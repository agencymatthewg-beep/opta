//! SQLite Database Manager
//!
//! Persistent storage implementation using rusqlite for Opta.
//! Handles user settings, telemetry history, and optimization records.

use rusqlite::{Connection, Result as SqlResult, params};
use std::path::Path;

/// Schema SQL embedded at compile time
const SCHEMA: &str = include_str!("schema.sql");

/// Telemetry record retrieved from the database
#[derive(Debug, Clone)]
pub struct TelemetryRecord {
    /// Unix timestamp in milliseconds
    pub timestamp: i64,
    /// CPU usage percentage (0-100)
    pub cpu_usage: f32,
    /// Memory usage percentage (0-100)
    pub memory_usage: f32,
    /// GPU usage percentage (0-100), if available
    pub gpu_usage: Option<f32>,
    /// Temperature in Celsius, if available
    pub temperature: Option<f32>,
}

/// Optimization record retrieved from the database
#[derive(Debug, Clone)]
pub struct OptimizationRecord {
    /// Record ID
    pub id: i64,
    /// Unix timestamp in milliseconds
    pub timestamp: i64,
    /// Score before optimization
    pub score_before: i32,
    /// Score after optimization
    pub score_after: i32,
    /// Serialized actions (JSON blob)
    pub actions: Vec<u8>,
    /// Result description
    pub result: String,
}

/// SQLite database manager for Opta persistence
pub struct Database {
    conn: Connection,
}

