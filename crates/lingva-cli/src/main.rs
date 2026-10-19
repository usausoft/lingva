//! Lingva's standalone, language-neutral command-line engine.
//!
//! `main` owns argument parsing and command orchestration. File formats,
//! synchronization, hosted transport, credentials, and merge state stay in
//! focused modules so npm/PyPI launchers never duplicate product behavior.

mod api;
mod atomic_file;
mod auth;
mod config;
mod credentials;
mod customer;
mod extraction;
mod local;
mod organization_sso;
mod project;
mod state;
mod transaction;

use std::{
    env, fs,
    io::{self, Write},
    path::{Path, PathBuf},
    process::ExitCode,
};

use anyhow::{Context, Result, bail};
use clap::{Args, Parser, Subcommand, ValueEnum};
use serde::Serialize;
use serde_json::{Value, json};

use api::{LingvaApi, PlatformProject};
use auth::{DEFAULT_AUTH_PORT, DEFAULT_AUTH_SCOPES, DEFAULT_PLATFORM_URL, LoginOptions};
use config::{
    Config, ConfigDocument, DEFAULT_API_KEY_ENV, DEFAULT_CONFIG_FILE, DEFAULT_ENVIRONMENT,
    DEFAULT_TRANSLATION_FILES, PUBLISH_TOKEN_ENV,
};
use local::{Dictionary, read_dictionary, set_dotted, write_dictionary};
use state::{RemoteState, merge_remote};

const EXIT_SUCCESS: u8 = 0;
const EXIT_FAILURE: u8 = 1;
const CRATES_IO_PACKAGE_URL: &str = "https://crates.io/api/v1/crates/lingva";
const NPM_PACKAGE_URL: &str = "https://registry.npmjs.org/@lingva%2fcli/latest";
const PYPI_PACKAGE_URL: &str = "https://pypi.org/pypi/lingva-cli/json";

#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
enum InstallChannel {
    Standalone,
    Npm,
    Python,
    Homebrew,
    Cargo,
}

#[derive(Debug, Args)]
struct UpdateArgs {
    #[command(flatten)]
    output: OutputArgs,
    /// Override automatic installation-channel detection.
    #[arg(
        long,
        value_enum,
        env = "LINGVA_CLI_INSTALL_CHANNEL",
        hide_env_values = true
    )]
    channel: Option<InstallChannel>,
}

fn standalone_install_command(version: &str) -> String {
    // Pin both script and asset version. A mutable latest tag can otherwise
    // change between downloading the installer and downloading the archive.
    if cfg!(windows) {
        format!(
            "$env:LINGVA_CLI_VERSION='{version}'; irm https://unpkg.com/@lingva/cli@{version}/lingva-installer.ps1 | iex"
        )
    } else {
        shell_install_command(version)
    }
}

fn shell_install_command(version: &str) -> String {
    format!(
        "curl --proto '=https' --tlsv1.2 -LsSf https://unpkg.com/@lingva/cli@{version}/lingva-installer.sh | LINGVA_CLI_VERSION={version} sh"
    )
}

fn install_channel(executable: &Path) -> InstallChannel {
    let path = executable.to_string_lossy().replace('\\', "/");
    if path.contains("/Cellar/lingva/") || path.contains("/Caskroom/lingva/") {
        InstallChannel::Homebrew
    } else if path.contains("/.cargo/bin/") {
        InstallChannel::Cargo
    } else {
        InstallChannel::Standalone
    }
}

fn upgrade_command(channel: InstallChannel, version: &str) -> String {
    match channel {
        InstallChannel::Npm => format!("pnpm add -g @lingva/cli@{version}"),
        InstallChannel::Python => format!("python -m pip install --upgrade lingva-cli=={version}"),
        InstallChannel::Homebrew => "brew update && brew upgrade lingva".into(),
        InstallChannel::Cargo => format!("cargo install lingva --locked --version {version}"),
        InstallChannel::Standalone => standalone_install_command(version),
    }
}

#[derive(Debug, Parser)]
#[command(name = "lingva", version, disable_version_flag = true, about = "Lingva localization CLI", long_about = None)]
struct Cli {
    #[arg(short = 'v', long = "version", action = clap::ArgAction::Version)]
    _version: Option<bool>,
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Manage hosted Lingva credentials.
    Auth {
        #[command(subcommand)]
        command: AuthCommand,
    },
    /// Create a portable Lingva project config.
    Init(InitArgs),
    /// Check whether a newer standalone CLI is available.
    Update(UpdateArgs),
    /// Align locale files with the default locale.
    Sync(SyncArgs),
    /// Validate local translation alignment without writing.
    Check(customer::ValidationArgs),
    /// Pull hosted translations using a conflict-safe three-way merge.
    Pull(PullArgs),
    /// Push local translations with an optimistic revision guard.
    Push(PushArgs),
    #[command(flatten)]
    Customer(customer::Command),
}

#[derive(Debug, Subcommand)]
enum AuthCommand {
    /// Sign in with OAuth PKCE in a browser.
    Login(AuthLoginArgs),
    /// Verify Business organization SSO for the current native account token.
    Sso(AuthSsoArgs),
    /// Store a project API key for local and CI use.
    UseKey(AuthKeyArgs),
    /// Show the active credential type.
    Status(OutputArgs),
    /// Remove stored credentials.
    Logout(OutputArgs),
}

#[derive(Debug, Args)]
struct AuthLoginArgs {
    #[arg(long, default_value = DEFAULT_PLATFORM_URL)]
    platform_url: String,
    #[arg(long)]
    issuer_url: Option<String>,
    #[arg(long)]
    authorize_url: Option<String>,
    #[arg(long)]
    token_url: Option<String>,
    #[arg(long)]
    client_id: Option<String>,
    #[arg(long, default_value = DEFAULT_AUTH_SCOPES)]
    scope: String,
    #[arg(long, default_value_t = DEFAULT_AUTH_PORT)]
    port: u16,
    #[arg(long)]
    no_browser: bool,
    #[arg(long)]
    device: bool,
    #[arg(long)]
    device_url: Option<String>,
}

#[derive(Debug, Args)]
struct AuthSsoArgs {
    #[arg(long)]
    organization_id: String,
    #[arg(long)]
    platform_url: Option<String>,
    #[arg(long)]
    no_browser: bool,
    #[arg(long, default_value_t = 600)]
    timeout: u64,
}

#[derive(Debug, Args)]
struct AuthKeyArgs {
    #[arg(long, env = "LINGVA_API_KEY", hide_env_values = true)]
    api_key: String,
    #[arg(long)]
    api_url: Option<String>,
    #[arg(long)]
    project_id: Option<String>,
    #[command(flatten)]
    output: OutputArgs,
}

#[derive(Debug, Clone, Args)]
struct OutputArgs {
    #[arg(long, value_enum, default_value_t = OutputFormat::Text)]
    format: OutputFormat,
}

