"""Dev command - Start Opta development environment."""

import os
import signal
import subprocess
import sys

import click

from ..utils.config import PROJECT_ROOT, PORTS
from ..utils.console import console, success, error, warning, info, header, create_progress
from ..utils.process import (
    kill_opta_processes,
    check_prerequisites,
    is_port_in_use,
    wait_for_port_ready,
)


@click.command()
@click.option("--web", is_flag=True, help="Run frontend only (browser mode)")
@click.option("--skip-checks", is_flag=True, help="Skip prerequisite checks")
def dev(web: bool, skip_checks: bool) -> None:
    """Start Opta development environment."""
    header("Opta Development Server")

    # Change to project directory
    os.chdir(PROJECT_ROOT)

    # Check prerequisites
    if not skip_checks:
        with create_progress() as progress:
            task = progress.add_task("Checking prerequisites...", total=None)
            checks = check_prerequisites()

        if not checks.get("env_file"):
            warning(".env file not found")
            info("Cloud LLM features will be disabled")
            info("To enable: cp .env.example .env && add your ANTHROPIC_API_KEY")
            console.print()

        if not checks.get("npm"):
            error("npm not found! Please install Node.js")
            sys.exit(1)

        if not checks.get("node_modules"):
            warning("node_modules not found. Running npm install...")
            subprocess.run(["npm", "install"], check=True)
            success("Dependencies installed")

        success("Prerequisites OK")

    # Kill any existing processes
    if is_port_in_use(PORTS["vite"]):
        warning(f"Port {PORTS['vite']} in use. Killing existing processes...")
        killed = kill_opta_processes(verbose=False)
        if killed > 0:
            info(f"Killed {killed} process(es)")

    # Start the appropriate dev server
    console.print()
    if web:
        info("Starting frontend only (browser mode)...")
        info(f"Open http://localhost:{PORTS['vite']} in your browser")
        cmd = ["npm", "run", "dev:web"]
    else:
        info("Starting Tauri desktop app...")
        cmd = ["npm", "run", "dev:app"]

    console.print()

    # Handle Ctrl+C gracefully
    def signal_handler(sig, frame):
        console.print()
        warning("Shutting down...")
        kill_opta_processes(verbose=False)
        success("Development server stopped")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        # Run the dev server
        process = subprocess.Popen(
            cmd,
            cwd=PROJECT_ROOT,
            stdout=sys.stdout,
            stderr=sys.stderr,
        )
        process.wait()
    except KeyboardInterrupt:
        signal_handler(None, None)
    except Exception as e:
        error(f"Failed to start: {e}")
        sys.exit(1)
