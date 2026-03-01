use keyring::{Entry, Error};

const SERVICE_NAME: &str = "com.opta.code.desktop";

fn account_key(host: &str, port: u16) -> String {
    format!("daemon:{host}:{port}")
}

fn entry_for(host: &str, port: u16) -> Result<Entry, String> {
    Entry::new(SERVICE_NAME, &account_key(host, port))
        .map_err(|error| format!("Unable to create secure store entry: {error}"))
}

#[tauri::command]
pub fn set_connection_secret(host: String, port: u16, token: String) -> Result<(), String> {
    let entry = entry_for(&host, port)?;
    entry
        .set_password(&token)
        .map_err(|error| format!("Unable to save connection secret: {error}"))
}

#[tauri::command]
pub fn get_connection_secret(host: String, port: u16) -> Result<Option<String>, String> {
    let entry = entry_for(&host, port)?;
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Unable to read connection secret: {error}")),
    }
}

#[tauri::command]
pub fn delete_connection_secret(host: String, port: u16) -> Result<(), String> {
    let entry = entry_for(&host, port)?;
    match entry.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Unable to delete connection secret: {error}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn connection_secrets_uses_stable_account_key_format() {
        assert_eq!(account_key("localhost", 8080), "daemon:localhost:8080");
    }

    #[test]
    fn connection_secrets_missing_secret_returns_ok_none() {
        let host = format!("missing-connection-secret-{}", std::process::id());
        let port = 65534;

        // Ignore cleanup errors for the precondition step.
        let _ = delete_connection_secret(host.clone(), port);

        let secret = get_connection_secret(host, port).expect("lookup should not error");
        assert_eq!(secret, None);
    }
}
