//! Synchronous hosted-platform transport for the standalone CLI.
//!
//! Network shapes live here so command orchestration never hand-builds HTTP.
//! Project API keys are sent through both supported authentication headers;
//! OAuth bearer tokens ignore the API-key header server-side.

use std::collections::BTreeMap;

use anyhow::{Context, Result, bail};
use reqwest::blocking::{Client, Response};
use reqwest::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE, HeaderMap, HeaderValue};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};

use crate::{config::Config, local::Dictionary};

const JSON_MEDIA_TYPE: &str = "application/json";
const API_KEY_HEADER: &str = "x-api-key";
const REVISION_HEADER: &str = "x-lingva-revision";
const PUBLISH_ACTION: &str = "publish";
const INVALIDATE_ACTION: &str = "invalidate";

/// OAuth discovery values exposed by the Lingva web application.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthDiscovery {
    pub issuer_url: String,
    pub client_id: String,
}

/// Publish endpoint attached to one hosted project environment.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformEnvironment {
    pub environment_id: String,
    pub publish_api_url: Option<String>,
}

/// Project summary returned to interactive `lingva init`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformProject {
    pub project_id: String,
    pub name: String,
    pub locales: Vec<String>,
    pub default_locale: String,
    #[serde(default)]
    pub environments: Vec<PlatformEnvironment>,
}

#[derive(Debug, Deserialize)]
struct ProjectList {
    projects: Vec<PlatformProject>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PushPayload {
    action: &'static str,
    manifest: Value,
    bundles: BTreeMap<String, Value>,
    mutation_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    base_revision: Option<Option<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct InvalidatePayload<'a> {
    action: &'static str,
    project_id: &'a str,
    environment: &'a str,
    source: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<&'a str>,
}

/// Reusable hosted HTTP client with a stable product user-agent.
pub struct LingvaApi {
    client: Client,
}

impl LingvaApi {
    /// Build the TLS client used by all hosted commands.
    pub fn new() -> Result<Self> {
        Ok(Self {
            client: Client::builder()
                .user_agent(format!("lingva/{}", env!("CARGO_PKG_VERSION")))
                .connect_timeout(std::time::Duration::from_secs(10))
                .timeout(std::time::Duration::from_secs(60))
                .build()?,
        })
    }

    /// Discover OAuth issuer/client metadata from a platform deployment.
    pub fn discover_auth(&self, platform_url: &str) -> Result<AuthDiscovery> {
        self.get_json(
            &format!("{}/api/cli/config", platform_url.trim_end_matches('/')),
            None,
        )
    }

    /// List projects visible to the authenticated platform user.
    pub fn list_projects(
        &self,
        platform_url: &str,
        access_token: &str,
    ) -> Result<Vec<PlatformProject>> {
        Ok(self
            .get_json::<ProjectList>(
                &format!("{}/api/cli/projects", platform_url.trim_end_matches('/')),
                Some(access_token),
            )?
            .projects)
    }

    /// Download one locale bundle and its optimistic concurrency revision.
    pub fn pull_bundle(
        &self,
        config: &Config,
        locale: &str,
        token: Option<&str>,
    ) -> Result<(Value, String)> {
        let base = config
            .api_url
            .as_deref()
            .context("Lingva pull requires \"apiUrl\" in lingva.config.yaml.")?;
        // Identity is data, never URL syntax. Keep any deployment base path
        // and encode each segment so slashes/query characters cannot reroute.
        let mut url = reqwest::Url::parse(base)?;
        url.set_query(None);
        url.set_fragment(None);
        url.path_segments_mut()
            .map_err(|_| anyhow::anyhow!("Lingva API URL cannot contain bundle paths."))?
            .pop_if_empty()
            .extend([
                "bundles",
                &config.project_id,
                &config.environment,
                "latest",
                &format!("{locale}.bundle.json"),
            ]);
        let response = self.request(self.client.get(url), token)?.send()?;
        let response = ensure_success(response)?;
        let revision = response
            .headers()
            .get(REVISION_HEADER)
            .and_then(|value| value.to_str().ok())
            .context("Lingva hosted pull response has no revision header.")?
            .to_owned();
        Ok((response.json()?, revision))
    }

