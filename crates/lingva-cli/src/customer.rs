//! Portable customer command surface, independent of installation adapters.
//!
//! Platform emulation deliberately stays outside this binary. All customer
//! writes validate their complete input before modifying project files.

use crate::{
    OutputFormat,
    api::LingvaApi,
    config::{Config, DEFAULT_CONFIG_FILE},
    local::{self, Dictionary},
    project::{self, Project},
};
use anyhow::{Context, Result, bail};
use clap::{Args, Subcommand, ValueEnum};
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
};

const LIST_DRAFTS: &str = "list-drafts";
const APPROVE_DRAFT: &str = "approve-draft";

#[derive(Debug, Subcommand)]
pub enum Command {
    /// Scaffold metadata without replacing existing descriptions or reviewers.
    Metadata(MetadataArgs),
    /// Apply a JSON translation dictionary and align the locale schema.
    Apply(ApplyArgs),
    /// Apply a local or hosted authoring draft.
    Approve(ApproveArgs),
    /// Export a self-contained translation editor.
    Studio(StudioArgs),
    /// List hosted authoring drafts, including pagination.
    Drafts(DraftArgs),
    /// Validate translations, variants, metadata, and workflow policies.
    Validate(ValidationArgs),
    /// Describe keys, variables, metadata, and locale presence.
    Manifest(ArtifactArgs),
    /// Build one fallback-resolved locale bundle.
    Bundle(BundleArgs),
    /// Generate publish artifacts or publish them to a hosted project.
    Publish(PublishArgs),
    /// Invalidate hosted delivery after an external update.
    Invalidate(InvalidateArgs),
    /// Report translation and review workflow state.
    Workflow(ArtifactArgs),
    /// Generate TypeScript locale and translation key types.
    Types(ArtifactArgs),
    /// Generate typed lookup and presence helpers.
    Helpers(ArtifactArgs),
    /// Export normalized project JSON.
    Export(ArtifactArgs),
    /// Normalize JSON resources, optionally merging an existing project.
    Import(ImportArgs),
    /// Extract literal translation keys from application source.
    Extract(crate::extraction::ExtractArgs),
}

#[derive(Debug, Clone, Args)]
pub struct ArtifactArgs {
    #[arg(default_value = DEFAULT_CONFIG_FILE)]
    pub config_file: PathBuf,
    #[arg(long)]
    pub output: Option<PathBuf>,
    #[arg(long)]
    pub no_summary: bool,
    #[arg(long)]
    pub no_metadata: bool,
    #[arg(long, value_enum, default_value_t = OutputFormat::Text)]
    pub format: OutputFormat,
}

