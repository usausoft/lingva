//! Browser-based OAuth authorization-code login with PKCE.
//!
//! The loopback callback binds only to `127.0.0.1`, validates a random state,
//! and exchanges the code directly with the configured identity provider.

use std::{
    collections::HashMap,
    path::Path,
    time::{Duration, Instant},
};

use anyhow::{Context, Result, bail};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::{Duration as ChronoDuration, Utc};
use rand::RngCore;
use reqwest::blocking::Client;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tiny_http::{Header, Response, Server};
use url::Url;

use crate::{
    api::LingvaApi,
    credentials::{self, Credentials},
};

pub const DEFAULT_PLATFORM_URL: &str = "https://lingva.dev";
pub const DEFAULT_AUTH_PORT: u16 = 53_682;
pub const DEFAULT_AUTH_SCOPES: &str = "openid email profile";

/// Inputs for an interactive browser login.
#[derive(Debug)]
pub struct LoginOptions<'a> {
    pub platform_url: &'a str,
    pub issuer_url: Option<&'a str>,
    pub authorize_url: Option<&'a str>,
    pub token_url: Option<&'a str>,
    pub client_id: Option<&'a str>,
    pub scopes: &'a str,
    pub port: u16,
    pub open_browser: bool,
    pub device: bool,
    pub device_url: Option<&'a str>,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    id_token: Option<String>,
    token_type: Option<String>,
    scope: Option<String>,
    expires_in: Option<i64>,
}

/// Authenticate and persist the resulting refreshable credential set.
pub fn login(
    api: &LingvaApi,
    options: LoginOptions<'_>,
    credentials_path: &Path,
) -> Result<Credentials> {
    // Explicit identity-provider options win. Otherwise the selected Lingva
    // deployment supplies its environment-specific issuer and public client.
    let discovery = if options.issuer_url.is_none()
        && options.authorize_url.is_none()
        && options.device_url.is_none()
    {
        Some(api.discover_auth(options.platform_url)?)
    } else {
        None
    };
    let issuer = options
        .issuer_url
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or_else(|| discovery.as_ref().map(|value| value.issuer_url.as_str()));
    let authorize_url = options.authorize_url.map(str::to_owned).or_else(|| {
        issuer.map(|value| format!("{}/oauth2/authorize", value.trim_end_matches('/')))
    });
    let token_url = options
        .token_url
        .map(str::to_owned)
        .or_else(|| issuer.map(|value| format!("{}/oauth2/token", value.trim_end_matches('/'))))
        .context(
            "Lingva auth login requires --issuer-url or both --authorize-url and --token-url.",
        )?;
    let client_id = options
        .client_id
        .map(str::to_owned)
        .or_else(|| discovery.as_ref().map(|value| value.client_id.clone()))
        .context("Lingva auth login requires --client-id when discovery is disabled.")?;
    if options.device {
        let device_url = options
            .device_url
            .map(str::to_owned)
            .or_else(|| {
                issuer.map(|issuer| {
                    format!(
                        "{}/oauth2/device_authorization",
                        issuer.trim_end_matches('/')
                    )
                })
            })
            .context("Device login requires --device-url or --issuer-url.")?;
        let tokens = device_login(
            &device_url,
            &token_url,
            &client_id,
            options.scopes,
            options.open_browser,
        )?;
        return store_tokens(tokens, client_id, token_url, &options, credentials_path);
    }
    let authorize_url =
        authorize_url.context("Browser login requires --authorize-url or --issuer-url.")?;

    // PKCE prevents an intercepted authorization code from being exchanged by
    // another process. State separately binds the callback to this invocation.
    let verifier = random_url_token(48);
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let expected_state = random_url_token(24);
    let server = Server::http(("127.0.0.1", options.port))
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let actual_port = server
        .server_addr()
        .to_ip()
        .map(|value| value.port())
        .unwrap_or(options.port);
    let redirect_uri = format!("http://127.0.0.1:{actual_port}/callback");
    let mut login_url = Url::parse(&authorize_url)?;
    login_url
        .query_pairs_mut()
        .append_pair("client_id", &client_id)
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("scope", options.scopes)
        .append_pair("state", &expected_state);
    println!("Open this URL to authenticate Lingva CLI:\n{login_url}\n");
    if options.open_browser {
        open::that(login_url.as_str())
            .context("Unable to open the browser for Lingva authentication.")?;
    }

    // Five minutes is long enough for normal SSO/MFA without leaving a
    // forgotten local listener alive indefinitely.
    let deadline = Instant::now() + Duration::from_secs(300);
    let request = loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        let request = server
            .recv_timeout(remaining)?
            .context("Lingva authentication callback timed out.")?;
        // Browsers may request favicons or preflight unrelated paths. These do
        // not consume the one state-bound callback or extend its deadline.
        let callback = Url::parse(&format!("http://127.0.0.1{}", request.url()))?;
        if request.method() == &tiny_http::Method::Get && callback.path() == "/callback" {
            break request;
        }
        request.respond(Response::empty(404))?;
    };
    let callback = Url::parse(&format!("http://127.0.0.1{}", request.url()))?;
    let query = callback
        .query_pairs()
        .into_owned()
        .collect::<HashMap<_, _>>();
    let valid = callback.query_pairs().count() == query.len()
        && query.get("state") == Some(&expected_state)
        && query.get("code").is_some_and(|value| !value.is_empty());
    let result = (|| {
        if !valid {
            bail!("Lingva authentication callback was invalid.");
        }
        let tokens = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?
            .post(&token_url)
            .form(&[
                ("client_id", client_id.as_str()),
                ("code", query["code"].as_str()),
                ("code_verifier", verifier.as_str()),
                ("grant_type", "authorization_code"),
                ("redirect_uri", redirect_uri.as_str()),
            ])
            .send()?
            .error_for_status()?
            .json::<TokenResponse>()?;
        store_tokens(tokens, client_id, token_url, &options, credentials_path)
    })();
    let (status, html) = if result.is_ok() {
        (
            200,
            "<h1>Lingva CLI is authenticated</h1><p>You can close this tab.</p>",
        )
    } else {
        (
            400,
            "<h1>Lingva CLI authentication failed</h1><p>Return to the terminal.</p>",
        )
    };
    // Token exchange and durable persistence determine success, not receipt of
    // a code. A browser disconnect must not discard persisted credentials.
    let _ = request.respond(
        Response::from_string(html)
            .with_status_code(status)
            .with_header(Header::from_bytes("content-type", "text/html; charset=utf-8").unwrap()),
    );
    result
}

