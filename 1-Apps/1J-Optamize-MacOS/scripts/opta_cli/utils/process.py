"""Process management utilities for Opta CLI."""

import socket
import time
import subprocess
import psutil

from .config import PORTS, PROCESS_PATTERNS
from .console import console, success, warning, info


def is_port_in_use(port: int) -> bool:
    """Check if a port is currently in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("localhost", port)) == 0


def wait_for_port(port: int, timeout: float = 10.0, check_interval: float = 0.5) -> bool:
    """Wait for a port to become available (not in use)."""
    start = time.time()
    while time.time() - start < timeout:
        if not is_port_in_use(port):
            return True
        time.sleep(check_interval)
    return False


def wait_for_port_ready(port: int, timeout: float = 30.0, check_interval: float = 0.5) -> bool:
    """Wait for a port to become ready (in use - server started)."""
    start = time.time()
    while time.time() - start < timeout:
        if is_port_in_use(port):
            return True
        time.sleep(check_interval)
    return False


def find_opta_processes() -> list[psutil.Process]:
    """Find all Opta-related processes."""
    import os
    current_pid = os.getpid()
    parent_pid = os.getppid()

    opta_processes = []
    # Match tauri/vite dev processes, but not our own CLI
    patterns = ["tauri", "vite"]

    for proc in psutil.process_iter(["pid", "name", "cmdline"]):
        try:
            pid = proc.info["pid"]
            # Skip our own process and parent
            if pid == current_pid or pid == parent_pid:
                continue

            name = proc.info["name"].lower() if proc.info["name"] else ""
            cmdline = " ".join(proc.info["cmdline"] or []).lower()

            # Skip the opta CLI itself
            if "opta_cli" in cmdline or "scripts/opta" in cmdline:
                continue

            for pattern in patterns:
                if pattern in name or pattern in cmdline:
                    opta_processes.append(proc)
                    break
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    return opta_processes


def kill_opta_processes(verbose: bool = True) -> int:
    """Kill all Opta-related processes. Returns count of killed processes."""
    killed = 0
    processes = find_opta_processes()

    for proc in processes:
        try:
            pid = proc.pid
            name = proc.name()

            # Try graceful termination first
            proc.terminate()
            try:
                proc.wait(timeout=2)
            except psutil.TimeoutExpired:
                # Force kill if it doesn't respond
                proc.kill()

            killed += 1
            if verbose:
                info(f"Killed {name} (PID: {pid})")

        except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
            if verbose:
                warning(f"Could not kill process: {e}")

    # Also kill by port if needed
    for port_name, port in PORTS.items():
        if is_port_in_use(port):
            try:
                # Use lsof to find process on port
                result = subprocess.run(
                    ["lsof", "-ti", f":{port}"],
                    capture_output=True,
                    text=True
                )
                if result.stdout.strip():
                    for pid in result.stdout.strip().split("\n"):
                        subprocess.run(["kill", "-9", pid], capture_output=True)
                        killed += 1
                        if verbose:
                            info(f"Killed process on port {port} (PID: {pid})")
            except Exception:
                pass

    return killed


def check_prerequisites() -> dict[str, bool]:
    """Check if all prerequisites are met for development."""
    from .config import PROJECT_ROOT, REQUIRED_ENV_VARS

    checks = {}

    # Check .env file
    env_file = PROJECT_ROOT / ".env"
    checks["env_file"] = env_file.exists()

    # Check required env vars
    if checks["env_file"]:
        env_content = env_file.read_text()
        for var in REQUIRED_ENV_VARS:
            checks[f"env_{var}"] = var in env_content

    # Check node_modules
    checks["node_modules"] = (PROJECT_ROOT / "node_modules").exists()

    # Check npm
    try:
        subprocess.run(["npm", "--version"], capture_output=True, check=True)
        checks["npm"] = True
    except (subprocess.CalledProcessError, FileNotFoundError):
        checks["npm"] = False

    return checks