    /// Build and upload locale bundles as one idempotent publish mutation.
    pub fn push(
        &self,
        config: &Config,
        locales: &[String],
        token: Option<&str>,
        base_revision: Option<String>,
        force: bool,
        include_metadata: bool,
    ) -> Result<(Value, BTreeMap<String, Dictionary>)> {
        let api_url = config
            .api_url
            .as_deref()
            .context("Lingva push requires \"apiUrl\" in lingva.config.yaml.")?;
        // Read every configured locale because requested bundles may need
        // fallback/default values outside the subset being published.
        let project = crate::project::Project::from_config(config.clone())?;
        let generated_at = chrono::Utc::now().to_rfc3339();
        let mut bundles = BTreeMap::new();
        for locale in locales {
            let mut bundle = project.bundle(locale, include_metadata)?;
            bundle["generatedAt"] = json!(generated_at);
            bundles.insert(locale.clone(), bundle);
        }
        let descriptors = locales.iter().map(|locale| json!({
            "locale": locale,
            "fileName": format!("{locale}.bundle.json"),
            "keyCount": bundles[locale]["keyCount"],
            "fallbackKeyCount": bundles[locale]["fallbackKeys"].as_array().map_or(0, Vec::len),
        })).collect::<Vec<_>>();
        let manifest = json!({
            "projectId": config.project_id,
            "environment": config.environment,
            "defaultLocale": config.default_locale,
            "fallbackLocale": config.fallback_locale,
            "generatedAt": generated_at,
            "locales": locales,
            "bundles": descriptors,
        });
        // Timestamps are intentionally excluded from this digest, making a
        // retry of the same semantic content idempotent at the API boundary.
        let mutation_id = mutation_id(&manifest, &bundles)?;
        let payload = PushPayload {
            action: PUBLISH_ACTION,
            manifest,
            bundles,
            mutation_id,
            base_revision: (!force).then_some(base_revision),
        };
        let response = self
            .request(self.client.post(api_url).json(&payload), token)?
            .send()?;
        let result = ensure_success(response)?.json()?;
        Ok((result, project.resources))
    }

    /// Invalidate hosted delivery after a confirmed publish when requested.
    pub fn invalidate(
        &self,
        config: &Config,
        token: Option<&str>,
        source: &str,
        reason: Option<&str>,
    ) -> Result<Value> {
        let api_url = config
            .api_url
            .as_deref()
            .context("Lingva invalidation requires \"apiUrl\" in lingva.config.yaml.")?;
        let payload = InvalidatePayload {
            action: INVALIDATE_ACTION,
            project_id: &config.project_id,
            environment: &config.environment,
            source,
            reason: reason.filter(|value| !value.trim().is_empty()),
        };
        let response = self
            .request(self.client.post(api_url).json(&payload), token)?
            .send()?;
        Ok(ensure_success(response)?.json()?)
    }

    fn get_json<T: DeserializeOwned>(&self, url: &str, token: Option<&str>) -> Result<T> {
        let response = self.request(self.client.get(url), token)?.send()?;
        Ok(ensure_success(response)?.json()?)
    }

    /// Send an authoring action through the same authenticated transport.
    pub fn post_json(&self, url: &str, payload: &Value, token: Option<&str>) -> Result<Value> {
        let response = self
            .request(self.client.post(url).json(payload), token)?
            .send()?;
        Ok(ensure_success(response)?.json()?)
    }

    fn request(
        &self,
        request: reqwest::blocking::RequestBuilder,
        token: Option<&str>,
    ) -> Result<reqwest::blocking::RequestBuilder> {
        let mut headers = HeaderMap::new();
        headers.insert(ACCEPT, HeaderValue::from_static(JSON_MEDIA_TYPE));
        headers.insert(CONTENT_TYPE, HeaderValue::from_static(JSON_MEDIA_TYPE));
        if let Some(token) = token {
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {token}"))?,
            );
            headers.insert(API_KEY_HEADER, HeaderValue::from_str(token)?);
        }
        Ok(request.headers(headers))
    }
}

fn ensure_success(response: Response) -> Result<Response> {
    if response.status().is_success() {
        return Ok(response);
    }
    let status = response.status();
    let detail = response.text().unwrap_or_default();
    bail!(
        "Lingva hosted request failed with HTTP {}{}",
        status.as_u16(),
        if detail.trim().is_empty() {
            ".".into()
        } else {
            format!(": {}", detail.trim())
        }
    );
}

