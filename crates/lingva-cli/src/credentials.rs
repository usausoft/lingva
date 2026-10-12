//! Credential persistence and OAuth token refresh.
//!
//! Credentials are shared by every CLI distribution adapter. Raw secrets are
//! never printed; only an intentionally lossy API-key preview reaches output.

use std::{
    fs,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result, bail};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[cfg(all(unix, test))]
use std::os::unix::fs::PermissionsExt;

/// On-disk credentials contract stored at `~/.lingva/credentials.json`.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Credentials {
    pub access_token: Option<String>,
    pub api_key: Option<String>,
    pub api_key_preview: Option<String>,
    pub api_url: Option<String>,
    pub client_id: Option<String>,
    pub expires_at: Option<String>,
    pub id_token: Option<String>,
    pub obtained_at: String,
    pub platform_url: Option<String>,
    pub refresh_token: Option<String>,
    pub scope: Option<String>,
    pub project_id: Option<String>,
    pub token_type: Option<String>,
    pub token_url: Option<String>,
}

/// Return the per-user credentials file without creating it.
pub fn default_path() -> Result<PathBuf> {
    // Windows known-folder lookup ignores USERPROFILE. Honor a non-empty
    // process override so isolated shells and parallel contract tests cannot
    // read or overwrite another user's credential store. Fall back to the
    // native profile when no override is supplied, as Unix does for HOME.
    #[cfg(windows)]
    let home = std::env::var_os("USERPROFILE")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .or_else(dirs::home_dir);
    #[cfg(not(windows))]
    let home = dirs::home_dir();
    home.map(|home| home.join(".lingva/credentials.json"))
        .context("Cannot resolve the home directory for Lingva credentials.")
}

/// Load credentials, treating a missing file as an unauthenticated session.
pub fn load(path: &Path) -> Result<Option<Credentials>> {
    if !path.exists() {
        return Ok(None);
    }
    let source = fs::read_to_string(path)?;
    Ok(Some(serde_json::from_str(&source).with_context(|| {
        format!("Lingva credentials file \"{}\" is invalid.", path.display())
    })?))
}

/// Persist private credentials by atomic replacement.
///
/// Unix permissions are restricted before secret bytes enter the staging file.
pub fn save(path: &Path, credentials: &Credentials) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    crate::atomic_file::write(
        path,
        format!("{}\n", serde_json::to_string_pretty(credentials)?),
        true,
    )?;
    Ok(())
}

/// Remove credentials. Logout is intentionally idempotent.
pub fn clear(path: &Path) -> Result<()> {
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}

/// Select a currently usable access token, then fall back to an API key.
pub fn token(credentials: Option<&Credentials>) -> Option<String> {
    let credentials = credentials?;
    let access_valid = credentials
        .access_token
        .as_ref()
        .is_some_and(|value| !value.trim().is_empty())
        && credentials.expires_at.as_ref().is_none_or(|value| {
            DateTime::parse_from_rfc3339(value).is_ok_and(|expires| {
                expires.with_timezone(&Utc) > Utc::now() + Duration::minutes(1)
            })
        });
    if access_valid {
        return credentials.access_token.clone();
    }
    credentials
        .api_key
        .clone()
        .filter(|value| !value.is_empty())
}

