from __future__ import annotations

import copy
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from lingva._config import LingvaCliConfig

VARIANT_CONTRACT_FIELDS = ("tone", "mood", "intonation", "label", "context")
INTERPOLATION_PATTERN = re.compile(r"\{(\w+)\}")
TRANSLATION_KEY_MAX_LENGTH = 200
TRANSLATION_KEY_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")

Dictionary = dict[str, Any]


def validate_translation_key(key: str) -> None:
    """Enforce the portable key contract shared by every Lingva SDK."""

    if not key:
        raise ValueError("Lingva translation key is required.")
    if len(key) > TRANSLATION_KEY_MAX_LENGTH:
        raise ValueError(
            f"Lingva translation key must be at most {TRANSLATION_KEY_MAX_LENGTH} characters."
        )
    if key.endswith("."):
        raise ValueError("Lingva translation key must not end with a dot.")
    if ".." in key:
        raise ValueError("Lingva translation key must not contain consecutive dots.")
    if not TRANSLATION_KEY_PATTERN.fullmatch(key):
        raise ValueError(
            "Lingva translation key may only use letters, digits, dots, underscores, "
            "and hyphens, and must start with a letter or digit."
        )


def validate_dictionary_keys(dictionary: Dictionary) -> None:
    for key in flatten_dictionary(dictionary):
        validate_translation_key(key)


@dataclass
class DictionaryDrift:
    missingKeys: int = 0
    missingVariants: int = 0
    extraVariants: int = 0
    variantMetadataMismatches: int = 0

    @property
    def has_drift(self) -> bool:
        return any(asdict(self).values())

    def add(self, other: "DictionaryDrift") -> None:
        for field in asdict(self):
            setattr(self, field, getattr(self, field) + getattr(other, field))


def is_variant(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and isinstance(value.get("id"), str)
        and bool(value["id"].strip())
        and isinstance(value.get("text"), str)
    )


def is_variants(value: Any) -> bool:
    return isinstance(value, list) and bool(value) and all(is_variant(item) for item in value)


def read_dictionary(path: Path) -> Dictionary:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    if not isinstance(payload, dict):
        raise ValueError(f'Lingva translation file "{path}" must contain a JSON object.')
    return payload


def sort_dictionary(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: sort_dictionary(value[key]) for key in sorted(value)}
    if isinstance(value, list):
        return [sort_dictionary(item) for item in value]
    return value


def write_dictionary(path: Path, dictionary: Dictionary) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(sort_dictionary(dictionary), indent=2) + "\n", encoding="utf-8")


def _blank_value(source: Any) -> Any:
    if isinstance(source, str):
        return ""
    if is_variants(source):
        return [{**variant, "text": ""} for variant in source]
    if isinstance(source, dict):
        return {key: _blank_value(value) for key, value in source.items()}
    return copy.deepcopy(source)


def merge_missing_from_source(source: Dictionary, target: Dictionary) -> Dictionary:
    """Match Node sync: add blank keys and align variant contracts without overwrites."""

    output = copy.deepcopy(target)
    for key, source_value in source.items():
        if key not in output:
            output[key] = _blank_value(source_value)
            continue

        target_value = output[key]
        if is_variants(source_value):
            target_by_id = (
                {variant["id"]: variant for variant in target_value}
                if is_variants(target_value)
                else {}
            )
            output[key] = [
                {**variant, **target_by_id.get(variant["id"], {"text": ""})}
                for variant in source_value
            ]
            continue

        if isinstance(source_value, dict) and isinstance(target_value, dict):
            output[key] = merge_missing_from_source(source_value, target_value)

    return sort_dictionary(output)


def analyze_drift(source: Dictionary, target: Dictionary) -> DictionaryDrift:
    drift = DictionaryDrift()
    for key, source_value in source.items():
        if key not in target:
            drift.missingKeys += 1
            continue

        target_value = target[key]
        if is_variants(source_value):
            if not is_variants(target_value):
                drift.missingVariants += len(source_value)
                continue
            source_by_id = {variant["id"]: variant for variant in source_value}
            target_by_id = {variant["id"]: variant for variant in target_value}
            for variant_id, source_variant in source_by_id.items():
                target_variant = target_by_id.get(variant_id)
                if target_variant is None:
                    drift.missingVariants += 1
                    continue
                drift.variantMetadataMismatches += sum(
                    _normalized_variant_field(source_variant, field)
                    != _normalized_variant_field(target_variant, field)
                    for field in VARIANT_CONTRACT_FIELDS
                )
            drift.extraVariants += len(target_by_id.keys() - source_by_id.keys())
            continue

        if isinstance(source_value, dict) and isinstance(target_value, dict):
            drift.add(analyze_drift(source_value, target_value))
    return drift


