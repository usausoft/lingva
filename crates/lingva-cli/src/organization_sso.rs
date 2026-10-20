//! Owns native-account organization SSO verification for the customer CLI.
//!
//! The platform binds assurance to the existing access token and organization.
//! Browser confirmation must use the same native account. No provider token or
//! new credential is persisted or merged here; existing credentials remain the
//! only authentication source. API keys have no user-session fallback. Polling
//! is read-only and retries never create memberships or restore revoked access.

use crate::{api::LingvaApi, credentials};
use anyhow::{Context, Result, bail};
use serde_json::json;
use std::{
    path::Path,
    thread,
    time::{Duration, Instant},
};
use url::Url;

fn platform_url(value: &str) -> Result<Url> {
    let url = Url::parse(value)?;
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    if (url.scheme() != "https" && !(local && url.scheme() == "http"))
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || !matches!(url.path(), "" | "/")
    {
        bail!("Organization SSO requires an HTTPS platform origin (HTTP is allowed on loopback).");
    }
    Ok(url)
}

pub fn verify(
    path: &Path,
    organization_id: &str,
    platform: Option<&str>,
    open_browser: bool,
    timeout_seconds: u64,
) -> Result<()> {
    if organization_id.len() < 3
        || organization_id.len() > 64
        || !organization_id
            .bytes()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'_' || c == b'-')
        || !organization_id.as_bytes()[0].is_ascii_alphanumeric()
    {
        bail!("Organization ID is invalid.");
    }
    if !(1..=600).contains(&timeout_seconds) {
        bail!("SSO timeout must be between 1 and 600 seconds.");
    }
    let token = credentials::resolve_token(path)?
        .context("Run lingva auth login before organization SSO.")?;
    let stored =
        credentials::load(path)?.context("Run lingva auth login before organization SSO.")?;
    if stored.access_token.as_deref() != Some(token.as_str()) {
        bail!(
            "Organization SSO requires native account login. Project API keys do not represent user sessions."
        );
    }
    let base = platform_url(
        platform
            .or(stored.platform_url.as_deref())
            .context("The platform URL is missing.")?,
    )?;
    let endpoint = base.join("api/cli/organizations/sso")?;
    let api = LingvaApi::new()?;
    let request = api.post_json(
        endpoint.as_str(),
        &json!({ "action": "request", "organizationId": organization_id }),
        Some(&token),
    )?;
    let authorization = Url::parse(
        request["authorizationUrl"]
            .as_str()
            .context("SSO response has no browser URL.")?,
    )?;
    if authorization.origin() != base.origin() || authorization.path() != "/app/organizations/sso" {
        bail!("SSO response points outside the configured platform.");
    }
    println!(
        "Open this URL and confirm organization SSO using the same native account:\n{authorization}\n"
    );
    if open_browser {
        open::that(authorization.as_str())
            .context("Could not open the browser; open the displayed URL manually.")?;
    }
    let started = Instant::now();
    loop {
        let status = api.post_json(
            endpoint.as_str(),
            &json!({ "action": "status", "organizationId": organization_id }),
            Some(&token),
        )?;
        if status["verified"].as_bool() == Some(true) {
            println!("Organization SSO verified for this CLI access token.");
            return Ok(());
        }
        if started.elapsed() >= Duration::from_secs(timeout_seconds) {
            bail!("Organization SSO timed out. Start a new verification request.");
        }
        thread::sleep(Duration::from_secs(2));
    }
}

#[cfg(test)]
mod tests {
    use super::platform_url;
    #[test]
    fn platform_origin_never_sends_native_tokens_to_an_insecure_remote_or_embedded_identity() {
        for url in [
            "http://platform.example",
            "https://user:pass@platform.example",
            "https://platform.example/path",
            "https://platform.example?target=other",
        ] {
            assert!(platform_url(url).is_err(), "{url}");
        }
        assert!(platform_url("https://platform.example").is_ok());
        assert!(platform_url("http://127.0.0.1:3000").is_ok());
    }
}