#[derive(Debug, Clone, Copy, ValueEnum, PartialEq, Eq)]
enum OutputFormat {
    Text,
    Json,
}

#[derive(Debug, Clone, Copy, ValueEnum, PartialEq, Eq)]
enum Mode {
    Remote,
    Local,
}

#[derive(Debug, Clone, Copy, ValueEnum, PartialEq, Eq)]
enum Sdk {
    Vanilla,
    React,
    Next,
    Angular,
    Vue,
    Svelte,
    Python,
    Swift,
    Kotlin,
    Flutter,
}

#[derive(Debug, Clone, Copy, ValueEnum, PartialEq, Eq)]
enum DeliverySource {
    Dashboard,
    Repository,
    Manual,
}

#[derive(Debug, Clone, Copy, ValueEnum, PartialEq, Eq)]
enum CiProvider {
    Github,
}

impl DeliverySource {
    fn as_str(self) -> &'static str {
        match self {
            Self::Dashboard => "dashboard",
            Self::Repository => "repository",
            Self::Manual => "manual",
        }
    }
}

#[derive(Debug, Args)]
struct InitArgs {
    #[arg(long, visible_alias = "config", default_value = DEFAULT_CONFIG_FILE)]
    config_file: PathBuf,
    #[arg(long)]
    project_id: Option<String>,
    #[arg(long)]
    environment: Option<String>,
    #[arg(long, value_delimiter = ',')]
    locale: Vec<String>,
    #[arg(long, value_enum, default_value_t = Mode::Remote)]
    mode: Mode,
    #[arg(long)]
    no_auth: bool,
    #[arg(long)]
    non_interactive: bool,
    #[arg(long)]
    platform_url: Option<String>,
    #[arg(long, visible_alias = "framework", value_enum)]
    sdk: Option<Sdk>,
    #[arg(long, conflicts_with = "non_interactive")]
    wizard: bool,
    #[arg(long)]
    locales_dir: Option<String>,
    #[arg(long)]
    provider_file: Option<PathBuf>,
    #[arg(long)]
    bundle_url: Option<String>,
    #[arg(long, value_enum)]
    ci: Option<CiProvider>,
    #[arg(long)]
    default_locale: Option<String>,
    #[arg(long)]
    fallback_locale: Option<String>,
    #[arg(long, default_value = DEFAULT_TRANSLATION_FILES)]
    translation_files: String,
    #[arg(long)]
    api_url: Option<String>,
    #[arg(long, default_value = DEFAULT_API_KEY_ENV)]
    api_key_env: String,
    #[arg(long)]
    dry_run: bool,
    #[arg(long)]
    force: bool,
    #[command(flatten)]
    output: OutputArgs,
}

#[derive(Debug, Args)]
struct SyncArgs {
    #[arg(default_value = DEFAULT_CONFIG_FILE)]
    config_file: PathBuf,
    #[arg(long)]
    dry_run: bool,
    #[arg(long)]
    check: bool,
    #[command(flatten)]
    output: OutputArgs,
}

#[derive(Debug, Args)]
struct PullArgs {
    #[arg(default_value = DEFAULT_CONFIG_FILE)]
    config_file: PathBuf,
    #[arg(long, value_delimiter = ',')]
    locale: Vec<String>,
    #[arg(long)]
    output: Option<String>,
    #[arg(long)]
    api_url: Option<String>,
    #[arg(long)]
    auth_token: Option<String>,
    #[arg(long)]
    no_summary: bool,
    #[arg(long, value_enum, default_value_t = OutputFormat::Text)]
    format: OutputFormat,
}

#[derive(Debug, Args)]
struct PushArgs {
    #[arg(default_value = DEFAULT_CONFIG_FILE)]
    config_file: PathBuf,
    #[arg(long)]
    config: Option<PathBuf>,
    #[arg(long)]
    output: Option<PathBuf>,
    #[arg(long, value_delimiter = ',')]
    locale: Vec<String>,
    #[arg(long)]
    api_url: Option<String>,
    #[arg(long)]
    auth_token: Option<String>,
    #[arg(long)]
    output_dir: Option<PathBuf>,
    #[arg(long)]
    force: bool,
    #[arg(long)]
    invalidate: bool,
    #[arg(long)]
    environment: Option<String>,
    #[arg(long, value_enum, default_value_t = DeliverySource::Repository)]
    source: DeliverySource,
    #[arg(long)]
    reason: Option<String>,
    #[arg(long)]
    no_summary: bool,
    #[arg(long)]
    no_metadata: bool,
    #[arg(long, value_enum, default_value_t = OutputFormat::Text)]
    format: OutputFormat,
}

fn main() -> ExitCode {
    match run(Cli::parse()) {
        Ok(code) => ExitCode::from(code),
        Err(error) => {
            eprintln!("Error: {error:#}");
            ExitCode::from(EXIT_FAILURE)
        }
    }
}

fn run(cli: Cli) -> Result<u8> {
    match cli.command {
        Command::Auth { command } => run_auth(command),
        Command::Init(args) => run_init(args),
        Command::Update(args) => run_update(args),
        Command::Sync(args) => run_sync(
            &args.config_file,
            !args.dry_run && !args.check,
            args.check,
            args.output.format,
        ),
        Command::Check(args) => customer::validate(args, true),
        Command::Pull(args) => run_pull(args),
        Command::Push(args) => run_push(args),
        Command::Customer(command) => customer::run(command),
    }
}

