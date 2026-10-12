from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

from lingva._config import LingvaCliConfig
from lingva._local import Dictionary, flatten_dictionary, set_dictionary_value, sort_dictionary

REMOTE_STATE_FILE = ".lingva/remote-state.json"
REMOTE_STATE_SCHEMA_VERSION = 1
_MISSING = object()


class LingvaMergeConflictError(RuntimeError):
    """Raised when local and hosted translations changed from the same base."""

    def __init__(self, locale: str, keys: list[str]) -> None:
        self.locale = locale
        self.keys = keys
        super().__init__(
            f'Lingva pull found conflicts in locale "{locale}": {", ".join(keys)}. '
            "Resolve local or hosted values, then pull again."
        )


def remote_state_path(config: LingvaCliConfig) -> Path:
    return config.path.parent / REMOTE_STATE_FILE


def load_remote_state(config: LingvaCliConfig) -> dict[str, Any]:
    path = remote_state_path(config)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        payload = {}
    if (
        not isinstance(payload, dict)
        or payload.get("schemaVersion") != REMOTE_STATE_SCHEMA_VERSION
        or payload.get("projectId") != config.project_id
        or payload.get("environment") != config.environment
    ):
        return {
            "schemaVersion": REMOTE_STATE_SCHEMA_VERSION,
            "projectId": config.project_id,
            "environment": config.environment,
            "locales": {},
        }
    return payload


def set_remote_locale(
    state: dict[str, Any],
    locale: str,
    revision: str,
    base: Dictionary,
) -> None:
    locales = state.setdefault("locales", {})
    locales[locale] = {"revision": revision, "base": sort_dictionary(base)}


def save_remote_state(config: LingvaCliConfig, state: dict[str, Any]) -> None:
    path = remote_state_path(config)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def get_push_base_revision(
    config: LingvaCliConfig,
    locales: tuple[str, ...],
    *,
    force: bool,
) -> str | None:
    if force:
        return None
    state = load_remote_state(config)
    locale_states = state.get("locales") if isinstance(state.get("locales"), dict) else {}
    revisions = {
        locale_states.get(locale, {}).get("revision")
        for locale in locales
        if isinstance(locale_states.get(locale), dict)
    }
    revisions.discard(None)
    if len(revisions) > 1:
        raise LingvaMergeConflictError(
            ",".join(locales),
            ["locales were pulled from different remote revisions; pull them together before pushing"],
        )
    return next(iter(revisions)) if revisions else None


def merge_remote_dictionary(
    locale: str,
    base: Dictionary,
    local: Dictionary,
    remote: Dictionary,
) -> Dictionary:
    base_flat = flatten_dictionary(base)
    local_flat = flatten_dictionary(local)
    remote_flat = flatten_dictionary(remote)
    merged: Dictionary = {}
    conflicts: list[str] = []

    for key in sorted(set(base_flat) | set(local_flat) | set(remote_flat)):
        base_value = base_flat.get(key, _MISSING)
        local_value = local_flat.get(key, _MISSING)
        remote_value = remote_flat.get(key, _MISSING)
        if local_value == remote_value:
            selected = local_value
        elif local_value == base_value:
            selected = remote_value
        elif remote_value == base_value:
            selected = local_value
        else:
            conflicts.append(key)
            continue
        if selected is not _MISSING:
            set_dictionary_value(merged, key, copy.deepcopy(selected))

    if conflicts:
        raise LingvaMergeConflictError(locale, conflicts)
    return sort_dictionary(merged)
