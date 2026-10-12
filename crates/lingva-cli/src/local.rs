//! Local translation validation, synchronization, and bundle generation.
//!
//! Dictionaries are nested JSON objects whose leaves are strings or non-empty
//! variant arrays. All comparisons use flattened dotted keys, while writes
//! preserve deterministic nested JSON for reviewable repository diffs.

use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::Path,
};

use anyhow::{Context, Result, bail};
use serde::Serialize;
use serde_json::{Map, Value, json};

use crate::config::Config;

/// JSON object used by locale files and merge state.
pub type Dictionary = Map<String, Value>;
/// Shared product limit for a dotted translation key.
pub const TRANSLATION_KEY_MAX_LENGTH: usize = 200;
const VARIANT_FIELDS: [&str; 5] = ["tone", "mood", "intonation", "label", "context"];

/// Structural differences between a locale and its default-locale schema.
#[derive(Debug, Default, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Drift {
    pub missing_keys: usize,
    pub missing_variants: usize,
    pub extra_variants: usize,
    pub variant_metadata_mismatches: usize,
}

impl Drift {
    /// Return whether synchronization would change structural content.
    pub fn has_drift(&self) -> bool {
        self.missing_keys
            + self.missing_variants
            + self.extra_variants
            + self.variant_metadata_mismatches
            > 0
    }
    fn add(&mut self, other: Self) {
        self.missing_keys += other.missing_keys;
        self.missing_variants += other.missing_variants;
        self.extra_variants += other.extra_variants;
        self.variant_metadata_mismatches += other.variant_metadata_mismatches;
    }
}

/// Result for one locale file in a sync/check operation.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncFile {
    pub locale: String,
    pub file_path: String,
    #[serde(flatten)]
    pub drift: Drift,
    pub written: bool,
}

/// Aggregate sync/check result emitted by the CLI.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub config_file: String,
    pub default_locale: String,
    pub locales: Vec<String>,
    pub has_drift: bool,
    pub files: Vec<SyncFile>,
}

/// Validate the cross-SDK dotted-key contract.
pub fn validate_key(key: &str) -> Result<()> {
    if key.is_empty() {
        bail!("Lingva translation key is required.");
    }
    if key.chars().count() > TRANSLATION_KEY_MAX_LENGTH {
        bail!("Lingva translation key must be at most {TRANSLATION_KEY_MAX_LENGTH} characters.");
    }
    if key.ends_with('.') {
        bail!("Lingva translation key must not end with a dot.");
    }
    if key.contains("..") {
        bail!("Lingva translation key must not contain consecutive dots.");
    }
    let mut chars = key.chars();
    if !chars
        .next()
        .is_some_and(|value| value.is_ascii_alphanumeric())
        || !chars.all(|value| value.is_ascii_alphanumeric() || matches!(value, '.' | '_' | '-'))
    {
        bail!(
            "Lingva translation key may only use letters, digits, dots, underscores, and hyphens, and must start with a letter or digit."
        );
    }
    Ok(())
}

/// Read a JSON dictionary; a missing locale starts as an empty dictionary.
pub fn read_dictionary(path: &Path) -> Result<Dictionary> {
    if !path.exists() {
        return Ok(Dictionary::new());
    }
    let source = fs::read_to_string(path)?;
    serde_json::from_str::<Dictionary>(&source).with_context(|| {
        format!(
            "Lingva translation file \"{}\" must contain a JSON object.",
            path.display()
        )
    })
}

/// Write stable, recursively sorted, pretty JSON with a trailing newline.
pub fn write_dictionary(path: &Path, dictionary: &Dictionary) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    crate::atomic_file::write(path, dictionary_bytes(dictionary)?, false)?;
    Ok(())
}

pub fn dictionary_bytes(dictionary: &Dictionary) -> Result<Vec<u8>> {
    Ok(format!(
        "{}\n",
        serde_json::to_string_pretty(&sort_object(dictionary))?
    )
    .into_bytes())
}