impl Database {
    /// Open a database at the specified path with WAL mode enabled.
    ///
    /// Creates the database file if it doesn't exist and runs migrations.
    ///
    /// # Arguments
    ///
    /// * `path` - Path to the SQLite database file
    ///
    /// # Example
    ///
    /// ```no_run
    /// use opta_core::storage::Database;
    /// let db = Database::open("opta.db").unwrap();
    /// ```
    pub fn open<P: AsRef<Path>>(path: P) -> SqlResult<Self> {
        let conn = Connection::open(path)?;

        // Enable WAL mode for better concurrent read performance
        conn.execute_batch("PRAGMA journal_mode=WAL;")?;

        // Enable foreign keys
        conn.execute_batch("PRAGMA foreign_keys=ON;")?;

        let mut db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    /// Open an in-memory database for testing.
    ///
    /// The database is initialized with the schema but data is not persisted.
    ///
    /// # Example
    ///
    /// ```
    /// use opta_core::storage::Database;
    /// let db = Database::open_in_memory().unwrap();
    /// ```
    pub fn open_in_memory() -> SqlResult<Self> {
        let conn = Connection::open_in_memory()?;
        let mut db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    /// Run database migrations to ensure schema is up to date.
    ///
    /// Currently runs the full schema.sql which uses CREATE IF NOT EXISTS.
    /// Future versions may track migration versions for incremental updates.
    pub fn migrate(&mut self) -> SqlResult<()> {
        self.conn.execute_batch(SCHEMA)?;
        Ok(())
    }

    /// Save a setting value.
    ///
    /// # Arguments
    ///
    /// * `key` - Setting key (unique identifier)
    /// * `value` - Binary value to store (typically JSON-serialized)
    ///
    /// # Example
    ///
    /// ```
    /// use opta_core::storage::Database;
    /// let db = Database::open_in_memory().unwrap();
    /// db.save_setting("theme", b"{\"dark\": true}").unwrap();
    /// ```
    pub fn save_setting(&self, key: &str, value: &[u8]) -> SqlResult<()> {
        let timestamp = current_timestamp();
        self.conn.execute(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
            params![key, value, timestamp],
        )?;
        Ok(())
    }

    /// Load a setting value by key.
    ///
    /// # Arguments
    ///
    /// * `key` - Setting key to retrieve
    ///
    /// # Returns
    ///
    /// The stored binary value, or None if the key doesn't exist.
    ///
    /// # Example
    ///
    /// ```
    /// use opta_core::storage::Database;
    /// let db = Database::open_in_memory().unwrap();
    /// db.save_setting("theme", b"dark").unwrap();
    /// let value = db.load_setting("theme").unwrap();
    /// assert_eq!(value, Some(b"dark".to_vec()));
    /// ```
    pub fn load_setting(&self, key: &str) -> SqlResult<Option<Vec<u8>>> {
        let mut stmt = self.conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let result = stmt.query_row(params![key], |row| row.get::<_, Vec<u8>>(0));

        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Delete a setting by key.
    ///
    /// # Arguments
    ///
    /// * `key` - Setting key to delete
    ///
    /// # Returns
    ///
    /// True if a setting was deleted, false if the key didn't exist.
    pub fn delete_setting(&self, key: &str) -> SqlResult<bool> {
        let affected = self.conn.execute("DELETE FROM settings WHERE key = ?1", params![key])?;
        Ok(affected > 0)
    }

    /// Record an optimization event.
    ///
    /// # Arguments
    ///
    /// * `score_before` - System score before optimization
    /// * `score_after` - System score after optimization
    /// * `actions` - Serialized actions taken (JSON blob)
    /// * `result` - Result description (e.g., "success", "partial", "failed")
    ///
    /// # Returns
    ///
    /// The ID of the newly created record.
    ///
    /// # Example
    ///
    /// ```
    /// use opta_core::storage::Database;
    /// let db = Database::open_in_memory().unwrap();
    /// let id = db.record_optimization(75, 92, b"[\"closed_apps\"]", "success").unwrap();
    /// assert!(id > 0);
    /// ```
    pub fn record_optimization(
        &self,
        score_before: i32,
        score_after: i32,
        actions: &[u8],
        result: &str,
    ) -> SqlResult<i64> {
        let timestamp = current_timestamp();
        self.conn.execute(
            "INSERT INTO optimizations (timestamp, score_before, score_after, actions, result)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![timestamp, score_before, score_after, actions, result],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// Get optimization history.
    ///
    /// # Arguments
    ///
    /// * `limit` - Maximum number of records to return
    ///
    /// # Returns
    ///
    /// A vector of optimization records, ordered by timestamp descending (newest first).
    pub fn get_optimization_history(&self, limit: usize) -> SqlResult<Vec<OptimizationRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, timestamp, score_before, score_after, actions, result
             FROM optimizations
             ORDER BY timestamp DESC
             LIMIT ?1"
        )?;

        let records = stmt.query_map(params![limit as i64], |row| {
            Ok(OptimizationRecord {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                score_before: row.get(2)?,
                score_after: row.get(3)?,
                actions: row.get(4)?,
                result: row.get(5)?,
            })
        })?;

        records.collect()
    }

    /// Record a telemetry snapshot.
    ///
    /// # Arguments
    ///
    /// * `cpu` - CPU usage percentage (0-100)
    /// * `memory` - Memory usage percentage (0-100)
    /// * `gpu` - GPU usage percentage (0-100), optional
    /// * `temperature` - Temperature in Celsius, optional
    ///
    /// # Example
    ///
    /// ```
    /// use opta_core::storage::Database;
    /// let db = Database::open_in_memory().unwrap();
    /// db.record_telemetry(45.5, 62.3, Some(30.0), Some(58.5)).unwrap();
    /// ```
    pub fn record_telemetry(
        &self,
        cpu: f32,
        memory: f32,
        gpu: Option<f32>,
        temperature: Option<f32>,
    ) -> SqlResult<()> {
        let timestamp = current_timestamp();
        self.conn.execute(
            "INSERT INTO telemetry_history (timestamp, cpu_usage, memory_usage, gpu_usage, temperature)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![timestamp, cpu, memory, gpu, temperature],
        )?;
        Ok(())
    }

    /// Get telemetry history.
    ///
    /// # Arguments
    ///
    /// * `limit` - Maximum number of records to return
    ///
    /// # Returns
    ///
    /// A vector of telemetry records, ordered by timestamp descending (newest first).
    ///
    /// # Example
    ///
    /// ```
    /// use opta_core::storage::Database;
    /// let db = Database::open_in_memory().unwrap();
    /// db.record_telemetry(45.5, 62.3, Some(30.0), Some(58.5)).unwrap();
    /// let history = db.get_telemetry_history(10).unwrap();
    /// assert_eq!(history.len(), 1);
    /// ```
    pub fn get_telemetry_history(&self, limit: usize) -> SqlResult<Vec<TelemetryRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT timestamp, cpu_usage, memory_usage, gpu_usage, temperature
             FROM telemetry_history
             ORDER BY timestamp DESC
             LIMIT ?1"
        )?;

        let records = stmt.query_map(params![limit as i64], |row| {
            Ok(TelemetryRecord {
                timestamp: row.get(0)?,
                cpu_usage: row.get(1)?,
                memory_usage: row.get(2)?,
                gpu_usage: row.get(3)?,
                temperature: row.get(4)?,
            })
        })?;

        records.collect()
    }

    /// Prune old telemetry records.
    ///
    /// Removes telemetry records older than the specified number of days.
    ///
    /// # Arguments
    ///
    /// * `days_to_keep` - Number of days of history to retain
    ///
    /// # Returns
    ///
    /// The number of records deleted.
    ///
    /// # Example
    ///
    /// ```
    /// use opta_core::storage::Database;
    /// let db = Database::open_in_memory().unwrap();
    /// let deleted = db.prune_telemetry(7).unwrap();  // Keep last 7 days
    /// ```
    pub fn prune_telemetry(&self, days_to_keep: u32) -> SqlResult<usize> {
        let cutoff = current_timestamp() - (days_to_keep as i64 * 24 * 60 * 60 * 1000);
        let deleted = self.conn.execute(
            "DELETE FROM telemetry_history WHERE timestamp < ?1",
            params![cutoff],
        )?;
        Ok(deleted)
    }

    /// Prune old optimization records.
    ///
    /// Removes optimization records older than the specified number of days.
    ///
    /// # Arguments
    ///
    /// * `days_to_keep` - Number of days of history to retain
    ///
    /// # Returns
    ///
    /// The number of records deleted.
    pub fn prune_optimizations(&self, days_to_keep: u32) -> SqlResult<usize> {
        let cutoff = current_timestamp() - (days_to_keep as i64 * 24 * 60 * 60 * 1000);
        let deleted = self.conn.execute(
            "DELETE FROM optimizations WHERE timestamp < ?1",
            params![cutoff],
        )?;
        Ok(deleted)
    }

    /// Get database statistics.
    ///
    /// # Returns
    ///
    /// A tuple of (settings_count, optimizations_count, telemetry_count).
    pub fn get_stats(&self) -> SqlResult<(usize, usize, usize)> {
        let settings: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM settings", [], |row| row.get(0)
        )?;
        let optimizations: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM optimizations", [], |row| row.get(0)
        )?;
        let telemetry: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM telemetry_history", [], |row| row.get(0)
        )?;
        Ok((settings as usize, optimizations as usize, telemetry as usize))
    }
}