#[derive(Debug, Args)]
pub struct BundleArgs {
    #[command(flatten)]
    pub artifact: ArtifactArgs,
    #[arg(long)]
    pub locale: String,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum StudioFormat {
    Html,
    Json,
}

#[derive(Debug, Args)]
pub struct StudioArgs {
    #[arg(default_value = DEFAULT_CONFIG_FILE)]
    pub config_file: PathBuf,
    #[arg(long)]
    pub output: Option<PathBuf>,
    #[arg(long)]
    pub no_summary: bool,
    #[arg(long)]
    pub no_metadata: bool,
    #[arg(long, value_enum, default_value_t = StudioFormat::Html)]
    pub format: StudioFormat,
}

#[derive(Debug, Args)]
pub struct MetadataArgs {
    #[command(flatten)]
    pub artifact: ArtifactArgs,
    #[arg(long)]
    pub dry_run: bool,
    #[arg(long)]
    pub check: bool,
    #[arg(long, value_parser = ["draft", "translated", "reviewed", "approved"])]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum FailOn {
    None,
    Error,
    Warning,
    Info,
    VariantDrift,
}

#[derive(Debug, Args)]
pub struct ValidationArgs {
    #[command(flatten)]
    pub artifact: ArtifactArgs,
    #[arg(long, value_enum)]
    pub fail_on: Option<FailOn>,
    #[arg(long, value_delimiter = ',')]
    pub only: Vec<String>,
    #[arg(long, value_delimiter = ',')]
    pub ignore: Vec<String>,
    #[arg(long)]
    pub max_issues: Option<usize>,
    #[arg(long)]
    pub policy: Option<String>,
    #[arg(long)]
    pub glob: Option<String>,
    #[arg(long)]
    pub config: Option<PathBuf>,
}

#[derive(Debug, Args)]
pub struct ApplyArgs {
    #[command(flatten)]
    pub artifact: ArtifactArgs,
    #[arg(long)]
    pub locale: String,
    #[arg(long)]
    pub input: PathBuf,
    #[arg(long)]
    pub no_sync: bool,
}

#[derive(Debug, Args)]
pub struct ImportArgs {
    pub input: PathBuf,
    #[arg(long)]
    pub project: Option<PathBuf>,
    #[arg(long)]
    pub project_id: Option<String>,
    #[arg(long)]
    pub output: Option<PathBuf>,
    #[arg(long, value_enum, default_value_t = OutputFormat::Json)]
    pub format: OutputFormat,
}

#[derive(Debug, Clone, Args)]
pub struct EndpointArgs {
    #[arg(long)]
    pub api_url: Option<String>,
    #[arg(long)]
    pub auth_token: Option<String>,
    #[arg(long)]
    pub environment: Option<String>,
}

#[derive(Debug, Args)]
pub struct DraftArgs {
    #[command(flatten)]
    pub artifact: ArtifactArgs,
    #[command(flatten)]
    pub endpoint: EndpointArgs,
    #[arg(long)]
    pub locale: Option<String>,
    #[arg(long)]
    pub key: Option<String>,
    #[arg(long, value_parser = ["draft", "approved", "all"])]
    pub status: Option<String>,
    #[arg(long)]
    pub include_approved: bool,
    #[arg(long, value_parser = clap::value_parser!(u32).range(1..=100))]
    pub limit: Option<u32>,
    #[arg(long)]
    pub next_token: Option<String>,
    #[arg(long)]
    pub output_dir: Option<PathBuf>,
}

#[derive(Debug, Args)]
pub struct ApproveArgs {
    #[command(flatten)]
    pub artifact: ArtifactArgs,
    #[command(flatten)]
    pub endpoint: EndpointArgs,
    #[arg(
        long,
        required_unless_present = "draft_id",
        conflicts_with = "draft_id"
    )]
    pub draft: Option<PathBuf>,
    #[arg(long, required_unless_present = "draft")]
    pub draft_id: Option<String>,
    #[arg(long)]
    pub approved_by: Option<String>,
    #[arg(long)]
    pub dry_run: bool,
    #[arg(long)]
    pub no_sync: bool,
    #[arg(long)]
    pub no_mark_approved: bool,
    #[arg(long, conflicts_with = "no_sync")]
    pub push: bool,
    #[arg(long, requires = "push")]
    pub invalidate: bool,
    #[arg(long)]
    pub publish_api_url: Option<String>,
    #[arg(long)]
    pub publish_auth_token: Option<String>,
    #[arg(long, value_enum, default_value_t = crate::DeliverySource::Repository)]
    pub source: crate::DeliverySource,
    #[arg(long)]
    pub force: bool,
    #[arg(long, value_delimiter = ',')]
    pub locale: Vec<String>,
    #[arg(long)]
    pub output_dir: Option<PathBuf>,
    #[arg(long)]
    pub reason: Option<String>,
}

#[derive(Debug, Args)]
pub struct PublishArgs {
    #[command(flatten)]
    pub artifact: ArtifactArgs,
    #[command(flatten)]
    pub endpoint: EndpointArgs,
    #[arg(long)]
    pub config: Option<PathBuf>,
    #[arg(long, value_delimiter = ',')]
    pub locale: Vec<String>,
    #[arg(long)]
    pub output_dir: Option<PathBuf>,
    #[arg(long)]
    pub force: bool,
    /// Validate and report artifacts without writing files or contacting the platform.
    #[arg(long, conflicts_with = "local_only")]
    pub dry_run: bool,
    /// Export local artifacts without contacting a configured hosted endpoint.
    #[arg(long)]
    pub local_only: bool,
}

#[derive(Debug, Args)]
pub struct InvalidateArgs {
    #[command(flatten)]
    pub artifact: ArtifactArgs,
    #[command(flatten)]
    pub endpoint: EndpointArgs,
    #[arg(long)]
    pub config: Option<PathBuf>,
    #[arg(long, value_enum, default_value_t = crate::DeliverySource::Repository)]
    pub source: crate::DeliverySource,
    #[arg(long)]
    pub reason: Option<String>,
}

/// Writes reports only after command success; JSON is always machine-readable.
pub fn report(payload: &Value, args: &ArtifactArgs, text: String) -> Result<()> {
    let source = if args.format == OutputFormat::Json {
        serde_json::to_string_pretty(payload)?
    } else {
        text
    };
    if let Some(path) = &args.output {
        write_text(path, &source)?;
    }
    println!("{source}");
    Ok(())
}

pub fn write_text(path: &Path, source: &str) -> Result<()> {
    if let Some(parent) = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent)?;
    }
    crate::atomic_file::write(path, format!("{}\n", source.trim_end()), false)?;
    Ok(())
}