fn run_auth(command: AuthCommand) -> Result<u8> {
    let path = credentials::default_path()?;
    match command {
        AuthCommand::Login(args) => {
            let api = LingvaApi::new()?;
            let credentials = auth::login(
                &api,
                LoginOptions {
                    platform_url: &args.platform_url,
                    issuer_url: args.issuer_url.as_deref(),
                    authorize_url: args.authorize_url.as_deref(),
                    token_url: args.token_url.as_deref(),
                    client_id: args.client_id.as_deref(),
                    scopes: &args.scope,
                    port: args.port,
                    open_browser: !args.no_browser,
                    device: args.device,
                    device_url: args.device_url.as_deref(),
                },
                &path,
            )?;
            println!(
                "Lingva auth login completed{}.",
                credentials
                    .expires_at
                    .as_ref()
                    .map(|value| format!("; token expires {value}"))
                    .unwrap_or_default()
            );
            Ok(EXIT_SUCCESS)
        }
        AuthCommand::Sso(args) => {
            organization_sso::verify(
                &path,
                &args.organization_id,
                args.platform_url.as_deref(),
                !args.no_browser,
                args.timeout,
            )?;
            Ok(EXIT_SUCCESS)
        }
        AuthCommand::UseKey(args) => {
            let credentials =
                credentials::store_api_key(&path, &args.api_key, args.api_url, args.project_id)?;
            emit(
                &json!({"credentialsFile": path, "apiKeyPreview": credentials.api_key_preview, "projectId": credentials.project_id}),
                args.output.format,
                format!(
                    "Lingva auth project API key stored ({}).",
                    credentials
                        .api_key_preview
                        .as_deref()
                        .unwrap_or("stored-key")
                ),
            )?;
            Ok(EXIT_SUCCESS)
        }
        AuthCommand::Status(args) => {
            let credentials = credentials::load(&path)?;
            let authenticated = credentials::token(credentials.as_ref()).is_some();
            let method = credentials.as_ref().map(|value| {
                if value.api_key.is_some() {
                    "api-key"
                } else {
                    "oauth"
                }
            });
            emit(
                &json!({"authenticated": authenticated, "authMethod": method, "credentialsFile": path, "apiKeyPreview": credentials.as_ref().and_then(|value| value.api_key_preview.clone()), "projectId": credentials.as_ref().and_then(|value| value.project_id.clone()), "expiresAt": credentials.as_ref().and_then(|value| value.expires_at.clone())}),
                args.format,
                format!(
                    "Lingva auth status: {}",
                    if authenticated {
                        "authenticated"
                    } else {
                        "not authenticated"
                    }
                ),
            )?;
            Ok(if authenticated {
                EXIT_SUCCESS
            } else {
                EXIT_FAILURE
            })
        }
        AuthCommand::Logout(args) => {
            credentials::clear(&path)?;
            emit(
                &json!({"credentialsFile": path, "authenticated": false}),
                args.format,
                "Lingva auth logout completed.".into(),
            )?;
            Ok(EXIT_SUCCESS)
        }
    }
}

fn run_init(mut args: InitArgs) -> Result<u8> {
    if args.wizard {
        if !std::io::IsTerminal::is_terminal(&io::stdin()) {
            bail!("--wizard requires an interactive terminal; use explicit options in CI.");
        }
        if args.project_id.is_none() {
            print!("Project ID [lingva-app]: ");
            io::stdout().flush()?;
            let mut input = String::new();
            io::stdin().read_line(&mut input)?;
            if !input.trim().is_empty() {
                args.project_id = Some(input.trim().into());
            }
        }
        if args.locale.is_empty() {
            print!("Locales [en,ru]: ");
            io::stdout().flush()?;
            let mut input = String::new();
            io::stdin().read_line(&mut input)?;
            if !input.trim().is_empty() {
                args.locale = input.trim().split(',').map(str::to_owned).collect();
            }
        }
    }
    if let Some(directory) = &args.locales_dir {
        if args.translation_files != DEFAULT_TRANSLATION_FILES {
            bail!("Choose --locales-dir or --translation-files, not both.");
        }
        args.translation_files = format!(
            "{}/{{locale}}.json",
            directory.trim_end_matches(['/', '\\'])
        );
    }
    if args.no_auth && args.mode != Mode::Local {
        bail!("--no-auth is only valid with --mode local.");
    }
    if args.ci.is_some() && args.mode != Mode::Local {
        bail!("--ci is only valid with --mode local; hosted CI uses project API-key secrets.");
    }
    let credentials_path = credentials::default_path()?;
    if !args.no_auth && credentials::resolve_token(&credentials_path)?.is_none() {
        bail!(
            "Lingva init requires authentication. Run \"lingva auth login\" or use --mode local --no-auth."
        );
    }
    // Refresh may rotate credentials. Discovery must use the persisted new
    // access token, never the expired snapshot loaded before the refresh.
    let credentials = if args.no_auth {
        None
    } else {
        credentials::load(&credentials_path)?
    };
    let mut project_id = args.project_id.or_else(|| {
        credentials
            .as_ref()
            .and_then(|value| value.project_id.clone())
    });
    let mut api_url = args
        .api_url
        .or_else(|| credentials.as_ref().and_then(|value| value.api_url.clone()));
    let mut environment = args
        .environment
        .unwrap_or_else(|| DEFAULT_ENVIRONMENT.into());
    let mut locales = unique_non_empty(args.locale);
    let mut default_locale = args.default_locale;
    // OAuth credentials can discover the full project/environment contract.
    // API-key credentials remain deterministic and require explicit values.
    if args.mode == Mode::Remote
        && credentials
            .as_ref()
            .and_then(|value| value.access_token.as_ref())
            .is_some()
        && (project_id.is_none() || api_url.is_none())
    {
        let stored = credentials.as_ref().unwrap();
        let platform_url = args
            .platform_url
            .as_deref()
            .or(stored.platform_url.as_deref())
            .unwrap_or(DEFAULT_PLATFORM_URL);
        let api = LingvaApi::new()?;
        let projects = api.list_projects(platform_url, stored.access_token.as_deref().unwrap())?;
        let candidates = project_id.as_ref().map_or(projects.clone(), |id| {
            projects
                .into_iter()
                .filter(|project| &project.project_id == id)
                .collect()
        });
        let project = select_project(candidates, args.non_interactive)?;
        project_id = Some(project.project_id.clone());
        locales = project.locales.clone();
        default_locale = Some(project.default_locale.clone());
        let selected_environment = project
            .environments
            .iter()
            .find(|item| item.environment_id == environment && item.publish_api_url.is_some())
            .or_else(|| {
                project
                    .environments
                    .iter()
                    .find(|item| item.publish_api_url.is_some())
            })
            .context(format!(
                "Project \"{}\" has no configured remote environment.",
                project.project_id
            ))?;
        environment = selected_environment.environment_id.clone();
        api_url = selected_environment.publish_api_url.clone();
    }
    if args.mode == Mode::Remote && (project_id.is_none() || api_url.is_none()) {
        bail!(
            "Remote init requires --project-id and --api-url when project discovery is unavailable."
        );
    }
    if locales.is_empty() {
        locales = vec!["en".into(), "ru".into()];
    }
    let project_id = project_id.unwrap_or_else(|| "lingva-app".into());
    let default_locale = default_locale.unwrap_or_else(|| locales[0].clone());
    let fallback_locale = args
        .fallback_locale
        .unwrap_or_else(|| default_locale.clone());
    let path = if args.config_file.is_absolute() {
        args.config_file
    } else {
        env::current_dir()?.join(args.config_file)
    };
    if !matches!(
        path.extension().and_then(|extension| extension.to_str()),
        Some("yaml" | "yml" | "json")
    ) {
        bail!(
            "Init --config-file must name portable YAML or JSON. JavaScript runtime adapters are generated separately under .lingva/generated."
        );
    }
    if path.exists() && !args.force {
        bail!(
            "Lingva config \"{}\" already exists; pass --force to replace it.",
            path.display()
        );
    }
    let mut document = ConfigDocument {
        project_id,
        environment,
        locales: locales.clone(),
        default_locale: Some(default_locale),
        fallback_locale: Some(fallback_locale),
        translation_files: args.translation_files.clone(),
        api_key_env: args.api_key_env,
        api_url,
        api_key: None,
        settings: Default::default(),
    };
    if let Some(bundle_url) = args.bundle_url {
        document
            .settings
            .insert("bundleUrl".into(), json!(bundle_url));
    }
    // Validate before planning paths or creating any project file.
    Config::from_document(path.clone(), document.clone())?;
    let mut files = std::iter::once(path.clone())
        .chain(locales.iter().map(|locale| {
            let candidate = PathBuf::from(args.translation_files.replace("{locale}", locale));
            if candidate.is_absolute() {
                candidate
            } else {
                path.parent().unwrap_or(Path::new(".")).join(candidate)
            }
        }))
        .collect::<Vec<_>>();
    let mut generated_files = create_sdk_files(
        path.parent().unwrap_or(Path::new(".")),
        args.sdk,
        args.mode,
        &document,
    )?;
    if let Some(provider_file) = args.provider_file {
        let sdk = args.sdk.context("--provider-file requires --sdk.")?;
        let (default_path, _) = render_framework_adapter(sdk, args.mode == Mode::Local)
            .context("Selected SDK does not have a provider file.")?;
        let provider_file = if provider_file.is_absolute() {
            provider_file
        } else {
            path.parent().unwrap().join(provider_file)
        };
        let from = provider_file
            .parent()
            .context("Provider file requires a parent directory.")?;
        let (file, content) = generated_files
            .iter_mut()
            .find(|(file, _)| file.ends_with(default_path))
            .context("Provider scaffold is missing.")?;
        *content = content
            .replace(
                "'../../.lingva/generated/runtime'",
                &serde_json::to_string(&relative_import(
                    from,
                    &path.parent().unwrap().join(".lingva/generated/runtime"),
                ))?,
            )
            .replace(
                "'../../.lingva/generated/project'",
                &serde_json::to_string(&relative_import(
                    from,
                    &path.parent().unwrap().join(".lingva/generated/project"),
                ))?,
            );
        *file = provider_file;
    }
    if args.ci == Some(CiProvider::Github) {
        generated_files.push((
            path.parent()
                .unwrap_or(Path::new("."))
                .join(".github/workflows/lingva-local.yml"),
            render_github_workflow(
                path.file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or(DEFAULT_CONFIG_FILE),
            ),
        ));
    }
    files.extend(generated_files.iter().map(|(file, _)| file.clone()));
    if !args.force {
        if let Some(existing) = generated_files
            .iter()
            .map(|(file, _)| file)
            .find(|file| file.exists())
        {
            bail!(
                "Lingva SDK adapter \"{}\" already exists; pass --force to replace it.",
                existing.display()
            );
        }
    }
    if !args.dry_run {
        config::write_document(&path, &document)?;
        for file in files.iter().skip(1).take(locales.len()) {
            if !file.exists() {
                write_dictionary(file, &Dictionary::new())?;
            }
        }
        for (file, content) in &generated_files {
            if let Some(parent) = file.parent() {
                fs::create_dir_all(parent)?;
            }
            atomic_file::write(file, content, false)?;
        }
        let ignore = path
            .parent()
            .unwrap_or(Path::new("."))
            .join(".lingva/.gitignore");
        if !ignore.exists() {
            fs::create_dir_all(ignore.parent().unwrap())?;
            atomic_file::write(
                &ignore,
                "remote-state.json\ntranslation-transaction.lock\ntranslation-transaction.json\n",
                false,
            )?;
        }
    }
    let payload = json!({"configFile": path, "files": files, "written": !args.dry_run, "sdk": args.sdk.map(|value| format!("{value:?}").to_lowercase())});
    emit(
        &payload,
        args.output.format,
        files
            .iter()
            .map(|file| file.display().to_string())
            .collect::<Vec<_>>()
            .join("\n"),
    )?;
    Ok(EXIT_SUCCESS)
}