def _normalized_variant_field(variant: dict[str, Any], field: str) -> str | None:
    value = variant.get(field)
    return value.strip() if isinstance(value, str) and value.strip() else None


def flatten_dictionary(dictionary: Dictionary, prefix: str = "") -> Dictionary:
    output: Dictionary = {}
    for key, value in dictionary.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, str) or is_variants(value):
            output[path] = value
        elif isinstance(value, dict):
            output.update(flatten_dictionary(value, path))
    return output


def set_dictionary_value(dictionary: Dictionary, dotted_key: str, value: Any) -> None:
    validate_translation_key(dotted_key)
    if dotted_key in dictionary:
        dictionary[dotted_key] = value
        return
    segments = dotted_key.split(".")
    current = dictionary
    for segment in segments[:-1]:
        nested = current.get(segment)
        if not isinstance(nested, dict):
            nested = {}
            current[segment] = nested
        current = nested
    current[segments[-1]] = value


def sync_local_files(config: LingvaCliConfig, *, write: bool) -> dict[str, Any]:
    source = sort_dictionary(read_dictionary(config.translation_path(config.default_locale)))
    validate_dictionary_keys(source)
    files: list[dict[str, Any]] = []
    for locale in config.locales:
        path = config.translation_path(locale)
        current = sort_dictionary(read_dictionary(path))
        validate_dictionary_keys(current)
        drift = DictionaryDrift() if locale == config.default_locale else analyze_drift(source, current)
        updated = current if locale == config.default_locale else merge_missing_from_source(source, current)
        if write:
            write_dictionary(path, updated)
        files.append(
            {
                "locale": locale,
                "filePath": str(path),
                **asdict(drift),
                "written": write,
            }
        )
    return {
        "configFile": str(config.path),
        "defaultLocale": config.default_locale,
        "locales": list(config.locales),
        "hasDrift": any(
            any(file[field] for field in asdict(DictionaryDrift())) for file in files
        ),
        "files": files,
    }


def build_bundle(config: LingvaCliConfig, locale: str, resources: dict[str, Dictionary]) -> dict[str, Any]:
    flat_resources = {name: flatten_dictionary(dictionary) for name, dictionary in resources.items()}
    keys = sorted({key for dictionary in flat_resources.values() for key in dictionary})
    for key in keys:
        validate_translation_key(key)
    messages: dict[str, str] = {}
    variants: dict[str, Any] = {}
    sources: dict[str, str] = {}
    variables: dict[str, list[str]] = {}
    entries: list[dict[str, Any]] = []
    fallback_keys: list[str] = []

    for key in keys:
        candidates = (
            (locale, flat_resources.get(locale, {}).get(key)),
            (config.fallback_locale, flat_resources.get(config.fallback_locale, {}).get(key)),
            (config.default_locale, flat_resources.get(config.default_locale, {}).get(key)),
        )
        source_locale, value = next(
            ((name, message) for name, message in candidates if message is not None),
            (None, None),
        )
        if source_locale is None:
            continue
        text = value if isinstance(value, str) else value[0]["text"]
        tokens = sorted(
            {
                token
                for candidate_text in (
                    [value] if isinstance(value, str) else [variant["text"] for variant in value]
                )
                for token in INTERPOLATION_PATTERN.findall(candidate_text)
            }
        )
        is_fallback = source_locale != locale
        messages[key] = text
        sources[key] = source_locale
        variables[key] = tokens
        if is_fallback:
            fallback_keys.append(key)
        if is_variants(value):
            variants[key] = value
        entry = {
            "key": key,
            "value": text,
            "sourceLocale": source_locale,
            "fallback": is_fallback,
            "variables": tokens,
        }
        if "." in key:
            entry["namespace"] = key.split(".", 1)[0]
        if is_variants(value):
            entry["variants"] = value
        entries.append(entry)

    bundle = {
        "schemaVersion": 1,
        "projectId": config.project_id,
        "environment": config.environment,
        "locale": locale,
        "defaultLocale": config.default_locale,
        "fallbackLocale": config.fallback_locale,
        "keyCount": len(entries),
        "fallbackKeys": fallback_keys,
        "messages": messages,
        "sources": sources,
        "variables": variables,
        "entries": entries,
    }
    if variants:
        bundle["variants"] = variants
    return bundle
