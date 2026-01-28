"""Main CLI entry point for Opta."""

import click

from . import __version__
from .commands import dev, nuke, update, snap, restore


LOGO = """
[magenta]
  ██████╗ ██████╗ ████████╗ █████╗
 ██╔═══██╗██╔══██╗╚══██╔══╝██╔══██╗
 ██║   ██║██████╔╝   ██║   ███████║
 ██║   ██║██╔═══╝    ██║   ██╔══██║
 ╚██████╔╝██║        ██║   ██║  ██║
  ╚═════╝ ╚═╝        ╚═╝   ╚═╝  ╚═╝
[/magenta]
"""


@click.group()
@click.version_option(version=__version__, prog_name="opta")
@click.pass_context
def cli(ctx: click.Context) -> None:
    """Opta CLI - Development environment manager.

    Manage your Opta development workflow with simple commands.

    \b
    Examples:
      opta dev          Start the Tauri desktop app
      opta dev --web    Start frontend only (browser)
      opta nuke         Kill processes and clean builds
      opta update       Pull and install dependencies
      opta snap backup  Create environment snapshot
      opta restore backup  Restore from snapshot
    """
    pass


# Register commands
cli.add_command(dev)
cli.add_command(nuke)
cli.add_command(update)
cli.add_command(snap)
cli.add_command(restore)


def main() -> None:
    """Main entry point."""
    cli()


if __name__ == "__main__":
    main()