/// Return a usable token, refreshing OAuth credentials when necessary.
///
/// The refreshed response is persisted before it is returned so subsequent
/// commands observe the same token and expiry.
pub fn resolve_token(path: &Path) -> Result<Option<String>> {
    let Some(mut credentials) = load(path)? else {
        return Ok(None);
    };
    if let Some(value) = token(Some(&credentials)) {
        return Ok(Some(value));
    }
    let Some(refresh_token) = credentials.refresh_token.as_deref() else {
        return Ok(None);
    };
    let token_url = credentials
        .token_url
        .as_deref()
        .context("Lingva auth refresh requires a token URL.")?;
    let client_id = credentials
        .client_id
        .as_deref()
        .context("Lingva auth refresh requires a client ID.")?;
    let response = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?
        .post(token_url)
        .form(&[
            ("client_id", client_id),
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
        ])
        .send()?;
    let status = response.status();
    let body = response.json::<Value>()?;
    let access_token = body
        .get("access_token")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty());
    if !status.is_success() || access_token.is_none() {
        bail!(
            "{}",
            body.get("error_description")
                .and_then(Value::as_str)
                .unwrap_or("Lingva auth refresh failed.")
        );
    }
    let now = Utc::now();
    credentials.access_token = access_token.map(str::to_owned);
    credentials.obtained_at = now.to_rfc3339();
    credentials.expires_at = body
        .get("expires_in")
        .and_then(Value::as_i64)
        .map(|seconds| (now + Duration::seconds(seconds)).to_rfc3339());
    credentials.id_token = body
        .get("id_token")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .or(credentials.id_token);
    credentials.refresh_token = body
        .get("refresh_token")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .or(credentials.refresh_token);
    credentials.scope = body
        .get("scope")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .or(credentials.scope);
    credentials.token_type = body
        .get("token_type")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .or(credentials.token_type);
    save(path, &credentials)?;
    Ok(credentials.access_token)
}