pub fn run(command: Command) -> Result<u8> {
    match command {
        Command::Validate(args) => validate(args, false),
        Command::Extract(args) => crate::extraction::run(args),
        Command::Metadata(args) => metadata(args),
        Command::Apply(args) => apply(args),
        Command::Approve(args) => approve(args),
        Command::Drafts(args) => drafts(args),
        Command::Import(args) => import(args),
        Command::Bundle(args) => {
            let project = Project::load(&args.artifact.config_file)?;
            let bundle = project.bundle(&args.locale, !args.artifact.no_metadata)?;
            report(
                &bundle,
                &args.artifact,
                serde_json::to_string_pretty(&bundle)?,
            )?;
            Ok(0)
        }
        Command::Publish(args) => publish(args),
        Command::Invalidate(args) => {
            let mut config = Config::load(&args.artifact.config_file)?;
            if let Some(path) = &args.config {
                config = settings_config(Some(&config), path)?;
            }
            let (url, token) = endpoint(&config, &args.endpoint, "invalidate")?;
            config.api_url = Some(url);
            if let Some(environment) = args.endpoint.environment {
                config.environment = environment;
            }
            let value = LingvaApi::new()?.invalidate(
                &config,
                token.as_deref(),
                args.source.as_str(),
                args.reason.as_deref(),
            )?;
            report(
                &value,
                &args.artifact,
                serde_json::to_string_pretty(&value)?,
            )?;
            Ok(0)
        }
        Command::Manifest(args) => artifact(args, Artifact::Manifest),
        Command::Workflow(args) => artifact(args, Artifact::Workflow),
        Command::Types(args) => artifact(args, Artifact::Types),
        Command::Helpers(args) => artifact(args, Artifact::Helpers),
        Command::Export(args) => artifact(args, Artifact::Export),
        Command::Studio(args) => artifact(
            ArtifactArgs {
                config_file: args.config_file,
                output: args.output,
                no_summary: args.no_summary,
                no_metadata: args.no_metadata,
                format: match args.format {
                    StudioFormat::Html => OutputFormat::Text,
                    StudioFormat::Json => OutputFormat::Json,
                },
            },
            Artifact::Studio,
        ),
    }
}

enum Artifact {
    Manifest,
    Workflow,
    Types,
    Helpers,
    Export,
    Studio,
}

fn artifact(args: ArtifactArgs, kind: Artifact) -> Result<u8> {
    let project = Project::load(&args.config_file)?;
    let payload = match kind {
        Artifact::Workflow => project.workflow()?,
        Artifact::Export | Artifact::Studio => project.export()?,
        _ => project.manifest()?,
    };
    let text = match kind {
        Artifact::Types | Artifact::Helpers => project::types(
            &payload,
            matches!(kind, Artifact::Helpers),
            !args.no_metadata,
        )?,
        Artifact::Studio => studio(&payload)?,
        _ => serde_json::to_string_pretty(&payload)?,
    };
    // Code and HTML are artifacts, not a JSON report when --format is omitted.
    report(&payload, &args, text)?;
    Ok(0)
}

pub fn policy(config: &Config, kind: &str, name: Option<&str>) -> Result<Value> {
    let settings = config.settings.get("cli").unwrap_or(&Value::Null);
    let setting = |key: &str| settings.get(key).or_else(|| config.settings.get(key));
    let mut policy = setting(kind).cloned().unwrap_or_else(|| json!({}));
    if let Some(name) = name {
        let policies_key = format!("{kind}Policies");
        let selected = setting(&policies_key)
            .and_then(|policies| policies.get(name))
            .with_context(|| format!("Unknown {kind} policy \"{name}\"."))?;
        policy
            .as_object_mut()
            .context("Policy must be an object.")?
            .extend(
                selected
                    .as_object()
                    .context("Named policy must be an object.")?
                    .clone(),
            );
    }
    Ok(policy)
}

/// Separate policy files need no project identity. Never let settings move the
/// resource owner or replace the project being validated/published.
pub fn settings_config(base: Option<&Config>, path: &Path) -> Result<Config> {
    let path = crate::config::absolute_path(path)?;
    let source = fs::read_to_string(&path)?;
    let value: Value = if path.extension().and_then(|extension| extension.to_str()) == Some("json")
    {
        serde_json::from_str(&source)?
    } else {
        serde_yaml::from_str(&source)?
    };
    let settings = value
        .as_object()
        .context("CLI settings must contain an object.")?;
    let mut config = if let Some(base) = base {
        base.clone()
    } else {
        Config::from_document(
            path.clone(),
            serde_json::from_value(json!({"projectId":"cli-policy","locales":["en"]}))?,
        )?
    };
    for name in [
        "cli",
        "validate",
        "validatePolicies",
        "extract",
        "extractPolicies",
        "publish",
        "invalidate",
        "authoring",
    ] {
        if let Some(value) = settings.get(name) {
            config.settings.insert(name.into(), value.clone());
        }
    }
    if let Some(url) = settings
        .get("apiUrl")
        .or_else(|| settings.get("cli").and_then(|cli| cli.get("apiUrl")))
    {
        config.api_url = Some(url.as_str().context("apiUrl must be a string.")?.into());
    }
    if let Some(name) = settings.get("apiKeyEnv") {
        let name = name.as_str().context("apiKeyEnv must be a string.")?;
        if let Ok(token) = std::env::var(name) {
            if !token.trim().is_empty() {
                config.api_key = Some(token);
            }
        }
    }
    Ok(config)
}