/// Get current Unix timestamp in milliseconds.
fn current_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_open() {
        let db = Database::open_in_memory();
        assert!(db.is_ok(), "Failed to open in-memory database");
    }

    #[test]
    fn test_settings_save_and_load() {
        let db = Database::open_in_memory().unwrap();

        // Save a setting
        let value = b"test_value";
        db.save_setting("test_key", value).unwrap();

        // Load the setting
        let loaded = db.load_setting("test_key").unwrap();
        assert_eq!(loaded, Some(value.to_vec()));

        // Load non-existent setting
        let missing = db.load_setting("missing_key").unwrap();
        assert_eq!(missing, None);
    }

    #[test]
    fn test_settings_update() {
        let db = Database::open_in_memory().unwrap();

        // Save initial value
        db.save_setting("key", b"value1").unwrap();
        assert_eq!(db.load_setting("key").unwrap(), Some(b"value1".to_vec()));

        // Update value
        db.save_setting("key", b"value2").unwrap();
        assert_eq!(db.load_setting("key").unwrap(), Some(b"value2".to_vec()));
    }

    #[test]
    fn test_settings_delete() {
        let db = Database::open_in_memory().unwrap();

        db.save_setting("key", b"value").unwrap();
        assert!(db.delete_setting("key").unwrap());
        assert_eq!(db.load_setting("key").unwrap(), None);

        // Delete non-existent key returns false
        assert!(!db.delete_setting("missing").unwrap());
    }

    #[test]
    fn test_telemetry_record_and_retrieve() {
        let db = Database::open_in_memory().unwrap();

        // Record telemetry
        db.record_telemetry(45.5, 62.3, Some(30.0), Some(58.5)).unwrap();
        db.record_telemetry(50.0, 70.0, None, None).unwrap();

        // Retrieve history
        let history = db.get_telemetry_history(10).unwrap();
        assert_eq!(history.len(), 2);

        // Most recent should be first
        assert_eq!(history[0].cpu_usage, 50.0);
        assert_eq!(history[0].gpu_usage, None);

        assert_eq!(history[1].cpu_usage, 45.5);
        assert_eq!(history[1].gpu_usage, Some(30.0));
    }

    #[test]
    fn test_telemetry_limit() {
        let db = Database::open_in_memory().unwrap();

        // Record more than limit
        for i in 0..10 {
            db.record_telemetry(i as f32, i as f32, None, None).unwrap();
        }

        // Retrieve with limit
        let history = db.get_telemetry_history(5).unwrap();
        assert_eq!(history.len(), 5);
    }

    #[test]
    fn test_optimization_record() {
        let db = Database::open_in_memory().unwrap();

        let actions = b"[\"close_app\", \"clear_cache\"]";
        let id = db.record_optimization(75, 92, actions, "success").unwrap();
        assert!(id > 0);

        let history = db.get_optimization_history(10).unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].score_before, 75);
        assert_eq!(history[0].score_after, 92);
        assert_eq!(history[0].result, "success");
    }

    #[test]
    fn test_prune_telemetry() {
        let db = Database::open_in_memory().unwrap();

        // Record telemetry
        db.record_telemetry(50.0, 60.0, None, None).unwrap();

        // Prune with future cutoff (0 days) should delete recent records
        // But since we just added them, 0 days means "delete older than now"
        // which should keep the new record
        let deleted = db.prune_telemetry(0).unwrap();
        assert_eq!(deleted, 0); // Just-added record should not be deleted with 0 days

        // Verify record still exists
        let history = db.get_telemetry_history(10).unwrap();
        assert_eq!(history.len(), 1);
    }

    #[test]
    fn test_database_stats() {
        let db = Database::open_in_memory().unwrap();

        // Initially empty
        let (settings, opts, telem) = db.get_stats().unwrap();
        assert_eq!(settings, 0);
        assert_eq!(opts, 0);
        assert_eq!(telem, 0);

        // Add some data
        db.save_setting("k1", b"v1").unwrap();
        db.save_setting("k2", b"v2").unwrap();
        db.record_optimization(50, 80, b"[]", "success").unwrap();
        db.record_telemetry(50.0, 60.0, None, None).unwrap();
        db.record_telemetry(55.0, 65.0, None, None).unwrap();
        db.record_telemetry(60.0, 70.0, None, None).unwrap();

        let (settings, opts, telem) = db.get_stats().unwrap();
        assert_eq!(settings, 2);
        assert_eq!(opts, 1);
        assert_eq!(telem, 3);
    }

    #[test]
    fn test_binary_data_preservation() {
        let db = Database::open_in_memory().unwrap();

        // Test with various binary data including null bytes
        let binary_data: &[u8] = &[0x00, 0x01, 0xFF, 0xFE, 0x00, 0xAB];
        db.save_setting("binary", binary_data).unwrap();

        let loaded = db.load_setting("binary").unwrap().unwrap();
        assert_eq!(loaded, binary_data);
    }

    #[test]
    fn test_json_settings() {
        let db = Database::open_in_memory().unwrap();

        // Simulate storing JSON settings
        let json = r#"{"theme":"dark","scale":1.5,"notifications":true}"#;
        db.save_setting("ui_settings", json.as_bytes()).unwrap();

        let loaded = db.load_setting("ui_settings").unwrap().unwrap();
        let loaded_str = String::from_utf8(loaded).unwrap();
        assert_eq!(loaded_str, json);
    }
}