/// Replace OAuth credentials with a project API key for local or CI use.
pub fn store_api_key(
    path: &Path,
    api_key: &str,
    api_url: Option<String>,
    project_id: Option<String>,
) -> Result<Credentials> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        bail!("Lingva auth use-key requires a non-empty --api-key value.");
    }
    // Work in characters rather than bytes: a malformed/non-ASCII key must
    // produce a safe preview instead of panicking at a UTF-8 boundary.
    let characters = api_key.chars().collect::<Vec<_>>();
    let preview = if characters.len() > 12 {
        format!(
            "{}...{}",
            characters[..8].iter().collect::<String>(),
            characters[characters.len() - 4..]
                .iter()
                .collect::<String>()
        )
    } else {
        "stored-key".into()
    };
    let credentials = Credentials {
        api_key: Some(api_key.into()),
        api_key_preview: Some(preview),
        api_url: api_url.filter(|value| !value.trim().is_empty()),
        project_id: project_id.filter(|value| !value.trim().is_empty()),
        obtained_at: Utc::now().to_rfc3339(),
        ..Default::default()
    };
    save(path, &credentials)?;
    Ok(credentials)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{sync::mpsc, thread};
    use tiny_http::{Header, Response, Server, StatusCode};

    fn credentials(
        access_token: Option<&str>,
        expires_at: Option<String>,
        api_key: Option<&str>,
    ) -> Credentials {
        Credentials {
            access_token: access_token.map(str::to_owned),
            expires_at,
            api_key: api_key.map(str::to_owned),
            obtained_at: Utc::now().to_rfc3339(),
            ..Default::default()
        }
    }

    fn token_server(status: u16, body: &str) -> (String, mpsc::Receiver<String>) {
        let server = Server::http("127.0.0.1:0").unwrap();
        let url = format!("http://{}/token", server.server_addr());
        let body = body.to_owned();
        let (sender, receiver) = mpsc::channel();
        thread::spawn(move || {
            let mut request = server.recv().unwrap();
            let mut request_body = String::new();
            request
                .as_reader()
                .read_to_string(&mut request_body)
                .unwrap();
            let _ = sender.send(request_body);
            request
                .respond(
                    Response::from_string(body)
                        .with_status_code(StatusCode(status))
                        .with_header(
                            Header::from_bytes("content-type", "application/json").unwrap(),
                        ),
                )
                .unwrap();
        });
        (url, receiver)
    }

    #[test]
    fn token_prefers_valid_access_token_and_uses_api_key_for_expired_token() {
        let future = (Utc::now() + Duration::minutes(10)).to_rfc3339();
        let expired = (Utc::now() - Duration::minutes(10)).to_rfc3339();
        assert_eq!(
            token(Some(&credentials(Some("oauth"), Some(future), Some("key")))),
            Some("oauth".into())
        );
        assert_eq!(
            token(Some(&credentials(
                Some("oauth"),
                Some(expired),
                Some("key")
            ))),
            Some("key".into())
        );
    }

    #[test]
    fn token_rejects_empty_or_malformed_access_tokens() {
        assert_eq!(
            token(Some(&credentials(Some("  "), None, Some("key")))),
            Some("key".into())
        );
        assert_eq!(
            token(Some(&credentials(
                Some("oauth"),
                Some("not-a-date".into()),
                None
            ))),
            None
        );
    }

    #[test]
    fn save_load_and_clear_are_idempotent() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("nested/credentials.json");
        let value = credentials(Some("oauth"), None, None);
        assert!(load(&path).unwrap().is_none());
        save(&path, &value).unwrap();
        assert_eq!(
            load(&path).unwrap().unwrap().access_token.as_deref(),
            Some("oauth")
        );
        clear(&path).unwrap();
        clear(&path).unwrap();
        assert!(!path.exists());
    }

    #[cfg(unix)]
    #[test]
    fn save_restricts_unix_permissions() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("credentials.json");
        save(&path, &credentials(Some("oauth"), None, None)).unwrap();
        assert_eq!(
            fs::metadata(path).unwrap().permissions().mode() & 0o777,
            0o600
        );
    }

    #[test]
    fn api_key_storage_validates_and_masks_ascii_or_unicode_values() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("credentials.json");
        assert!(store_api_key(&path, "  ", None, None).is_err());

        let short = store_api_key(&path, "short", None, None).unwrap();
        assert_eq!(short.api_key_preview.as_deref(), Some("stored-key"));

        let unicode = store_api_key(&path, "абвгдежзийклмнопр", None, None).unwrap();
        assert_eq!(unicode.api_key_preview.as_deref(), Some("абвгдежз...нопр"));
        assert_eq!(unicode.api_key.as_deref(), Some("абвгдежзийклмнопр"));
    }

    #[test]
    fn invalid_credentials_file_reports_its_path() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("credentials.json");
        fs::write(&path, "not-json").unwrap();
        let error = load(&path).unwrap_err();
        assert!(error.to_string().contains("credentials.json"));
    }

    #[test]
    fn expired_oauth_token_refreshes_and_persists_rotated_values() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("credentials.json");
        let (token_url, request_body) = token_server(
            200,
            r#"{"access_token":"fresh","refresh_token":"rotated","id_token":"identity","token_type":"Bearer","scope":"openid","expires_in":3600}"#,
        );
        let mut value = credentials(
            Some("expired"),
            Some((Utc::now() - Duration::minutes(2)).to_rfc3339()),
            None,
        );
        value.client_id = Some("client".into());
        value.refresh_token = Some("refresh".into());
        value.token_url = Some(token_url);
        save(&path, &value).unwrap();

        assert_eq!(resolve_token(&path).unwrap(), Some("fresh".into()));
        let form = request_body.recv().unwrap();
        assert!(form.contains("grant_type=refresh_token"));
        assert!(form.contains("refresh_token=refresh"));
        let saved = load(&path).unwrap().unwrap();
        assert_eq!(saved.refresh_token.as_deref(), Some("rotated"));
        assert_eq!(saved.id_token.as_deref(), Some("identity"));
        assert!(token(Some(&saved)).is_some());
    }

    #[test]
    fn refresh_surfaces_provider_error_and_keeps_existing_credentials() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("credentials.json");
        let (token_url, _) = token_server(
            400,
            r#"{"error":"invalid_grant","error_description":"Refresh token expired"}"#,
        );
        let mut value = credentials(
            Some("expired"),
            Some((Utc::now() - Duration::minutes(2)).to_rfc3339()),
            None,
        );
        value.client_id = Some("client".into());
        value.refresh_token = Some("refresh".into());
        value.token_url = Some(token_url);
        save(&path, &value).unwrap();

        let error = resolve_token(&path).unwrap_err();
        assert!(error.to_string().contains("Refresh token expired"));
        assert_eq!(
            load(&path).unwrap().unwrap().access_token.as_deref(),
            Some("expired")
        );
    }
}