fn create_sdk_files(
    root: &Path,
    sdk: Option<Sdk>,
    mode: Mode,
    config: &ConfigDocument,
) -> Result<Vec<(PathBuf, String)>> {
    let Some(sdk) = sdk else {
        return Ok(Vec::new());
    };
    // Native/non-JavaScript SDKs consume the portable YAML directly; emitting
    // TypeScript beside them would make `--sdk` unexpectedly add a runtime.
    if matches!(sdk, Sdk::Python | Sdk::Swift | Sdk::Kotlin | Sdk::Flutter) {
        return Ok(Vec::new());
    }
    let local = mode == Mode::Local;
    let mut files = Vec::new();
    if local {
        files.push((
            root.join(".lingva/generated/project.ts"),
            render_generated_project(config),
        ));
    }
    // YAML is the portable owner. The generated typed runtime is an adapter,
    // not a second equivalent root configuration competing for CLI discovery.
    let mut runtime = config.clone();
    if !Path::new(&runtime.translation_files).is_absolute() {
        runtime.translation_files = format!("../../{}", runtime.translation_files);
    }
    files.push((
        root.join(".lingva/generated/runtime.ts"),
        render_runtime_config(&runtime, mode)?
            .replace(
                "generatedProjectFile: '.lingva/generated/project.ts'",
                "generatedProjectFile: './project.ts'",
            )
            .replace(
                "metadataFile: '.lingva/metadata.json'",
                "metadataFile: '../metadata.json'",
            ),
    ));
    if let Some((relative_path, content)) = render_framework_adapter(sdk, local) {
        files.push((
            root.join(relative_path),
            content.replace("'../../lingva.config'", "'../../.lingva/generated/runtime'"),
        ));
    }
    Ok(files)
}

fn relative_import(from: &Path, target: &Path) -> String {
    let from = from.components().collect::<Vec<_>>();
    let target = target.components().collect::<Vec<_>>();
    let common = from
        .iter()
        .zip(&target)
        .take_while(|(left, right)| left == right)
        .count();
    let mut result = PathBuf::new();
    for _ in common..from.len() {
        result.push("..");
    }
    for component in &target[common..] {
        result.push(component.as_os_str());
    }
    let result = result.to_string_lossy().replace('\\', "/");
    if result.starts_with('.') || result.starts_with('/') {
        result
    } else {
        format!("./{result}")
    }
}

