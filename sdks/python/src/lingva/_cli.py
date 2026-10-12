from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from dataclasses import replace
from pathlib import Path
from typing import Any, Sequence

import yaml

from lingva import __version__
from lingva._auth import (
    DEFAULT_AUTH_PORT,
    DEFAULT_AUTH_SCOPES,
    DEFAULT_PLATFORM_URL,
    auth_status,
    clear_credentials,
    discover_auth_config,
    list_platform_projects,
    load_credentials,
    save_credentials,
    login,
    store_api_key,
)

from lingva._config import (
    DEFAULT_API_KEY_ENV,
    DEFAULT_CONFIG_FILE,
    DEFAULT_ENVIRONMENT,
    DEFAULT_TRANSLATION_FILES,
    LingvaConfigError,
    load_cli_config,
    resolve_auth_token,
)
from lingva._hosted import LingvaHostedError, pull_bundle, push_translations
from lingva._local import read_dictionary, set_dictionary_value, sync_local_files, write_dictionary
from lingva._remote_state import (
    LingvaMergeConflictError,
    get_push_base_revision,
    load_remote_state,
    merge_remote_dictionary,
    save_remote_state,
    set_remote_locale,
)

COMMAND_INIT = "init"
COMMAND_SYNC = "sync"
COMMAND_CHECK = "check"
COMMAND_PULL = "pull"
COMMAND_PUSH = "push"
COMMAND_AUTH = "auth"
COMMAND_UPDATE = "update"
AUTH_LOGIN = "login"
AUTH_LOGOUT = "logout"
AUTH_STATUS = "status"
AUTH_USE_KEY = "use-key"
FORMAT_TEXT = "text"
FORMAT_JSON = "json"
EXIT_SUCCESS = 0
EXIT_FAILURE = 1
PYPI_PACKAGE_URL = "https://pypi.org/pypi/lingva-sdk/json"
PYTHON_UPDATE_COMMAND = "python -m pip install --upgrade lingva-sdk"


def _locale_list(value: str) -> tuple[str, ...]:
    locales = tuple(
        dict.fromkeys(locale.strip() for locale in value.split(",") if locale.strip())
    )
    if not locales:
        raise argparse.ArgumentTypeError("expected a comma-separated locale list")
    return locales


