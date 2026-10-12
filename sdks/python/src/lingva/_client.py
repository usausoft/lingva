from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Mapping

from lingva._delivery import (
    LingvaDeliveryTarget,
    load_bundle_from_file,
    load_bundle_from_url_async,
    load_bundle_from_url_sync,
)

_SCHEMA_VERSION = 1
_PLACEHOLDER_RE = re.compile(r"\{(\w+)\}")
_VARIANT_ID_FIELD = "id"
_VARIANT_TEXT_FIELD = "text"


def _interpolate(template: str, variables: dict[str, str]) -> str:
    """Replace {varname} tokens; unknown tokens pass through unchanged."""
    def replace(m: re.Match[str]) -> str:
        return variables.get(m.group(1), m.group(0))
    return _PLACEHOLDER_RE.sub(replace, template)


class LingvaSchemaError(ValueError):
    """Raised when a bundle fails schema validation."""


class LingvaClient:
    """
    Reads a Lingva locale bundle and provides key lookup with fallback and
    variable interpolation.
    """

    def __init__(
        self,
        bundle: dict[str, Any],
        fallback_bundle: dict[str, Any] | None = None,
    ) -> None:
        if bundle.get("schemaVersion") != _SCHEMA_VERSION:
            raise LingvaSchemaError(
                f"Unsupported bundle schemaVersion: {bundle.get('schemaVersion')!r}"
            )
        self._bundle = bundle
        self._messages: dict[str, str] = bundle.get("messages") or {}
        self._variants: dict[str, list[dict[str, str]]] = bundle.get("variants") or {}
        self._fallback_messages: dict[str, str] = (
            fallback_bundle.get("messages") or {} if fallback_bundle else {}
        )
        self._fallback_variants: dict[str, list[dict[str, str]]] = (
            fallback_bundle.get("variants") or {} if fallback_bundle else {}
        )
        self._fallback_keys: set[str] = set(bundle.get("fallbackKeys") or [])
        self._locale: str = bundle.get("locale") or bundle.get("defaultLocale") or "en"
        self._fallback_locale: str | None = bundle.get("fallbackLocale")
        self._last_valid: dict[str, Any] = bundle

    # ------------------------------------------------------------------
    # Factory methods
    # ------------------------------------------------------------------

    @classmethod
    def from_bundle(cls, bundle: dict[str, Any]) -> "LingvaClient":
        """Create a client from an already-parsed bundle dict."""
        return cls(bundle)

    @classmethod
    def from_file(cls, path: str | Path, *, fallback_path: str | Path | None = None) -> "LingvaClient":
        """Load a bundle from the local filesystem."""
        bundle = load_bundle_from_file(path)
        fallback = load_bundle_from_file(fallback_path) if fallback_path else None
        return cls(bundle, fallback)

    @classmethod
    def from_config(
        cls,
        locale: str,
        *,
        config_file: str | Path = "lingva.config.yaml",
    ) -> "LingvaClient":
        """Build a runtime client from the local translation files in a Lingva config."""
        # Imports stay local so the bundle-only runtime remains lightweight for
        # consumers that never use repository-managed translation files.
        from lingva._config import load_cli_config
        from lingva._local import build_bundle, read_dictionary

        config = load_cli_config(config_file)
        if locale not in config.locales:
            raise ValueError(
                f'Lingva locale "{locale}" is not configured in "{config.path}".'
            )
        resources = {
            configured_locale: read_dictionary(config.translation_path(configured_locale))
            for configured_locale in config.locales
        }
        return cls(build_bundle(config, locale, resources))

    @classmethod
    def from_url_sync(
        cls,
        target: LingvaDeliveryTarget,
        locale: str,
        *,
        fallback_locale: str | None = None,
        last_valid: dict[str, Any] | None = None,
    ) -> "LingvaClient":
        """Fetch a bundle synchronously; return a client over `last_valid` on error."""
        try:
            bundle = load_bundle_from_url_sync(target.resolve(locale), api_key=target.api_key)
        except Exception:
            if last_valid is not None:
                return cls(last_valid)
            raise
        fallback = None
        if fallback_locale and fallback_locale != locale:
            try:
                fallback = load_bundle_from_url_sync(
                    target.resolve(fallback_locale), api_key=target.api_key
                )
            except Exception:
                pass
        return cls(bundle, fallback)

    @classmethod
    async def from_url(
        cls,
        target: LingvaDeliveryTarget,
        locale: str,
        *,
        fallback_locale: str | None = None,
        last_valid: dict[str, Any] | None = None,
    ) -> "LingvaClient":
        """Fetch a bundle asynchronously; return a client over `last_valid` on error."""
        try:
            bundle = await load_bundle_from_url_async(
                target.resolve(locale), api_key=target.api_key
            )
        except Exception:
            if last_valid is not None:
                return cls(last_valid)
            raise
        fallback = None
        if fallback_locale and fallback_locale != locale:
            try:
                fallback = await load_bundle_from_url_async(
                    target.resolve(fallback_locale), api_key=target.api_key
                )
            except Exception:
                pass
        return cls(bundle, fallback)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def locale(self) -> str:
        return self._locale

    @property
    def fallback_locale(self) -> str | None:
        return self._fallback_locale

    def has(self, key: str) -> bool:
        """Return True if the key exists in the primary or fallback messages."""
        return key in self._messages or key in self._fallback_messages

    def t(
        self,
        key: str,
        *,
        variant: str | Mapping[str, str] | None = None,
        **variables: str,
    ) -> str:
        """
        Translate `key` with optional variable substitution.

        Falls back to `fallback_bundle` when the key is missing from the
        primary bundle or is listed in `fallbackKeys`.
        """
        use_fallback = key in self._fallback_keys or key not in self._messages
        if use_fallback:
            template = self._fallback_messages.get(key) or self._messages.get(key)
            variants = self._fallback_variants.get(key) or self._variants.get(key)
        else:
            template = self._messages.get(key)
            variants = self._variants.get(key)

        if template is None:
            return key

        if variants:
            selected = next(
                (
                    item
                    for item in variants
                    if (
                        item.get(_VARIANT_ID_FIELD) == variant
                        if isinstance(variant, str)
                        else all(item.get(field) == value for field, value in variant.items())
                        if variant
                        else True
                    )
                ),
                variants[0],
            )
            template = selected.get(_VARIANT_TEXT_FIELD, template)

        return _interpolate(template, variables) if variables else template

    def bundle(self) -> dict[str, Any]:
        """Return the raw bundle dict (useful for last-valid caching)."""
        return self._bundle
