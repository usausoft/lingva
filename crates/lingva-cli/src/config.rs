//! Portable `lingva.config.yaml` / JSON loading and validation.
//!
//! This module intentionally has no SDK-specific behavior. The same document
//! drives Rust CLI commands launched directly, through npm, or through PyPI.

use std::{
    collections::BTreeMap,
    env, fs,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};

pub const DEFAULT_CONFIG_FILE: &str = "lingva.config.yaml";
pub const DEFAULT_ENVIRONMENT: &str = "dev";
pub const DEFAULT_TRANSLATION_FILES: &str = ".lingva/translations/{locale}.json";
pub const DEFAULT_API_KEY_ENV: &str = "LINGVA_API_KEY";
pub const PUBLISH_TOKEN_ENV: &str = "LINGVA_PUBLISH_API_TOKEN";

/// Serialized, language-neutral CLI configuration.
///
/// Optional values stay optional here so deserialization and generated config
/// output preserve the public file contract. [`Config`] applies defaults and
/// invariants before command code can consume the values.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigDocument {
    pub project_id: String,
    #[serde(default = "default_environment")]
    pub environment: String,
    #[serde(default)]
    pub locales: Vec<String>,
    pub default_locale: Option<String>,
    pub fallback_locale: Option<String>,
    #[serde(default = "default_translation_files")]
    pub translation_files: String,
    #[serde(default = "default_api_key_env")]
    pub api_key_env: String,
    pub api_url: Option<String>,
    pub api_key: Option<String>,
    /// Preserve policy, metadata, and endpoint sections across adapter conversion.
    #[serde(flatten)]
    pub settings: BTreeMap<String, serde_json::Value>,
}

/// Validated runtime view of a portable configuration document.
#[derive(Debug, Clone)]
pub struct Config {
    pub path: PathBuf,
    pub project_id: String,
    pub environment: String,
    pub locales: Vec<String>,
    pub default_locale: String,
    pub fallback_locale: String,
    pub translation_files: String,
    pub api_url: Option<String>,
    pub api_key: Option<String>,
    pub settings: BTreeMap<String, serde_json::Value>,
}

fn default_environment() -> String {
    DEFAULT_ENVIRONMENT.into()
}
fn default_translation_files() -> String {
    DEFAULT_TRANSLATION_FILES.into()
}
fn default_api_key_env() -> String {
    DEFAULT_API_KEY_ENV.into()
}

fn non_empty(value: String, field: &str) -> Result<String> {
    let value = value.trim().to_owned();
    if value.is_empty() {
        bail!("Lingva config requires a non-empty \"{field}\" string.");
    }
    Ok(value)
}

impl Config {
    /// Load YAML by default, or JSON when the file extension is `.json`.
    pub fn load(path: impl AsRef<Path>) -> Result<Self> {
        let path = absolute_path(path.as_ref())?;
        crate::transaction::recover(&path)?;
        if matches!(
            path.extension().and_then(|value| value.to_str()),
            Some("ts" | "tsx" | "js" | "mjs" | "cjs")
        ) {
            bail!(
                "Executable JS/TS config requires the npm adapter. Use a portable lingva.config.yaml or JSON config with the standalone engine."
            );
        }
        let source = fs::read_to_string(&path)
            .with_context(|| format!("Lingva config \"{}\" does not exist.", path.display()))?;
        let extension = path.extension().and_then(|value| value.to_str());
        let document: ConfigDocument = if extension == Some("json") {
            serde_json::from_str(&source).with_context(|| {
                format!("Lingva config \"{}\" is not valid JSON.", path.display())
            })?
        } else {
            serde_yaml::from_str(&source).with_context(|| {
                format!("Lingva config \"{}\" is not valid YAML.", path.display())
            })?
        };
        Self::from_document(path, document)
    }