def _add_format(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--format", choices=(FORMAT_TEXT, FORMAT_JSON), default=FORMAT_TEXT)


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="lingva", description="Lingva localization CLI")
    parser.add_argument("-v", "--version", action="version", version=__version__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    auth = subparsers.add_parser(COMMAND_AUTH, help="manage hosted Lingva credentials")
    auth_commands = auth.add_subparsers(dest="auth_command", required=True)
    auth_login = auth_commands.add_parser(AUTH_LOGIN, help="sign in with OAuth in a browser")
    auth_login.add_argument("--issuer-url")
    auth_login.add_argument("--authorize-url")
    auth_login.add_argument("--token-url")
    auth_login.add_argument("--client-id")
    auth_login.add_argument("--platform-url", default=DEFAULT_PLATFORM_URL)
    auth_login.add_argument("--scope", default=DEFAULT_AUTH_SCOPES)
    auth_login.add_argument("--port", type=int, default=DEFAULT_AUTH_PORT)
    auth_login.add_argument("--no-browser", action="store_true")
    auth_key = auth_commands.add_parser(AUTH_USE_KEY, help="store a project API key")
    auth_key.add_argument("--api-key", required=True)
    auth_key.add_argument("--api-url")
    auth_key.add_argument("--project-id")
    auth_commands.add_parser(AUTH_STATUS, help="show the active credential type")
    auth_commands.add_parser(AUTH_LOGOUT, help="remove stored credentials")

    init = subparsers.add_parser(COMMAND_INIT, help="create a portable Lingva project config")
    init.add_argument("--config-file", default=DEFAULT_CONFIG_FILE)
    init.add_argument("--project-id")
    init.add_argument("--environment")
    init.add_argument("--locale", type=_locale_list)
    init.add_argument("--mode", choices=("remote", "local"), default="remote")
    init.add_argument("--no-auth", action="store_true")
    init.add_argument("--non-interactive", action="store_true")
    init.add_argument("--platform-url")
    init.add_argument("--sdk", choices=("python",), default="python")
    init.add_argument("--default-locale")
    init.add_argument("--fallback-locale")
    init.add_argument("--translation-files", default=DEFAULT_TRANSLATION_FILES)
    init.add_argument("--api-url")
    init.add_argument("--api-key-env", default=DEFAULT_API_KEY_ENV)
    init.add_argument("--dry-run", action="store_true")
    init.add_argument("--force", action="store_true")
    _add_format(init)

    update = subparsers.add_parser(COMMAND_UPDATE, help="check for a newer Lingva Python SDK and CLI")
    _add_format(update)

    sync = subparsers.add_parser(COMMAND_SYNC, help="align locale files with the default locale")
    sync.add_argument("config_file", nargs="?", default=DEFAULT_CONFIG_FILE)
    sync.add_argument("--dry-run", action="store_true")
    sync.add_argument("--check", action="store_true")
    _add_format(sync)

    check = subparsers.add_parser(COMMAND_CHECK, help="validate local translation alignment")
    check.add_argument("config_file", nargs="?", default=DEFAULT_CONFIG_FILE)
    _add_format(check)

    pull = subparsers.add_parser(COMMAND_PULL, help="pull hosted translations into locale files")
    pull.add_argument("config_file", nargs="?", default=DEFAULT_CONFIG_FILE)
    pull.add_argument("--locale", type=_locale_list)
    pull.add_argument("--output")
    pull.add_argument("--no-summary", action="store_true")
    _add_format(pull)

    push = subparsers.add_parser(COMMAND_PUSH, help="push local translations to Lingva")
    push.add_argument("config_file", nargs="?", default=DEFAULT_CONFIG_FILE)
    push.add_argument("--locale", type=_locale_list)
    push.add_argument("--api-url")
    push.add_argument("--auth-token")
    push.add_argument("--output-dir")
    push.add_argument("--force", action="store_true")
    push.add_argument("--no-summary", action="store_true")
    push.add_argument("--no-metadata", action="store_true")
    _add_format(push)

    return parser


def _run_auth_login(args: argparse.Namespace) -> int:
    discovered = discover_auth_config(args.platform_url) if not args.issuer_url and not args.authorize_url else {}
    issuer_value = args.issuer_url or discovered.get("issuerUrl")
    issuer_url = issuer_value.rstrip("/") if issuer_value else None
    authorize_url = args.authorize_url or (f"{issuer_url}/oauth2/authorize" if issuer_url else None)
    token_url = args.token_url or (f"{issuer_url}/oauth2/token" if issuer_url else None)
    if not authorize_url or not token_url:
        raise ValueError("Lingva auth login requires --issuer-url or both --authorize-url and --token-url.")
    client_id = args.client_id or discovered.get("clientId")
    if not client_id:
        raise ValueError("Lingva auth login requires --client-id when discovery is disabled.")
    credentials = login(
        authorize_url=authorize_url,
        token_url=token_url,
        client_id=client_id,
        scopes=args.scope,
        port=args.port,
        open_browser=not args.no_browser,
    )
    credentials["platformUrl"] = args.platform_url
    save_credentials(credentials)
    print("Lingva auth login completed.")
    return EXIT_SUCCESS


def _run_auth_use_key(args: argparse.Namespace) -> int:
    credentials = store_api_key(args.api_key, api_url=args.api_url, project_id=args.project_id)
    print(f"Lingva auth project API key stored ({credentials['apiKeyPreview']}).")
    return EXIT_SUCCESS


def _run_auth_status(_args: argparse.Namespace) -> int:
    status = auth_status()
    state = "authenticated" if status["authenticated"] else "not authenticated"
    print(f"Lingva auth status: {state}")
    return EXIT_SUCCESS if status["authenticated"] else EXIT_FAILURE


def _run_auth_logout(_args: argparse.Namespace) -> int:
    clear_credentials()
    print("Lingva auth logout completed.")
    return EXIT_SUCCESS


def _run_auth(args: argparse.Namespace) -> int:
    handlers = {
        AUTH_LOGIN: _run_auth_login,
        AUTH_LOGOUT: _run_auth_logout,
        AUTH_STATUS: _run_auth_status,
        AUTH_USE_KEY: _run_auth_use_key,
    }
    return handlers[args.auth_command](args)


def _latest_sdk_version() -> str:
    try:
        with urllib.request.urlopen(PYPI_PACKAGE_URL, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, json.JSONDecodeError) as exc:
        raise ValueError("Unable to check the latest lingva-sdk version.") from exc
    version = payload.get("info", {}).get("version") if isinstance(payload, dict) else None
    if not isinstance(version, str) or not version:
        raise ValueError("PyPI did not return the latest lingva-sdk version.")
    return version


def _version_parts(version: str) -> tuple[int, ...]:
    return tuple(int(part) if part.isdigit() else 0 for part in version.removeprefix("v").split("-")[0].split("."))


def _run_update(args: argparse.Namespace) -> int:
    latest = _latest_sdk_version()
    update_available = _version_parts(latest) > _version_parts(__version__)
    result = {
        "currentVersion": __version__,
        "latestVersion": latest,
        "updateAvailable": update_available,
        **({"installCommand": PYTHON_UPDATE_COMMAND} if update_available else {}),
    }
    if args.format == FORMAT_JSON:
        print(json.dumps(result, indent=2))
    elif update_available:
        print(f"Lingva Python SDK update available: {__version__} -> {latest}\nRun: {PYTHON_UPDATE_COMMAND}")
    else:
        print(f"Lingva Python SDK is current ({__version__}).")
    return EXIT_SUCCESS


def _format_sync(result: dict[str, Any], output_format: str, *, check: bool) -> str:
    if output_format == FORMAT_JSON:
        return json.dumps(result, indent=2)
    state = "planned" if not any(file["written"] for file in result["files"]) else "updated"
    lines = [f"Lingva sync: {state} local translations for {', '.join(result['locales'])}"]
    for file in result["files"]:
        suffix = (
            " [default]"
            if file["locale"] == result["defaultLocale"]
            else (
                f" ({file['missingKeys']} missing keys, "
                f"{file['missingVariants']} missing variants, "
                f"{file['extraVariants']} extra variants, "
                f"{file['variantMetadataMismatches']} variant metadata mismatches)"
            )
        )
        lines.append(f"- {file['locale']}: {file['filePath']}{suffix}")
    if check:
        lines.append(f"- check: {'failed (locale drift detected)' if result['hasDrift'] else 'passed'}")
    return "\n".join(lines)


def _run_init(args: argparse.Namespace) -> int:
    if args.no_auth and args.mode != "local":
        raise ValueError("--no-auth is only valid with --mode local.")
    credentials = None if args.no_auth else load_credentials()
    if not args.no_auth and not credentials:
        raise ValueError('Lingva init requires authentication. Run "lingva auth login" or use --mode local --no-auth.')

    project_id = args.project_id or (credentials or {}).get("projectId")
    api_url = args.api_url or (credentials or {}).get("apiUrl")
    environment = args.environment or DEFAULT_ENVIRONMENT
    locales = args.locale
    default_locale = args.default_locale
    if args.mode == "remote" and credentials and credentials.get("accessToken") and (not project_id or not api_url):
        platform_url = args.platform_url or credentials.get("platformUrl") or DEFAULT_PLATFORM_URL
        projects = list_platform_projects(credentials["accessToken"], platform_url)
        matching = [project for project in projects if project.get("projectId") == project_id] if project_id else projects
        if not matching:
            raise ValueError("No matching Lingva project is available to the authenticated user.")
        if len(matching) > 1:
            if args.non_interactive or not sys.stdin.isatty():
                choices = ", ".join(str(project.get("projectId")) for project in matching)
                raise ValueError(f"Multiple Lingva projects are available. Pass --project-id ({choices}).")
            print("Choose a Lingva project:")
            for index, project in enumerate(matching, start=1):
                print(f"{index}. {project.get('name')} ({project.get('projectId')})")
            choice = int(input("Project number: "))
            selected = matching[choice - 1] if 0 < choice <= len(matching) else None
        else:
            selected = matching[0]
        if not selected:
            raise ValueError("Select a valid project number.")
        project_id = str(selected["projectId"])
        locales = tuple(selected.get("locales") or ("en", "ru"))
        default_locale = str(selected.get("defaultLocale") or locales[0])
        environments = selected.get("environments") or []
        selected_environment = next((item for item in environments if item.get("environmentId") == environment), None)
        selected_environment = selected_environment or next((item for item in environments if item.get("publishApiUrl")), None)
        if not selected_environment or not selected_environment.get("publishApiUrl"):
            raise ValueError(f'Project "{project_id}" has no configured remote environment.')
        environment = str(selected_environment["environmentId"])
        api_url = str(selected_environment["publishApiUrl"])
    if args.mode == "remote" and (not project_id or not api_url):
        raise ValueError("Remote init requires --project-id and --api-url when project discovery is unavailable.")

    path = Path(args.config_file).resolve()
    locales = locales or ("en", "ru")
    project_id = project_id or "lingva-app"
    default_locale = default_locale or locales[0]
    fallback_locale = args.fallback_locale or default_locale
    payload = {
        "projectId": project_id,
        "environment": environment,
        "locales": list(locales),
        "defaultLocale": default_locale,
        "fallbackLocale": fallback_locale,
        "translationFiles": args.translation_files,
        "apiKeyEnv": args.api_key_env,
        **({"apiUrl": api_url} if api_url else {}),
    }
    files = [str(path)] + [
        str(path.parent / args.translation_files.replace("{locale}", locale)) for locale in locales
    ]
    if not args.dry_run:
        if path.exists() and not args.force:
            raise LingvaConfigError(
                f'Lingva config "{path}" already exists; pass --force to replace it.'
            )
        path.parent.mkdir(parents=True, exist_ok=True)
        content = (
            json.dumps(payload, indent=2) + "\n"
            if path.suffix == ".json"
            else yaml.safe_dump(payload, sort_keys=False, allow_unicode=True)
        )
        path.write_text(content, encoding="utf-8")
        for locale in locales:
            translation_path = path.parent / args.translation_files.replace("{locale}", locale)
            if not translation_path.exists():
                write_dictionary(translation_path, {})
        lingva_gitignore = path.parent / ".lingva" / ".gitignore"
        if not lingva_gitignore.exists():
            lingva_gitignore.parent.mkdir(parents=True, exist_ok=True)
            lingva_gitignore.write_text("remote-state.json\n", encoding="utf-8")
    report = {"configFile": str(path), "files": files, "written": not args.dry_run}
    print(json.dumps(report, indent=2) if args.format == FORMAT_JSON else "\n".join(files))
    return EXIT_SUCCESS


def _run_sync(args: argparse.Namespace, *, check: bool) -> int:
    config = load_cli_config(args.config_file)
    result = sync_local_files(config, write=not (check or getattr(args, "dry_run", False)))
    print(_format_sync(result, args.format, check=check))
    return EXIT_FAILURE if check and result["hasDrift"] else EXIT_SUCCESS


def _run_pull(args: argparse.Namespace) -> int:
    config = load_cli_config(args.config_file)
    locales = args.locale or config.locales
    token = resolve_auth_token(config)
    files = []
    state = load_remote_state(config)
    planned_writes = []
    for locale in locales:
        bundle, revision = pull_bundle(config, locale, token)
        output_template = args.output or config.translation_files
        path = Path(output_template.replace("{locale}", locale))
        if not path.is_absolute():
            path = config.path.parent / path
        remote_dictionary = {}
        variants = bundle.get("variants") if isinstance(bundle.get("variants"), dict) else {}
        messages = bundle.get("messages")
        sources = bundle.get("sources") if isinstance(bundle.get("sources"), dict) else {}
        if not isinstance(messages, dict):
            raise LingvaHostedError(f'Lingva bundle for locale "{locale}" has no messages object.')
        for key, value in messages.items():
            if sources.get(key, locale) != locale:
                continue
            set_dictionary_value(remote_dictionary, key, variants.get(key, value))
        locale_state = state.get("locales", {}).get(locale, {})
        base = locale_state.get("base", {}) if isinstance(locale_state, dict) else {}
        local_dictionary = read_dictionary(path)
        merged = merge_remote_dictionary(locale, base, local_dictionary, remote_dictionary)
        planned_writes.append((locale, path, merged, revision, remote_dictionary))
        files.append(str(path))
    for locale, path, merged, revision, remote_dictionary in planned_writes:
        write_dictionary(path, merged)
        set_remote_locale(state, locale, revision, remote_dictionary)
    save_remote_state(config, state)
    report = {"configFile": str(config.path), "locales": list(locales), "files": files}
    print(json.dumps(report, indent=2) if args.format == FORMAT_JSON else "\n".join(files))
    return EXIT_SUCCESS


def _run_push(args: argparse.Namespace) -> int:
    config = load_cli_config(args.config_file)
    if args.api_url:
        config = replace(config, api_url=args.api_url)
    locales = args.locale or config.locales
    output_dir = Path(args.output_dir) if args.output_dir else None
    if output_dir and not output_dir.is_absolute():
        output_dir = config.path.parent / output_dir
    base_revision = get_push_base_revision(config, locales, force=args.force)
    result = push_translations(
        config,
        locales,
        resolve_auth_token(config, args.auth_token),
        output_dir,
        base_revision=base_revision,
        force=args.force,
    )
    revision = result.get("publishId")
    if not isinstance(revision, str) or not revision:
        raise LingvaHostedError("Lingva hosted push response has no publishId revision.")
    state = load_remote_state(config)
    for locale in locales:
        set_remote_locale(state, locale, revision, read_dictionary(config.translation_path(locale)))
    save_remote_state(config, state)
    report = (
        json.dumps(result, indent=2)
        if args.format == FORMAT_JSON
        else (
            f"Hosted publish: {result.get('projectId', config.project_id)} "
            f"-> {result.get('manifestKey', 'complete')}"
        )
    )
    print(report)
    return EXIT_SUCCESS


def run(argv: Sequence[str] | None = None) -> int:
    args = create_parser().parse_args(argv)
    handlers = {
        COMMAND_AUTH: _run_auth,
        COMMAND_UPDATE: _run_update,
        COMMAND_INIT: _run_init,
        COMMAND_SYNC: lambda value: _run_sync(value, check=value.check),
        COMMAND_CHECK: lambda value: _run_sync(value, check=True),
        COMMAND_PULL: _run_pull,
        COMMAND_PUSH: _run_push,
    }
    return handlers[args.command](args)


def main() -> None:
    try:
        raise SystemExit(run())
    except (LingvaConfigError, LingvaHostedError, LingvaMergeConflictError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(EXIT_FAILURE) from exc


if __name__ == "__main__":
    main()
