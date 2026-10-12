//! Black-box contract tests for the published `lingva` executable.
//!
//! Unit tests cover algorithms; this suite proves clap parsing, exit codes,
//! filesystem effects, and hosted HTTP seams through the real binary.

use std::{
    collections::BTreeMap,
    fs,
    process::Command,
    sync::mpsc::{self, Receiver},
    thread,
};

use serde_json::Value;
use tiny_http::{Header, Response, Server, StatusCode};

fn lingva(root: &std::path::Path) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_lingva"));
    command.current_dir(root);
    // Child-only isolation works with Unix HOME and Windows USERPROFILE.
    // Contract tests must never read the developer's real credential store.
    command.env("HOME", root.join("home"));
    command.env("USERPROFILE", root.join("home"));
    command
}

#[derive(Debug)]
struct CapturedRequest {
    method: String,
    url: String,
    headers: BTreeMap<String, String>,
    body: String,
}

/// A deterministic response script consumed by the sequential mock server.
type MockResponse = (u16, Vec<(&'static str, &'static str)>, &'static str);

/// Start a one-request server so black-box tests never depend on Lingva SaaS.
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
        // Dropping the capture receiver is valid for response-only tests.
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
        let mut response = Response::from_string(body).with_status_code(StatusCode(status));
        for header in response_headers {
            response = response.with_header(header);
        }
        request.respond(response).unwrap();
    });
    (address, receiver)
}

fn serve_sequence(responses: Vec<MockResponse>) -> (String, Receiver<CapturedRequest>) {
    let server = Server::http("127.0.0.1:0").unwrap();
    let address = format!("http://{}", server.server_addr());
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        for (status, headers, body) in responses {
            let mut request = server.recv().unwrap();
            let mut request_body = String::new();
            request
                .as_reader()
                .read_to_string(&mut request_body)
                .unwrap();
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
            let mut response = Response::from_string(body).with_status_code(StatusCode(status));
            for (name, value) in headers {
                response = response.with_header(Header::from_bytes(name, value).unwrap());
            }
            request.respond(response).unwrap();
        }
    });
    (address, receiver)
}

fn write_remote_config(root: &std::path::Path, api_url: &str, locales: &str) {
    fs::write(
        root.join("lingva.config.yaml"),
        format!(
            "projectId: demo\nenvironment: stage\nlocales: [{locales}]\ndefaultLocale: en\nfallbackLocale: en\ntranslationFiles: .lingva/translations/{{locale}}.json\napiUrl: {api_url}\n"
        ),
    )
    .unwrap();
}

#[test]
fn help_exposes_the_portable_customer_surface() {
    let root = tempfile::tempdir().unwrap();
    let output = lingva(root.path()).arg("--help").output().unwrap();
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(output.status.success());
    let commands = stdout
        .split("Commands:\n")
        .nth(1)
        .unwrap()
        .split("Options:")
        .next()
        .unwrap()
        .lines()
        .filter_map(|line| line.split_whitespace().next())
        .filter(|command| *command != "help")
        .collect::<std::collections::BTreeSet<_>>();
    assert_eq!(
        commands,
        [
            "auth",
            "init",
            "update",
            "sync",
            "check",
            "pull",
            "push",
            "metadata",
            "apply",
            "approve",
            "studio",
            "drafts",
            "validate",
            "manifest",
            "bundle",
            "publish",
            "invalidate",
            "workflow",
            "types",
            "helpers",
            "export",
            "import",
            "extract",
        ]
        .into_iter()
        .collect()
    );
    for operator in [
        "serve",
        "smoke",
        "env-check",
        "local-users",
        "local-projects",
    ] {
        assert!(
            !commands.contains(operator),
            "platform tool leaked: {operator}"
        );
    }
}

/// File-backed fixtures exercise actual customer writes, not inline resources.
fn write_customer_project(root: &std::path::Path) {
    fs::write(
        root.join("lingva.config.yaml"),
        "projectId: demo\nenvironment: stage\nlocales: [en, ru]\ndefaultLocale: en\nfallbackLocale: en\ntranslationFiles: .lingva/translations/{locale}.json\n",
    )
    .unwrap();
    fs::create_dir_all(root.join(".lingva/translations")).unwrap();
    fs::write(
        root.join(".lingva/translations/en.json"),
        r#"{"home":{"title":"Hello {name}"},"onlyEnglish":"Fallback"}"#,
    )
    .unwrap();
    fs::write(
        root.join(".lingva/translations/ru.json"),
        r#"{"home":{"title":"Привет {name}"}}"#,
    )
    .unwrap();
}

fn successful_json(root: &std::path::Path, args: &[&str]) -> Value {
    let output = lingva(root).args(args).output().unwrap();
    assert!(
        output.status.success(),
        "args: {args:?}\nstderr: {}\nstdout: {}",
        String::from_utf8_lossy(&output.stderr),
        String::from_utf8_lossy(&output.stdout)
    );
    serde_json::from_slice(&output.stdout).unwrap()
}

#[test]
fn metadata_preview_and_check_preserve_existing_reviews() {
    let root = tempfile::tempdir().unwrap();
    write_customer_project(root.path());
    let metadata_path = root.path().join(".lingva/metadata.json");
    let original = r#"{"home.title":{"description":"Landing title","status":"reviewed","reviewer":"alice","translator":"bob","custom":"keep"}}"#;
    fs::write(&metadata_path, original).unwrap();
    for option in ["--dry-run", "--check"] {
        let output = lingva(root.path())
            .args(["metadata", option, "--format", "json"])
            .output()
            .unwrap();
        assert_eq!(output.status.success(), option == "--dry-run");
        let report: Value = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(report["written"], false);
        assert_eq!(report["missingKeys"], serde_json::json!(["onlyEnglish"]));
        assert_eq!(fs::read_to_string(&metadata_path).unwrap(), original);
    }
    let report = successful_json(
        root.path(),
        &["metadata", "--status", "draft", "--format", "json"],
    );
    assert_eq!(report["written"], true);
    let saved: Value = serde_json::from_str(&fs::read_to_string(metadata_path).unwrap()).unwrap();
    assert_eq!(saved["home.title"]["reviewer"], "alice");
    assert_eq!(saved["home.title"]["custom"], "keep");
    assert_eq!(saved["onlyEnglish"]["status"], "draft");
    assert!(
        lingva(root.path())
            .args(["metadata", "--check"])
            .output()
            .unwrap()
            .status
            .success()
    );
}