    pub fn from_document(path: PathBuf, document: ConfigDocument) -> Result<Self> {
        let project_id = non_empty(document.project_id, "projectId")?;
        let environment = non_empty(document.environment, "environment")?;
        // Preserve user order because the first locale is the implicit default,
        // while removing duplicates that would otherwise repeat network/file IO.
        let configured_locales = if document.locales.is_empty() {
            document
                .settings
                .get("resources")
                .and_then(serde_json::Value::as_object)
                .map(|resources| resources.keys().cloned().collect())
                .unwrap_or_default()
        } else {
            document.locales
        };
        let locales =
            configured_locales
                .into_iter()
                .try_fold(Vec::new(), |mut result, locale| {
                    let locale = non_empty(locale, "locales")?;
                    // Locale IDs become filenames and URL segments. Never accept
                    // separators or dot segments supplied by a config/API adapter.
                    if locale == "."
                        || locale == ".."
                        || !locale.chars().all(|value| {
                            value.is_ascii_alphanumeric() || matches!(value, '-' | '_' | '.')
                        })
                    {
                        bail!("Lingva locale \"{locale}\" must be a safe filename/URL segment.");
                    }
                    if !result.contains(&locale) {
                        result.push(locale);
                    }
                    Ok::<_, anyhow::Error>(result)
                })?;
        if locales.is_empty() {
            bail!("Lingva config requires at least one locale in \"locales\".");
        }
        let default_locale = document
            .default_locale
            .map(|value| non_empty(value, "defaultLocale"))
            .transpose()?
            .unwrap_or_else(|| locales[0].clone());
        let fallback_locale = document
            .fallback_locale
            .map(|value| non_empty(value, "fallbackLocale"))
            .transpose()?
            .unwrap_or_else(|| default_locale.clone());
        if !locales.contains(&default_locale) {
            bail!("Lingva \"defaultLocale\" must be included in \"locales\".");
        }
        if !locales.contains(&fallback_locale) {
            bail!("Lingva \"fallbackLocale\" must be included in \"locales\".");
        }
        let translation_files = non_empty(document.translation_files, "translationFiles")?;
        if locales.len() > 1 && !translation_files.contains("{locale}") {
            bail!(
                "Lingva translationFiles must contain {{locale}} when multiple locales are configured."
            );
        }
        // Environment values deliberately override a checked-in compatibility
        // value. New configs never serialize a secret into `apiKey`.
        let api_key = env::var(&document.api_key_env)
            .ok()
            .filter(|value| !value.trim().is_empty())
            .or(document.api_key.filter(|value| !value.trim().is_empty()));
        Ok(Self {
            path,
            project_id,
            environment,
            locales,
            default_locale,
            fallback_locale,
            translation_files,
            api_url: document.api_url.filter(|value| !value.trim().is_empty()),
            api_key,
            settings: document.settings,
        })
    }

    /// Resolve a locale template relative to the config file, not process CWD.
    pub fn translation_path(&self, locale: &str) -> PathBuf {
        let candidate = PathBuf::from(self.translation_files.replace("{locale}", locale));
        if candidate.is_absolute() {
            candidate
        } else {
            self.path.parent().unwrap_or(Path::new(".")).join(candidate)
        }
    }

    /// Read from the configured resource owner, not an unused file shadow.
    pub fn read_translation(&self, locale: &str) -> Result<crate::local::Dictionary> {
        if let Some(resources) = self.settings.get("resources") {
            let current = Config::load(&self.path)?;
            let resources = current.settings.get("resources").unwrap_or(resources);
            return serde_json::from_value(
                resources
                    .get(locale)
                    .cloned()
                    .unwrap_or_else(|| serde_json::json!({})),
            )
            .context("Inline locale must contain a JSON dictionary.");
        }
        crate::local::read_dictionary(&self.translation_path(locale))
    }

    /// Commit a validated resource plan through the recoverable batch owner.
    pub fn write_translations(
        &self,
        updates: &BTreeMap<String, crate::local::Dictionary>,
    ) -> Result<()> {
        crate::transaction::write(&self.path, self.translation_writes(updates)?)
    }

    /// Plan bytes separately so pull can commit resources and merge state together.
    pub fn translation_writes(
        &self,
        updates: &BTreeMap<String, crate::local::Dictionary>,
    ) -> Result<Vec<(PathBuf, Vec<u8>)>> {
        if updates.is_empty() {
            return Ok(Vec::new());
        }
        for (locale, dictionary) in updates {
            if !self.locales.contains(locale) {
                bail!("Unknown locale {locale}.");
            }
            crate::local::flatten(dictionary)?;
        }
        if self.settings.contains_key("resources") {
            // Reload to preserve unrelated config changes and earlier locale writes.
            let source = fs::read_to_string(&self.path)?;
            let mut document: ConfigDocument =
                if self.path.extension().and_then(|value| value.to_str()) == Some("json") {
                    serde_json::from_str(&source)?
                } else {
                    serde_yaml::from_str(&source)?
                };
            let resources = document
                .settings
                .get_mut("resources")
                .and_then(serde_json::Value::as_object_mut)
                .context("Inline resources must contain a JSON object.")?;
            for (locale, dictionary) in updates {
                resources.insert(locale.clone(), serde_json::to_value(dictionary)?);
            }
            Ok(vec![(
                self.path.clone(),
                document_bytes(&self.path, &document)?,
            )])
        } else {
            updates
                .iter()
                .map(|(locale, dictionary)| {
                    Ok((
                        self.translation_path(locale),
                        crate::local::dictionary_bytes(dictionary)?,
                    ))
                })
                .collect::<Result<Vec<_>>>()
        }
    }
}

