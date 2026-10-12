from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

DEFAULT_CONFIG_FILE = "lingva.config.yaml"
DEFAULT_ENVIRONMENT = "dev"
DEFAULT_TRANSLATION_FILES = ".lingva/translations/{locale}.json"
DEFAULT_API_KEY_ENV = "LINGVA_API_KEY"
PUBLISH_TOKEN_ENV = "LINGVA_PUBLISH_API_TOKEN"


class LingvaConfigError(ValueError):
    """Raised when the portable Lingva config is missing or invalid."""


@dataclass(frozen=True)
class LingvaCliConfig:
    """Language-neutral subset of the Lingva runtime config used by every CLI."""

    path: Path
    project_id: str
    environment: str
    locales: tuple[str, ...]
    default_locale: str
    fallback_locale: str
    translation_files: str
    api_url: str | None
    api_key: str | None

    def translation_path(self, locale: str) -> Path:
        relative_path = self.translation_files.replace("{locale}", locale)
        candidate = Path(relative_path)
        return candidate if candidate.is_absolute() else self.path.parent / candidate


def _required_string(payload: dict[str, Any], field: str) -> str:
    value = payload.get(field)
    if not isinstance(value, str) or not value.strip():
        raise LingvaConfigError(f'Lingva config requires a non-empty "{field}" string.')
    return value.strip()


def _optional_string(payload: dict[str, Any], field: str) -> str | None:
    value = payload.get(field)
    return value.strip() if isinstance(value, str) and value.strip() else None


def load_cli_config(config_file: str | Path = DEFAULT_CONFIG_FILE) -> LingvaCliConfig:
    """Load the portable YAML contract shared with the JavaScript CLI."""

    path = Path(config_file).resolve()
    try:
        source = path.read_text(encoding="utf-8")
        payload = json.loads(source) if path.suffix == ".json" else yaml.safe_load(source)
    except FileNotFoundError as exc:
        raise LingvaConfigError(f'Lingva config "{path}" does not exist.') from exc
    except (json.JSONDecodeError, yaml.YAMLError) as exc:
        raise LingvaConfigError(f'Lingva config "{path}" is not valid YAML or JSON: {exc}.') from exc

    if not isinstance(payload, dict):
        raise LingvaConfigError("Lingva config must be a mapping object.")

    raw_locales = payload.get("locales")
    if not isinstance(raw_locales, list) or not all(
        isinstance(locale, str) and locale.strip() for locale in raw_locales
    ):
        raise LingvaConfigError('Lingva config requires a non-empty "locales" string array.')

    locales = tuple(dict.fromkeys(locale.strip() for locale in raw_locales))
    if not locales:
        raise LingvaConfigError('Lingva config requires at least one locale in "locales".')

    default_locale = _optional_string(payload, "defaultLocale") or locales[0]
    fallback_locale = _optional_string(payload, "fallbackLocale") or default_locale
    if default_locale not in locales:
        raise LingvaConfigError('Lingva "defaultLocale" must be included in "locales".')
    if fallback_locale not in locales:
        raise LingvaConfigError('Lingva "fallbackLocale" must be included in "locales".')

    api_key_env = _optional_string(payload, "apiKeyEnv") or DEFAULT_API_KEY_ENV
    api_key = os.environ.get(api_key_env) or _optional_string(payload, "apiKey")

    return LingvaCliConfig(
        path=path,
        project_id=_required_string(payload, "projectId"),
        environment=_optional_string(payload, "environment") or DEFAULT_ENVIRONMENT,
        locales=locales,
        default_locale=default_locale,
        fallback_locale=fallback_locale,
        translation_files=_optional_string(payload, "translationFiles")
        or DEFAULT_TRANSLATION_FILES,
        api_url=_optional_string(payload, "apiUrl"),
        api_key=api_key,
    )


def resolve_auth_token(config: LingvaCliConfig, explicit_token: str | None = None) -> str | None:
    """Use the same explicit-token, publish-token, API-key precedence in automation."""
    from lingva._auth import credential_token

    return explicit_token or os.environ.get(PUBLISH_TOKEN_ENV) or config.api_key or credential_token()