fn mutation_id(manifest: &Value, bundles: &BTreeMap<String, Value>) -> Result<String> {
    let mut semantic_manifest = manifest.clone();
    semantic_manifest
        .as_object_mut()
        .map(|object| object.remove("generatedAt"));
    let semantic_bundles = bundles
        .iter()
        .map(|(locale, bundle)| {
            let mut bundle = bundle.clone();
            bundle
                .as_object_mut()
                .map(|object| object.remove("generatedAt"));
            (locale.clone(), canonicalize(bundle))
        })
        .collect::<BTreeMap<_, _>>();
    let canonical =
        canonicalize(json!({"manifest": semantic_manifest, "bundles": semantic_bundles}));
    Ok(format!(
        "sha256:{:x}",
        Sha256::digest(serde_json::to_vec(&canonical)?)
    ))
}

fn canonicalize(value: Value) -> Value {
    match value {
        Value::Object(object) => Value::Object(
            object
                .into_iter()
                .map(|(key, value)| (key, canonicalize(value)))
                .collect::<BTreeMap<_, _>>()
                .into_iter()
                .collect::<Map<_, _>>(),
        ),
        Value::Array(items) => Value::Array(items.into_iter().map(canonicalize).collect()),
        value => value,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        sync::mpsc::{self, Receiver},
        thread,
    };
    use tiny_http::{Header, Response as TinyResponse, Server, StatusCode};

    #[derive(Debug)]
    struct CapturedRequest {
        method: String,
        url: String,
        headers: BTreeMap<String, String>,
        body: String,
    }

    fn serve_once(
        status: u16,
        headers: &[(&str, &str)],
        body: &str,
    ) -> (String, Receiver<CapturedRequest>) {
        let server = Server::http("127.0.0.1:0").unwrap();
        let address = format!("http://{}", server.server_addr());
        let response_headers = headers
            .iter()
            .map(|(name, value)| Header::from_bytes(*name, *value).unwrap())
            .collect::<Vec<_>>();
        let body = body.to_owned();
        let (sender, receiver) = mpsc::channel();
        thread::spawn(move || {
            let mut request = server.recv().unwrap();
            let mut request_body = String::new();
            request
                .as_reader()
                .read_to_string(&mut request_body)
                .unwrap();
            // Some tests only care about the response and intentionally drop
            // the receiver; that must not prevent the mock from responding.
            let _ = sender.send(CapturedRequest {
                method: request.method().to_string(),
                url: request.url().to_owned(),
                headers: request
                    .headers()
                    .iter()
                    .map(|header| {
                        (
                            header.field.as_str().to_ascii_lowercase().to_string(),
                            header.value.as_str().to_owned(),
                        )
                    })
                    .collect(),
                body: request_body,
            });
            let mut response = TinyResponse::from_string(body).with_status_code(StatusCode(status));
            for header in response_headers {
                response = response.with_header(header);
            }
            request.respond(response).unwrap();
        });
        (address, receiver)
    }

    fn test_config(root: &std::path::Path, api_url: String) -> Config {
        Config {
            path: root.join("lingva.config.yaml"),
            project_id: "demo".into(),
            environment: "stage".into(),
            locales: vec!["en".into()],
            default_locale: "en".into(),
            fallback_locale: "en".into(),
            translation_files: ".lingva/translations/{locale}.json".into(),
            api_url: Some(api_url),
            api_key: None,
            settings: Default::default(),
        }
    }

    #[test]
    fn mutation_ignores_generated_at() {
        let left = mutation_id(
            &json!({"generatedAt":"one","projectId":"p"}),
            &BTreeMap::from([(
                "en".into(),
                json!({"generatedAt":"one","messages":{"a":"A"}}),
            )]),
        )
        .unwrap();
        let right = mutation_id(
            &json!({"generatedAt":"two","projectId":"p"}),
            &BTreeMap::from([(
                "en".into(),
                json!({"generatedAt":"two","messages":{"a":"A"}}),
            )]),
        )
        .unwrap();
        assert_eq!(left, right);
    }

    #[test]
    fn mutation_is_stable_across_object_order_and_changes_with_content() {
        let first = mutation_id(
            &json!({"projectId":"p","defaultLocale":"en"}),
            &BTreeMap::from([("en".into(), json!({"messages":{"b":"B","a":"A"}}))]),
        )
        .unwrap();
        let reordered = mutation_id(
            &json!({"defaultLocale":"en","projectId":"p"}),
            &BTreeMap::from([("en".into(), json!({"messages":{"a":"A","b":"B"}}))]),
        )
        .unwrap();
        let changed = mutation_id(
            &json!({"projectId":"p","defaultLocale":"en"}),
            &BTreeMap::from([("en".into(), json!({"messages":{"a":"changed","b":"B"}}))]),
        )
        .unwrap();
        assert_eq!(first, reordered);
        assert_ne!(first, changed);
        assert!(first.starts_with("sha256:"));
    }

    #[test]
    fn project_listing_sends_bearer_and_api_key_headers() {
        let (base, captured) = serve_once(
            200,
            &[("content-type", "application/json")],
            r#"{"projects":[{"projectId":"demo","name":"Demo","locales":["en"],"defaultLocale":"en","environments":[]}]}"#,
        );
        let projects = LingvaApi::new()
            .unwrap()
            .list_projects(&base, "secret")
            .unwrap();
        assert_eq!(projects[0].project_id, "demo");
        let request = captured.recv().unwrap();
        assert_eq!(request.method, "GET");
        assert_eq!(request.url, "/api/cli/projects");
        assert_eq!(request.headers["authorization"], "Bearer secret");
        assert_eq!(request.headers[API_KEY_HEADER], "secret");
    }

    #[test]
    fn pull_requires_revision_and_uses_the_hosted_bundle_path() {
        let root = tempfile::tempdir().unwrap();
        let (base, captured) = serve_once(
            200,
            &[
                ("content-type", "application/json"),
                (REVISION_HEADER, "revision-1"),
            ],
            r#"{"messages":{"title":"Title"}}"#,
        );
        let (bundle, revision) = LingvaApi::new()
            .unwrap()
            .pull_bundle(&test_config(root.path(), base), "en", None)
            .unwrap();
        assert_eq!(bundle["messages"]["title"], "Title");
        assert_eq!(revision, "revision-1");
        assert_eq!(
            captured.recv().unwrap().url,
            "/bundles/demo/stage/latest/en.bundle.json"
        );

        let (base, _) = serve_once(
            200,
            &[("content-type", "application/json")],
            r#"{"messages":{}}"#,
        );
        let error = LingvaApi::new()
            .unwrap()
            .pull_bundle(&test_config(root.path(), base), "en", None)
            .unwrap_err();
        assert!(error.to_string().contains("no revision header"));
    }

    #[test]
    fn push_sends_idempotency_and_optimistic_revision_fields() {
        let root = tempfile::tempdir().unwrap();
        let (base, captured) = serve_once(
            200,
            &[("content-type", "application/json")],
            r#"{"publishId":"revision-2"}"#,
        );
        let config = test_config(root.path(), base);
        let translation_path = config.translation_path("en");
        fs::create_dir_all(translation_path.parent().unwrap()).unwrap();
        fs::write(translation_path, r#"{"title":"Hello"}"#).unwrap();
        LingvaApi::new()
            .unwrap()
            .push(
                &config,
                &["en".into()],
                Some("secret"),
                Some("revision-1".into()),
                false,
                true,
            )
            .unwrap();
        let request = captured.recv().unwrap();
        assert_eq!(request.method, "POST");
        let payload: Value = serde_json::from_str(&request.body).unwrap();
        assert_eq!(payload["action"], PUBLISH_ACTION);
        assert_eq!(payload["baseRevision"], "revision-1");
        assert!(
            payload["mutationId"]
                .as_str()
                .unwrap()
                .starts_with("sha256:")
        );
        assert_eq!(payload["bundles"]["en"]["messages"]["title"], "Hello");
    }

    #[test]
    fn hosted_errors_include_status_and_response_detail() {
        let (base, _) = serve_once(
            409,
            &[("content-type", "application/json")],
            r#"{"error":"revision conflict"}"#,
        );
        let error = LingvaApi::new().unwrap().discover_auth(&base).unwrap_err();
        let message = error.to_string();
        assert!(message.contains("HTTP 409"));
        assert!(message.contains("revision conflict"));
    }

    #[test]
    fn invalidation_uses_project_environment_and_optional_reason() {
        let root = tempfile::tempdir().unwrap();
        let (base, captured) = serve_once(
            200,
            &[("content-type", "application/json")],
            r#"{"invalidationId":"invalidate-1"}"#,
        );
        let config = test_config(root.path(), base);
        let response = LingvaApi::new()
            .unwrap()
            .invalidate(
                &config,
                Some("secret"),
                "repository",
                Some(" after publish "),
            )
            .unwrap();
        assert_eq!(response["invalidationId"], "invalidate-1");
        let request = captured.recv().unwrap();
        let payload: Value = serde_json::from_str(&request.body).unwrap();
        assert_eq!(payload["action"], INVALIDATE_ACTION);
        assert_eq!(payload["projectId"], "demo");
        assert_eq!(payload["environment"], "stage");
        assert_eq!(payload["source"], "repository");
        assert_eq!(payload["reason"], " after publish ");
    }
}