/// Serialize a portable config as JSON or YAML based on its extension.
pub fn write_document(path: &Path, document: &ConfigDocument) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    crate::atomic_file::write(path, document_bytes(path, document)?, false)?;
    Ok(())
}

fn document_bytes(path: &Path, document: &ConfigDocument) -> Result<Vec<u8>> {
    let content = if path.extension().and_then(|value| value.to_str()) == Some("json") {
        format!("{}\n", serde_json::to_string_pretty(document)?)
    } else {
        serde_yaml::to_string(document)?
    };
    Ok(content.into_bytes())
}

/// Resolve a user path without requiring it to exist.
pub fn absolute_path(path: &Path) -> Result<PathBuf> {
    if path.is_absolute() {
        return Ok(path.to_owned());
    }
    Ok(env::current_dir()?.join(path))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(root: &Path, name: &str, source: &str) -> PathBuf {
        let path = root.join(name);
        fs::write(&path, source).unwrap();
        path
    }

    #[test]
    fn loads_portable_yaml_defaults() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join(DEFAULT_CONFIG_FILE);
        fs::write(&path, "projectId: demo\nlocales: [en, ru]\n").unwrap();
        let config = Config::load(&path).unwrap();
        assert_eq!(config.default_locale, "en");
        assert_eq!(config.fallback_locale, "en");
        assert_eq!(
            config.translation_path("ru"),
            root.path().join(".lingva/translations/ru.json")
        );
    }

    #[test]
    fn loads_json_and_normalizes_locale_order() {
        let root = tempfile::tempdir().unwrap();
        let path = write(
            root.path(),
            "lingva.config.json",
            r#"{"projectId":" demo ","environment":" stage ","locales":["en","ru","en"],"defaultLocale":"ru","fallbackLocale":"en","translationFiles":"i18n/{locale}.json"}"#,
        );
        let config = Config::load(path).unwrap();
        assert_eq!(config.project_id, "demo");
        assert_eq!(config.environment, "stage");
        assert_eq!(config.locales, ["en", "ru"]);
        assert_eq!(config.default_locale, "ru");
        assert_eq!(
            config.translation_path("ru"),
            root.path().join("i18n/ru.json")
        );
    }

    #[test]
    fn rejects_empty_and_unlisted_default_or_fallback_locales() {
        let cases = [
            ("projectId: ''\nlocales: [en]\n", "projectId"),
            ("projectId: demo\nlocales: []\n", "at least one locale"),
            (
                "projectId: demo\nlocales: [en]\ndefaultLocale: ru\n",
                "defaultLocale",
            ),
            (
                "projectId: demo\nlocales: [en]\nfallbackLocale: ru\n",
                "fallbackLocale",
            ),
            (
                "projectId: demo\nlocales: [en]\ntranslationFiles: ''\n",
                "translationFiles",
            ),
        ];
        for (index, (source, expected)) in cases.into_iter().enumerate() {
            let root = tempfile::tempdir().unwrap();
            let error =
                Config::load(write(root.path(), &format!("{index}.yaml"), source)).unwrap_err();
            assert!(error.to_string().contains(expected), "{error:#}");
        }
    }

    #[test]
    fn reports_invalid_source_format_with_the_file_name() {
        let root = tempfile::tempdir().unwrap();
        let path = write(root.path(), "broken.json", "not-json");
        let error = Config::load(&path).unwrap_err();
        assert!(error.to_string().contains("broken.json"));
        assert!(error.to_string().contains("not valid JSON"));
    }

    #[test]
    fn writes_json_and_yaml_documents() {
        let root = tempfile::tempdir().unwrap();
        let document = ConfigDocument {
            project_id: "demo".into(),
            environment: "dev".into(),
            locales: vec!["en".into()],
            default_locale: Some("en".into()),
            fallback_locale: Some("en".into()),
            translation_files: DEFAULT_TRANSLATION_FILES.into(),
            api_key_env: DEFAULT_API_KEY_ENV.into(),
            api_url: None,
            api_key: None,
            settings: Default::default(),
        };
        let json_path = root.path().join("nested/config.json");
        let yaml_path = root.path().join("nested/config.yaml");
        write_document(&json_path, &document).unwrap();
        write_document(&yaml_path, &document).unwrap();
        assert_eq!(Config::load(json_path).unwrap().project_id, "demo");
        assert_eq!(Config::load(yaml_path).unwrap().project_id, "demo");
    }
}
