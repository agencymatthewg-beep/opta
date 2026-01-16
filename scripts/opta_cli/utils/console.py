"""Rich console utilities for beautiful terminal output."""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.theme import Theme

# Custom theme with Opta colors (purple accent)
opta_theme = Theme({
    "info": "cyan",
    "warning": "yellow",
    "error": "red bold",
    "success": "green",
    "accent": "magenta",
})

# Global console instance
console = Console(theme=opta_theme)


def success(message: str) -> None:
    """Print a success message."""
    console.print(f"[success][bold]\u2714[/bold] {message}[/success]")


def error(message: str) -> None:
    """Print an error message."""
    console.print(f"[error][bold]\u2718[/bold] {message}[/error]")


def warning(message: str) -> None:
    """Print a warning message."""
    console.print(f"[warning][bold]\u26a0[/bold] {message}[/warning]")


def info(message: str) -> None:
    """Print an info message."""
    console.print(f"[info][bold]\u2139[/bold] {message}[/info]")


def header(title: str) -> None:
    """Print a styled header."""
    console.print()
    console.print(Panel(f"[magenta bold]{title}[/magenta bold]", expand=False))
    console.print()


def create_table(title: str, columns: list[str]) -> Table:
    """Create a styled table."""
    table = Table(title=title, show_header=True, header_style="bold magenta")
    for col in columns:
        table.add_column(col)
    return table


def create_progress() -> Progress:
    """Create a progress bar with spinner."""
    return Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    )
