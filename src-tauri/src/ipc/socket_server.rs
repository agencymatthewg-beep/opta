//! Unix socket server for streaming metrics to the Menu Bar.
//!
//! This module provides a high-performance Unix domain socket server
//! that streams FlatBuffer-serialized metrics to connected clients
//! (primarily the Swift Menu Bar extra).
//!
//! ## Protocol
//!
//! Messages are length-prefixed:
//! - 4 bytes: message length (big-endian u32)
//! - N bytes: FlatBuffer payload
//!
//! ## Platform
//!
//! Unix sockets are macOS/Linux only. Windows would need named pipes.

#[cfg(unix)]
use std::os::unix::net::{UnixListener, UnixStream};
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;

/// Socket path for metrics streaming.
/// Located in /tmp for simplicity; could use app-specific directory.
pub const SOCKET_PATH: &str = "/tmp/opta-metrics.sock";

/// Default update interval in milliseconds (25Hz = 40ms).
pub const UPDATE_INTERVAL_MS: u64 = 40;

/// Server for streaming metrics over Unix socket.
///
/// The server accepts a single client connection and streams
/// FlatBuffer-serialized metrics at a configurable rate.
pub struct MetricsSocketServer {
    /// Shutdown flag
    shutdown: Arc<AtomicBool>,
    /// Metrics data receiver
    metrics_rx: broadcast::Receiver<Vec<u8>>,
    /// Whether the server is running
    is_running: Arc<AtomicBool>,
}

impl MetricsSocketServer {
    /// Create a new socket server with the given metrics receiver.
    pub fn new(metrics_rx: broadcast::Receiver<Vec<u8>>) -> Self {
        Self {
            shutdown: Arc::new(AtomicBool::new(false)),
            metrics_rx,
            is_running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Start the socket server in a background thread.
    ///
    /// The server will:
    /// 1. Remove any existing socket file
    /// 2. Bind to the socket path
    /// 3. Accept client connections
    /// 4. Stream metrics data to connected clients
    #[cfg(unix)]
    pub fn start(&self) {
        if self.is_running.load(Ordering::SeqCst) {
            return;
        }

        let shutdown = self.shutdown.clone();
        let is_running = self.is_running.clone();
        let mut metrics_rx = self.metrics_rx.resubscribe();

        std::thread::spawn(move || {
            // Remove existing socket file
            let _ = std::fs::remove_file(SOCKET_PATH);

            // Bind to socket
            let listener = match UnixListener::bind(SOCKET_PATH) {
                Ok(l) => l,
                Err(e) => {
                    eprintln!("[opta-ipc] Failed to bind socket: {}", e);
                    return;
                }
            };

            // Set socket permissions (readable/writable by all)
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = std::fs::set_permissions(
                    SOCKET_PATH,
                    std::fs::Permissions::from_mode(0o666),
                );
            }

            // Set non-blocking for accept
            listener.set_nonblocking(true).ok();

            is_running.store(true, Ordering::SeqCst);
            println!("[opta-ipc] Socket server started at {}", SOCKET_PATH);

            while !shutdown.load(Ordering::SeqCst) {
                // Try to accept a new connection
                match listener.accept() {
                    Ok((stream, _addr)) => {
                        println!("[opta-ipc] Client connected");
                        Self::handle_client(stream, &mut metrics_rx, &shutdown);
                        println!("[opta-ipc] Client disconnected");
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        // No connection pending, sleep briefly
                        std::thread::sleep(Duration::from_millis(100));
                    }
                    Err(e) => {
                        eprintln!("[opta-ipc] Accept error: {}", e);
                        std::thread::sleep(Duration::from_millis(100));
                    }
                }
            }

            // Cleanup
            is_running.store(false, Ordering::SeqCst);
            let _ = std::fs::remove_file(SOCKET_PATH);
            println!("[opta-ipc] Socket server stopped");
        });
    }

    /// Handle a connected client by streaming metrics.
    #[cfg(unix)]
    fn handle_client(
        mut stream: UnixStream,
        metrics_rx: &mut broadcast::Receiver<Vec<u8>>,
        shutdown: &Arc<AtomicBool>,
    ) {
        // Set write timeout to avoid blocking forever
        stream.set_write_timeout(Some(Duration::from_millis(100))).ok();
        stream.set_nonblocking(false).ok();

        while !shutdown.load(Ordering::SeqCst) {
            match metrics_rx.try_recv() {
                Ok(data) => {
                    // Write length prefix (4 bytes, big-endian)
                    let len = (data.len() as u32).to_be_bytes();
                    if let Err(e) = stream.write_all(&len) {
                        eprintln!("[opta-ipc] Write length error: {}", e);
                        break;
                    }

                    // Write FlatBuffer payload
                    if let Err(e) = stream.write_all(&data) {
                        eprintln!("[opta-ipc] Write data error: {}", e);
                        break;
                    }
                }
                Err(broadcast::error::TryRecvError::Empty) => {
                    // No data available, sleep briefly
                    std::thread::sleep(Duration::from_millis(UPDATE_INTERVAL_MS));
                }
                Err(broadcast::error::TryRecvError::Lagged(n)) => {
                    // We fell behind, skip old messages
                    eprintln!("[opta-ipc] Lagged {} messages", n);
                }
                Err(broadcast::error::TryRecvError::Closed) => {
                    // Channel closed, exit
                    break;
                }
            }
        }
    }

    /// Stop the socket server.
    pub fn stop(&self) {
        self.shutdown.store(true, Ordering::SeqCst);
    }

    /// Check if the server is running.
    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    /// Get the socket path.
    pub fn socket_path(&self) -> &'static str {
        SOCKET_PATH
    }

    /// Non-Unix stub (Windows not supported yet)
    #[cfg(not(unix))]
    pub fn start(&self) {
        eprintln!("[opta-ipc] Unix sockets not supported on this platform");
    }

    #[cfg(not(unix))]
    fn handle_client(
        _stream: (),
        _metrics_rx: &mut broadcast::Receiver<Vec<u8>>,
        _shutdown: &Arc<AtomicBool>,
    ) {
        // No-op on non-Unix
    }
}

impl Drop for MetricsSocketServer {
    fn drop(&mut self) {
        self.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_socket_path() {
        assert_eq!(SOCKET_PATH, "/tmp/opta-metrics.sock");
    }

    #[test]
    fn test_update_interval() {
        // 40ms = 25Hz
        assert_eq!(UPDATE_INTERVAL_MS, 40);
        assert_eq!(1000 / UPDATE_INTERVAL_MS, 25);
    }

    #[test]
    fn test_server_creation() {
        let (_tx, rx) = broadcast::channel::<Vec<u8>>(16);
        let server = MetricsSocketServer::new(rx);
        assert!(!server.is_running());
    }
}
