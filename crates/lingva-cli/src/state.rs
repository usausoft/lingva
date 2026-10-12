//! Conflict-detection state for hosted pull and push.
//!
//! The file stores the last common remote value per locale. It is cache-like:
//! corrupt, stale-schema, or wrong-project state is ignored safely.

use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::PathBuf,
};

use anyhow::{Result, bail};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    config::Config,
    local::{Dictionary, flatten, set_dotted, sort_object},
};

const STATE_FILE: &str = ".lingva/remote-state.json";
const STATE_SCHEMA_VERSION: u8 = 1;

/// Last downloaded revision and dictionary for one locale.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct LocaleState {
    pub revision: String,
    pub base: Dictionary,
}

/// Schema-versioned three-way-merge base for one project environment.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteState {
    pub schema_version: u8,
    pub project_id: String,
    pub environment: String,
    pub locales: BTreeMap<String, LocaleState>,
}

impl RemoteState {
    pub fn write_plan(&self, config: &Config) -> Result<(PathBuf, Vec<u8>)> {
        Ok((
            path(config),
            format!("{}\n", serde_json::to_string_pretty(self)?).into_bytes(),
        ))
    }
    /// Create state bound to the config's project and environment.
    pub fn empty(config: &Config) -> Self {
        Self {
            schema_version: STATE_SCHEMA_VERSION,
            project_id: config.project_id.clone(),
            environment: config.environment.clone(),
            locales: BTreeMap::new(),
        }
    }

    /// Load compatible state or return a clean state when it is unusable.
    pub fn load(config: &Config) -> Self {
        let parsed = fs::read_to_string(path(config))
            .ok()
            .and_then(|source| serde_json::from_str::<Self>(&source).ok());
        parsed
            .filter(|state| {
                state.schema_version == STATE_SCHEMA_VERSION
                    && state.project_id == config.project_id
                    && state.environment == config.environment
            })
            .unwrap_or_else(|| Self::empty(config))
    }

    /// Persist state beside the portable config.
    pub fn save(&self, config: &Config) -> Result<()> {
        let path = path(config);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        crate::atomic_file::write(
            &path,
            format!("{}\n", serde_json::to_string_pretty(self)?),
            true,
        )?;
        Ok(())
    }

    /// Record the common remote base after a successful pull or push.
    pub fn set_locale(&mut self, locale: &str, revision: &str, base: &Dictionary) {
        self.locales.insert(
            locale.to_owned(),
            LocaleState {
                revision: revision.to_owned(),
                base: sort_object(base),
            },
        );
    }

    /// Resolve the single optimistic revision shared by pushed locales.
    ///
    /// A force push intentionally omits the guard. Different known revisions
    /// are rejected because one request cannot safely represent both bases.
    pub fn base_revision(&self, locales: &[String], force: bool) -> Result<Option<String>> {
        if force {
            return Ok(None);
        }
        let revisions = locales
            .iter()
            .filter_map(|locale| self.locales.get(locale).map(|state| state.revision.clone()))
            .collect::<BTreeSet<_>>();
        if revisions.len() > 1 {
            bail!(
                "Lingva push found locales from different remote revisions. Pull them together before pushing."
            );
        }
        Ok(revisions.into_iter().next())
    }
}

fn path(config: &Config) -> PathBuf {
    config
        .path
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .join(STATE_FILE)
}