pub fn validate(args: ValidationArgs, check: bool) -> Result<u8> {
    let paths = if args.artifact.config_file.is_dir() {
        let mut paths = Vec::new();
        crate::extraction::collect_files(&args.artifact.config_file, &mut paths)?;
        let glob = args.glob.as_deref().unwrap_or("lingva.config.*");
        paths
            .into_iter()
            .filter(|path| {
                crate::extraction::glob_matches(
                    glob,
                    path.file_name().unwrap().to_str().unwrap_or(""),
                )
            })
            .collect::<Vec<_>>()
    } else {
        vec![args.artifact.config_file.clone()]
    };
    if paths.is_empty() {
        bail!("No Lingva project files matched.");
    }
    let mut results = Vec::new();
    let mut failed = false;
    for path in paths {
        let project = Project::load(&path)?;
        let policy_config = if let Some(path) = &args.config {
            settings_config(Some(&project.config), path)?
        } else {
            project.config.clone()
        };
        let policy = policy(&policy_config, "validate", args.policy.as_deref())?;
        let only = option_list(&args.only, policy.get("onlyCodes"));
        let ignore = option_list(&args.ignore, policy.get("ignoreCodes"));
        let mut issues = project
            .issues()
            .into_iter()
            .filter(|issue| {
                let code = issue["code"].as_str().unwrap();
                (only.is_empty() || only.iter().any(|value| value == code))
                    && !ignore.iter().any(|value| value == code)
            })
            .collect::<Vec<_>>();
        let configured_threshold = policy
            .get("failOn")
            .map(|value| {
                let name = value
                    .as_str()
                    .context("Validation failOn must be a string.")?;
                FailOn::from_str(name, true).map_err(|error| anyhow::anyhow!(error))
            })
            .transpose()?;
        let fail_on = args
            .fail_on
            .or(configured_threshold)
            .unwrap_or(FailOn::Error);
        let threshold = issues.iter().any(|issue| match fail_on {
            FailOn::None => false,
            FailOn::Error => issue["severity"] == "error",
            FailOn::Warning => issue["severity"] == "error" || issue["severity"] == "warning",
            FailOn::Info => true,
            FailOn::VariantDrift => [
                "missing_locale_variant",
                "extra_locale_variant",
                "variant_metadata_mismatch",
                "translation_contract_mismatch",
            ]
            .contains(&issue["code"].as_str().unwrap()),
        });
        let mut value = project::validation_result(issues.clone());
        if let Some(limit) = args.max_issues.or_else(|| {
            policy
                .get("maxIssues")
                .and_then(Value::as_u64)
                .map(|value| value as usize)
        }) {
            let count = issues.len();
            issues.truncate(limit);
            value["issues"] = json!(issues);
            value["issueCount"] = json!(count);
            value["truncated"] = json!(count > limit);
        }
        value["projectFile"] = json!(project.config.path);
        value["shouldFail"] = json!(threshold);
        if check {
            let sync = local::sync(&project.config, false)?;
            value["hasDrift"] = json!(sync.has_drift);
            value["passed"] = json!(!threshold && !sync.has_drift);
            value["sync"] = serde_json::to_value(&sync)?;
            failed |= sync.has_drift;
        }
        failed |= threshold;
        results.push(value);
    }
    let payload = if results.len() == 1 {
        results.remove(0)
    } else {
        json!({"projectCount":results.len(),"valid":results.iter().all(|result|result["valid"]==true),"shouldFail":failed,"results":results})
    };
    let drift = payload
        .get("hasDrift")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let text = if args.artifact.no_summary {
        serde_json::to_string_pretty(&payload)?
    } else {
        format!(
            "Lingva {}: {}\n{}",
            if check { "check" } else { "validation" },
            if drift {
                "failed (locale drift detected)"
            } else if failed {
                "failed"
            } else {
                "passed"
            },
            serde_json::to_string_pretty(&payload)?
        )
    };
    report(&payload, &args.artifact, text)?;
    Ok(u8::from(failed))
}

fn option_list(explicit: &[String], fallback: Option<&Value>) -> Vec<String> {
    if !explicit.is_empty() {
        explicit.to_vec()
    } else {
        fallback
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
            .map(str::to_owned)
            .collect()
    }
}

