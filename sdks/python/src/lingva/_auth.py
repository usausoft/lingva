from __future__ import annotations

import base64
import hashlib
import json
import secrets
import stat
import urllib.parse
import urllib.request
import urllib.error
import webbrowser
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any

DEFAULT_AUTH_PORT = 53682
DEFAULT_AUTH_SCOPES = "openid email profile"
DEFAULT_CREDENTIALS_FILE = Path.home() / ".lingva" / "credentials.json"
DEFAULT_PLATFORM_URL = "https://lingva.dev"


def _platform_request(path: str, *, platform_url: str, access_token: str | None = None) -> dict[str, Any]:
    headers = {"accept": "application/json"}
    if access_token:
        headers["authorization"] = f"Bearer {access_token}"
    request = urllib.request.Request(f"{platform_url.rstrip('/')}{path}", headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        payload = json.loads(exc.read().decode("utf-8"))
        raise ValueError(payload.get("error", "Lingva platform request failed.")) from exc
    if not isinstance(payload, dict):
        raise ValueError("Lingva platform returned an invalid response.")
    return payload


def discover_auth_config(platform_url: str = DEFAULT_PLATFORM_URL) -> dict[str, str]:
    payload = _platform_request("/api/cli/config", platform_url=platform_url)
    if not isinstance(payload.get("issuerUrl"), str) or not isinstance(payload.get("clientId"), str):
        raise ValueError("Lingva platform did not return CLI authentication metadata.")
    return {"issuerUrl": payload["issuerUrl"], "clientId": payload["clientId"]}


def list_platform_projects(access_token: str, platform_url: str = DEFAULT_PLATFORM_URL) -> list[dict[str, Any]]:
    payload = _platform_request("/api/cli/projects", platform_url=platform_url, access_token=access_token)
    projects = payload.get("projects")
    if not isinstance(projects, list):
        raise ValueError("Lingva platform did not return a project list.")
    return [project for project in projects if isinstance(project, dict)]


def load_credentials(path: Path = DEFAULT_CREDENTIALS_FILE) -> dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    if not isinstance(payload, dict):
        raise ValueError(f'Lingva credentials file "{path}" is invalid.')
    return payload


def save_credentials(payload: dict[str, Any], path: Path = DEFAULT_CREDENTIALS_FILE) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    path.chmod(stat.S_IRUSR | stat.S_IWUSR)
    return path


def clear_credentials(path: Path = DEFAULT_CREDENTIALS_FILE) -> None:
    path.unlink(missing_ok=True)


def credential_token(path: Path = DEFAULT_CREDENTIALS_FILE) -> str | None:
    credentials = load_credentials(path)
    if not credentials:
        return None
    access_token = credentials.get("accessToken")
    expires_at = credentials.get("expiresAt")
    if isinstance(access_token, str) and (
        not isinstance(expires_at, str)
        or datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        > datetime.now(timezone.utc) + timedelta(minutes=1)
    ):
        return access_token
    api_key = credentials.get("apiKey")
    return api_key if isinstance(api_key, str) and api_key else None


def store_api_key(
    api_key: str,
    *,
    api_url: str | None = None,
    project_id: str | None = None,
    path: Path = DEFAULT_CREDENTIALS_FILE,
) -> dict[str, Any]:
    value = api_key.strip()
    if not value:
        raise ValueError("Lingva auth use-key requires a non-empty --api-key value.")
    preview = f"{value[:8]}...{value[-4:]}" if len(value) > 12 else "stored-key"
    payload = {
        "apiKey": value,
        "apiKeyPreview": preview,
        "obtainedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        **({"apiUrl": api_url.strip()} if api_url and api_url.strip() else {}),
        **({"projectId": project_id.strip()} if project_id and project_id.strip() else {}),
    }
    save_credentials(payload, path)
    return payload


def auth_status(path: Path = DEFAULT_CREDENTIALS_FILE) -> dict[str, Any]:
    credentials = load_credentials(path)
    method = "api-key" if credentials and credentials.get("apiKey") else "oauth"
    return {
        "authenticated": credential_token(path) is not None,
        "authMethod": method if credentials else None,
        "credentialsFile": str(path),
        "apiKeyPreview": credentials.get("apiKeyPreview") if credentials else None,
        "projectId": credentials.get("projectId") if credentials else None,
        "expiresAt": credentials.get("expiresAt") if credentials else None,
    }


def _base64_url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _post_form(url: str, payload: dict[str, str]) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=urllib.parse.urlencode(payload).encode("utf-8"),
        headers={"content-type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.loads(response.read().decode("utf-8"))
    if not isinstance(result, dict):
        raise ValueError("Lingva authentication server returned an invalid response.")
    return result


def login(
    *,
    authorize_url: str,
    token_url: str,
    client_id: str,
    scopes: str = DEFAULT_AUTH_SCOPES,
    port: int = DEFAULT_AUTH_PORT,
    open_browser: bool = True,
    path: Path = DEFAULT_CREDENTIALS_FILE,
) -> dict[str, Any]:
    verifier = _base64_url(secrets.token_bytes(48))
    challenge = _base64_url(hashlib.sha256(verifier.encode("ascii")).digest())
    expected_state = _base64_url(secrets.token_bytes(24))
    result: dict[str, str] = {}

    class CallbackHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            result["code"] = query.get("code", [""])[0]
            result["state"] = query.get("state", [""])[0]
            self.send_response(200)
            self.send_header("content-type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"<h1>Lingva CLI is authenticated</h1><p>You can close this tab.</p>")

        def log_message(self, _format: str, *args: object) -> None:
            return

    server = HTTPServer(("127.0.0.1", port), CallbackHandler)
    redirect_uri = f"http://127.0.0.1:{server.server_port}/callback"
    query = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": scopes,
            "state": expected_state,
        }
    )
    login_url = f"{authorize_url}?{query}"
    print(f"Open this URL to authenticate Lingva CLI:\n{login_url}\n")
    if open_browser:
        webbrowser.open(login_url)
    server.timeout = 300
    server.handle_request()
    server.server_close()
    if result.get("state") != expected_state or not result.get("code"):
        raise ValueError("Lingva authentication callback was invalid or timed out.")

    tokens = _post_form(
        token_url,
        {
            "client_id": client_id,
            "code": result["code"],
            "code_verifier": verifier,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        },
    )
    obtained_at = datetime.now(timezone.utc)
    expires_in = tokens.get("expires_in")
    credentials = {
        "accessToken": tokens.get("access_token"),
        "refreshToken": tokens.get("refresh_token"),
        "idToken": tokens.get("id_token"),
        "tokenType": tokens.get("token_type", "Bearer"),
        "scope": tokens.get("scope", scopes),
        "clientId": client_id,
        "tokenUrl": token_url,
        "obtainedAt": obtained_at.isoformat().replace("+00:00", "Z"),
        **(
            {"expiresAt": (obtained_at + timedelta(seconds=int(expires_in))).isoformat().replace("+00:00", "Z")}
            if isinstance(expires_in, (int, float))
            else {}
        ),
    }
    if not credentials["accessToken"]:
        raise ValueError("Lingva authentication server did not return an access token.")
    save_credentials(credentials, path)
    return credentials