/// Three-way merge one locale without mutating any caller-owned dictionary.
///
/// A value is safe when both sides agree, or when only one side changed from
/// the last common base. Concurrent changes to the same dotted key conflict.
pub fn merge_remote(
    locale: &str,
    base: &Dictionary,
    local: &Dictionary,
    remote: &Dictionary,
) -> Result<Dictionary> {
    let base = flatten(base)?;
    let local = flatten(local)?;
    let remote = flatten(remote)?;
    let keys = base
        .keys()
        .chain(local.keys())
        .chain(remote.keys())
        .cloned()
        .collect::<BTreeSet<_>>();
    let mut merged = Dictionary::new();
    let mut conflicts = Vec::new();
    for key in keys {
        let base_value = base.get(&key);
        let local_value = local.get(&key);
        let remote_value = remote.get(&key);
        let selected: Option<&Value> = if local_value == remote_value {
            local_value
        } else if local_value == base_value {
            remote_value
        } else if remote_value == base_value {
            local_value
        } else {
            conflicts.push(key.clone());
            None
        };
        if let Some(value) = selected {
            set_dotted(&mut merged, &key, value.clone())?;
        }
    }
    if !conflicts.is_empty() {
        bail!(
            "Lingva pull found conflicts in locale \"{locale}\": {}. Resolve local or hosted values, then pull again.",
            conflicts.join(", ")
        );
    }
    Ok(sort_object(&merged))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn dictionary(value: Value) -> Dictionary {
        serde_json::from_value(value).unwrap()
    }

    fn test_config(root: &std::path::Path, project_id: &str, environment: &str) -> Config {
        Config {
            path: root.join("lingva.config.yaml"),
            project_id: project_id.into(),
            environment: environment.into(),
            locales: vec!["en".into(), "ru".into()],
            default_locale: "en".into(),
            fallback_locale: "en".into(),
            translation_files: ".lingva/translations/{locale}.json".into(),
            api_url: None,
            api_key: None,
            settings: Default::default(),
        }
    }

    #[test]
    fn three_way_merge_keeps_independent_changes() {
        let merged = merge_remote(
            "ru",
            &dictionary(json!({"a":"1","b":"1"})),
            &dictionary(json!({"a":"2","b":"1"})),
            &dictionary(json!({"a":"1","b":"2"})),
        )
        .unwrap();
        assert_eq!(merged, dictionary(json!({"a":"2","b":"2"})));
    }

    #[test]
    fn three_way_merge_rejects_same_key_conflict() {
        let error = merge_remote(
            "ru",
            &dictionary(json!({"a":"1"})),
            &dictionary(json!({"a":"2"})),
            &dictionary(json!({"a":"3"})),
        )
        .unwrap_err();
        assert!(error.to_string().contains("conflicts"));
    }

    #[test]
    fn three_way_merge_handles_additions_and_deletions() {
        let merged = merge_remote(
            "en",
            &dictionary(json!({"keep":"old","deleteLocal":"old","deleteRemote":"old"})),
            &dictionary(json!({"keep":"local","deleteRemote":"old","localOnly":"local"})),
            &dictionary(json!({"keep":"old","deleteLocal":"old","remoteOnly":"remote"})),
        )
        .unwrap();
        assert_eq!(
            merged,
            dictionary(json!({"keep":"local","localOnly":"local","remoteOnly":"remote"}))
        );
    }

    #[test]
    fn three_way_merge_reports_every_conflicting_key_in_stable_order() {
        let error = merge_remote(
            "en",
            &dictionary(json!({"z":"base","a":"base"})),
            &dictionary(json!({"z":"local","a":"local"})),
            &dictionary(json!({"z":"remote","a":"remote"})),
        )
        .unwrap_err()
        .to_string();
        assert!(error.contains("locale \"en\""));
        assert!(error.contains("a, z"));
    }

    #[test]
    fn state_round_trips_and_rejects_wrong_identity_or_schema() {
        let root = tempfile::tempdir().unwrap();
        let config = test_config(root.path(), "demo", "dev");
        let mut state = RemoteState::empty(&config);
        state.set_locale("en", "revision-1", &dictionary(json!({"b":"B","a":"A"})));
        state.save(&config).unwrap();
        let loaded = RemoteState::load(&config);
        assert_eq!(loaded.locales["en"].revision, "revision-1");
        assert_eq!(
            loaded.locales["en"].base.keys().collect::<Vec<_>>(),
            ["a", "b"]
        );

        assert!(
            RemoteState::load(&test_config(root.path(), "other", "dev"))
                .locales
                .is_empty()
        );
        let state_path = root.path().join(STATE_FILE);
        let mut invalid_schema: Value =
            serde_json::from_str(&fs::read_to_string(&state_path).unwrap()).unwrap();
        invalid_schema["schemaVersion"] = json!(99);
        fs::write(state_path, serde_json::to_string(&invalid_schema).unwrap()).unwrap();
        assert!(RemoteState::load(&config).locales.is_empty());
    }

    #[test]
    fn state_ignores_corruption_and_revision_guard_is_explicit() {
        let root = tempfile::tempdir().unwrap();
        let config = test_config(root.path(), "demo", "dev");
        let state_path = root.path().join(STATE_FILE);
        fs::create_dir_all(state_path.parent().unwrap()).unwrap();
        fs::write(&state_path, "not-json").unwrap();
        assert!(RemoteState::load(&config).locales.is_empty());

        let mut state = RemoteState::empty(&config);
        state.set_locale("en", "one", &Dictionary::new());
        assert_eq!(
            state.base_revision(&["en".into()], false).unwrap(),
            Some("one".into())
        );
        state.set_locale("ru", "two", &Dictionary::new());
        assert!(
            state
                .base_revision(&["en".into(), "ru".into()], false)
                .is_err()
        );
        assert_eq!(
            state
                .base_revision(&["en".into(), "ru".into()], true)
                .unwrap(),
            None
        );
    }
}