fn metadata(args: MetadataArgs) -> Result<u8> {
    let project = Project::load(&args.artifact.config_file)?;
    let default = &project.resources[&project.config.default_locale];
    let keys = local::flatten(default)?.into_keys().collect::<Vec<_>>();
    let output = args.artifact.output.clone().unwrap_or_else(|| {
        project.config.path.parent().unwrap().join(
            project
                .config
                .settings
                .get("metadataFile")
                .and_then(Value::as_str)
                .unwrap_or(project::DEFAULT_METADATA_FILE),
        )
    });
    let mut existing = local::read_dictionary(&output)?;
    existing.extend(project.metadata);
    let missing = keys
        .iter()
        .filter(|key| !existing.contains_key(*key))
        .cloned()
        .collect::<Vec<_>>();
    let mut metadata = Dictionary::new();
    for key in &keys {
        let value = existing.get(key).cloned().unwrap_or_else(|| {
            let mut value = json!({"description":"","status":args.status.as_deref().unwrap_or(project::WORKFLOW_STATUSES[0])});
            if let Some((namespace, _)) = key.split_once('.') { value["namespace"] = json!(namespace); }
            value
        });
        metadata.insert(key.clone(), value);
    }
    let written = !args.dry_run && !args.check;
    if written {
        local::write_dictionary(&output, &metadata)?;
    }
    let payload = json!({"configFile":project.config.path,"defaultLocale":project.config.default_locale,"outputFile":output,"keyCount":keys.len(),"added":missing.len(),"preserved":keys.len()-missing.len(),"missingKeys":missing,"hasDrift":!missing.is_empty(),"written":written,"metadata":metadata});
    // --output names metadata, not a report that could overwrite it.
    let mut report_args = args.artifact;
    report_args.output = None;
    report(
        &payload,
        &report_args,
        serde_json::to_string_pretty(&payload)?,
    )?;
    Ok(u8::from(args.check && !missing.is_empty()))
}

fn patch_dictionary(base: &Dictionary, patch: &Dictionary) -> Dictionary {
    let mut result = base.clone();
    for (key, value) in patch {
        let value = match (
            result.get(key).and_then(Value::as_object),
            value.as_object(),
        ) {
            (Some(base), Some(patch)) => Value::Object(patch_dictionary(base, patch)),
            _ => value.clone(),
        };
        result.insert(key.clone(), value);
    }
    result
}

fn apply(args: ApplyArgs) -> Result<u8> {
    let project = Project::load(&args.artifact.config_file)?;
    crate::validate_locales(&project.config, std::slice::from_ref(&args.locale))?;
    let patch = read_required_dictionary(&args.input)?;
    local::flatten(&patch)?;
    let default = &project.resources[&project.config.default_locale];
    let next = if args.locale == project.config.default_locale {
        patch_dictionary(default, &patch)
    } else {
        local::merge_missing(default, &patch)
    };
    local::flatten(&next)?;
    let path = project.config.translation_path(&args.locale);
    let synced = !args.no_sync && args.locale == project.config.default_locale;
    if synced {
        local::sync(&project.config, false)?;
    }
    project
        .config
        .write_translations(&BTreeMap::from([(args.locale.clone(), next)]))?;
    if synced {
        local::sync(&project.config, true)?;
    }
    let payload = json!({"configFile":project.config.path,"locale":args.locale,"inputFile":args.input,"filePath":path,"synced":synced});
    report(
        &payload,
        &args.artifact,
        serde_json::to_string_pretty(&payload)?,
    )?;
    Ok(0)
}

fn read_required_dictionary(path: &Path) -> Result<Dictionary> {
    let source = fs::read_to_string(path)
        .with_context(|| format!("Cannot read input {}.", path.display()))?;
    serde_json::from_str(&source).context("Input must contain a JSON object.")
}

fn import(args: ImportArgs) -> Result<u8> {
    let input = read_required_dictionary(&args.input)?;
    let resources = input.get("resources").unwrap_or(&Value::Null);
    let resources = if resources.is_null() {
        Value::Object(input.clone())
    } else {
        resources.clone()
    };
    let resources: BTreeMap<String, Dictionary> =
        serde_json::from_value(resources).context("Resources must map locales to dictionaries.")?;
    if resources.is_empty() {
        bail!("Import requires at least one locale.");
    }
    for dictionary in resources.values() {
        local::flatten(dictionary)?;
    }
    let mut payload = if let Some(path) = &args.project {
        Project::load(path)?.export()?
    } else {
        json!({"projectId":args.project_id.as_deref().unwrap_or("imported-project"),"defaultLocale":resources.keys().next().unwrap(),"resources":{}})
    };
    for field in [
        "projectId",
        "environment",
        "defaultLocale",
        "fallbackLocale",
        "keyMetadata",
    ] {
        if let Some(value) = input.get(field) {
            payload[field] = value.clone();
        }
    }
    if let Some(id) = args.project_id {
        payload["projectId"] = json!(id);
    }
    for (locale, dictionary) in resources {
        let base = payload["resources"]
            .get(&locale)
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default();
        payload["resources"][locale] = json!(patch_dictionary(&base, &dictionary));
    }
    // Reject unsafe locale IDs and invalid identities before creating output.
    let document = serde_json::from_value(payload.clone())?;
    Config::from_document(
        crate::config::absolute_path(
            args.output
                .as_deref()
                .unwrap_or(Path::new("imported.project.json")),
        )?,
        document,
    )?;
    let source = serde_json::to_string_pretty(&payload)?;
    if let Some(path) = args.output {
        write_text(&path, &source)?;
    }
    println!("{source}");
    Ok(0)
}