fn is_variant(value: &Value) -> bool {
    value.as_object().is_some_and(|item| {
        item.get("id")
            .and_then(Value::as_str)
            .is_some_and(|id| !id.trim().is_empty())
            && item.get("text").and_then(Value::as_str).is_some()
    })
}

/// Return whether a value is a valid non-empty Lingva variant list.
pub fn is_variants(value: &Value) -> bool {
    value
        .as_array()
        .is_some_and(|items| !items.is_empty() && items.iter().all(is_variant))
}

fn blank_value(value: &Value) -> Value {
    if value.is_string() {
        return Value::String(String::new());
    }
    if is_variants(value) {
        return Value::Array(
            value
                .as_array()
                .unwrap()
                .iter()
                .map(|variant| {
                    let mut variant = variant.as_object().unwrap().clone();
                    variant.insert("text".into(), Value::String(String::new()));
                    Value::Object(variant)
                })
                .collect(),
        );
    }
    match value {
        Value::Object(object) => Value::Object(
            object
                .iter()
                .map(|(key, value)| (key.clone(), blank_value(value)))
                .collect(),
        ),
        _ => value.clone(),
    }
}

fn variant_map(value: &Value) -> BTreeMap<String, &Map<String, Value>> {
    value
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|variant| {
            let object = variant.as_object()?;
            Some((object.get("id")?.as_str()?.to_owned(), object))
        })
        .collect()
}

/// Add source keys/variants to a target without replacing translated text.
///
/// Variant metadata follows the default locale, while translated `text` and
/// target-only extension fields survive for matching variant IDs.
pub fn merge_missing(source: &Dictionary, target: &Dictionary) -> Dictionary {
    let mut output = target.clone();
    for (key, source_value) in source {
        let Some(target_value) = output.get(key).cloned() else {
            output.insert(key.clone(), blank_value(source_value));
            continue;
        };
        if is_variants(source_value) {
            let target_by_id = variant_map(&target_value);
            let variants = source_value
                .as_array()
                .unwrap()
                .iter()
                .map(|source_variant| {
                    let source_object = source_variant.as_object().unwrap();
                    let id = source_object.get("id").and_then(Value::as_str).unwrap();
                    let mut merged = target_by_id
                        .get(id)
                        .map(|value| (*value).clone())
                        .unwrap_or_default();
                    merged.extend(source_object.clone());
                    if let Some(target_variant) = target_by_id.get(id) {
                        if let Some(text) = target_variant.get("text") {
                            merged.insert("text".into(), text.clone());
                        }
                    } else {
                        merged.insert("text".into(), Value::String(String::new()));
                    }
                    Value::Object(merged)
                })
                .collect();
            output.insert(key.clone(), Value::Array(variants));
        } else if let (Some(source_object), Some(target_object)) =
            (source_value.as_object(), target_value.as_object())
        {
            output.insert(
                key.clone(),
                Value::Object(merge_missing(source_object, target_object)),
            );
        }
    }
    sort_object(&output)
}

/// Count structural drift without mutating either locale.
pub fn analyze_drift(source: &Dictionary, target: &Dictionary) -> Drift {
    let mut drift = Drift::default();
    for (key, source_value) in source {
        let Some(target_value) = target.get(key) else {
            drift.missing_keys += 1;
            continue;
        };
        if is_variants(source_value) {
            if !is_variants(target_value) {
                drift.missing_variants += source_value.as_array().map_or(0, Vec::len);
                continue;
            }
            let source_by_id = variant_map(source_value);
            let target_by_id = variant_map(target_value);
            for (id, source_variant) in &source_by_id {
                let Some(target_variant) = target_by_id.get(id) else {
                    drift.missing_variants += 1;
                    continue;
                };
                drift.variant_metadata_mismatches += VARIANT_FIELDS
                    .iter()
                    .filter(|field| {
                        normalized(source_variant.get(**field))
                            != normalized(target_variant.get(**field))
                    })
                    .count();
            }
            drift.extra_variants += target_by_id
                .keys()
                .filter(|id| !source_by_id.contains_key(*id))
                .count();
        } else if let (Some(source_object), Some(target_object)) =
            (source_value.as_object(), target_value.as_object())
        {
            drift.add(analyze_drift(source_object, target_object));
        }
    }
    drift
}

