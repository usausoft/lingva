//! Customer project inspection, metadata, validation, and generated contracts.
//!
//! Commands share one materialized project. File-backed portable configs and
//! normalized JSON exports therefore use identical fallback/metadata semantics.

use crate::{
    config::Config,
    local::{self, Dictionary},
};
use anyhow::{Context, Result};
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
};

pub const DEFAULT_METADATA_FILE: &str = ".lingva/metadata.json";
pub const WORKFLOW_STATUSES: [&str; 5] =
    ["draft", "translated", "reviewed", "approved", "untracked"];
const ERROR: &str = "error";
const WARNING: &str = "warning";
const INFO: &str = "info";
const INVALID_KEY: &str = "invalid_translation_key";
const INVALID_CONTRACT: &str = "invalid_translation_contract";
const MISSING_DEFAULT: &str = "missing_default_translation";
const MISSING_LOCALE: &str = "missing_locale_translation";
const CONTRACT_MISMATCH: &str = "translation_contract_mismatch";
const MISSING_METADATA: &str = "missing_key_metadata";
const MISSING_DESCRIPTION: &str = "missing_key_description";
const MISSING_STATUS: &str = "missing_workflow_status";
const MISSING_TRANSLATOR: &str = "translated_key_missing_translator";
const MISSING_REVIEWER: &str = "reviewed_key_missing_reviewer";
const NAMESPACE_MISMATCH: &str = "namespace_mismatch";
const MISSING_VARIANT: &str = "missing_locale_variant";
const EXTRA_VARIANT: &str = "extra_locale_variant";
const VARIANT_MISMATCH: &str = "variant_metadata_mismatch";
const VARIANT_FIELDS: [&str; 5] = ["tone", "mood", "intonation", "label", "context"];

pub struct Project {
    pub config: Config,
    pub resources: BTreeMap<String, Dictionary>,
    pub metadata: Dictionary,
}

impl Project {
    pub fn load(path: &Path) -> Result<Self> {
        let config = Config::load(path)?;
        Self::from_config(config)
    }

    pub fn from_config(config: Config) -> Result<Self> {
        let mut resources: BTreeMap<String, Dictionary> = match config.settings.get("resources") {
            Some(resources) => serde_json::from_value(resources.clone())
                .context("resources must map locales to JSON dictionaries.")?,
            None => config
                .locales
                .iter()
                .map(|locale| {
                    Ok((
                        locale.clone(),
                        local::read_dictionary(&config.translation_path(locale))?,
                    ))
                })
                .collect::<Result<_>>()?,
        };
        for locale in &config.locales {
            resources.entry(locale.clone()).or_default();
        }
        for locale in resources.keys() {
            crate::validate_locales(&config, std::slice::from_ref(locale))?;
        }
        let metadata_path = config.path.parent().unwrap_or(Path::new(".")).join(
            config
                .settings
                .get("metadataFile")
                .and_then(Value::as_str)
                .unwrap_or(DEFAULT_METADATA_FILE),
        );
        let mut metadata = local::read_dictionary(&metadata_path)?;
        if let Some(inline) = config.settings.get("keyMetadata") {
            metadata.extend(
                inline
                    .as_object()
                    .context("keyMetadata must be a JSON object.")?
                    .clone(),
            );
        }
        Ok(Self {
            config,
            resources,
            metadata,
        })
    }

    pub fn flat(&self) -> Result<BTreeMap<String, BTreeMap<String, Value>>> {
        self.resources
            .iter()
            .map(|(locale, dictionary)| Ok((locale.clone(), local::flatten(dictionary)?)))
            .collect()
    }

    pub fn keys(&self) -> Result<Vec<String>> {
        Ok(self
            .flat()?
            .values()
            .flat_map(|dictionary| dictionary.keys().cloned())
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect())
    }

