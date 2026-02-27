"""Update command - Pull latest changes and update dependencies."""

import os
import subprocess
import sys

import click

from ..utils.config import PROJECT_ROOT
from ..utils.console import console, success, error, warning, info, header, create_progress, create_table


def run_command(cmd: list[str], description: str, cwd: str = None) -> tuple[bool, str]:
    """Run a command and return success status and output."""
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd or PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        return True, result.stdout.strip() or "OK"
    except subprocess.CalledProcessError as e:
        return False, e.stderr.strip() or str(e)
    except FileNotFoundError:
        return False, f"Command not found: {cmd[0]}"


@click.command()
@click.option("--skip-git", is_flag=True, help="Skip git pull")
@click.option("--skip-npm", is_flag=True, help="Skip npm install")
@click.option("--skip-pip", is_flag=True, help="Skip pip install")
@click.option("--skip-check", is_flag=True, help="Skip type checking")
def update(skip_git: bool, skip_npm: bool, skip_pip: bool, skip_check: bool) -> None:
    """Pull latest changes and update dependencies."""
    header("Opta Update")

    os.chdir(PROJECT_ROOT)
    results = []

    # Check for uncommitted changes
    info("Checking git status...")
    git_status = subprocess.run(
        ["git", "status", "--porcelain"],
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
    )
    if git_status.stdout.strip():
        warning("You have uncommitted changes!")
        console.print(git_status.stdout)
        if not click.confirm("Continue anyway?", default=False):
            info("Update cancelled")
            return

    with create_progress() as progress:
        # Git pull
        if not skip_git:
            task = progress.add_task("Pulling latest changes...", total=None)
            ok, output = run_command(["git", "pull", "--rebase"], "git pull")
            progress.remove_task(task)
            if ok:
                results.append(("Git pull", "OK"))
                success("Git pull complete")
            else:
                results.append(("Git pull", f"Failed: {output}"))
                error(f"Git pull failed: {output}")
        else:
            results.append(("Git pull", "Skipped"))

        # npm install
        if not skip_npm:
            task = progress.add_task("Installing npm dependencies...", total=None)
            ok, output = run_command(["npm", "install"], "npm install")
            progress.remove_task(task)
            if ok:
                results.append(("npm install", "OK"))
                success("npm install complete")
            else:
                results.append(("npm install", f"Failed: {output}"))
                error(f"npm install failed: {output}")
        else:
            results.append(("npm install", "Skipped"))

        # pip install for MCP server
        if not skip_pip:
            mcp_dir = PROJECT_ROOT / "mcp-server"
            if mcp_dir.exists():
                task = progress.add_task("Installing Python dependencies...", total=None)
                ok, output = run_command(
                    ["pip", "install", "-e", "."],
                    "pip install",
                    cwd=str(mcp_dir),
                )
                progress.remove_task(task)
                if ok:
                    results.append(("pip install", "OK"))
                    success("pip install complete")
                else:
                    results.append(("pip install", f"Failed: {output}"))
                    warning(f"pip install failed: {output}")
            else:
                results.append(("pip install", "mcp-server not found"))
        else:
            results.append(("pip install", "Skipped"))

        # Type check
        if not skip_check:
            task = progress.add_task("Running type check...", total=None)
            ok, output = run_command(["npx", "tsc", "--noEmit"], "type check")
            progress.remove_task(task)
            if ok:
                results.append(("Type check", "OK"))
                success("Type check passed")
            else:
                results.append(("Type check", "Errors found"))
                warning("Type check found errors (non-blocking)")
        else:
            results.append(("Type check", "Skipped"))

    # Print summary
    console.print()
    table = create_table("Update Summary", ["Step", "Result"])
    for step, result in results:
        table.add_row(step, result)
    console.print(table)

    console.print()
    success("Update complete!")
