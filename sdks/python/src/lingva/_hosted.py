from __future__ import annotations

import json
import hashlib
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from lingva._config import LingvaCliConfig
from lingva._delivery import DEFAULT_REMOTE_BUNDLE_PATH_TEMPLATE
from lingva._local import Dictionary, build_bundle, read_dictionary

HTTP_GET = "GET"
HTTP_POST = "POST"
AUTHORIZATION_HEADER = "Authorization"
API_KEY_HEADER = "x-api-key"
JSON_CONTENT_TYPE = "application/json"
PUBLISH_ACTION = "publish"
REVISION_HEADER = "x-lingva-revision"


class LingvaHostedError(RuntimeError):
    """Raised when hosted pull or push fails."""


def _request_json(
    url: str,
    *,
    method: str,
    token: str | None,
    payload: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], dict[str, str]]:
    headers = {"Accept": JSON_CONTENT_TYPE}
    if token:
        headers[AUTHORIZATION_HEADER] = f"Bearer {token}"
        headers[API_KEY_HEADER] = token
    body = None
    if payload is not None:
        headers["Content-Type"] = JSON_CONTENT_TYPE
        body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as response:  # noqa: S310
            result = json.loads(response.read().decode("utf-8"))
            response_headers = {key.lower(): value for key, value in response.headers.items()}
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8").strip()
        raise LingvaHostedError(
            f"Lingva hosted request failed with HTTP {exc.code}{f': {details}' if details else '.'}"
        ) from exc
    if not isinstance(result, dict):
        raise LingvaHostedError("Lingva hosted response must be a JSON object.")
    return result, response_headers


def pull_bundle(config: LingvaCliConfig, locale: str, token: str | None) -> tuple[dict[str, Any], str]:
    if not config.api_url:
        raise LingvaHostedError('Lingva pull requires "apiUrl" in lingva.config.yaml.')
    path = DEFAULT_REMOTE_BUNDLE_PATH_TEMPLATE.format(
        projectId=config.project_id,
        environment=config.environment,
        locale=locale,
    )
    bundle, headers = _request_json(
        f"{config.api_url.rstrip('/')}{path}",
        method=HTTP_GET,
        token=token,
    )
    revision = headers.get(REVISION_HEADER)
    if not revision:
        raise LingvaHostedError("Lingva hosted pull response has no revision header.")
    return bundle, revision


def _mutation_id(manifest: dict[str, Any], bundles: dict[str, Any]) -> str:
    semantic_bundles = {
        locale: {key: value for key, value in bundle.items() if key != "generatedAt"}
        for locale, bundle in bundles.items()
    }
    semantic_manifest = {key: value for key, value in manifest.items() if key != "generatedAt"}
    canonical = json.dumps(
        {"manifest": semantic_manifest, "bundles": semantic_bundles},
        sort_keys=True,
        separators=(",", ":"),
    )
    return f"sha256:{hashlib.sha256(canonical.encode('utf-8')).hexdigest()}"


def push_translations(
    config: LingvaCliConfig,
    locales: tuple[str, ...],
    token: str | None,
    output_dir: Path | None = None,
    *,
    base_revision: str | None = None,
    force: bool = False,
) -> dict[str, Any]:
    if not config.api_url:
        raise LingvaHostedError('Lingva push requires "apiUrl" in lingva.config.yaml.')
    resources: dict[str, Dictionary] = {
        locale: read_dictionary(config.translation_path(locale)) for locale in config.locales
    }
    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    bundles = {
        locale: {**build_bundle(config, locale, resources), "generatedAt": generated_at}
        for locale in locales
    }
    manifest = {
        "projectId": config.project_id,
        "environment": config.environment,
        "defaultLocale": config.default_locale,
        "fallbackLocale": config.fallback_locale,
        "generatedAt": generated_at,
        "locales": list(locales),
        "bundles": [
            {
                "locale": locale,
                "fileName": f"{locale}.bundle.json",
                "keyCount": bundles[locale]["keyCount"],
                "fallbackKeyCount": len(bundles[locale]["fallbackKeys"]),
            }
            for locale in locales
        ],
    }
    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        (output_dir / "manifest.json").write_text(
            json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
        )
        for locale, bundle in bundles.items():
            (output_dir / f"{locale}.bundle.json").write_text(
                json.dumps(bundle, indent=2) + "\n", encoding="utf-8"
            )
    payload: dict[str, Any] = {
        "action": PUBLISH_ACTION,
        "manifest": manifest,
        "bundles": bundles,
        "mutationId": _mutation_id(manifest, bundles),
    }
    if not force:
        payload["baseRevision"] = base_revision
    result, _headers = _request_json(
        config.api_url,
        method=HTTP_POST,
        token=token,
        payload=payload,
    )
    return result