#[test]
fn customer_artifacts_share_keys_variables_fallback_and_workflow_shapes() {
    let root = tempfile::tempdir().unwrap();
    write_customer_project(root.path());
    fs::write(root.path().join(".lingva/metadata.json"), r#"{"home.title":{"description":"Title","status":"approved","reviewer":"alice","translator":"bob"}}"#).unwrap();
    let manifest = successful_json(root.path(), &["manifest", "--format", "json"]);
    assert_eq!(manifest["projectId"], "demo");
    assert_eq!(
        manifest["keys"],
        serde_json::json!(["home.title", "onlyEnglish"])
    );
    assert_eq!(
        manifest["entries"][0]["variables"],
        serde_json::json!(["name"])
    );
    assert_eq!(manifest["entries"][1]["translations"][1]["missing"], true);
    let bundle = successful_json(
        root.path(),
        &["bundle", "--locale", "ru", "--format", "json"],
    );
    assert_eq!(bundle["messages"]["onlyEnglish"], "Fallback");
    assert_eq!(bundle["sources"]["onlyEnglish"], "en");
    assert_eq!(bundle["metadata"]["home.title"]["reviewer"], "alice");
    let without = successful_json(
        root.path(),
        &[
            "bundle",
            "--locale",
            "ru",
            "--no-metadata",
            "--format",
            "json",
        ],
    );
    assert!(without.get("metadata").is_none());
    let exported = successful_json(root.path(), &["export", "--format", "json"]);
    assert_eq!(exported["resources"]["en"]["home"]["title"], "Hello {name}");
    assert_eq!(exported["keyMetadata"]["home.title"]["status"], "approved");
    let workflow = successful_json(root.path(), &["workflow", "--format", "json"]);
    assert_eq!(workflow["totalKeys"], 2);
    assert_eq!(workflow["statusCounts"]["approved"], 1);
    assert_eq!(workflow["approvedKeys"], serde_json::json!(["home.title"]));
}

#[test]
fn types_and_helpers_generate_typescript_not_json_reports() {
    let root = tempfile::tempdir().unwrap();
    write_customer_project(root.path());
    for command in ["types", "helpers"] {
        let output = lingva(root.path())
            .args([command, "--output", "generated/project.ts", "--no-metadata"])
            .output()
            .unwrap();
        assert!(output.status.success());
        let generated = fs::read_to_string(root.path().join("generated/project.ts")).unwrap();
        assert!(generated.contains("export type LingvaLocale"));
        assert!(generated.contains("export type LingvaTranslationKey"));
        assert!(generated.contains("home.title"));
        assert!(!generated.contains("lingvaKeyMetadata"));
        assert_eq!(
            generated.contains("export function hasLingvaTranslation"),
            command == "helpers"
        );
        assert_eq!(
            generated.trim_end(),
            String::from_utf8(output.stdout).unwrap().trim_end()
        );
    }
}

#[test]
fn import_can_create_and_roundtrip_a_fresh_portable_project() {
    let root = tempfile::tempdir().unwrap();
    let input = serde_json::json!({"projectId":"fresh","environment":"stage","defaultLocale":"en","fallbackLocale":"en","resources":{"en":{"title":"Hello"},"ru":{"title":"Привет"}},"keyMetadata":{"title":{"description":"Greeting","status":"draft"}}});
    fs::write(
        root.path().join("resources.json"),
        serde_json::to_string(&input).unwrap(),
    )
    .unwrap();
    let imported = successful_json(
        root.path(),
        &["import", "resources.json", "--output", "project.json"],
    );
    assert_eq!(imported, input);
    let exported = successful_json(root.path(), &["export", "project.json", "--format", "json"]);
    assert_eq!(exported, input);
    let replaced = successful_json(
        root.path(),
        &["import", "resources.json", "--project-id", "renamed"],
    );
    assert_eq!(replaced["projectId"], "renamed");
}

#[test]
fn apply_rejects_invalid_locale_and_dictionary_before_any_write() {
    let root = tempfile::tempdir().unwrap();
    write_customer_project(root.path());
    let en = fs::read(root.path().join(".lingva/translations/en.json")).unwrap();
    let ru = fs::read(root.path().join(".lingva/translations/ru.json")).unwrap();
    for (locale, input) in [
        ("zz", r#"{"title":"Valid"}"#),
        ("en", "[]"),
        ("en", r#"{"bad key":"Invalid"}"#),
        ("en", r#"{"title":12}"#),
    ] {
        fs::write(root.path().join("patch.json"), input).unwrap();
        let output = lingva(root.path())
            .args(["apply", "--locale", locale, "--input", "patch.json"])
            .output()
            .unwrap();
        assert!(!output.status.success(), "accepted {locale}: {input}");
        assert_eq!(
            fs::read(root.path().join(".lingva/translations/en.json")).unwrap(),
            en
        );
        assert_eq!(
            fs::read(root.path().join(".lingva/translations/ru.json")).unwrap(),
            ru
        );
    }
    assert!(!root.path().join(".lingva/translations/zz.json").exists());
}

#[test]
fn validation_truncation_cannot_hide_errors_and_named_policies_filter_codes() {
    let root = tempfile::tempdir().unwrap();
    write_customer_project(root.path());
    fs::write(
        root.path().join(".lingva/translations/en.json"),
        r#"{"bad key":42}"#,
    )
    .unwrap();
    let output = lingva(root.path())
        .args(["validate", "--max-issues", "0", "--format", "json"])
        .output()
        .unwrap();
    assert!(!output.status.success());
    let report: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["issues"], serde_json::json!([]));
    assert_eq!(report["shouldFail"], true);
    assert_eq!(report["truncated"], true);
    assert!(report["errorCount"].as_u64().unwrap() > 0);
    let config = fs::read_to_string(root.path().join("lingva.config.yaml")).unwrap();
    fs::write(root.path().join("lingva.config.yaml"), format!("{config}\ncli:\n  validatePolicies:\n    keys:\n      onlyCodes: [invalid_translation_key]\n      failOn: none\n")).unwrap();
    let filtered = successful_json(
        root.path(),
        &["validate", "--policy", "keys", "--format", "json"],
    );
    assert_eq!(filtered["shouldFail"], false);
    assert_eq!(filtered["issues"].as_array().unwrap().len(), 1);
    assert_eq!(filtered["issues"][0]["code"], "invalid_translation_key");
    assert!(
        !lingva(root.path())
            .args(["validate", "--policy", "missing"])
            .output()
            .unwrap()
            .status
            .success()
    );
}

#[test]
fn local_approval_preview_and_environment_rejection_never_write() {
    let root = tempfile::tempdir().unwrap();
    write_customer_project(root.path());
    let original = fs::read(root.path().join(".lingva/translations/en.json")).unwrap();
    let draft = serde_json::json!({"projectId":"demo","environment":"stage","locale":"en","key":"variants.title","variantId":"formal","value":"Welcome"});
    fs::write(
        root.path().join("draft.json"),
        serde_json::to_string(&draft).unwrap(),
    )
    .unwrap();
    let preview = successful_json(
        root.path(),
        &[
            "approve",
            "--draft",
            "draft.json",
            "--dry-run",
            "--format",
            "json",
        ],
    );
    assert_eq!(preview["dryRun"], true);
    assert_eq!(
        fs::read(root.path().join(".lingva/translations/en.json")).unwrap(),
        original
    );
    let mut wrong = draft.clone();
    wrong["environment"] = serde_json::json!("prod");
    fs::write(
        root.path().join("draft.json"),
        serde_json::to_string(&wrong).unwrap(),
    )
    .unwrap();
    let rejected = lingva(root.path())
        .args(["approve", "--draft", "draft.json"])
        .output()
        .unwrap();
    assert!(!rejected.status.success());
    assert!(String::from_utf8_lossy(&rejected.stderr).contains("another environment"));
    assert_eq!(
        fs::read(root.path().join(".lingva/translations/en.json")).unwrap(),
        original
    );
    fs::write(
        root.path().join("draft.json"),
        serde_json::to_string(&draft).unwrap(),
    )
    .unwrap();
    successful_json(
        root.path(),
        &["approve", "--draft", "draft.json", "--format", "json"],
    );
    let saved: Value = serde_json::from_slice(
        &fs::read(root.path().join(".lingva/translations/en.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(saved["variants"]["title"][0]["id"], "formal");
    assert_eq!(saved["variants"]["title"][0]["text"], "Welcome");
}

#[test]
fn offline_publish_writes_environment_scoped_bundles_and_honors_metadata() {
    let root = tempfile::tempdir().unwrap();
    write_customer_project(root.path());
    successful_json(root.path(), &["metadata", "--format", "json"]);
    let result = successful_json(
        root.path(),
        &[
            "publish",
            "--environment",
            "prod",
            "--output-dir",
            "artifacts",
            "--locale",
            "en",
            "--no-metadata",
            "--format",
            "json",
        ],
    );
    assert_eq!(result["manifest"]["environment"], "prod");
    assert_eq!(result["manifest"]["locales"], serde_json::json!(["en"]));
    assert_eq!(result["bundles"]["en"]["environment"], "prod");
    assert!(result["bundles"]["en"].get("metadata").is_none());
    let bundle: Value =
        serde_json::from_slice(&fs::read(root.path().join("artifacts/en.bundle.json")).unwrap())
            .unwrap();
    assert_eq!(bundle, result["bundles"]["en"]);
    assert!(root.path().join("artifacts/manifest.json").exists());
    assert!(!root.path().join("artifacts/ru.bundle.json").exists());
    assert!(!root.path().join(".lingva/remote-state.json").exists());
}

#[test]
fn publish_preview_and_local_export_never_contact_configured_hosted_endpoint() {
    let root = tempfile::tempdir().unwrap();
    write_customer_project(root.path());
    for option in ["--dry-run", "--local-only"] {
        let payload = successful_json(
            root.path(),
            &[
                "publish",
                option,
                "--api-url",
                "http://127.0.0.1:1",
                "--output-dir",
                "artifacts",
                "--output",
                "report.json",
                "--format",
                "json",
            ],
        );
        assert_eq!(payload["manifest"]["projectId"], "demo");
        let writes = option == "--local-only";
        assert_eq!(root.path().join("artifacts/manifest.json").exists(), writes);
        assert_eq!(root.path().join("report.json").exists(), writes);
        assert!(!root.path().join(".lingva/remote-state.json").exists());
    }
    let output = lingva(root.path())
        .args(["publish", "--dry-run", "--local-only"])
        .output()
        .unwrap();
    assert!(!output.status.success());
}

#[test]
fn update_uses_channel_registry_and_version_pinned_upgrade_without_installing() {
    for (channel, body, expected) in [
        (
            "standalone",
            r#"{"version":"9.8.7"}"#,
            "@9.8.7/lingva-installer",
        ),
        (
            "npm",
            r#"{"version":"9.8.7"}"#,
            "pnpm add -g @lingva/cli@9.8.7",
        ),
        (
            "python",
            r#"{"info":{"version":"9.8.7"}}"#,
            "pip install --upgrade lingva-cli==9.8.7",
        ),
        (
            "cargo",
            r#"{"crate":{"max_stable_version":"9.8.7"}}"#,
            "cargo install lingva --locked --version 9.8.7",
        ),
        (
            "homebrew",
            r#"{"version":"9.8.7"}"#,
            "brew update && brew upgrade lingva",
        ),
    ] {
        let root = tempfile::tempdir().unwrap();
        let (url, capture) = serve_once(200, &[("content-type", "application/json")], body);
        let output = lingva(root.path())
            .args(["update", "--channel", channel, "--format", "json"])
            .env("LINGVA_CLI_UPDATE_URL", url)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let payload: Value = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(payload["channel"], channel);
        assert_eq!(payload["latestVersion"], "9.8.7");
        assert_eq!(payload["updateAvailable"], true);
        assert!(
            payload["installCommand"]
                .as_str()
                .unwrap()
                .contains(expected)
        );
        assert_eq!(capture.recv().unwrap().method, "GET");
        assert_eq!(fs::read_dir(root.path()).unwrap().count(), 0);
    }
    for (status, body) in [
        (503, "unavailable"),
        (200, "not JSON"),
        (200, r#"{"version":"bad"}"#),
        (200, r#"{"version":"9.8.7-beta.1"}"#),
    ] {
        let root = tempfile::tempdir().unwrap();
        let (url, _) = serve_once(status, &[], body);
        assert!(
            !lingva(root.path())
                .args(["update", "--channel", "npm"])
                .env("LINGVA_CLI_UPDATE_URL", url)
                .status()
                .unwrap()
                .success()
        );
    }
}

#[test]
fn help_never_discloses_environment_api_keys_or_adapter_channel_values() {
    let root = tempfile::tempdir().unwrap();
    let output = lingva(root.path())
        .args(["auth", "use-key", "--help"])
        .env("LINGVA_API_KEY", "sensitive-api-key")
        .output()
        .unwrap();
    assert!(output.status.success());
    assert!(!String::from_utf8_lossy(&output.stdout).contains("sensitive-api-key"));
    let output = lingva(root.path())
        .args(["update", "--help"])
        .env("LINGVA_CLI_INSTALL_CHANNEL", "python")
        .output()
        .unwrap();
    assert!(!String::from_utf8_lossy(&output.stdout).contains("CHANNEL=python"));
}

#[test]
fn extraction_uses_syntax_not_regex_jsx_text_comments_or_dynamic_arguments() {
    let root = tempfile::tempdir().unwrap();
    write_customer_project(root.path());
    fs::create_dir(root.path().join("src")).unwrap();
    fs::write(root.path().join("src/app.tsx"), "const pattern = /t('regex.fake')/;\n// t('comment.fake')\nconst text = \"t('string.fake')\";\nconst view = <div>t('jsx.fake'){t('home.title')}</div>;\ntSync('missing.key');\nt(`dynamic.${name}`);\n").unwrap();
    let output = lingva(root.path())
        .args([
            "extract",
            "src",
            "--project",
            "lingva.config.yaml",
            "--fail-on",
            "missing",
            "--format",
            "json",
        ])
        .output()
        .unwrap();
    assert!(!output.status.success());
    let report: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(
        report["keys"],
        serde_json::json!(["home.title", "missing.key"])
    );
    assert_eq!(report["missingKeys"], serde_json::json!(["missing.key"]));
    assert_eq!(
        report["unusedProjectKeys"],
        serde_json::json!(["onlyEnglish"])
    );
    assert_eq!(report["occurrences"]["home.title"][0]["line"], 4);
    assert_eq!(report["shouldFail"], true);
    let allowed = successful_json(
        root.path(),
        &[
            "extract",
            "src",
            "--project",
            "lingva.config.yaml",
            "--fail-on",
            "none",
            "--format",
            "json",
        ],
    );
    assert_eq!(allowed["shouldFail"], false);
}

#[test]
fn studio_exports_self_contained_html_without_script_injection() {
    let root = tempfile::tempdir().unwrap();
    write_customer_project(root.path());
    fs::write(
        root.path().join(".lingva/translations/en.json"),
        r#"{"title":"</script><script>alert(1)</script>&"}"#,
    )
    .unwrap();
    let output = lingva(root.path())
        .args(["studio", "--output", "studio.html"])
        .output()
        .unwrap();
    assert!(output.status.success());
    let html = fs::read_to_string(root.path().join("studio.html")).unwrap();
    assert!(html.starts_with("<!doctype html>"));
    assert!(!html.contains("</script><script>alert(1)"));
    assert!(html.contains("\\u003c/script\\u003e"));
    assert!(html.contains("Export locale JSON"));
}

#[test]
fn drafts_forward_filters_and_pagination_and_hash_untrusted_ids_for_files() {
    let root = tempfile::tempdir().unwrap();
    let (api_url, captured) = serve_once(
        200,
        &[("content-type", "application/json")],
        r#"{"drafts":[{"draftId":"../../escaped","locale":"en","key":"title","value":"Hello"}],"nextToken":"next-page"}"#,
    );
    write_remote_config(root.path(), &api_url, "en");
    let output = lingva(root.path())
        .args([
            "drafts",
            "--locale",
            "en",
            "--key",
            "title",
            "--status",
            "all",
            "--limit",
            "10",
            "--next-token",
            "previous-page",
            "--output-dir",
            "draft-files",
            "--format",
            "json",
        ])
        .env("LINGVA_PUBLISH_API_TOKEN", "secret")
        .env("HOME", root.path().join("home"))
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["nextToken"], "next-page");
    let path = std::path::Path::new(report["outputFiles"][0].as_str().unwrap());
    assert!(path.starts_with("draft-files"));
    assert!(root.path().join(path).is_file());
    assert!(!root.path().join("escaped").exists());
    let request = captured.recv().unwrap();
    assert_eq!(request.headers["authorization"], "Bearer secret");
    let body: Value = serde_json::from_str(&request.body).unwrap();
    assert_eq!(body["action"], "list-drafts");
    assert_eq!(body["environment"], "stage");
    assert_eq!(body["includeApproved"], true);
    assert_eq!(body["nextToken"], "previous-page");
    assert_eq!(body["limit"], 10);
}

#[test]
fn hosted_approval_requires_confirmation_before_publish() {
    let root = tempfile::tempdir().unwrap();
    write_customer_project(root.path());
    let (api_url, captured) = serve_sequence(vec![
        (
            200,
            vec![("content-type", "application/json")],
            r#"{"drafts":[{"draftId":"d1","projectId":"demo","environment":"stage","locale":"en","key":"home.title","value":"Approved value"}]}"#,
        ),
        (
            200,
            vec![("content-type", "application/json")],
            r#"{"ok":true,"draftId":"different","status":"approved"}"#,
        ),
    ]);
    let output = lingva(root.path())
        .args([
            "approve",
            "--draft-id",
            "d1",
            "--api-url",
            &api_url,
            "--auth-token",
            "secret",
            "--push",
            "--publish-api-url",
            &api_url,
        ])
        .env("HOME", root.path().join("home"))
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("hosted approval was not confirmed"));
    let first: Value = serde_json::from_str(&captured.recv().unwrap().body).unwrap();
    let second: Value = serde_json::from_str(&captured.recv().unwrap().body).unwrap();
    assert_eq!(first["action"], "list-drafts");
    assert_eq!(second["action"], "approve-draft");
    assert!(!root.path().join(".lingva/remote-state.json").exists());
    let saved: Value = serde_json::from_slice(
        &fs::read(root.path().join(".lingva/translations/en.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(saved["home"]["title"], "Approved value");
}

#[test]
fn version_and_invalid_command_follow_cli_exit_contract() {
    let root = tempfile::tempdir().unwrap();
    let version = lingva(root.path()).arg("--version").output().unwrap();
    assert!(version.status.success());
    assert_eq!(
        String::from_utf8(version.stdout).unwrap().trim(),
        concat!("lingva ", env!("CARGO_PKG_VERSION"))
    );

    let invalid = lingva(root.path()).arg("unknown").output().unwrap();
    assert!(!invalid.status.success());
    assert!(String::from_utf8_lossy(&invalid.stderr).contains("unrecognized subcommand"));
}

#[test]
fn init_requires_explicit_account_free_mode() {
    let root = tempfile::tempdir().unwrap();
    let no_auth_remote = lingva(root.path())
        .args(["init", "--no-auth"])
        .output()
        .unwrap();
    assert!(!no_auth_remote.status.success());
    assert!(
        String::from_utf8_lossy(&no_auth_remote.stderr).contains("only valid with --mode local")
    );

    let unauthenticated = lingva(root.path())
        .args(["init", "--mode", "local"])
        .env("HOME", root.path().join("home"))
        .output()
        .unwrap();
    assert!(!unauthenticated.status.success());
    assert!(String::from_utf8_lossy(&unauthenticated.stderr).contains("auth login"));
}

#[test]
fn init_dry_run_reports_files_without_writing_and_force_controls_overwrite() {
    let root = tempfile::tempdir().unwrap();
    let dry_run = lingva(root.path())
        .args([
            "init",
            "--mode",
            "local",
            "--no-auth",
            "--sdk",
            "react",
            "--project-id",
            "demo",
            "--dry-run",
            "--format",
            "json",
        ])
        .output()
        .unwrap();
    assert!(dry_run.status.success());
    let payload: Value = serde_json::from_slice(&dry_run.stdout).unwrap();
    assert_eq!(payload["written"], false);
    assert!(!root.path().join("lingva.config.yaml").exists());
    assert!(!root.path().join("lingva.config.ts").exists());

    assert!(
        lingva(root.path())
            .args([
                "init",
                "--mode",
                "local",
                "--no-auth",
                "--project-id",
                "one"
            ])
            .status()
            .unwrap()
            .success()
    );
    let refused = lingva(root.path())
        .args([
            "init",
            "--mode",
            "local",
            "--no-auth",
            "--project-id",
            "two",
        ])
        .output()
        .unwrap();
    assert!(!refused.status.success());
    assert!(String::from_utf8_lossy(&refused.stderr).contains("--force"));
    assert!(
        lingva(root.path())
            .args([
                "init",
                "--mode",
                "local",
                "--no-auth",
                "--project-id",
                "two",
                "--force",
            ])
            .status()
            .unwrap()
            .success()
    );
    assert!(
        fs::read_to_string(root.path().join("lingva.config.yaml"))
            .unwrap()
            .contains("projectId: two")
    );
}

#[test]
fn local_init_can_generate_runtime_free_github_checks() {
    let root = tempfile::tempdir().unwrap();
    let initialized = lingva(root.path())
        .args([
            "init",
            "--mode",
            "local",
            "--no-auth",
            "--project-id",
            "demo",
            "--ci",
            "github",
        ])
        .output()
        .unwrap();
    assert!(initialized.status.success());
    let workflow =
        fs::read_to_string(root.path().join(".github/workflows/lingva-local.yml")).unwrap();
    assert!(workflow.contains("lingva-installer.sh"));
    assert!(workflow.contains("lingva check lingva.config.yaml"));

    let remote_root = tempfile::tempdir().unwrap();
    let remote = lingva(remote_root.path())
        .args(["init", "--ci", "github"])
        .output()
        .unwrap();
    assert!(!remote.status.success());
    assert!(String::from_utf8_lossy(&remote.stderr).contains("only valid with --mode local"));
}

#[test]
fn local_init_and_sync_need_no_language_runtime() {
    let root = tempfile::tempdir().unwrap();
    let initialized = lingva(root.path())
        .args([
            "init",
            "--mode",
            "local",
            "--no-auth",
            "--sdk",
            "python",
            "--project-id",
            "demo",
            "--locale",
            "en,ru",
        ])
        .output()
        .unwrap();
    assert!(
        initialized.status.success(),
        "{}",
        String::from_utf8_lossy(&initialized.stderr)
    );
    let config = fs::read_to_string(root.path().join("lingva.config.yaml")).unwrap();
    assert!(config.contains("projectId: demo"));
    assert!(root.path().join(".lingva/translations/en.json").is_file());
    assert!(root.path().join(".lingva/translations/ru.json").is_file());

    fs::write(
        root.path().join(".lingva/translations/en.json"),
        "{\"welcome\":\"Hello\"}\n",
    )
    .unwrap();
    let drift = lingva(root.path()).arg("check").output().unwrap();
    assert!(!drift.status.success());
    assert!(
        String::from_utf8(drift.stdout)
            .unwrap()
            .contains("locale drift detected")
    );

    assert!(lingva(root.path()).arg("sync").status().unwrap().success());
    assert!(lingva(root.path()).arg("check").status().unwrap().success());
    let russian = fs::read_to_string(root.path().join(".lingva/translations/ru.json")).unwrap();
    assert!(russian.contains("\"welcome\": \"\""));
}

#[test]
fn react_init_generates_a_local_sdk_adapter_from_the_portable_engine() {
    let root = tempfile::tempdir().unwrap();
    let initialized = lingva(root.path())
        .args([
            "init",
            "--mode",
            "local",
            "--no-auth",
            "--sdk",
            "react",
            "--project-id",
            "demo",
            "--locale",
            "en,ru",
        ])
        .output()
        .unwrap();
    assert!(
        initialized.status.success(),
        "{}",
        String::from_utf8_lossy(&initialized.stderr)
    );

    let runtime_config =
        fs::read_to_string(root.path().join(".lingva/generated/runtime.ts")).unwrap();
    assert!(runtime_config.contains("generatedProjectFile: './project.ts'"));
    assert!(runtime_config.contains("../../.lingva/translations/{locale}.json"));
    assert!(!root.path().join("lingva.config.ts").exists());
    assert!(!runtime_config.contains("import project"));

    let provider = fs::read_to_string(root.path().join("src/lingva/provider.tsx")).unwrap();
    assert!(provider.contains("configureLingvaReact({"));
    assert!(provider.contains("...lingvaConfig"));
    assert!(provider.contains("project: lingvaProject"));

    let project = fs::read_to_string(root.path().join(".lingva/generated/project.ts")).unwrap();
    assert!(project.contains("createLingvaResources"));
    assert!(project.contains("projectId: \"demo\""));
}

#[test]
fn python_init_stays_runtime_agnostic() {
    let root = tempfile::tempdir().unwrap();
    assert!(
        lingva(root.path())
            .args([
                "init",
                "--mode",
                "local",
                "--no-auth",
                "--sdk",
                "python",
                "--project-id",
                "demo",
            ])
            .status()
            .unwrap()
            .success()
    );
    assert!(root.path().join("lingva.config.yaml").is_file());
    assert!(!root.path().join("lingva.config.ts").exists());
    assert!(!root.path().join(".lingva/generated/project.ts").exists());
}

#[test]
fn pull_downloads_only_authored_values_and_persists_revision_state() {
    let root = tempfile::tempdir().unwrap();
    let (api_url, captured) = serve_once(
        200,
        &[
            ("content-type", "application/json"),
            ("x-lingva-revision", "revision-1"),
        ],
        r#"{"messages":{"title":"Hello","fallback":"Fallback"},"sources":{"title":"en","fallback":"ru"},"variants":{"title":[{"id":"formal","text":"Welcome"}]}}"#,
    );
    write_remote_config(root.path(), &api_url, "en, ru");
    let output = lingva(root.path())
        .args(["pull", "--locale", "en", "--format", "json"])
        .env("LINGVA_PUBLISH_API_TOKEN", "secret")
        .env("HOME", root.path().join("home"))
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let dictionary: Value = serde_json::from_str(
        &fs::read_to_string(root.path().join(".lingva/translations/en.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(dictionary["title"][0]["text"], "Welcome");
    assert!(dictionary.get("fallback").is_none());
    let state: Value = serde_json::from_str(
        &fs::read_to_string(root.path().join(".lingva/remote-state.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(state["locales"]["en"]["revision"], "revision-1");
    let request = captured.recv().unwrap();
    assert_eq!(request.method, "GET");
    assert_eq!(request.url, "/bundles/demo/stage/latest/en.bundle.json");
    assert_eq!(request.headers["authorization"], "Bearer secret");
}

#[test]
fn pull_keeps_translations_unchanged_when_merge_state_cannot_be_committed() {
    let root = tempfile::tempdir().unwrap();
    let (url, _) = serve_once(
        200,
        &[
            ("content-type", "application/json"),
            ("x-lingva-revision", "revision-1"),
        ],
        r#"{"messages":{"title":"Hello"},"sources":{"title":"en"}}"#,
    );
    write_remote_config(root.path(), &url, "en");
    fs::create_dir_all(root.path().join(".lingva/translations")).unwrap();
    fs::write(root.path().join(".lingva/translations/en.json"), "{}").unwrap();
    fs::create_dir(root.path().join(".lingva/remote-state.json")).unwrap();
    let output = lingva(root.path())
        .args(["pull", "--locale", "en"])
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert_eq!(
        fs::read(root.path().join(".lingva/translations/en.json")).unwrap(),
        b"{}"
    );
}

#[test]
fn extraction_reports_dynamic_calls_and_respects_explicit_callee_selection() {
    let root = tempfile::tempdir().unwrap();
    fs::write(
        root.path().join("source.ts"),
        "other.t('ignored'); lingva.t('real');\nlingva.t(key);",
    )
    .unwrap();
    let output = lingva(root.path())
        .args([
            "extract",
            "source.ts",
            "--callee",
            "lingva.t",
            "--fail-on",
            "dynamic",
            "--format",
            "json",
        ])
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(1));
    let payload: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(payload["keys"], serde_json::json!(["real"]));
    assert_eq!(payload["dynamicCalls"][0]["line"], 2);
    assert_eq!(payload["shouldFail"], true);
}

#[test]
fn push_emits_semantic_payload_and_advances_state_only_after_success() {
    let root = tempfile::tempdir().unwrap();
    let (api_url, captured) = serve_once(
        200,
        &[("content-type", "application/json")],
        r#"{"publishId":"revision-2","projectId":"demo","manifestKey":"manifest.json"}"#,
    );
    write_remote_config(root.path(), &api_url, "en");
    fs::create_dir_all(root.path().join(".lingva/translations")).unwrap();
    fs::write(
        root.path().join(".lingva/translations/en.json"),
        r#"{"title":"Hello {name}"}"#,
    )
    .unwrap();
    let output = lingva(root.path())
        .args(["push", "--locale", "en", "--format", "json"])
        .env("LINGVA_PUBLISH_API_TOKEN", "secret")
        .env("HOME", root.path().join("home"))
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let request = captured.recv().unwrap();
    assert_eq!(request.method, "POST");
    let payload: Value = serde_json::from_str(&request.body).unwrap();
    assert_eq!(payload["action"], "publish");
    assert_eq!(payload["baseRevision"], Value::Null);
    assert_eq!(
        payload["bundles"]["en"]["variables"]["title"],
        serde_json::json!(["name"])
    );
    assert!(
        payload["mutationId"]
            .as_str()
            .unwrap()
            .starts_with("sha256:")
    );
    let state: Value = serde_json::from_str(
        &fs::read_to_string(root.path().join(".lingva/remote-state.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(state["locales"]["en"]["revision"], "revision-2");
}

#[test]
fn hosted_failure_returns_nonzero_without_advancing_state() {
    let root = tempfile::tempdir().unwrap();
    let (api_url, _) = serve_once(
        409,
        &[("content-type", "application/json")],
        r#"{"error":"revision conflict"}"#,
    );
    write_remote_config(root.path(), &api_url, "en");
    fs::create_dir_all(root.path().join(".lingva/translations")).unwrap();
    fs::write(
        root.path().join(".lingva/translations/en.json"),
        r#"{"title":"Hello"}"#,
    )
    .unwrap();
    let output = lingva(root.path())
        .args(["push", "--locale", "en"])
        .env("LINGVA_PUBLISH_API_TOKEN", "secret")
        .env("HOME", root.path().join("home"))
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("HTTP 409"));
    assert!(!root.path().join(".lingva/remote-state.json").exists());
}

#[test]
fn multi_locale_pull_is_atomic_when_a_later_locale_conflicts() {
    let root = tempfile::tempdir().unwrap();
    let (api_url, _) = serve_sequence(vec![
        (
            200,
            vec![
                ("content-type", "application/json"),
                ("x-lingva-revision", "revision-2"),
            ],
            r#"{"messages":{"title":"Remote EN"},"sources":{"title":"en"}}"#,
        ),
        (
            200,
            vec![
                ("content-type", "application/json"),
                ("x-lingva-revision", "revision-2"),
            ],
            r#"{"messages":{"title":"Remote RU"},"sources":{"title":"ru"}}"#,
        ),
    ]);
    write_remote_config(root.path(), &api_url, "en, ru");
    fs::create_dir_all(root.path().join(".lingva/translations")).unwrap();
    fs::write(
        root.path().join(".lingva/translations/en.json"),
        r#"{"title":"Base"}"#,
    )
    .unwrap();
    fs::write(
        root.path().join(".lingva/translations/ru.json"),
        r#"{"title":"Local RU"}"#,
    )
    .unwrap();
    fs::write(
        root.path().join(".lingva/remote-state.json"),
        r#"{"schemaVersion":1,"projectId":"demo","environment":"stage","locales":{"en":{"revision":"revision-1","base":{"title":"Base"}},"ru":{"revision":"revision-1","base":{"title":"Base"}}}}"#,
    )
    .unwrap();

    let output = lingva(root.path())
        .arg("pull")
        .env("LINGVA_PUBLISH_API_TOKEN", "secret")
        .env("HOME", root.path().join("home"))
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("conflicts in locale \"ru\""));
    assert_eq!(
        fs::read_to_string(root.path().join(".lingva/translations/en.json")).unwrap(),
        r#"{"title":"Base"}"#
    );
    let state: Value = serde_json::from_str(
        &fs::read_to_string(root.path().join(".lingva/remote-state.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(state["locales"]["en"]["revision"], "revision-1");
}

#[test]
fn push_can_invalidate_after_publish_with_one_consistent_token() {
    let root = tempfile::tempdir().unwrap();
    let (api_url, captured) = serve_sequence(vec![
        (
            200,
            vec![("content-type", "application/json")],
            r#"{"publishId":"revision-2","projectId":"demo","manifestKey":"manifest.json"}"#,
        ),
        (
            200,
            vec![("content-type", "application/json")],
            r#"{"invalidationId":"invalidate-1"}"#,
        ),
    ]);
    write_remote_config(root.path(), &api_url, "en");
    fs::create_dir_all(root.path().join(".lingva/translations")).unwrap();
    fs::write(
        root.path().join(".lingva/translations/en.json"),
        r#"{"title":"Hello"}"#,
    )
    .unwrap();
    let output = lingva(root.path())
        .args([
            "push",
            "--invalidate",
            "--reason",
            "release",
            "--format",
            "json",
        ])
        .env("LINGVA_PUBLISH_API_TOKEN", "secret")
        .env("HOME", root.path().join("home"))
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let result: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(result["publish"]["publishId"], "revision-2");
    assert_eq!(result["invalidation"]["invalidationId"], "invalidate-1");
    let publish = captured.recv().unwrap();
    let invalidate = captured.recv().unwrap();
    assert_eq!(publish.headers["authorization"], "Bearer secret");
    assert_eq!(invalidate.headers["authorization"], "Bearer secret");
    let payload: Value = serde_json::from_str(&invalidate.body).unwrap();
    assert_eq!(payload["action"], "invalidate");
    assert_eq!(payload["reason"], "release");
}

#[test]
fn approving_leaf_over_an_existing_namespace_never_discards_nested_translations() {
    let root = tempfile::tempdir().unwrap();
    write_customer_project(root.path());
    let path = root.path().join(".lingva/translations/en.json");
    let original = r#"{"a":{"b":"keep"}}"#;
    fs::write(&path, original).unwrap();
    for variant in [false, true] {
        let mut draft = serde_json::json!({"projectId":"demo","environment":"stage","locale":"en","key":"a","value":"replace"});
        if variant {
            draft["variantId"] = serde_json::json!("formal");
        }
        fs::write(
            root.path().join("draft.json"),
            serde_json::to_string(&draft).unwrap(),
        )
        .unwrap();
        let output = lingva(root.path())
            .args(["approve", "--draft", "draft.json", "--no-mark-approved"])
            .output()
            .unwrap();
        assert!(
            !output.status.success(),
            "namespace replacement accepted (variant={variant})"
        );
        assert_eq!(fs::read_to_string(&path).unwrap(), original);
    }
}

#[test]
fn sync_and_default_apply_validate_all_locales_before_writing_any_locale() {
    let root = tempfile::tempdir().unwrap();
    write_customer_project(root.path());
    let config_path = root.path().join("lingva.config.yaml");
    let config = fs::read_to_string(&config_path)
        .unwrap()
        .replace("locales: [en, ru]", "locales: [en, ru, zz]");
    fs::write(config_path, config).unwrap();
    fs::write(
        root.path().join(".lingva/translations/zz.json"),
        r#"{"broken":42}"#,
    )
    .unwrap();
    fs::write(root.path().join("patch.json"), r#"{"new":"Added"}"#).unwrap();
    let snapshots = ["en", "ru", "zz"].map(|locale| {
        fs::read(
            root.path()
                .join(format!(".lingva/translations/{locale}.json")),
        )
        .unwrap()
    });
    for args in [
        vec!["sync"],
        vec!["apply", "--locale", "en", "--input", "patch.json"],
    ] {
        let output = lingva(root.path()).args(&args).output().unwrap();
        assert!(
            !output.status.success(),
            "malformed later locale accepted: {args:?}"
        );
        for (index, locale) in ["en", "ru", "zz"].iter().enumerate() {
            assert_eq!(
                fs::read(
                    root.path()
                        .join(format!(".lingva/translations/{locale}.json"))
                )
                .unwrap(),
                snapshots[index]
            );
        }
    }
}

#[test]
fn inline_resource_mutations_persist_config_and_never_create_shadow_locale_files() {
    let root = tempfile::tempdir().unwrap();
    let config_path = root.path().join("project.json");
    let initial = serde_json::json!({"projectId":"inline","environment":"stage","locales":["en","ru"],"defaultLocale":"en","fallbackLocale":"en","resources":{"en":{"title":"Hello"},"ru":{}},"custom":{"preserve":true}});
    fs::write(&config_path, serde_json::to_string(&initial).unwrap()).unwrap();
    let original = fs::read(&config_path).unwrap();
    let check = lingva(root.path())
        .args(["check", "project.json"])
        .output()
        .unwrap();
    assert!(!check.status.success());
    assert_eq!(fs::read(&config_path).unwrap(), original);
    assert!(
        lingva(root.path())
            .args(["sync", "project.json"])
            .output()
            .unwrap()
            .status
            .success()
    );
    let synced: Value = serde_json::from_slice(&fs::read(&config_path).unwrap()).unwrap();
    assert_eq!(synced["resources"]["ru"]["title"], "");
    fs::write(root.path().join("patch.json"), r#"{"new":"Keep new key"}"#).unwrap();
    successful_json(
        root.path(),
        &[
            "apply",
            "project.json",
            "--locale",
            "en",
            "--input",
            "patch.json",
            "--format",
            "json",
        ],
    );
    let applied: Value = serde_json::from_slice(&fs::read(&config_path).unwrap()).unwrap();
    assert_eq!(applied["resources"]["en"]["new"], "Keep new key");
    assert_eq!(applied["resources"]["ru"]["new"], "");
    fs::write(root.path().join("draft.json"), r#"{"projectId":"inline","environment":"stage","locale":"ru","key":"title","value":"Привет"}"#).unwrap();
    successful_json(
        root.path(),
        &[
            "approve",
            "project.json",
            "--draft",
            "draft.json",
            "--no-mark-approved",
            "--format",
            "json",
        ],
    );
    let approved: Value = serde_json::from_slice(&fs::read(&config_path).unwrap()).unwrap();
    assert_eq!(approved["resources"]["ru"]["title"], "Привет");
    assert_eq!(approved["resources"]["en"]["new"], "Keep new key");
    assert_eq!(approved["custom"]["preserve"], true);
    assert!(!root.path().join(".lingva/translations").exists());
    let before_check = fs::read(&config_path).unwrap();
    assert!(
        lingva(root.path())
            .args(["check", "project.json"])
            .output()
            .unwrap()
            .status
            .success()
    );
    assert_eq!(fs::read(&config_path).unwrap(), before_check);
}

#[test]
fn react_init_distinguishes_sanitized_locale_names_and_resolves_custom_locale_paths() {
    let root = tempfile::tempdir().unwrap();
    let output = lingva(root.path())
        .args([
            "init",
            "--mode",
            "local",
            "--no-auth",
            "--sdk",
            "react",
            "--project-id",
            "demo",
            "--locale",
            "en-US,en_US",
            "--locales-dir",
            "src/messages",
        ])
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let generated = fs::read_to_string(root.path().join(".lingva/generated/project.ts")).unwrap();
    assert!(generated.contains("import locale_en_US_0 from \"../../src/messages/en-US.json\";"));
    assert!(generated.contains("import locale_en_US_1 from \"../../src/messages/en_US.json\";"));
    assert!(generated.contains("\"en-US\": locale_en_US_0"));
    assert!(generated.contains("\"en_US\": locale_en_US_1"));
    assert!(root.path().join("src/messages/en-US.json").is_file());
    assert!(root.path().join("src/messages/en_US.json").is_file());
    let config = fs::read_to_string(root.path().join("lingva.config.yaml")).unwrap();
    assert!(config.contains("src/messages/{locale}.json"));
    let provider = fs::read_to_string(root.path().join("src/lingva/provider.tsx")).unwrap();
    assert!(provider.contains("../../.lingva/generated/project"));
}

#[test]
fn import_rejects_traversal_locale_before_creating_output() {
    let root = tempfile::tempdir().unwrap();
    fs::write(
        root.path().join("unsafe.json"),
        r#"{"projectId":"unsafe","resources":{"../outside":{"title":"Hello"}}}"#,
    )
    .unwrap();
    let output = lingva(root.path())
        .args(["import", "unsafe.json", "--output", "output/project.json"])
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(!root.path().join("output").exists());
}

#[test]
fn cli_publish_endpoint_alone_uses_hosted_revision_protocol() {
    let root = tempfile::tempdir().unwrap();
    write_customer_project(root.path());
    let (api_url, captured) = serve_once(
        200,
        &[("content-type", "application/json")],
        r#"{"publishId":"nested-endpoint-revision","projectId":"demo","manifestKey":"manifest.json"}"#,
    );
    let config_path = root.path().join("lingva.config.yaml");
    let original = fs::read_to_string(&config_path).unwrap();
    fs::write(
        config_path,
        format!("{original}\ncli:\n  publish:\n    apiUrl: {api_url}\n"),
    )
    .unwrap();
    let output = lingva(root.path())
        .args(["publish", "--locale", "en", "--format", "json"])
        .env("LINGVA_PUBLISH_API_TOKEN", "secret")
        .env("HOME", root.path().join("home"))
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let request = captured.recv().unwrap();
    let payload: Value = serde_json::from_str(&request.body).unwrap();
    assert_eq!(payload["action"], "publish");
    assert_eq!(payload["manifest"]["environment"], "stage");
    assert_eq!(request.headers["authorization"], "Bearer secret");
    let state: Value =
        serde_json::from_slice(&fs::read(root.path().join(".lingva/remote-state.json")).unwrap())
            .unwrap();
    assert_eq!(
        state["locales"]["en"]["revision"],
        "nested-endpoint-revision"
    );
}

#[test]
fn studio_accepts_explicit_html_format() {
    let root = tempfile::tempdir().unwrap();
    write_customer_project(root.path());
    let output = lingva(root.path())
        .args(["studio", "--format", "html"])
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(String::from_utf8_lossy(&output.stdout).starts_with("<!doctype html>"));
}

#[test]
fn policy_only_documents_support_validation_extraction_and_reject_invalid_thresholds() {
    let root = tempfile::tempdir().unwrap();
    write_customer_project(root.path());
    fs::write(root.path().join("policy.json"), r#"{"cli":{"validatePolicies":{"ci":{"failOn":"none","onlyCodes":["missing_key_metadata"]}},"extractPolicies":{"ci":{"failOn":"missing"}}}}"#).unwrap();
    let result = successful_json(
        root.path(),
        &[
            "validate",
            "--config",
            "policy.json",
            "--policy",
            "ci",
            "--format",
            "json",
        ],
    );
    assert_eq!(result["shouldFail"], false);
    assert!(
        result["issues"]
            .as_array()
            .unwrap()
            .iter()
            .all(|issue| issue["code"] == "missing_key_metadata")
    );
    fs::write(root.path().join("app.ts"), "t('missing');\n").unwrap();
    let extracted = lingva(root.path())
        .args([
            "extract",
            "app.ts",
            "--project",
            "lingva.config.yaml",
            "--config",
            "policy.json",
            "--policy",
            "ci",
            "--format",
            "json",
        ])
        .output()
        .unwrap();
    assert!(!extracted.status.success());
    let report: Value = serde_json::from_slice(&extracted.stdout).unwrap();
    assert_eq!(report["missingKeys"], serde_json::json!(["missing"]));
    fs::write(root.path().join("policy.json"), r#"{"cli":{"validatePolicies":{"ci":{"failOn":"garbage"}},"extractPolicies":{"ci":{"failOn":"garbage"}}}}"#).unwrap();
    for args in [
        vec!["validate", "--config", "policy.json", "--policy", "ci"],
        vec![
            "extract",
            "app.ts",
            "--config",
            "policy.json",
            "--policy",
            "ci",
        ],
    ] {
        let output = lingva(root.path()).args(&args).output().unwrap();
        assert!(
            !output.status.success(),
            "invalid policy accepted: {args:?}"
        );
        assert!(String::from_utf8_lossy(&output.stderr).contains("garbage"));
    }
}

#[test]
fn lightweight_publish_settings_control_hosted_endpoint_metadata_artifacts_and_report() {
    for command in ["publish", "push"] {
        let root = tempfile::tempdir().unwrap();
        write_customer_project(root.path());
        successful_json(root.path(), &["metadata", "--format", "json"]);
        let (api_url, captured) = serve_once(
            200,
            &[("content-type", "application/json")],
            r#"{"publishId":"policy-revision","projectId":"demo","manifestKey":"manifest.json"}"#,
        );
        fs::write(root.path().join("policy.json"), serde_json::to_string(&serde_json::json!({"apiKeyEnv":"LINGVA_TEST_POLICY_TOKEN","cli":{"publish":{"apiUrl":api_url,"includeMetadata":false,"outputDir":"policy-artifacts"}}})).unwrap()).unwrap();
        let output = lingva(root.path())
            .args([
                command,
                "--config",
                "policy.json",
                "--locale",
                "en",
                "--output",
                "report.json",
                "--format",
                "json",
            ])
            .env_remove("LINGVA_PUBLISH_API_TOKEN")
            .env_remove("LINGVA_API_KEY")
            .env("LINGVA_TEST_POLICY_TOKEN", "policy-secret")
            .env("HOME", root.path().join("home"))
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{command}: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        let request = captured.recv().unwrap();
        assert_eq!(request.headers["authorization"], "Bearer policy-secret");
        let payload: Value = serde_json::from_str(&request.body).unwrap();
        assert_eq!(payload["action"], "publish");
        assert!(payload["bundles"]["en"].get("metadata").is_none());
        assert!(
            root.path()
                .join(if command == "publish" {
                    "policy-artifacts/en.bundle.json"
                } else {
                    "policy-artifacts/publish-response.json"
                })
                .is_file()
        );
        let saved: Value =
            serde_json::from_slice(&fs::read(root.path().join("report.json")).unwrap()).unwrap();
        assert_eq!(saved["publishId"], "policy-revision");
    }
}

fn device_login_command(root: &std::path::Path, endpoint: &str) -> Command {
    let mut command = lingva(root);
    command
        .args([
            "auth",
            "login",
            "--device",
            "--no-browser",
            "--device-url",
            endpoint,
            "--token-url",
            endpoint,
            "--client-id",
            "public-client",
        ])
        .env("HOME", root.join("home"));
    command
}

#[test]
fn remote_init_uses_refreshed_oauth_token_and_discovered_project_contract() {
    let root = tempfile::tempdir().unwrap();
    let home = root.path().join("home");
    fs::create_dir_all(home.join(".lingva")).unwrap();
    let (token_url, refresh) = serve_once(
        200,
        &[("content-type", "application/json")],
        r#"{"access_token":"fresh-access","expires_in":3600}"#,
    );
    let (platform_url, projects) = serve_once(
        200,
        &[("content-type", "application/json")],
        r#"{"projects":[{"projectId":"remote-demo","name":"Demo","locales":["en","de"],"defaultLocale":"de","environments":[{"environmentId":"production","publishApiUrl":"https://publish.example.test"}]}]}"#,
    );
    fs::write(home.join(".lingva/credentials.json"),serde_json::to_string(&serde_json::json!({"accessToken":"expired-access","refreshToken":"refresh-secret","expiresAt":"2000-01-01T00:00:00Z","obtainedAt":"2000-01-01T00:00:00Z","clientId":"public-client","tokenUrl":token_url,"platformUrl":platform_url})).unwrap()).unwrap();
    let output = lingva(root.path())
        .args(["init", "--non-interactive", "--format", "json"])
        .env("HOME", &home)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(
        refresh
            .recv()
            .unwrap()
            .body
            .contains("refresh_token=refresh-secret")
    );
    let request = projects.recv().unwrap();
    assert_eq!(request.headers["authorization"], "Bearer fresh-access");
    assert_eq!(request.url, "/api/cli/projects");
    let document: Value =
        serde_yaml::from_slice(&fs::read(root.path().join("lingva.config.yaml")).unwrap()).unwrap();
    assert_eq!(document["projectId"], "remote-demo");
    assert_eq!(document["locales"], serde_json::json!(["en", "de"]));
    assert_eq!(document["defaultLocale"], "de");
    assert_eq!(document["environment"], "production");
    assert_eq!(document["apiUrl"], "https://publish.example.test");
    assert!(document.get("apiKey").is_none_or(Value::is_null));
}

#[test]
fn credential_cli_status_key_and_logout_never_expose_the_raw_key() {
    let root = tempfile::tempdir().unwrap();
    let home = root.path().join("home");
    let invoke = |args: &[&str]| {
        lingva(root.path())
            .args(args)
            .env("HOME", &home)
            .output()
            .unwrap()
    };
    let empty = invoke(&["auth", "status", "--format", "json"]);
    assert_eq!(empty.status.code(), Some(1));
    // In particular, Windows must honor the child USERPROFILE rather than
    // resolving the shared runner profile through the known-folder API.
    let status: Value = serde_json::from_slice(&empty.stdout).unwrap();
    assert_eq!(
        std::path::PathBuf::from(status["credentialsFile"].as_str().unwrap()),
        home.join(".lingva/credentials.json")
    );
    let saved = invoke(&[
        "auth",
        "use-key",
        "--api-key",
        "super-secret-project-key",
        "--project-id",
        "demo",
        "--api-url",
        "https://publish.example.test",
        "--format",
        "json",
    ]);
    assert!(saved.status.success());
    assert!(!String::from_utf8_lossy(&saved.stdout).contains("super-secret-project-key"));
    let status = invoke(&["auth", "status", "--format", "json"]);
    let value: Value = serde_json::from_slice(&status.stdout).unwrap();
    assert!(status.status.success());
    assert_eq!(value["authenticated"], true);
    assert_eq!(value["authMethod"], "api-key");
    assert_eq!(value["projectId"], "demo");
    assert!(!String::from_utf8_lossy(&status.stdout).contains("super-secret-project-key"));
    for _ in 0..2 {
        assert!(
            invoke(&["auth", "logout", "--format", "json"])
                .status
                .success()
        );
    }
    assert!(!home.join(".lingva/credentials.json").exists());
    assert_eq!(invoke(&["auth", "status"]).status.code(), Some(1));
}

#[test]
fn invalid_init_combinations_never_create_partial_project_files() {
    for options in [
        vec!["--no-auth"],
        vec!["--ci", "github", "--no-auth"],
        vec!["--mode", "local", "--no-auth", "--wizard"],
        vec![
            "--mode",
            "local",
            "--no-auth",
            "--locales-dir",
            "locales",
            "--translation-files",
            "other/{locale}.json",
        ],
        vec![
            "--mode",
            "local",
            "--no-auth",
            "--config-file",
            "lingva.config.ts",
        ],
        vec![
            "--mode",
            "local",
            "--no-auth",
            "--provider-file",
            "provider.ts",
        ],
        vec![
            "--mode",
            "local",
            "--no-auth",
            "--sdk",
            "python",
            "--provider-file",
            "provider.py",
        ],
        vec!["--mode", "local", "--no-auth", "--locale", "../escape"],
    ] {
        let root = tempfile::tempdir().unwrap();
        let output = lingva(root.path())
            .arg("init")
            .args(&options)
            .env("HOME", root.path().join("home"))
            .output()
            .unwrap();
        assert!(!output.status.success(), "{options:?}");
        assert_eq!(fs::read_dir(root.path()).unwrap().count(), 0, "{options:?}");
    }
}

#[test]
fn device_login_exchanges_the_device_grant_and_saves_credentials_only_after_success() {
    let root = tempfile::tempdir().unwrap();
    let (endpoint, captured) = serve_sequence(vec![
        (
            200,
            vec![("content-type", "application/json")],
            r#"{"device_code":"device-secret","user_code":"ABC123","verification_uri":"https://login.example.test/device","expires_in":5,"interval":1}"#,
        ),
        (
            200,
            vec![("content-type", "application/json")],
            r#"{"access_token":"device-access","refresh_token":"device-refresh","expires_in":3600,"token_type":"Bearer"}"#,
        ),
    ]);
    let output = device_login_command(root.path(), &endpoint)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let first = captured.recv().unwrap();
    let second = captured.recv().unwrap();
    let parse = |source: &str| {
        url::form_urlencoded::parse(source.as_bytes())
            .into_owned()
            .collect::<BTreeMap<_, _>>()
    };
    assert_eq!(parse(&first.body)["client_id"], "public-client");
    let token_form = parse(&second.body);
    assert_eq!(
        token_form["grant_type"],
        "urn:ietf:params:oauth:grant-type:device_code"
    );
    assert_eq!(token_form["device_code"], "device-secret");
    let saved: Value = serde_json::from_slice(
        &fs::read(root.path().join("home/.lingva/credentials.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(saved["accessToken"], "device-access");
    assert_eq!(saved["refreshToken"], "device-refresh");
}

#[test]
fn invalid_expired_and_denied_device_authorization_never_store_credentials() {
    for (body, expected) in [
        (
            r#"{"device_code":"d","user_code":"u","verification_uri":"file:///tmp/unsafe","expires_in":5,"interval":1}"#,
            "HTTP or HTTPS",
        ),
        (
            r#"{"device_code":"d","user_code":"u","verification_uri":"https://login.example.test","expires_in":0,"interval":1}"#,
            "expired",
        ),
    ] {
        let root = tempfile::tempdir().unwrap();
        let (endpoint, _) = serve_once(200, &[("content-type", "application/json")], body);
        let output = device_login_command(root.path(), &endpoint)
            .output()
            .unwrap();
        assert!(!output.status.success());
        assert!(String::from_utf8_lossy(&output.stderr).contains(expected));
        assert!(!root.path().join("home/.lingva/credentials.json").exists());
    }
    let root = tempfile::tempdir().unwrap();
    let (endpoint, _) = serve_sequence(vec![
        (
            200,
            vec![("content-type", "application/json")],
            r#"{"device_code":"d","user_code":"u","verification_uri":"https://login.example.test","expires_in":5,"interval":1}"#,
        ),
        (
            400,
            vec![("content-type", "application/json")],
            r#"{"error":"access_denied","error_description":"User denied access"}"#,
        ),
    ]);
    let output = device_login_command(root.path(), &endpoint)
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("User denied access"));
    assert!(!root.path().join("home/.lingva/credentials.json").exists());
}

#[test]
fn browser_login_validates_callback_state_and_exchanges_matching_pkce_verifier() {
    use base64::Engine;
    use sha2::{Digest, Sha256};
    use std::io::{BufRead, BufReader};
    use std::process::Stdio;
    for (valid_state, token_status, token_body, blocked_store, duplicate_code) in [
        (
            false,
            200,
            r#"{"access_token":"browser-access","expires_in":3600}"#,
            false,
            false,
        ),
        (
            true,
            200,
            r#"{"access_token":"browser-access","expires_in":3600}"#,
            false,
            false,
        ),
        (true, 400, r#"{"error":"invalid_grant"}"#, false, false),
        (true, 200, r#"{"access_token":""}"#, false, false),
        (
            true,
            200,
            r#"{"access_token":"browser-access"}"#,
            true,
            false,
        ),
        (
            true,
            200,
            r#"{"access_token":"browser-access"}"#,
            false,
            true,
        ),
    ] {
        let root = tempfile::tempdir().unwrap();
        if blocked_store {
            fs::create_dir_all(root.path().join("home/.lingva/credentials.json")).unwrap();
        }
        let success = valid_state
            && token_status == 200
            && !blocked_store
            && !duplicate_code
            && token_body.contains("browser-access");
        let (token_url, capture) = if valid_state && !duplicate_code {
            let (url, rx) = serve_once(
                token_status,
                &[("content-type", "application/json")],
                token_body,
            );
            (url, Some(rx))
        } else {
            ("http://127.0.0.1:1".into(), None)
        };
        let mut child = lingva(root.path())
            .args([
                "auth",
                "login",
                "--no-browser",
                "--port",
                "0",
                "--authorize-url",
                "https://login.example.test/authorize",
                "--token-url",
                &token_url,
                "--client-id",
                "public-client",
            ])
            .env("HOME", root.path().join("home"))
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        let stdout = child.stdout.take().unwrap();
        let (sender, receiver) = mpsc::channel();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines() {
                let line = line.unwrap();
                if line.starts_with("https://login.example.test/") {
                    let _ = sender.send(line);
                }
            }
        });
        let login_url = match receiver.recv_timeout(std::time::Duration::from_secs(10)) {
            Ok(url) => url::Url::parse(&url).unwrap(),
            Err(error) => {
                child.kill().unwrap();
                panic!("No login URL: {error}");
            }
        };
        let query = login_url
            .query_pairs()
            .into_owned()
            .collect::<BTreeMap<_, _>>();
        assert_eq!(query["code_challenge_method"], "S256");
        let mut callback = url::Url::parse(&query["redirect_uri"]).unwrap();
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .unwrap();
        assert_eq!(
            client
                .get(callback.join("/favicon.ico").unwrap())
                .send()
                .unwrap()
                .status(),
            404
        );
        assert_eq!(client.post(callback.clone()).send().unwrap().status(), 404);
        callback
            .query_pairs_mut()
            .append_pair("code", "authorization-code")
            .append_pair(
                "state",
                if valid_state {
                    &query["state"]
                } else {
                    "wrong-state"
                },
            );
        if duplicate_code {
            callback.query_pairs_mut().append_pair("code", "duplicate");
        }
        let response = client.get(callback).send().unwrap();
        assert_eq!(response.status().is_success(), success);
        let html = response.text().unwrap();
        assert_eq!(html.contains("CLI is authenticated"), success);
        assert_eq!(
            root.path().join("home/.lingva/credentials.json").is_file(),
            success
        );
        let output = child.wait_with_output().unwrap();
        assert_eq!(
            output.status.success(),
            success,
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert_eq!(
            root.path().join("home/.lingva/credentials.json").is_file(),
            success
        );
        if let Some(capture) = capture {
            let request = capture.recv().unwrap();
            let form = url::form_urlencoded::parse(request.body.as_bytes())
                .into_owned()
                .collect::<BTreeMap<_, _>>();
            assert_eq!(form["grant_type"], "authorization_code");
            assert_eq!(form["code"], "authorization-code");
            let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD
                .encode(Sha256::digest(form["code_verifier"].as_bytes()));
            assert_eq!(challenge, query["code_challenge"]);
            assert_eq!(form["redirect_uri"], query["redirect_uri"]);
        }
    }
}