fn store_tokens(
    tokens: TokenResponse,
    client_id: String,
    token_url: String,
    options: &LoginOptions<'_>,
    credentials_path: &Path,
) -> Result<Credentials> {
    if tokens.access_token.trim().is_empty() {
        bail!("Identity provider returned an empty access token.");
    }
    let now = Utc::now();
    let credentials = Credentials {
        access_token: Some(tokens.access_token),
        refresh_token: tokens.refresh_token,
        id_token: tokens.id_token,
        token_type: Some(tokens.token_type.unwrap_or_else(|| "Bearer".into())),
        scope: Some(tokens.scope.unwrap_or_else(|| options.scopes.into())),
        client_id: Some(client_id),
        token_url: Some(token_url),
        obtained_at: now.to_rfc3339(),
        expires_at: tokens
            .expires_in
            .map(|seconds| {
                now.checked_add_signed(
                    ChronoDuration::try_seconds(seconds).context("Invalid token lifetime.")?,
                )
                .context("Invalid token expiration.")
                .map(|expiration| expiration.to_rfc3339())
            })
            .transpose()?,
        platform_url: Some(options.platform_url.into()),
        ..Default::default()
    };
    credentials::save(credentials_path, &credentials)?;
    Ok(credentials)
}

#[derive(Deserialize)]
struct DeviceAuthorization {
    device_code: String,
    user_code: String,
    verification_uri: String,
    verification_uri_complete: Option<String>,
    expires_in: Option<u64>,
    interval: Option<u64>,
}

fn device_login(
    device_url: &str,
    token_url: &str,
    client_id: &str,
    scopes: &str,
    browser: bool,
) -> Result<TokenResponse> {
    const DEVICE_GRANT: &str = "urn:ietf:params:oauth:grant-type:device_code";
    const PENDING: &str = "authorization_pending";
    const SLOW_DOWN: &str = "slow_down";
    let client = Client::builder().timeout(Duration::from_secs(30)).build()?;
    let authorization = client
        .post(device_url)
        .form(&[("client_id", client_id), ("scope", scopes)])
        .send()?
        .error_for_status()?
        .json::<DeviceAuthorization>()?;
    if authorization.device_code.trim().is_empty() || authorization.user_code.trim().is_empty() {
        bail!("Invalid device authorization response.");
    }
    let url = authorization
        .verification_uri_complete
        .as_deref()
        .unwrap_or(&authorization.verification_uri);
    let verification = Url::parse(url)?;
    if !matches!(verification.scheme(), "https" | "http") {
        bail!("Device verification URI must use HTTP or HTTPS.");
    }
    println!("Open {url} and enter code {}.", authorization.user_code);
    if browser {
        open::that(url)?;
    }
    let expires = authorization.expires_in.unwrap_or(600).min(3600);
    let mut interval = authorization.interval.unwrap_or(5).clamp(1, 60);
    let start = Instant::now();
    while start.elapsed().as_secs() < expires {
        let delay = Duration::from_secs(interval);
        if start.elapsed().saturating_add(delay) > Duration::from_secs(expires) {
            break;
        }
        std::thread::sleep(delay);
        let response = client
            .post(token_url)
            .form(&[
                ("client_id", client_id),
                ("device_code", authorization.device_code.as_str()),
                ("grant_type", DEVICE_GRANT),
            ])
            .send()?;
        let status = response.status();
        let payload = response.json::<serde_json::Value>()?;
        if status.is_success() && payload.get("access_token").is_some() {
            return Ok(serde_json::from_value(payload)?);
        }
        match payload.get("error").and_then(serde_json::Value::as_str) {
            Some(PENDING) => {}
            Some(SLOW_DOWN) => interval = (interval + 5).min(60),
            _ => bail!(
                "Device authorization failed: {}",
                payload
                    .get("error_description")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or("identity provider rejected the request")
            ),
        }
    }
    bail!("Lingva device authorization expired.")
}

fn random_url_token(size: usize) -> String {
    let mut bytes = vec![0; size];
    rand::rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn random_tokens_are_url_safe_have_expected_size_and_do_not_repeat() {
        let first = random_url_token(48);
        let second = random_url_token(48);
        assert_eq!(first.len(), 64);
        assert_ne!(first, second);
        assert!(
            first
                .chars()
                .all(|value| value.is_ascii_alphanumeric() || matches!(value, '-' | '_'))
        );
    }

    #[test]
    fn default_auth_contract_is_explicit() {
        assert_eq!(DEFAULT_PLATFORM_URL, "https://lingva.dev");
        assert!(
            DEFAULT_AUTH_SCOPES
                .split_whitespace()
                .all(|scope| { matches!(scope, "openid" | "email" | "profile") })
        );
    }
}