pub fn endpoint(
    config: &Config,
    explicit: &EndpointArgs,
    section: &str,
) -> Result<(String, Option<String>)> {
    let cli = config.settings.get("cli");
    let section = cli
        .and_then(|cli| cli.get(section))
        .or_else(|| config.settings.get(section));
    let url = explicit
        .api_url
        .clone()
        .or_else(|| {
            section
                .and_then(|section| section.get("apiUrl"))
                .and_then(Value::as_str)
                .map(str::to_owned)
        })
        .or_else(|| config.api_url.clone())
        .context("Command requires --api-url or a configured API endpoint.")?;
    let token = explicit.auth_token.clone().or_else(|| {
        section
            .and_then(|section| section.get("authToken"))
            .and_then(Value::as_str)
            .map(str::to_owned)
    });
    let token = crate::resolve_token(config, token, &crate::credentials::default_path()?)?;
    Ok((url, token))
}

fn draft_page(config: &Config, endpoint_args: &EndpointArgs, filters: Value) -> Result<Value> {
    let (url, token) = endpoint(config, endpoint_args, "authoring")?;
    let mut payload = json!({"action":LIST_DRAFTS,"projectId":config.project_id,"environment":endpoint_args.environment.as_deref().unwrap_or(&config.environment)});
    payload
        .as_object_mut()
        .unwrap()
        .extend(filters.as_object().unwrap().clone());
    let result = LingvaApi::new()?.post_json(&url, &payload, token.as_deref())?;
    result
        .get("drafts")
        .and_then(Value::as_array)
        .context("Hosted drafts response has no drafts array.")?;
    Ok(result)
}

fn drafts(args: DraftArgs) -> Result<u8> {
    let config = Config::load(&args.artifact.config_file)?;
    if let Some(locale) = &args.locale {
        crate::validate_locales(&config, std::slice::from_ref(locale))?;
    }
    if let Some(key) = &args.key {
        local::validate_key(key)?;
    }
    let mut filters = json!({});
    for (field, value) in [
        ("locale", json!(args.locale)),
        ("key", json!(args.key)),
        ("limit", json!(args.limit)),
        ("nextToken", json!(args.next_token)),
        ("status", json!(args.status)),
    ] {
        if !value.is_null() {
            filters[field] = value;
        }
    }
    if args.include_approved || args.status.as_deref() == Some("all") {
        filters["includeApproved"] = json!(true);
    }
    let mut payload = draft_page(&config, &args.endpoint, filters)?;
    let mut outputs = Vec::new();
    if let Some(directory) = args.output_dir {
        for draft in payload["drafts"].as_array().unwrap() {
            let id = draft["draftId"].as_str().context("Draft has no draftId.")?;
            // IDs are untrusted network values; never use them as path components.
            use sha2::{Digest, Sha256};
            let path = directory.join(format!("{:x}.draft.json", Sha256::digest(id.as_bytes())));
            write_text(&path, &serde_json::to_string_pretty(draft)?)?;
            outputs.push(path);
        }
    }
    payload["outputFiles"] = json!(outputs);
    report(
        &payload,
        &args.artifact,
        serde_json::to_string_pretty(&payload)?,
    )?;
    Ok(0)
}