fn normalized(value: Option<&Value>) -> Option<&str> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

/// Flatten nested dictionaries into validated dotted keys.
pub fn flatten(dictionary: &Dictionary) -> Result<BTreeMap<String, Value>> {
    fn visit(
        prefix: &str,
        dictionary: &Dictionary,
        output: &mut BTreeMap<String, Value>,
    ) -> Result<()> {
        for (key, value) in dictionary {
            let path = if prefix.is_empty() {
                key.clone()
            } else {
                format!("{prefix}.{key}")
            };
            if value.is_string() || is_variants(value) {
                validate_key(&path)?;
                if is_variants(value) {
                    let ids = value
                        .as_array()
                        .unwrap()
                        .iter()
                        .filter_map(|item| item.get("id").and_then(Value::as_str))
                        .collect::<Vec<_>>();
                    if ids.iter().collect::<BTreeSet<_>>().len() != ids.len() {
                        bail!("Lingva translation \"{path}\" contains duplicate variant IDs.");
                    }
                }
                if output.insert(path.clone(), value.clone()).is_some() {
                    bail!("Lingva translation \"{path}\" collides with another flattened key.");
                }
            } else if let Some(object) = value.as_object() {
                visit(&path, object, output)?;
            } else {
                bail!(
                    "Lingva translation \"{path}\" must be a string or a non-empty variant array."
                );
            }
        }
        Ok(())
    }
    let mut output = BTreeMap::new();
    visit("", dictionary, &mut output)?;
    Ok(output)
}

/// Insert one dotted translation key, creating only missing object parents.
pub fn set_dotted(dictionary: &mut Dictionary, key: &str, value: Value) -> Result<()> {
    validate_key(key)?;
    let mut segments = key.split('.').peekable();
    let mut current = dictionary;
    while let Some(segment) = segments.next() {
        if segments.peek().is_none() {
            // An object is a namespace, not an editable translation leaf.
            // Replacing it would silently delete every descendant key.
            if current.get(segment).is_some_and(Value::is_object) {
                bail!("Lingva translation key \"{key}\" conflicts with an existing namespace.");
            }
            current.insert(segment.into(), value);
            return Ok(());
        }
        let entry = current
            .entry(segment)
            .or_insert_with(|| Value::Object(Map::new()));
        if !entry.is_object() {
            bail!(
                "Lingva translation key \"{key}\" conflicts with the existing parent \"{segment}\"."
            );
        }
        current = entry.as_object_mut().unwrap();
    }
    Ok(())
}

/// Plan or apply locale-structure synchronization from the default locale.
pub fn sync(config: &Config, write: bool) -> Result<SyncResult> {
    let source = config.read_translation(&config.default_locale)?;
    flatten(&source)?;
    // Validate and plan every locale before the first mutation. A malformed
    // later file must not leave earlier files structurally updated.
    let mut updates = BTreeMap::new();
    let files = config
        .locales
        .iter()
        .map(|locale| {
            let path = config.translation_path(locale);
            let current = config.read_translation(locale)?;
            flatten(&current)?;
            let drift = if locale == &config.default_locale {
                Drift::default()
            } else {
                analyze_drift(&source, &current)
            };
            if write {
                let updated = if locale == &config.default_locale {
                    current.clone()
                } else {
                    merge_missing(&source, &current)
                };
                updates.insert(locale.clone(), updated);
            }
            Ok(SyncFile {
                locale: locale.clone(),
                file_path: path.display().to_string(),
                drift,
                written: write,
            })
        })
        .collect::<Result<Vec<_>>>()?;
    config.write_translations(&updates)?;
    let has_drift = files.iter().any(|file| file.drift.has_drift());
    Ok(SyncResult {
        config_file: config.path.display().to_string(),
        default_locale: config.default_locale.clone(),
        locales: config.locales.clone(),
        has_drift,
        files,
    })
}