    pub fn manifest(&self) -> Result<Value> {
        let flat = self.flat()?;
        let locales = self.resources.keys().cloned().collect::<Vec<_>>();
        let keys = self.keys()?;
        let entries = keys.iter().map(|key| {
            let mut variables = BTreeSet::new();
            let translations = locales.iter().map(|locale| {
                let value = flat[locale].get(key);
                if let Some(value) = value { variables.extend(local::interpolation_tokens(value)); }
                let mut item = json!({"locale":locale,"missing":value.is_none(),"isDefaultLocale":locale == &self.config.default_locale});
                if let Some(value) = value { item["value"] = value.clone(); }
                item
            }).collect::<Vec<_>>();
            let mut entry = json!({"key":key,"variables":variables,"translations":translations});
            if let Some(namespace) = self.metadata.get(key).and_then(|m| m.get("namespace")).cloned()
                .or_else(|| key.split_once('.').map(|(namespace, _)| json!(namespace))) { entry["namespace"] = namespace; }
            if let Some(metadata) = self.metadata.get(key) { entry["metadata"] = metadata.clone(); }
            entry
        }).collect::<Vec<_>>();
        Ok(
            json!({"projectId":self.config.project_id,"defaultLocale":self.config.default_locale,"fallbackLocale":self.config.fallback_locale,"locales":locales,"keys":keys,"entries":entries}),
        )
    }

    pub fn bundle(&self, locale: &str, include_metadata: bool) -> Result<Value> {
        crate::validate_locales(&self.config, &[locale.into()])?;
        let mut bundle = local::build_bundle(&self.config, locale, &self.resources)?;
        bundle["generatedAt"] = json!(chrono::Utc::now().to_rfc3339());
        if include_metadata {
            bundle["metadata"] = json!(
                self.metadata
                    .iter()
                    .filter(|(key, _)| bundle["messages"].get(*key).is_some())
                    .map(|(key, value)| (key.clone(), value.clone()))
                    .collect::<Dictionary>()
            );
        }
        for entry in bundle["entries"].as_array_mut().unwrap() {
            let key = entry["key"].as_str().unwrap();
            if let Some(namespace) = self.metadata.get(key).and_then(|m| m.get("namespace")) {
                entry["namespace"] = namespace.clone();
            }
        }
        Ok(bundle)
    }

    pub fn export(&self) -> Result<Value> {
        self.flat()?;
        Ok(
            json!({"projectId":self.config.project_id,"environment":self.config.environment,"defaultLocale":self.config.default_locale,"fallbackLocale":self.config.fallback_locale,"resources":self.resources,"keyMetadata":self.metadata}),
        )
    }

    pub fn workflow(&self) -> Result<Value> {
        let entries = self.keys()?.iter().map(|key| {
            let metadata = self.metadata.get(key);
            let mut entry = json!({"key":key,"status":metadata.and_then(|m|m.get("status")).and_then(Value::as_str).unwrap_or(WORKFLOW_STATUSES[4])});
            for field in ["translator", "reviewer"] {
                if let Some(value) = metadata.and_then(|m| m.get(field)) { entry[field] = value.clone(); }
            }
            entry
        }).collect::<Vec<_>>();
        let mut counts = BTreeMap::new();
        for status in WORKFLOW_STATUSES {
            counts.insert(
                status,
                entries
                    .iter()
                    .filter(|entry| entry["status"] == status)
                    .count(),
            );
        }
        let pending = |field: &str, statuses: &[&str]| {
            entries
                .iter()
                .filter(|entry| {
                    statuses.contains(&entry["status"].as_str().unwrap()) && blank(entry.get(field))
                })
                .map(|entry| entry["key"].clone())
                .collect::<Vec<_>>()
        };
        Ok(json!({"totalKeys":entries.len(),"statusCounts":counts,
            "translatorPendingKeys":pending("translator", &WORKFLOW_STATUSES[1..4]),
            "reviewerPendingKeys":pending("reviewer", &WORKFLOW_STATUSES[2..4]),
            "approvalPendingKeys":entries.iter().filter(|entry|entry["status"]==WORKFLOW_STATUSES[2]).map(|entry|entry["key"].clone()).collect::<Vec<_>>(),
            "approvedKeys":entries.iter().filter(|entry|entry["status"]==WORKFLOW_STATUSES[3]).map(|entry|entry["key"].clone()).collect::<Vec<_>>(),"entries":entries}))
    }