fn approve(args: ApproveArgs) -> Result<u8> {
    let project = Project::load(&args.artifact.config_file)?;
    let draft = if let Some(path) = args.draft {
        Value::Object(read_required_dictionary(&path)?)
    } else {
        let id = args.draft_id.as_deref().unwrap();
        let mut token = None;
        let mut seen = BTreeSet::new();
        loop {
            let page = draft_page(
                &project.config,
                &args.endpoint,
                json!({"limit":100,"nextToken":token}),
            )?;
            if let Some(draft) = page["drafts"]
                .as_array()
                .unwrap()
                .iter()
                .find(|draft| draft["draftId"] == id)
            {
                break draft.clone();
            }
            token = page
                .get("nextToken")
                .and_then(Value::as_str)
                .map(str::to_owned);
            match &token {
                None => bail!("Hosted draft \"{id}\" was not found."),
                Some(token) if !seen.insert(token.clone()) => {
                    bail!("Hosted drafts returned a repeated page token.")
                }
                _ => {}
            }
        }
    };
    let locale = draft["locale"]
        .as_str()
        .context("Draft requires a locale.")?;
    let key = draft["key"].as_str().context("Draft requires a key.")?;
    let value = draft["value"]
        .as_str()
        .context("Draft value must be a string.")?;
    crate::validate_locales(&project.config, &[locale.into()])?;
    local::validate_key(key)?;
    if value.chars().count() > 20_000 {
        bail!("Draft value must be at most 20000 characters.");
    }
    if draft
        .get("environment")
        .and_then(Value::as_str)
        .is_some_and(|environment| {
            environment
                != args
                    .endpoint
                    .environment
                    .as_deref()
                    .unwrap_or(&project.config.environment)
        })
    {
        bail!("Draft belongs to another environment.");
    }
    if draft
        .get("projectId")
        .and_then(Value::as_str)
        .is_some_and(|id| id != project.config.project_id)
    {
        bail!("Draft belongs to another project.");
    }
    let mut dictionary = project.resources[locale].clone();
    let flat = local::flatten(&dictionary)?;
    let next = if let Some(id) = draft.get("variantId").and_then(Value::as_str) {
        if id.trim().is_empty() {
            bail!("Draft variantId must not be empty.");
        }
        if flat.get(key).is_some_and(Value::is_string) {
            bail!("Key does not define translation variants.");
        }
        let mut variants = flat
            .get(key)
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        if let Some(variant) = variants.iter_mut().find(|variant| variant["id"] == id) {
            variant["text"] = json!(value);
        } else {
            variants.push(json!({"id":id,"text":value}));
        }
        json!(variants)
    } else {
        if flat.get(key).is_some_and(local::is_variants) {
            bail!("Variant translation requires a variantId.");
        }
        json!(value)
    };
    local::set_dotted(&mut dictionary, key, next)?;
    local::flatten(&dictionary)?;
    let path = project.config.translation_path(locale);
    if !args.no_sync {
        local::sync(&project.config, false)?;
    }
    if !args.dry_run {
        project
            .config
            .write_translations(&BTreeMap::from([(locale.into(), dictionary)]))?;
        if !args.no_sync {
            local::sync(&project.config, true)?;
        }
        if !args.no_mark_approved {
            if let Some(id) = &args.draft_id {
                let (url, token) = endpoint(&project.config, &args.endpoint, "authoring")?;
                let response = LingvaApi::new()?.post_json(&url, &json!({"action":APPROVE_DRAFT,"projectId":project.config.project_id,"environment":args.endpoint.environment.as_deref().unwrap_or(&project.config.environment),"draftId":id,"approvedBy":args.approved_by}), token.as_deref())
                    .context("Local translation was applied, but hosted approval failed; retry with the same draft ID.")?;
                if response["ok"] != true
                    || response["draftId"] != *id
                    || response["status"] != "approved"
                {
                    bail!(
                        "Local translation was applied, but hosted approval was not confirmed; no publish was attempted."
                    );
                }
            }
        }
        if args.push {
            crate::run_push(crate::PushArgs { config_file:project.config.path.clone(),config:None,output:None,locale:args.locale,api_url:args.publish_api_url,auth_token:args.publish_auth_token,output_dir:args.output_dir,force:args.force,invalidate:args.invalidate,environment:args.endpoint.environment,source:args.source,reason:args.reason,no_summary:true,no_metadata:args.artifact.no_metadata,format:OutputFormat::Text })
                .context("Local translation was applied, but publish failed; retry push after resolving the error.")?;
        }
    }
    let payload = json!({"configFile":project.config.path,"draft":draft,"filePath":path,"synced":!args.no_sync,"dryRun":args.dry_run});
    report(
        &payload,
        &args.artifact,
        serde_json::to_string_pretty(&payload)?,
    )?;
    Ok(0)
}

