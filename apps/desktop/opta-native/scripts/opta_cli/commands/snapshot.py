"""Snapshot commands - Save and restore environment state."""

import json
import subprocess
from datetime import datetime

import click

from ..utils.config import PROJECT_ROOT, SNAPSHOT_DIR, REQUIRED_ENV_VARS
from ..utils.console import console, success, error, warning, info, header, create_table


def get_git_info() -> dict:
    """Get current git state."""
    try:
        branch = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT,
        ).stdout.strip()

        commit = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT,
        ).stdout.strip()

        dirty = bool(subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT,
        ).stdout.strip())

        return {
            "branch": branch,
            "commit": commit,
            "dirty": dirty,
        }
    except Exception:
        return {"branch": "unknown", "commit": "unknown", "dirty": True}


def get_versions() -> dict:
    """Get current tool versions."""
    versions = {}

    try:
        result = subprocess.run(["node", "--version"], capture_output=True, text=True)
        versions["node"] = result.stdout.strip()
    except Exception:
        versions["node"] = "unknown"

    try:
        result = subprocess.run(["npm", "--version"], capture_output=True, text=True)
        versions["npm"] = result.stdout.strip()
    except Exception:
        versions["npm"] = "unknown"

    try:
        result = subprocess.run(["python3", "--version"], capture_output=True, text=True)
        versions["python"] = result.stdout.strip().replace("Python ", "")
    except Exception:
        versions["python"] = "unknown"

    return versions


def get_env_keys() -> list[str]:
    """Get list of environment variable keys (not values)."""
    env_file = PROJECT_ROOT / ".env"
    if not env_file.exists():
        return []

    keys = []
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key = line.split("=", 1)[0].strip()
            keys.append(key)

    return keys


@click.command()
@click.argument("name")
def snap(name: str) -> None:
    """Create a snapshot of current environment state."""
    header(f"Creating Snapshot: {name}")

    # Ensure snapshot directory exists
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)

    snapshot_file = SNAPSHOT_DIR / f"{name}.json"

    if snapshot_file.exists():
        if not click.confirm(f"Snapshot '{name}' already exists. Overwrite?", default=False):
            info("Snapshot cancelled")
            return

    # Gather snapshot data
    info("Gathering environment state...")

    snapshot = {
        "name": name,
        "created": datetime.now().isoformat(),
        "git": get_git_info(),
        "versions": get_versions(),
        "env_keys": get_env_keys(),
    }

    # Save snapshot
    snapshot_file.write_text(json.dumps(snapshot, indent=2))

    # Display summary
    console.print()
    table = create_table(f"Snapshot: {name}", ["Property", "Value"])
    table.add_row("Created", snapshot["created"])
    table.add_row("Git branch", snapshot["git"]["branch"])
    table.add_row("Git commit", snapshot["git"]["commit"])
    table.add_row("Dirty", str(snapshot["git"]["dirty"]))
    table.add_row("Node", snapshot["versions"]["node"])
    table.add_row("npm", snapshot["versions"]["npm"])
    table.add_row("Python", snapshot["versions"]["python"])
    table.add_row("Env vars", ", ".join(snapshot["env_keys"]))
    console.print(table)

    console.print()
    success(f"Snapshot saved to {snapshot_file.relative_to(PROJECT_ROOT)}")


@click.command()
@click.argument("name")
@click.option("--start", is_flag=True, help="Start dev server after restore")
def restore(name: str, start: bool) -> None:
    """Restore environment from a snapshot."""
    header(f"Restoring Snapshot: {name}")

    snapshot_file = SNAPSHOT_DIR / f"{name}.json"

    if not snapshot_file.exists():
        error(f"Snapshot '{name}' not found")
        info(f"Available snapshots: {', '.join(s.stem for s in SNAPSHOT_DIR.glob('*.json'))}")
        return

    # Load snapshot
    snapshot = json.loads(snapshot_file.read_text())

    # Display snapshot info
    table = create_table(f"Snapshot: {name}", ["Property", "Value"])
    table.add_row("Created", snapshot["created"])
    table.add_row("Git branch", snapshot["git"]["branch"])
    table.add_row("Git commit", snapshot["git"]["commit"])
    console.print(table)

    # Check git state
    current_git = get_git_info()
    if current_git["branch"] != snapshot["git"]["branch"]:
        warning(f"Current branch ({current_git['branch']}) differs from snapshot ({snapshot['git']['branch']})")
    if current_git["commit"] != snapshot["git"]["commit"]:
        warning(f"Current commit ({current_git['commit']}) differs from snapshot ({snapshot['git']['commit']})")

    # Check env vars
    current_env_keys = get_env_keys()
    missing_keys = set(snapshot["env_keys"]) - set(current_env_keys)
    if missing_keys:
        warning(f"Missing env vars: {', '.join(missing_keys)}")

    # Confirm restore
    if not click.confirm("Proceed with restore (npm install + pip install)?", default=True):
        info("Restore cancelled")
        return

    # Run npm install
    info("Running npm install...")
    result = subprocess.run(["npm", "install"], cwd=PROJECT_ROOT)
    if result.returncode == 0:
        success("npm install complete")
    else:
        warning("npm install had issues")

    # Run pip install for MCP server
    mcp_dir = PROJECT_ROOT / "mcp-server"
    if mcp_dir.exists():
        info("Running pip install for MCP server...")
        result = subprocess.run(["pip", "install", "-e", "."], cwd=mcp_dir)
        if result.returncode == 0:
            success("pip install complete")
        else:
            warning("pip install had issues")

    success(f"Restore from '{name}' complete!")

    # Optionally start dev
    if start:
        console.print()
        info("Starting development server...")
        from .dev import dev
        ctx = click.Context(dev)
        ctx.invoke(dev)
