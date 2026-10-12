from __future__ import annotations

import json
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

DEFAULT_REMOTE_BUNDLE_PATH_TEMPLATE = "/bundles/{projectId}/{environment}/latest/{locale}.bundle.json"
API_KEY_HEADER = "x-api-key"

_PLACEHOLDERS = {"projectId", "environment", "locale"}


@dataclass(frozen=True)
class LingvaDeliveryTarget:
    """Resolves a Lingva CDN delivery URL for a given locale."""
    base_url: str
    uri_template: str = DEFAULT_REMOTE_BUNDLE_PATH_TEMPLATE
    project_id: str = ""
    environment: str = "production"
    api_key: str | None = field(default=None, repr=False)

    def resolve(self, locale: str) -> str:
        path = (
            self.uri_template
            .replace("{projectId}", self.project_id)
            .replace("{environment}", self.environment)
            .replace("{locale}", locale)
        )
        return self.base_url.rstrip("/") + path


def load_bundle_from_file(path: str | Path) -> dict[str, Any]:
    """Read and parse a locale bundle JSON file."""
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_bundle_from_url_sync(url: str, *, api_key: str | None = None) -> dict[str, Any]:
    """Fetch a locale bundle over HTTP (synchronous, no extra deps)."""
    headers = {API_KEY_HEADER: api_key} if api_key else {}
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request) as resp:  # noqa: S310
        return json.loads(resp.read().decode("utf-8"))


async def load_bundle_from_url_async(url: str, *, api_key: str | None = None) -> dict[str, Any]:
    """Fetch a locale bundle over HTTP using httpx (async)."""
    try:
        import httpx
    except ImportError as exc:
        raise ImportError(
            "Install 'lingva-sdk[http]' (httpx) for async HTTP delivery."
        ) from exc
    async with httpx.AsyncClient() as client:
        headers = {API_KEY_HEADER: api_key} if api_key else None
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