fn render_generated_project(config: &ConfigDocument) -> String {
    let imports = config
        .locales
        .iter()
        .enumerate()
        .map(|(index, locale)| {
            format!(
                "import {}_{index} from {};",
                locale_identifier(locale),
                serde_json::to_string(&if Path::new(&config.translation_files).is_absolute() {
                    config.translation_files.replace("{locale}", locale)
                } else {
                    format!(
                        "../../{}",
                        config.translation_files.replace("{locale}", locale)
                    )
                })
                .unwrap()
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let entries = config
        .locales
        .iter()
        .enumerate()
        .map(|(index, locale)| {
            format!(
                "  {}: {}_{index},",
                serde_json::to_string(locale).unwrap(),
                locale_identifier(locale)
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "import {{ createLingvaResources, defineLingvaProject }} from '@lingva/core';\n{imports}\n\nexport const resources = createLingvaResources({{\n{entries}\n}});\n\nexport const project = defineLingvaProject({{\n  projectId: {},\n  resources,\n  defaultLocale: {},\n  fallbackLocale: {},\n  environment: {},\n}});\n\nexport default project;\n",
        serde_json::to_string(&config.project_id).unwrap(),
        serde_json::to_string(
            config
                .default_locale
                .as_deref()
                .unwrap_or(&config.locales[0])
        )
        .unwrap(),
        serde_json::to_string(
            config
                .fallback_locale
                .as_deref()
                .unwrap_or(&config.locales[0])
        )
        .unwrap(),
        serde_json::to_string(&config.environment).unwrap(),
    )
}

fn render_runtime_config(config: &ConfigDocument, mode: Mode) -> Result<String> {
    let project_id = serde_json::to_string(&config.project_id)?;
    let environment = serde_json::to_string(&config.environment)?;
    let locales = serde_json::to_string(&config.locales)?;
    let default_locale = serde_json::to_string(
        config
            .default_locale
            .as_deref()
            .unwrap_or(&config.locales[0]),
    )?;
    let fallback_locale = serde_json::to_string(
        config
            .fallback_locale
            .as_deref()
            .unwrap_or(&config.locales[0]),
    )?;
    let translation_files = serde_json::to_string(&config.translation_files)?;
    if mode == Mode::Local {
        return Ok(format!(
            "import {{ defineLingvaConfig }} from '@lingva/core';\n\nconst lingvaConfig = defineLingvaConfig({{\n  projectId: {project_id},\n  locales: {locales},\n  defaultLocale: {default_locale},\n  locale: {default_locale},\n  fallbackLocale: {fallback_locale},\n  translationFiles: {translation_files},\n  generatedProjectFile: '.lingva/generated/project.ts',\n  metadataFile: '.lingva/metadata.json',\n  delivery: {{ mode: 'local', path: {translation_files} }},\n}});\n\nexport default lingvaConfig;\n"
        ));
    }
    let api_url = config
        .api_url
        .as_deref()
        .context("Remote SDK setup requires apiUrl.")?;
    let bundle_url = config
        .settings
        .get("bundleUrl")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .unwrap_or_else(|| {
            format!(
                "{}/bundles/{}/{}/latest/{{locale}}.bundle.json",
                api_url.trim_end_matches('/'),
                config.project_id,
                config.environment
            )
        });
    let api_key_access = format!("[{}]", serde_json::to_string(&config.api_key_env)?);
    Ok(format!(
        "import {{ defineLingvaConfig }} from '@lingva/core';\n\nconst lingvaConfig = defineLingvaConfig({{\n  projectId: {project_id},\n  environment: {environment},\n  locales: {locales},\n  defaultLocale: {default_locale},\n  locale: {default_locale},\n  fallbackLocale: {fallback_locale},\n  apiUrl: {},\n  apiKey: process.env{api_key_access},\n  delivery: {{ mode: 'cdn', url: {} }},\n}});\n\nexport default lingvaConfig;\n",
        serde_json::to_string(api_url)?,
        serde_json::to_string(&bundle_url)?,
    ))
}

fn render_framework_adapter(sdk: Sdk, local: bool) -> Option<(&'static str, String)> {
    let project_import = if local {
        "import lingvaProject from '../../.lingva/generated/project';\n"
    } else {
        ""
    };
    let adapter_input = if local {
        "{\n  ...lingvaConfig,\n  project: lingvaProject,\n}"
    } else {
        "lingvaConfig"
    };
    match sdk {
        Sdk::React => Some((
            "src/lingva/provider.tsx",
            format!(
                "'use client';\n\nimport type {{ PropsWithChildren }} from 'react';\nimport {{ configureLingvaReact, LingvaProvider }} from '@lingva/react';\nimport lingvaConfig from '../../lingva.config';\n{project_import}\nconfigureLingvaReact({adapter_input});\n\n/** App-level Lingva provider generated by `lingva init --sdk react`. */\nexport function AppLingvaProvider({{ children }}: PropsWithChildren) {{\n  return <LingvaProvider>{{children}}</LingvaProvider>;\n}}\n"
            ),
        )),
        Sdk::Next => Some((
            "src/lingva/provider.tsx",
            format!(
                "'use client';\n\nimport {{ createLingvaNextProvider }} from '@lingva/next';\nimport lingvaConfig from '../../lingva.config';\n{project_import}\n/** App-level Lingva provider generated by `lingva init --sdk next`. */\nexport const AppLingvaProvider = createLingvaNextProvider({{\n  config: lingvaConfig,\n{}  displayName: 'AppLingvaProvider',\n}});\n",
                if local {
                    "  project: lingvaProject,\n"
                } else {
                    ""
                }
            ),
        )),
        Sdk::Angular => Some((
            "src/lingva/providers.ts",
            format!(
                "import {{ provideLingvaAngular }} from '@lingva/angular';\nimport lingvaConfig from '../../lingva.config';\n{project_import}\n/** Registers the generated Lingva configuration at the Angular application boundary. */\nexport function provideAppLingva() {{\n  return provideLingvaAngular({adapter_input});\n}}\n"
            ),
        )),
        Sdk::Vue => Some((
            "src/lingva/index.ts",
            format!(
                "import {{ createLingvaVue }} from '@lingva/vue';\nimport lingvaConfig from '../../lingva.config';\n{}\n/** Vue plugin generated by `lingva init --sdk vue`. */\nexport const appLingva = createLingvaVue{}({adapter_input});\n",
                if local {
                    "import lingvaProject, { type resources } from '../../.lingva/generated/project';"
                } else {
                    ""
                },
                if local { "<typeof resources>" } else { "" }
            ),
        )),
        Sdk::Svelte => Some((
            "src/lib/lingva.ts",
            format!(
                "import {{ createLingvaSvelte }} from '@lingva/svelte';\nimport lingvaConfig from '../../lingva.config';\n{}\n/** Svelte stores generated by `lingva init --sdk svelte`. */\nexport const appLingva = createLingvaSvelte{}({adapter_input});\n",
                if local {
                    "import lingvaProject, { type resources } from '../../.lingva/generated/project';"
                } else {
                    ""
                },
                if local { "<typeof resources>" } else { "" }
            ),
        )),
        Sdk::Vanilla | Sdk::Python | Sdk::Swift | Sdk::Kotlin | Sdk::Flutter => None,
    }
}

fn render_github_workflow(config_file: &str) -> String {
    let install_command = shell_install_command(env!("CARGO_PKG_VERSION"));
    format!(
        "name: Lingva Local Checks\n\non:\n  pull_request:\n  push:\n    branches: [main]\n  workflow_dispatch:\n\npermissions:\n  contents: read\n\njobs:\n  lingva-local:\n    name: Validate local translations\n    runs-on: ubuntu-latest\n    steps:\n      - name: Checkout repository\n        uses: actions/checkout@v6\n      - name: Install standalone Lingva CLI\n        run: |\n          {install_command}\n          echo \"$HOME/.local/bin\" >> \"$GITHUB_PATH\"\n      - name: Check local translation sync\n        run: lingva check {config_file}\n"
    )
}

fn locale_identifier(locale: &str) -> String {
    let suffix = locale
        .chars()
        .map(|value| {
            if value.is_ascii_alphanumeric() {
                value
            } else {
                '_'
            }
        })
        .collect::<String>();
    format!("locale_{suffix}")
}

fn select_project(
    projects: Vec<PlatformProject>,
    non_interactive: bool,
) -> Result<PlatformProject> {
    if projects.is_empty() {
        bail!("No matching Lingva project is available to the authenticated user.");
    }
    if projects.len() == 1 {
        return Ok(projects.into_iter().next().unwrap());
    }
    if non_interactive || !std::io::IsTerminal::is_terminal(&io::stdin()) {
        bail!(
            "Multiple Lingva projects are available. Pass --project-id ({}).",
            projects
                .iter()
                .map(|project| project.project_id.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        );
    }
    println!("Choose a Lingva project:");
    for (index, project) in projects.iter().enumerate() {
        println!("{}. {} ({})", index + 1, project.name, project.project_id);
    }
    print!("Project number: ");
    io::stdout().flush()?;
    let mut choice = String::new();
    io::stdin().read_line(&mut choice)?;
    let index = choice
        .trim()
        .parse::<usize>()
        .context("Select a valid project number.")?;
    projects
        .into_iter()
        .nth(index.saturating_sub(1))
        .context("Select a valid project number.")
}

fn run_sync(config_file: &Path, write: bool, check: bool, format: OutputFormat) -> Result<u8> {
    let config = Config::load(config_file)?;
    let result = local::sync(&config, write)?;
    let state = if write { "updated" } else { "planned" };
    let mut lines = vec![format!(
        "Lingva sync: {state} local translations for {}",
        result.locales.join(", ")
    )];
    lines.extend(result.files.iter().map(|file| format!("- {}: {} ({} missing keys, {} missing variants, {} extra variants, {} variant metadata mismatches)",
        file.locale, file.file_path, file.drift.missing_keys, file.drift.missing_variants, file.drift.extra_variants, file.drift.variant_metadata_mismatches)));
    if check {
        lines.push(format!(
            "- check: {}",
            if result.has_drift {
                "failed (locale drift detected)"
            } else {
                "passed"
            }
        ));
    }
    emit(&result, format, lines.join("\n"))?;
    Ok(if check && result.has_drift {
        EXIT_FAILURE
    } else {
        EXIT_SUCCESS
    })
}

fn run_pull(args: PullArgs) -> Result<u8> {
    let mut config = Config::load(&args.config_file)?;
    if args.api_url.is_some() {
        config.api_url = args.api_url;
    }
    let locales = if args.locale.is_empty() {
        config.locales.clone()
    } else {
        unique_non_empty(args.locale)
    };
    validate_locales(&config, &locales)?;
    let credentials_path = credentials::default_path()?;
    let token = resolve_token(&config, args.auth_token, &credentials_path)?;
    let api = LingvaApi::new()?;
    if locales.len() > 1
        && args
            .output
            .as_ref()
            .is_some_and(|output| !output.contains("{locale}"))
    {
        bail!("Pull --output must contain {{locale}} when downloading multiple locales.");
    }
    let mut state = RemoteState::load(&config);
    // Finish every download and merge before the first write. A conflict in
    // one locale therefore cannot leave the repository partially updated.
    let mut writes = Vec::new();
    for locale in &locales {
        let (bundle, revision) = api.pull_bundle(&config, locale, token.as_deref())?;
        let remote = bundle_dictionary(&bundle, locale)?;
        let template = args.output.as_deref().unwrap_or(&config.translation_files);
        let candidate = PathBuf::from(template.replace("{locale}", locale));
        let path = if candidate.is_absolute() {
            candidate
        } else {
            config
                .path
                .parent()
                .unwrap_or(Path::new("."))
                .join(candidate)
        };
        let local = if args.output.is_none() {
            config.read_translation(locale)?
        } else {
            read_dictionary(&path)?
        };
        let base = state
            .locales
            .get(locale)
            .map(|value| &value.base)
            .cloned()
            .unwrap_or_default();
        let merged = merge_remote(locale, &base, &local, &remote)?;
        writes.push((locale.clone(), path, merged, revision, remote));
    }
    let mut files = if args.output.is_none() {
        config.translation_writes(
            &writes
                .iter()
                .map(|(locale, _, merged, _, _)| (locale.clone(), merged.clone()))
                .collect(),
        )?
    } else {
        writes
            .iter()
            .map(|(_, path, merged, _, _)| Ok((path.clone(), local::dictionary_bytes(merged)?)))
            .collect::<Result<Vec<_>>>()?
    };
    for (locale, _, _, revision, remote) in &writes {
        state.set_locale(locale, revision, remote);
    }
    let state_write = state.write_plan(&config)?;
    let private = state_write.0.clone();
    files.push(state_write);
    transaction::write_private(&config.path, files, &[private])?;
    let files = writes
        .iter()
        .map(|(_, path, _, _, _)| path.display().to_string())
        .collect::<Vec<_>>();
    let text = [
        (!args.no_summary).then(|| {
            format!(
                "Lingva pull: wrote {} hosted locale file(s) for {}",
                files.len(),
                locales.join(", ")
            )
        }),
        Some(
            files
                .iter()
                .map(|file| format!("- {file}"))
                .collect::<Vec<_>>()
                .join("\n"),
        ),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>()
    .join("\n");
    emit(
        &json!({"configFile": config.path, "locales": locales, "files": files}),
        args.format,
        text,
    )?;
    Ok(EXIT_SUCCESS)
}

fn run_push(args: PushArgs) -> Result<u8> {
    let mut config = Config::load(&args.config_file)?;
    if let Some(path) = &args.config {
        config = customer::settings_config(Some(&config), path)?;
    }
    let (url, token) = customer::endpoint(
        &config,
        &customer::EndpointArgs {
            api_url: args.api_url,
            auth_token: args.auth_token,
            environment: None,
        },
        "publish",
    )?;
    config.api_url = Some(url);
    if let Some(environment) = args.environment.filter(|value| !value.trim().is_empty()) {
        config.environment = environment;
    }
    let locales = if args.locale.is_empty() {
        config.locales.clone()
    } else {
        unique_non_empty(args.locale)
    };
    validate_locales(&config, &locales)?;
    let mut state = RemoteState::load(&config);
    let base_revision = state.base_revision(&locales, args.force)?;
    let api = LingvaApi::new()?;
    let (result, resources) = api.push(
        &config,
        &locales,
        token.as_deref(),
        base_revision,
        args.force,
        !args.no_metadata
            && customer::policy(&config, "publish", None)?.get("includeMetadata")
                != Some(&Value::Bool(false)),
    )?;
    let output_dir = args.output_dir.or_else(|| {
        customer::policy(&config, "publish", None)
            .ok()
            .and_then(|section| {
                section
                    .get("outputDir")
                    .and_then(Value::as_str)
                    .map(|directory| {
                        config
                            .path
                            .parent()
                            .unwrap_or(Path::new("."))
                            .join(directory)
                    })
            })
    });
    if let Some(output_dir) = output_dir {
        fs::create_dir_all(&output_dir)?;
        crate::atomic_file::write(
            &output_dir.join("publish-response.json"),
            format!("{}\n", serde_json::to_string_pretty(&result)?),
            false,
        )?;
    }
    // State advances only after the server confirms a publish revision.
    let revision = result
        .get("publishId")
        .and_then(Value::as_str)
        .filter(|revision| !revision.trim().is_empty())
        .context("Lingva hosted push response has no publishId revision.")?;
    for locale in &locales {
        state.set_locale(locale, revision, &resources[locale]);
    }
    state.save(&config)?;
    let invalidation = if args.invalidate {
        Some(api.invalidate(
            &config,
            token.as_deref(),
            args.source.as_str(),
            args.reason.as_deref(),
        )?)
    } else {
        None
    };
    let text = if args.no_summary {
        String::new()
    } else {
        let publish = format!(
            "Hosted publish: {} -> {}",
            result
                .get("projectId")
                .and_then(Value::as_str)
                .unwrap_or(&config.project_id),
            result
                .get("manifestKey")
                .and_then(Value::as_str)
                .unwrap_or("complete")
        );
        invalidation.as_ref().map_or(publish.clone(), |value| {
            format!(
                "{publish}\nLingva invalidation: {}",
                value
                    .get("invalidationId")
                    .and_then(Value::as_str)
                    .unwrap_or("complete")
            )
        })
    };
    let payload = invalidation.map_or_else(
        || result.clone(),
        |invalidation| json!({"publish": result, "invalidation": invalidation}),
    );
    if let Some(path) = args.output {
        customer::write_text(&path, &serde_json::to_string_pretty(&payload)?)?;
    }
    emit(&payload, args.format, text)?;
    Ok(EXIT_SUCCESS)
}

fn run_update(args: UpdateArgs) -> Result<u8> {
    let channel = args
        .channel
        .unwrap_or_else(|| install_channel(&env::current_exe().unwrap_or_default()));
    let (registry, pointer) = match channel {
        InstallChannel::Cargo => (CRATES_IO_PACKAGE_URL, "/crate/max_stable_version"),
        InstallChannel::Python => (PYPI_PACKAGE_URL, "/info/version"),
        _ => (NPM_PACKAGE_URL, "/version"),
    };
    let api = reqwest::blocking::Client::builder()
        .user_agent(format!("lingva/{}", env!("CARGO_PKG_VERSION")))
        .timeout(std::time::Duration::from_secs(30))
        .build()?;
    let payload = api
        .get(env::var("LINGVA_CLI_UPDATE_URL").unwrap_or_else(|_| registry.into()))
        .send()?
        .error_for_status()?
        .json::<Value>()?;
    let latest = latest_release_version(&payload, pointer)?;
    let current = semver::Version::parse(env!("CARGO_PKG_VERSION"))?;
    let update_available = latest > current;
    let command = upgrade_command(channel, &latest.to_string());
    emit(
        &json!({"currentVersion": current.to_string(), "latestVersion": latest.to_string(), "updateAvailable": update_available, "channel": format!("{channel:?}").to_lowercase(), "installCommand": update_available.then_some(&command)}),
        args.output.format,
        if update_available {
            format!("Lingva CLI update available: {current} -> {latest}\nRun: {command}")
        } else {
            format!("Lingva CLI is current ({current}).")
        },
    )?;
    Ok(EXIT_SUCCESS)
}

fn latest_release_version(payload: &Value, pointer: &str) -> Result<semver::Version> {
    let version = payload
        .pointer(pointer)
        .and_then(Value::as_str)
        .context("Release registry did not return Lingva's latest stable version.")
        .and_then(|version| {
            semver::Version::parse(version)
                .context("Release registry returned an invalid Lingva version.")
        })?;
    if !version.pre.is_empty() || !version.build.is_empty() {
        bail!("Release registry returned a non-stable Lingva version.");
    }
    Ok(version)
}

fn bundle_dictionary(bundle: &Value, locale: &str) -> Result<Dictionary> {
    let messages = bundle
        .get("messages")
        .and_then(Value::as_object)
        .context(format!(
            "Lingva bundle for locale \"{locale}\" has no messages object."
        ))?;
    let sources = bundle.get("sources").and_then(Value::as_object);
    let variants = bundle.get("variants").and_then(Value::as_object);
    let mut result = Dictionary::new();
    for (key, value) in messages {
        // Delivery bundles may contain resolved fallback messages. Pull must
        // not write them into the requested locale as if they were authored.
        if sources
            .and_then(|items| items.get(key))
            .and_then(Value::as_str)
            .is_some_and(|source| source != locale)
        {
            continue;
        }
        set_dotted(
            &mut result,
            key,
            variants
                .and_then(|items| items.get(key))
                .cloned()
                .unwrap_or_else(|| value.clone()),
        )?;
    }
    Ok(result)
}

fn resolve_token(
    config: &Config,
    explicit: Option<String>,
    credentials_path: &Path,
) -> Result<Option<String>> {
    // Stop at the first credential source. In particular, CI using an explicit
    // token must not depend on a developer's malformed/expired credential file.
    if let Some(token) = explicit.filter(|value| !value.trim().is_empty()) {
        return Ok(Some(token));
    }
    if let Some(token) = env::var(PUBLISH_TOKEN_ENV)
        .ok()
        .filter(|value| !value.trim().is_empty())
    {
        return Ok(Some(token));
    }
    if let Some(token) = config
        .api_key
        .clone()
        .filter(|value| !value.trim().is_empty())
    {
        return Ok(Some(token));
    }
    credentials::resolve_token(credentials_path)
}

fn validate_locales(config: &Config, locales: &[String]) -> Result<()> {
    let missing = locales
        .iter()
        .filter(|locale| !config.locales.contains(locale))
        .cloned()
        .collect::<Vec<_>>();
    if !missing.is_empty() {
        bail!(
            "Requested locales are not present in config.locales: {}.",
            missing.join(", ")
        );
    }
    Ok(())
}

fn unique_non_empty(values: Vec<String>) -> Vec<String> {
    values
        .into_iter()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .fold(Vec::new(), |mut result, value| {
            if !result.contains(&value) {
                result.push(value);
            }
            result
        })
}

fn emit(payload: &impl Serialize, format: OutputFormat, text: String) -> Result<()> {
    println!(
        "{}",
        if format == OutputFormat::Json {
            serde_json::to_string_pretty(payload)?
        } else {
            text
        }
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundle_dictionary_preserves_variants_and_ignores_fallbacks() {
        let bundle = json!({
            "messages": {"welcome":"Hello","fallback":"Fallback"},
            "sources": {"welcome":"en","fallback":"ru"},
            "variants": {"welcome":[{"id":"formal","text":"Welcome"}]}
        });
        let dictionary = bundle_dictionary(&bundle, "en").unwrap();
        assert!(dictionary.get("fallback").is_none());
        assert_eq!(dictionary["welcome"][0]["id"], "formal");
    }

    #[test]
    fn bundle_dictionary_rejects_missing_messages_and_parent_collisions() {
        assert!(bundle_dictionary(&json!({}), "en").is_err());
        let error = bundle_dictionary(
            &json!({"messages":{"account":"Account","account.title":"Title"}}),
            "en",
        )
        .unwrap_err();
        assert!(error.to_string().contains("conflicts"));
    }

    #[test]
    fn locale_selection_is_trimmed_stable_and_unique() {
        assert_eq!(
            unique_non_empty(vec![" ru ".into(), "".into(), "en".into(), "ru".into()]),
            ["ru", "en"]
        );
    }

    #[test]
    fn locale_validation_lists_every_unknown_locale() {
        let config = Config {
            path: "lingva.config.yaml".into(),
            project_id: "demo".into(),
            environment: "dev".into(),
            locales: vec!["en".into()],
            default_locale: "en".into(),
            fallback_locale: "en".into(),
            translation_files: DEFAULT_TRANSLATION_FILES.into(),
            api_url: None,
            api_key: None,
            settings: Default::default(),
        };
        let error = validate_locales(&config, &["ru".into(), "de".into()]).unwrap_err();
        assert!(error.to_string().contains("ru, de"));
    }

    #[test]
    fn locale_identifier_makes_framework_safe_import_names() {
        assert_eq!(locale_identifier("pt-BR"), "locale_pt_BR");
        assert_eq!(locale_identifier("zh.Hant"), "locale_zh_Hant");
    }

    #[test]
    fn sdk_renderers_keep_local_and_remote_boundaries_distinct() {
        let document = ConfigDocument {
            project_id: "demo".into(),
            environment: "stage".into(),
            locales: vec!["en".into(), "pt-BR".into()],
            default_locale: Some("en".into()),
            fallback_locale: Some("en".into()),
            translation_files: DEFAULT_TRANSLATION_FILES.into(),
            api_key_env: "SPECIAL_KEY".into(),
            api_url: Some("https://api.example.test/".into()),
            api_key: None,
            settings: Default::default(),
        };
        let root = Path::new("/project");
        for sdk in [
            Sdk::Vanilla,
            Sdk::React,
            Sdk::Next,
            Sdk::Angular,
            Sdk::Vue,
            Sdk::Svelte,
        ] {
            let local = create_sdk_files(root, Some(sdk), Mode::Local, &document).unwrap();
            assert!(
                local
                    .iter()
                    .any(|(path, _)| path.ends_with(".lingva/generated/runtime.ts"))
            );
            assert!(
                local
                    .iter()
                    .any(|(path, _)| path.ends_with(".lingva/generated/project.ts"))
            );

            let remote = create_sdk_files(root, Some(sdk), Mode::Remote, &document).unwrap();
            assert!(
                remote
                    .iter()
                    .any(|(path, _)| path.ends_with(".lingva/generated/runtime.ts"))
            );
            assert!(
                !remote
                    .iter()
                    .any(|(path, _)| path.ends_with(".lingva/generated/project.ts"))
            );
            assert!(
                remote
                    .iter()
                    .all(|(_, source)| !source.contains("lingvaProject"))
            );
        }
        for sdk in [Sdk::Python, Sdk::Swift, Sdk::Kotlin, Sdk::Flutter] {
            assert!(
                create_sdk_files(root, Some(sdk), Mode::Local, &document)
                    .unwrap()
                    .is_empty()
            );
        }
        let remote_config = render_runtime_config(&document, Mode::Remote).unwrap();
        assert!(remote_config.contains("process.env[\"SPECIAL_KEY\"]"));
        assert!(
            remote_config.contains(
                "https://api.example.test/bundles/demo/stage/latest/{locale}.bundle.json"
            )
        );
    }

    #[test]
    fn github_workflow_uses_the_runtime_free_installer_and_selected_config() {
        let workflow = render_github_workflow("config/lingva.config.yaml");
        assert!(workflow.contains("lingva-installer.sh"));
        assert!(workflow.contains("$GITHUB_PATH"));
        assert!(workflow.contains("lingva check config/lingva.config.yaml"));
        assert!(!workflow.contains("setup-node"));
    }

    #[test]
    fn update_reads_the_latest_stable_crates_io_version() {
        let payload = json!({"crate":{"max_stable_version":"0.1.3"}});
        assert_eq!(
            latest_release_version(&payload, "/crate/max_stable_version")
                .unwrap()
                .to_string(),
            "0.1.3"
        );
        for invalid in [
            json!({}),
            json!({"version":"invalid"}),
            json!({"version":"1.0.0-beta.1"}),
            json!({"version":"1.0.0+build"}),
        ] {
            assert!(latest_release_version(&invalid, "/version").is_err());
        }
    }

    #[test]
    fn project_selection_handles_empty_single_and_non_interactive_many() {
        let project = |id: &str| PlatformProject {
            project_id: id.into(),
            name: id.into(),
            locales: vec!["en".into()],
            default_locale: "en".into(),
            environments: Vec::new(),
        };
        assert!(select_project(Vec::new(), true).is_err());
        assert_eq!(
            select_project(vec![project("one")], true)
                .unwrap()
                .project_id,
            "one"
        );
        let error = select_project(vec![project("one"), project("two")], true).unwrap_err();
        assert!(error.to_string().contains("one, two"));
    }

    #[test]
    fn explicit_token_short_circuits_corrupt_saved_credentials() {
        let root = tempfile::tempdir().unwrap();
        let credentials_path = root.path().join("credentials.json");
        fs::write(&credentials_path, "not-json").unwrap();
        let config = Config {
            path: root.path().join("lingva.config.yaml"),
            project_id: "demo".into(),
            environment: "dev".into(),
            locales: vec!["en".into()],
            default_locale: "en".into(),
            fallback_locale: "en".into(),
            translation_files: DEFAULT_TRANSLATION_FILES.into(),
            api_url: None,
            api_key: None,
            settings: Default::default(),
        };
        assert_eq!(
            resolve_token(&config, Some("explicit".into()), &credentials_path).unwrap(),
            Some("explicit".into())
        );
    }
}