/// Build one runtime bundle using requested, fallback, then default locale.
pub fn build_bundle(
    config: &Config,
    locale: &str,
    resources: &BTreeMap<String, Dictionary>,
) -> Result<Value> {
    let flattened = resources
        .iter()
        .map(|(locale, dictionary)| Ok((locale.clone(), flatten(dictionary)?)))
        .collect::<Result<BTreeMap<_, _>>>()?;
    let keys = flattened
        .values()
        .flat_map(|items| items.keys().cloned())
        .collect::<BTreeSet<_>>();
    let mut messages = BTreeMap::new();
    let mut variants = BTreeMap::new();
    let mut sources = BTreeMap::new();
    let mut variables = BTreeMap::new();
    let mut entries = Vec::new();
    let mut fallback_keys = Vec::new();
    for key in keys {
        // `find_map` also deduplicates behavior naturally when fallback equals
        // default: the first available value wins without another code path.
        let selected = [locale, &config.fallback_locale, &config.default_locale]
            .into_iter()
            .find_map(|source| {
                flattened
                    .get(source)
                    .and_then(|items| items.get(&key))
                    .map(|value| (source, value))
            });
        let Some((source, value)) = selected else {
            continue;
        };
        let text = value
            .as_str()
            .map(str::to_owned)
            .or_else(|| {
                value
                    .as_array()?
                    .first()?
                    .get("text")?
                    .as_str()
                    .map(str::to_owned)
            })
            .unwrap_or_default();
        let tokens = interpolation_tokens(value);
        let fallback = source != locale;
        messages.insert(key.clone(), text.clone());
        sources.insert(key.clone(), source.to_owned());
        variables.insert(key.clone(), tokens.clone());
        if fallback {
            fallback_keys.push(key.clone());
        }
        if is_variants(value) {
            variants.insert(key.clone(), value.clone());
        }
        let mut entry = json!({"key": key, "value": text, "sourceLocale": source, "fallback": fallback, "variables": tokens});
        if let Some(namespace) = key.split_once('.').map(|value| value.0) {
            entry["namespace"] = json!(namespace);
        }
        if is_variants(value) {
            entry["variants"] = value.clone();
        }
        entries.push(entry);
    }
    let mut bundle = json!({
        "schemaVersion": 1,
        "projectId": config.project_id,
        "environment": config.environment,
        "locale": locale,
        "defaultLocale": config.default_locale,
        "fallbackLocale": config.fallback_locale,
        "keyCount": entries.len(),
        "fallbackKeys": fallback_keys,
        "messages": messages,
        "sources": sources,
        "variables": variables,
        "entries": entries,
    });
    if !variants.is_empty() {
        bundle["variants"] = serde_json::to_value(variants)?;
    }
    Ok(bundle)
}

pub fn interpolation_tokens(value: &Value) -> Vec<String> {
    let texts: Vec<&str> = if let Some(text) = value.as_str() {
        vec![text]
    } else {
        value
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|item| item.get("text")?.as_str())
            .collect()
    };
    texts
        .into_iter()
        .flat_map(|text| {
            let mut tokens = Vec::new();
            let mut rest = text;
            while let Some(start) = rest.find('{') {
                let after = &rest[start + 1..];
                let Some(end) = after.find('}') else {
                    break;
                };
                let token = &after[..end];
                if !token.is_empty()
                    && token
                        .chars()
                        .all(|value| value.is_ascii_alphanumeric() || value == '_')
                {
                    tokens.push(token.to_owned());
                }
                rest = &after[end + 1..];
            }
            tokens
        })
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