    /// Collect invalid leaves rather than throwing, so CI receives a full report.
    pub fn issues(&self) -> Vec<Value> {
        let mut issues = Vec::new();
        let mut flat = BTreeMap::new();
        for (locale, dictionary) in &self.resources {
            let mut values = BTreeMap::new();
            collect_leaves(dictionary, "", locale, &mut values, &mut issues);
            flat.insert(locale.clone(), values);
        }
        let keys = flat
            .values()
            .flat_map(|dictionary| dictionary.keys().cloned())
            .collect::<BTreeSet<_>>();
        for key in keys {
            if let Err(error) = local::validate_key(&key) {
                issues.push(issue(INVALID_KEY, ERROR, &key, None, &error.to_string()));
            }
            let default = flat
                .get(&self.config.default_locale)
                .and_then(|dictionary| dictionary.get(&key));
            if default.is_none() {
                issues.push(issue(
                    MISSING_DEFAULT,
                    ERROR,
                    &key,
                    Some(&self.config.default_locale),
                    "Key is missing in the default locale.",
                ));
            }
            for (locale, dictionary) in &flat {
                if locale == &self.config.default_locale || default.is_none() {
                    continue;
                }
                match dictionary.get(&key) {
                    None => issues.push(issue(
                        MISSING_LOCALE,
                        INFO,
                        &key,
                        Some(locale),
                        "Translation uses a fallback.",
                    )),
                    Some(value) if value.is_string() != default.unwrap().is_string() => issues
                        .push(issue(
                            CONTRACT_MISMATCH,
                            ERROR,
                            &key,
                            Some(locale),
                            "Translation kind differs from the default locale.",
                        )),
                    Some(value) if local::is_variants(value) => {
                        variant_issues(&key, locale, default.unwrap(), value, &mut issues)
                    }
                    _ => {}
                }
            }
            let Some(metadata) = self.metadata.get(&key) else {
                issues.push(issue(
                    MISSING_METADATA,
                    WARNING,
                    &key,
                    None,
                    "Key does not have metadata yet.",
                ));
                continue;
            };
            if blank(metadata.get("description")) {
                issues.push(issue(
                    MISSING_DESCRIPTION,
                    WARNING,
                    &key,
                    None,
                    "Metadata description is missing.",
                ));
            }
            let status = metadata.get("status").and_then(Value::as_str);
            if status.is_none() {
                issues.push(issue(
                    MISSING_STATUS,
                    INFO,
                    &key,
                    None,
                    "Workflow status is missing.",
                ));
            }
            if status.is_some_and(|status| WORKFLOW_STATUSES[1..4].contains(&status))
                && blank(metadata.get("translator"))
            {
                issues.push(issue(
                    MISSING_TRANSLATOR,
                    WARNING,
                    &key,
                    None,
                    "Translated key has no translator.",
                ));
            }
            if status.is_some_and(|status| WORKFLOW_STATUSES[2..4].contains(&status))
                && blank(metadata.get("reviewer"))
            {
                issues.push(issue(
                    MISSING_REVIEWER,
                    WARNING,
                    &key,
                    None,
                    "Reviewed key has no reviewer.",
                ));
            }
            if let Some((namespace, _)) = key.split_once('.') {
                if metadata
                    .get("namespace")
                    .and_then(Value::as_str)
                    .is_some_and(|declared| declared != namespace)
                {
                    issues.push(issue(
                        NAMESPACE_MISMATCH,
                        WARNING,
                        &key,
                        None,
                        "Metadata namespace differs from the key namespace.",
                    ));
                }
            }
        }
        issues
    }
}

fn blank(value: Option<&Value>) -> bool {
    value
        .and_then(Value::as_str)
        .is_none_or(|value| value.trim().is_empty())
}

fn issue(code: &str, severity: &str, key: &str, locale: Option<&str>, message: &str) -> Value {
    let mut issue = json!({"code":code,"severity":severity,"key":key,"message":message});
    if let Some(locale) = locale {
        issue["locale"] = json!(locale);
    }
    issue
}

fn collect_leaves(
    dictionary: &Dictionary,
    prefix: &str,
    locale: &str,
    output: &mut BTreeMap<String, Value>,
    issues: &mut Vec<Value>,
) {
    for (key, value) in dictionary {
        let key = if prefix.is_empty() {
            key.clone()
        } else {
            format!("{prefix}.{key}")
        };
        if let Some(object) = value.as_object() {
            collect_leaves(object, &key, locale, output, issues);
        } else {
            if output.insert(key.clone(), value.clone()).is_some() {
                issues.push(issue(
                    INVALID_CONTRACT,
                    ERROR,
                    &key,
                    Some(locale),
                    "Translation collides with another flattened key.",
                ));
            }
            let duplicate = value.as_array().is_some_and(|items| {
                let ids = items
                    .iter()
                    .filter_map(|item| item.get("id").and_then(Value::as_str))
                    .collect::<Vec<_>>();
                ids.iter().collect::<BTreeSet<_>>().len() != ids.len()
            });
            if !(value.is_string() || local::is_variants(value)) || duplicate {
                issues.push(issue(
                    INVALID_CONTRACT,
                    ERROR,
                    &key,
                    Some(locale),
                    "Translation must be a string or non-empty variants with unique IDs.",
                ));
            }
        }
    }
}