fn publish(mut args: PublishArgs) -> Result<u8> {
    if args.dry_run {
        args.artifact.output = None;
    }
    let mut project = Project::load(&args.artifact.config_file)?;
    if let Some(path) = &args.config {
        project.config = settings_config(Some(&project.config), path)?;
    }
    if let Some(environment) = &args.endpoint.environment {
        project.config.environment = environment.clone();
    }
    let defaults = policy(&project.config, "publish", None)?;
    let include_metadata =
        !args.artifact.no_metadata && defaults.get("includeMetadata") != Some(&Value::Bool(false));
    let locales = if args.locale.is_empty() {
        project.config.locales.clone()
    } else {
        crate::unique_non_empty(args.locale)
    };
    crate::validate_locales(&project.config, &locales)?;
    let bundles = locales
        .iter()
        .map(|locale| Ok((locale.clone(), project.bundle(locale, include_metadata)?)))
        .collect::<Result<BTreeMap<_, _>>>()?;
    let descriptors = locales.iter().map(|locale|json!({"locale":locale,"fileName":format!("{locale}.bundle.json"),"keyCount":bundles[locale]["keyCount"],"fallbackKeyCount":bundles[locale]["fallbackKeys"].as_array().unwrap().len()})).collect::<Vec<_>>();
    let artifacts = json!({"manifest":{"projectId":project.config.project_id,"environment":args.endpoint.environment.as_deref().unwrap_or(&project.config.environment),"defaultLocale":project.config.default_locale,"fallbackLocale":project.config.fallback_locale,"generatedAt":chrono::Utc::now().to_rfc3339(),"locales":locales,"bundles":descriptors},"bundles":bundles});
    let output_dir = args.output_dir.or_else(|| {
        defaults
            .get("outputDir")
            .and_then(Value::as_str)
            .map(|directory| {
                project
                    .config
                    .path
                    .parent()
                    .unwrap_or(Path::new("."))
                    .join(directory)
            })
    });
    if let Some(directory) = output_dir.filter(|_| !args.dry_run) {
        for (locale, bundle) in &bundles {
            write_text(
                &directory.join(format!("{locale}.bundle.json")),
                &serde_json::to_string_pretty(bundle)?,
            )?;
        }
        write_text(
            &directory.join("manifest.json"),
            &serde_json::to_string_pretty(&artifacts["manifest"])?,
        )?;
    }
    let hosted = args.endpoint.api_url.is_some()
        || project.config.api_url.is_some()
        || project
            .config
            .settings
            .get("cli")
            .and_then(|cli| cli.get("publish"))
            .and_then(|section| section.get("apiUrl"))
            .is_some()
        || project
            .config
            .settings
            .get("publish")
            .and_then(|section| section.get("apiUrl"))
            .is_some();
    if hosted && !args.dry_run && !args.local_only {
        let (url, token) = endpoint(&project.config, &args.endpoint, "publish")?;
        // Reuse the revision/idempotency owner. Publish never invalidates implicitly.
        crate::run_push(crate::PushArgs {
            config_file: project.config.path,
            config: args.config,
            output: args.artifact.output,
            locale: locales,
            api_url: Some(url),
            auth_token: token,
            output_dir: None,
            force: args.force,
            invalidate: false,
            environment: args.endpoint.environment,
            source: crate::DeliverySource::Repository,
            reason: None,
            no_summary: args.artifact.no_summary,
            no_metadata: !include_metadata,
            format: args.artifact.format,
        })
    } else {
        report(
            &artifacts,
            &args.artifact,
            serde_json::to_string_pretty(&artifacts)?,
        )?;
        Ok(0)
    }
}

fn studio(project: &Value) -> Result<String> {
    // Escape script delimiters and JS line separators before embedding JSON.
    let data = serde_json::to_string(project)?
        .replace('<', "\\u003c")
        .replace('>', "\\u003e")
        .replace('&', "\\u0026")
        .replace('\u{2028}', "\\u2028")
        .replace('\u{2029}', "\\u2029");
    Ok(format!(
        "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><title>Lingva Studio</title><h1>Lingva Studio</h1><p>Edit locale JSON. Export and apply with lingva apply.</p><label>Locale <select id=\"locale\"></select></label><br><textarea id=\"editor\" rows=\"30\" cols=\"100\"></textarea><br><button id=\"save\">Export locale JSON</button><p id=\"error\" role=\"alert\"></p><script>const project={data};const select=document.getElementById('locale'),editor=document.getElementById('editor'),error=document.getElementById('error');const locales=Object.keys(project.resources);for(const locale of locales){{const option=document.createElement('option');option.value=locale;option.textContent=locale;select.append(option);}}let active=locales[0];function load(){{editor.value=JSON.stringify(project.resources[active],null,2);}}select.onchange=()=>{{try{{project.resources[active]=JSON.parse(editor.value);active=select.value;load();error.textContent='';}}catch(e){{select.value=active;error.textContent=e.message;}}}};document.getElementById('save').onclick=()=>{{try{{const value=JSON.parse(editor.value);if(!value||Array.isArray(value)||typeof value!=='object')throw new Error('Locale must contain a JSON object');const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\\n'],{{type:'application/json'}}));const link=document.createElement('a');link.href=url;link.download=active+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);error.textContent='';}}catch(e){{error.textContent=e.message;}}}};load();</script></html>"
    ))
}