/// Recursively sort object keys while retaining array order.
pub fn sort_object(object: &Dictionary) -> Dictionary {
    object
        .iter()
        .map(|(key, value)| (key.clone(), sort_value(value)))
        .collect::<BTreeMap<_, _>>()
        .into_iter()
        .collect()
}

fn sort_value(value: &Value) -> Value {
    match value {
        Value::Object(object) => Value::Object(sort_object(object)),
        Value::Array(items) => Value::Array(items.iter().map(sort_value).collect()),
        _ => value.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dictionary(value: Value) -> Dictionary {
        serde_json::from_value(value).unwrap()
    }

    fn test_config(root: &Path) -> Config {
        Config {
            path: root.join("lingva.config.yaml"),
            project_id: "demo".into(),
            environment: "dev".into(),
            locales: vec!["en".into(), "ru".into(), "de".into()],
            default_locale: "en".into(),
            fallback_locale: "de".into(),
            translation_files: ".lingva/translations/{locale}.json".into(),
            api_url: None,
            api_key: None,
            settings: Default::default(),
        }
    }

    #[test]
    fn sync_preserves_text_and_aligns_variant_contract() {
        let source = dictionary(json!({"title": [{"id":"formal","tone":"formal","text":"Hello"}]}));
        let target =
            dictionary(json!({"title": [{"id":"formal","tone":"casual","text":"Привет"}]}));
        let drift = analyze_drift(&source, &target);
        assert_eq!(drift.variant_metadata_mismatches, 1);
        let merged = merge_missing(&source, &target);
        assert_eq!(merged["title"][0]["text"], "Привет");
        assert_eq!(merged["title"][0]["tone"], "formal");
    }

    #[test]
    fn validates_key_boundaries_and_characters() {
        for key in ["a", "home.title", "checkout_item-2", &"a".repeat(200)] {
            validate_key(key).unwrap();
        }
        for key in [
            "",
            ".leading",
            "trailing.",
            "double..dot",
            "contains space",
            "emoji.🚀",
            &"a".repeat(201),
        ] {
            assert!(validate_key(key).is_err(), "accepted invalid key {key:?}");
        }
    }

    #[test]
    fn flatten_rejects_invalid_leaf_values() {
        for value in [
            json!(null),
            json!(false),
            json!(42),
            json!([]),
            json!([{"id":"x"}]),
        ] {
            let error = flatten(&dictionary(json!({"bad": value}))).unwrap_err();
            assert!(error.to_string().contains("bad"));
        }
    }

    #[test]
    fn flatten_rejects_duplicate_variant_ids() {
        let error = flatten(&dictionary(json!({
            "title": [
                {"id":"same","text":"One"},
                {"id":"same","text":"Two"}
            ]
        })))
        .unwrap_err();
        assert!(error.to_string().contains("duplicate variant IDs"));
    }

    #[test]
    fn set_dotted_rejects_scalar_parent_collision() {
        let mut value = dictionary(json!({"account":"Account"}));
        let error = set_dotted(&mut value, "account.title", json!("Title")).unwrap_err();
        assert!(error.to_string().contains("conflicts"));
        assert_eq!(value, dictionary(json!({"account":"Account"})));
    }

    #[test]
    fn merge_missing_preserves_text_and_follows_source_variant_set() {
        let source = dictionary(json!({
            "nested": {"new":"New"},
            "title": [
                {"id":"formal","tone":"formal","text":"Hello"},
                {"id":"casual","tone":"casual","text":"Hi"}
            ]
        }));
        let target = dictionary(json!({
            "title": [
                {"id":"formal","tone":"old","text":"Здравствуйте"},
                {"id":"removed","text":"Removed"}
            ]
        }));
        let merged = merge_missing(&source, &target);
        assert_eq!(merged["nested"]["new"], "");
        assert_eq!(merged["title"][0]["text"], "Здравствуйте");
        assert_eq!(merged["title"][0]["tone"], "formal");
        assert_eq!(merged["title"][1]["id"], "casual");
        assert_eq!(merged["title"][1]["text"], "");
        assert_eq!(merged["title"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn drift_counts_nested_keys_and_variant_differences() {
        let source = dictionary(json!({
            "nested":{"missing":"value"},
            "title":[
                {"id":"formal","tone":"formal","text":"Hello"},
                {"id":"casual","text":"Hi"}
            ]
        }));
        let target = dictionary(json!({
            "nested":{},
            "title":[
                {"id":"formal","tone":"casual","text":"Привет"},
                {"id":"extra","text":"Extra"}
            ]
        }));
        assert_eq!(
            analyze_drift(&source, &target),
            Drift {
                missing_keys: 1,
                missing_variants: 1,
                extra_variants: 1,
                variant_metadata_mismatches: 1,
            }
        );
    }

    #[test]
    fn bundle_uses_requested_then_fallback_locale_and_collects_variables() {
        let root = tempfile::tempdir().unwrap();
        let config = test_config(root.path());
        let resources = BTreeMap::from([
            (
                "en".into(),
                dictionary(json!({"onlyDefault":"Default","welcome":"Hello {name}"})),
            ),
            (
                "de".into(),
                dictionary(
                    json!({"welcome":"Hallo {name}","choice":[{"id":"one","text":"Ein {count}"}]}),
                ),
            ),
            ("ru".into(), dictionary(json!({"welcome":"Привет {name}"}))),
        ]);
        let bundle = build_bundle(&config, "ru", &resources).unwrap();
        assert_eq!(bundle["messages"]["welcome"], "Привет {name}");
        assert_eq!(bundle["sources"]["choice"], "de");
        assert_eq!(bundle["sources"]["onlyDefault"], "en");
        assert_eq!(bundle["variables"]["welcome"], json!(["name"]));
        assert_eq!(bundle["variables"]["choice"], json!(["count"]));
        assert_eq!(bundle["fallbackKeys"], json!(["choice", "onlyDefault"]));
        assert_eq!(bundle["keyCount"], 3);
    }

    #[test]
    fn sync_dry_run_does_not_write_and_apply_preserves_existing_text() {
        let root = tempfile::tempdir().unwrap();
        let config = test_config(root.path());
        write_dictionary(
            &config.translation_path("en"),
            &dictionary(json!({"a":"A","nested":{"b":"B"}})),
        )
        .unwrap();
        write_dictionary(
            &config.translation_path("ru"),
            &dictionary(json!({"a":"А"})),
        )
        .unwrap();

        let plan = sync(&config, false).unwrap();
        assert!(plan.has_drift);
        assert!(
            !read_dictionary(&config.translation_path("ru"))
                .unwrap()
                .contains_key("nested")
        );

        sync(&config, true).unwrap();
        let russian = read_dictionary(&config.translation_path("ru")).unwrap();
        assert_eq!(russian["a"], "А");
        assert_eq!(russian["nested"]["b"], "");
        assert!(config.translation_path("de").is_file());
    }

    #[test]
    fn dictionary_io_sorts_nested_objects_and_reports_non_objects() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("nested/locale.json");
        write_dictionary(&path, &dictionary(json!({"z":{"b":"B","a":"A"},"a":"A"}))).unwrap();
        let source = fs::read_to_string(&path).unwrap();
        assert!(source.find("\"a\"").unwrap() < source.find("\"z\"").unwrap());
        assert!(source.ends_with('\n'));

        fs::write(&path, "[]").unwrap();
        let error = read_dictionary(&path).unwrap_err();
        assert!(error.to_string().contains("JSON object"));
    }
}