fn variant_issues(
    key: &str,
    locale: &str,
    default: &Value,
    target: &Value,
    issues: &mut Vec<Value>,
) {
    let variants = |value: &Value| {
        value
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|variant| Some((variant.get("id")?.as_str()?.to_owned(), variant.clone())))
            .collect::<BTreeMap<_, _>>()
    };
    let source = variants(default);
    let target = variants(target);
    for (id, variant) in &source {
        match target.get(id) {
            None => issues.push(issue(
                MISSING_VARIANT,
                INFO,
                key,
                Some(locale),
                &format!("Variant {id} is missing."),
            )),
            Some(target) => {
                for field in VARIANT_FIELDS {
                    let normalized = |value: Option<&Value>| {
                        value
                            .and_then(Value::as_str)
                            .map(str::trim)
                            .filter(|value| !value.is_empty())
                            .map(str::to_owned)
                    };
                    if normalized(target.get(field)) != normalized(variant.get(field)) {
                        issues.push(issue(
                            VARIANT_MISMATCH,
                            WARNING,
                            key,
                            Some(locale),
                            &format!("Variant {id} has different {field}."),
                        ));
                    }
                }
            }
        }
    }
    for id in target.keys().filter(|id| !source.contains_key(*id)) {
        issues.push(issue(
            EXTRA_VARIANT,
            WARNING,
            key,
            Some(locale),
            &format!("Extra variant {id}."),
        ));
    }
}

pub fn validation_result(issues: Vec<Value>) -> Value {
    let count = |severity| {
        issues
            .iter()
            .filter(|issue| issue["severity"] == severity)
            .count()
    };
    json!({"valid":count(ERROR)==0,"errorCount":count(ERROR),"warningCount":count(WARNING),"infoCount":count(INFO),"issues":issues})
}

