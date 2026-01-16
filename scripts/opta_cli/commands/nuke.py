"""Nuke command - Kill processes and clean build artifacts."""

import shutil

import click

from ..utils.config import PROJECT_ROOT, CLEAN_DIRS, DEEP_CLEAN_DIRS, PORTS
from ..utils.console import console, success, error, warning, info, header, create_table
from ..utils.process import kill_opta_processes, is_port_in_use


@click.command()
@click.option("--deep", is_flag=True, help="Also clean node_modules and .venv")
@click.option("--keep-deps", is_flag=True, help="Only kill processes, keep build cache")
def nuke(deep: bool, keep_deps: bool) -> None:
    """Kill all Opta processes and clean build artifacts."""
    header("Opta Nuke")

    results = []

    # Kill processes
    info("Killing Opta processes...")
    killed = kill_opta_processes(verbose=True)
    results.append(("Processes killed", str(killed)))

    # Check ports are free
    ports_freed = []
    for name, port in PORTS.items():
        if not is_port_in_use(port):
            ports_freed.append(f"{name}:{port}")
    results.append(("Ports freed", ", ".join(ports_freed) if ports_freed else "None"))

    if not keep_deps:
        # Clean build artifacts
        info("Cleaning build artifacts...")
        for name, path in CLEAN_DIRS.items():
            if path.exists():
                try:
                    shutil.rmtree(path)
                    results.append((f"Removed {name}", str(path.relative_to(PROJECT_ROOT))))
                    success(f"Removed {path.relative_to(PROJECT_ROOT)}")
                except Exception as e:
                    results.append((f"Failed {name}", str(e)))
                    warning(f"Could not remove {path}: {e}")
            else:
                results.append((f"{name}", "Not found (skipped)"))

        # Deep clean if requested
        if deep:
            warning("Deep clean: removing node_modules and .venv...")
            for name, path in DEEP_CLEAN_DIRS.items():
                if path.exists():
                    try:
                        shutil.rmtree(path)
                        results.append((f"Removed {name}", str(path.relative_to(PROJECT_ROOT))))
                        success(f"Removed {path.relative_to(PROJECT_ROOT)}")
                    except Exception as e:
                        results.append((f"Failed {name}", str(e)))
                        warning(f"Could not remove {path}: {e}")

    # Print summary table
    console.print()
    table = create_table("Nuke Summary", ["Action", "Result"])
    for action, result in results:
        table.add_row(action, result)
    console.print(table)

    console.print()
    success("Nuke complete!")
