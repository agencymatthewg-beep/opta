/// Shared platform-aware path helpers for the Opta config directory.
///
/// Both `daemon_ops` and `setup_wizard` write to the same config root — this
/// module is the single source of truth so they can never drift apart.
use std::path::PathBuf;

/// Return the platform-appropriate Opta config directory.
///
/// | Platform | Path |
/// |----------|------|
/// | macOS    | `$HOME/.config/opta` |
/// | Windows  | `%APPDATA%\opta` |
/// | Linux    | `$XDG_CONFIG_HOME/opta` or `$HOME/.config/opta` |
pub fn opta_config_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME env var not set".to_string())?;
        return Ok(PathBuf::from(home).join(".config").join("opta"));
    }

    #[cfg(target_os = "windows")]
    {
        let appdata =
            std::env::var("APPDATA").map_err(|_| "APPDATA env var not set".to_string())?;
        return Ok(PathBuf::from(appdata).join("opta"));
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME env var not set".to_string())?;
        let xdg = std::env::var("XDG_CONFIG_HOME")
            .unwrap_or_else(|_| format!("{}/.config", home));
        Ok(PathBuf::from(xdg).join("opta"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opta_config_dir_returns_ok() {
        // Verifies the function runs without panicking in the current environment.
        // The exact path is platform-specific but must always be a non-empty PathBuf.
        let dir = opta_config_dir().expect("opta_config_dir should not fail in a normal env");
        assert!(dir.ends_with("opta"), "path should end with 'opta', got: {dir:?}");
    }
}