pub fn types(manifest: &Value, helpers: bool, metadata: bool) -> Result<String> {
    let entries = manifest["entries"]
        .as_array()
        .context("Manifest has no entries.")?;
    let mut namespaces = Dictionary::new();
    let mut variables = Dictionary::new();
    let mut presence = Dictionary::new();
    let mut key_metadata = Dictionary::new();
    for entry in entries {
        let key = entry["key"].as_str().unwrap();
        namespaces.insert(
            key.into(),
            entry.get("namespace").cloned().unwrap_or(Value::Null),
        );
        variables.insert(key.into(), entry["variables"].clone());
        presence.insert(
            key.into(),
            Value::Object(
                entry["translations"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|translation| {
                        (
                            translation["locale"].as_str().unwrap().to_owned(),
                            json!(translation["missing"] == false),
                        )
                    })
                    .collect(),
            ),
        );
        if let Some(value) = entry.get("metadata") {
            key_metadata.insert(key.into(), value.clone());
        }
    }
    let prefix = if helpers { "" } else { "export " };
    let mut source = String::from("// Generated by Lingva. Do not edit.\n");
    for (name, value) in [
        ("lingvaLocales", manifest["locales"].clone()),
        ("lingvaKeys", manifest["keys"].clone()),
        ("lingvaKeyNamespaces", json!(namespaces)),
        ("lingvaKeyVariables", json!(variables)),
        ("lingvaTranslationPresence", json!(presence)),
    ] {
        source.push_str(&format!(
            "{prefix}const {name} = {} as const;\n",
            serde_json::to_string_pretty(&value)?
        ));
    }
    if metadata {
        source.push_str(&format!(
            "{prefix}const lingvaKeyMetadata = {} as const;\n",
            serde_json::to_string_pretty(&key_metadata)?
        ));
    }
    source.push_str("export type LingvaLocale = typeof lingvaLocales[number];\nexport type LingvaTranslationKey = typeof lingvaKeys[number];\n");
    if helpers {
        source.push_str("export function getLingvaLocales(): readonly LingvaLocale[] { return lingvaLocales; }\nexport function getLingvaKeys(): readonly LingvaTranslationKey[] { return lingvaKeys; }\nexport function isLingvaLocale(value: string): value is LingvaLocale { return (lingvaLocales as readonly string[]).includes(value); }\nexport function isLingvaKey(value: string): value is LingvaTranslationKey { return (lingvaKeys as readonly string[]).includes(value); }\nexport function getLingvaNamespace(key: LingvaTranslationKey): string | null { return lingvaKeyNamespaces[key]; }\nexport function getLingvaVariables(key: LingvaTranslationKey): readonly string[] { return lingvaKeyVariables[key]; }\nexport function hasLingvaTranslation(locale: LingvaLocale, key: LingvaTranslationKey): boolean { return lingvaTranslationPresence[key][locale]; }\n");
        if metadata {
            source.push_str("export function getLingvaKeyMetadata(key: LingvaTranslationKey) { return (lingvaKeyMetadata as Partial<Record<LingvaTranslationKey, unknown>>)[key]; }\n");
        }
    }
    Ok(source)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project(resources: Value, metadata: Value) -> Project {
        let config = Config::from_document(
            Path::new("/tmp/lingva-project-tests/config.json").into(),
            serde_json::from_value(json!({
                "projectId":"validation-tests", "locales":["en","ru"],
                "defaultLocale":"en", "fallbackLocale":"en"
            }))
            .unwrap(),
        )
        .unwrap();
        Project {
            config,
            resources: serde_json::from_value(resources).unwrap(),
            metadata: serde_json::from_value(metadata).unwrap(),
        }
    }

    #[test]
    fn validation_reports_all_fourteen_issue_codes_without_losing_invalid_leaves() {
        let project = project(
            json!({
                "en": {
                    "bad key": 42,
                    "collision":{"leaf":"nested"}, "collision.leaf":"flat",
                    "missing":"source", "kind":"string",
                    "variants":[{"id":"same","text":"same","tone":"formal"},{"id":"missing","text":"missing"}],
                    "duplicate":[{"id":"same","text":"first"},{"id":"same","text":"second"}],
                    "ns.described":"description", "status":"status"
                },
                "ru": {
                    "extra":"no default", "kind":[{"id":"one","text":"variant"}],
                    "variants":[{"id":"same","text":"same","tone":"casual"},{"id":"extra","text":"extra"}]
                }
            }),
            json!({
                "ns.described":{"description":" ","namespace":"wrong","status":"reviewed","translator":" ","reviewer":null},
                "status":{"description":"present"}
            }),
        );
        let issues = project.issues();
        let codes = issues
            .iter()
            .map(|entry| entry["code"].as_str().unwrap())
            .collect::<BTreeSet<_>>();
        assert_eq!(
            codes,
            BTreeSet::from([
                "invalid_translation_key",
                "invalid_translation_contract",
                "missing_default_translation",
                "missing_locale_translation",
                "translation_contract_mismatch",
                "missing_key_metadata",
                "missing_key_description",
                "missing_workflow_status",
                "translated_key_missing_translator",
                "reviewed_key_missing_reviewer",
                "namespace_mismatch",
                "missing_locale_variant",
                "extra_locale_variant",
                "variant_metadata_mismatch"
            ])
        );
        let result = validation_result(issues);
        assert_eq!(result["valid"], false);
        assert!(result["errorCount"].as_u64().unwrap() > 0);
        assert!(result["warningCount"].as_u64().unwrap() > 0);
        assert!(result["infoCount"].as_u64().unwrap() > 0);
        assert!(project.flat().is_err());
        assert!(project.export().is_err());
    }

    #[test]
    fn complete_metadata_and_normalized_variant_fields_have_no_issues() {
        let project = project(
            json!({
                "en":{"ns.key":[{"id":"one","text":"Hello {name}","tone":"formal","label":" "}]},
                "ru":{"ns.key":[{"id":"one","text":"Privet {name}","tone":" formal "}]}
            }),
            json!({"ns.key":{"description":"Greeting", "namespace":"ns", "status":"approved", "translator":"t", "reviewer":"r"}}),
        );
        assert!(project.issues().is_empty());
        assert_eq!(validation_result(project.issues())["valid"], true);
    }

    #[test]
    fn workflow_tracks_each_status_and_missing_people_independently() {
        let project = project(
            json!({"en":{"draft":"d","translated":"t","reviewed":"r","approved":"a","untracked":"u"},"ru":{}}),
            json!({
                "draft":{"status":"draft"}, "translated":{"status":"translated"},
                "reviewed":{"status":"reviewed","translator":"t","reviewer":" "},
                "approved":{"status":"approved","translator":"t","reviewer":"r"}
            }),
        );
        let result = project.workflow().unwrap();
        assert_eq!(result["totalKeys"], 5);
        for status in ["draft", "translated", "reviewed", "approved", "untracked"] {
            assert_eq!(result["statusCounts"][status], 1);
        }
        assert_eq!(result["translatorPendingKeys"], json!(["translated"]));
        assert_eq!(result["reviewerPendingKeys"], json!(["reviewed"]));
        assert_eq!(result["approvalPendingKeys"], json!(["reviewed"]));
        assert_eq!(result["approvedKeys"], json!(["approved"]));
        assert_eq!(result["entries"][0]["reviewer"], "r");
    }

    #[test]
    fn metadata_overlay_and_missing_locales_preserve_the_resource_contract() {
        let root = tempfile::tempdir().unwrap();
        std::fs::write(root.path().join("metadata.json"), r#"{"ns.key":{"namespace":"disk","description":"old"},"orphan":{"description":"keep"}}"#).unwrap();
        let document = json!({"projectId":"overlay", "locales":["en","ru"], "defaultLocale":"en", "resources":{"en":{"ns.key":"Hello {name}"}}, "metadataFile":"metadata.json", "keyMetadata":{"ns.key":{"namespace":"inline","description":"new"}}});
        let config = Config::from_document(
            root.path().join("config.json"),
            serde_json::from_value(document.clone()).unwrap(),
        )
        .unwrap();
        let project = Project::from_config(config).unwrap();
        assert!(project.resources["ru"].is_empty());
        assert_eq!(project.metadata["ns.key"]["description"], "new");
        assert_eq!(project.metadata["orphan"]["description"], "keep");
        let manifest = project.manifest().unwrap();
        assert_eq!(manifest["entries"][0]["namespace"], "inline");
        assert_eq!(manifest["entries"][0]["variables"], json!(["name"]));
        assert_eq!(manifest["entries"][0]["translations"][1]["missing"], true);
        let bundle = project.bundle("ru", true).unwrap();
        assert_eq!(bundle["messages"]["ns.key"], "Hello {name}");
        assert_eq!(bundle["entries"][0]["namespace"], "inline");
        assert!(bundle["metadata"].get("orphan").is_none());
        assert!(
            project
                .bundle("en", false)
                .unwrap()
                .get("metadata")
                .is_none()
        );
        assert!(project.bundle("de", true).is_err());
        for (field, value) in [
            ("resources", json!({"de":{}})),
            ("resources", json!([])),
            ("keyMetadata", json!([])),
        ] {
            let mut invalid = document.clone();
            invalid[field] = value;
            let config = Config::from_document(
                root.path().join("config.json"),
                serde_json::from_value(invalid).unwrap(),
            )
            .unwrap();
            assert!(Project::from_config(config).is_err(), "{field}");
        }
    }

    #[test]
    fn generated_contracts_cover_metadata_helpers_and_namespace_free_keys() {
        let project = project(
            json!({"en":{"plain":"hello", "ns.key":"Hello {name}"},"ru":{"plain":"privet"}}),
            json!({"ns.key":{"description":"Greeting"}}),
        );
        let manifest = project.manifest().unwrap();
        for helpers in [true, false] {
            for metadata in [true, false] {
                let source = types(&manifest, helpers, metadata).unwrap();
                assert!(source.contains("\"plain\": null"));
                assert_eq!(source.contains("const lingvaKeyMetadata"), metadata);
                assert_eq!(source.contains("function getLingvaLocales"), helpers);
                assert_eq!(
                    source.contains("function getLingvaKeyMetadata"),
                    helpers && metadata
                );
                assert_eq!(source.contains("export const lingvaKeys"), !helpers);
            }
        }
        assert!(types(&json!({}), false, false).is_err());
    }
}
