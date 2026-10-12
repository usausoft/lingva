import json

from lingva._delivery import (
    API_KEY_HEADER,
    DEFAULT_REMOTE_BUNDLE_PATH_TEMPLATE,
    LingvaDeliveryTarget,
    load_bundle_from_url_sync,
)


def test_default_template_constant():
    assert DEFAULT_REMOTE_BUNDLE_PATH_TEMPLATE == "/bundles/{projectId}/{environment}/latest/{locale}.bundle.json"


def test_resolve_builds_correct_url():
    target = LingvaDeliveryTarget(
        base_url="https://api.lingva.dev",
        project_id="my-project",
        environment="production",
    )
    url = target.resolve("fr")
    assert url == "https://api.lingva.dev/bundles/my-project/production/latest/fr.bundle.json"


def test_resolve_strips_trailing_slash():
    target = LingvaDeliveryTarget(
        base_url="https://api.lingva.dev/",
        project_id="p1",
        environment="dev",
    )
    url = target.resolve("en")
    assert url == "https://api.lingva.dev/bundles/p1/dev/latest/en.bundle.json"


def test_custom_uri_template():
    target = LingvaDeliveryTarget(
        base_url="https://cdn.example.com",
        uri_template="/v2/{locale}/{projectId}.json",
        project_id="abc",
    )
    url = target.resolve("de")
    assert url == "https://cdn.example.com/v2/de/abc.json"


def test_delivery_target_hides_api_key_from_repr():
    target = LingvaDeliveryTarget(base_url="https://api.lingva.dev", api_key="secret")

    assert API_KEY_HEADER == "x-api-key"
    assert "secret" not in repr(target)


def test_sync_delivery_sends_project_api_key(monkeypatch):
    captured = {}

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self):
            return json.dumps({"schemaVersion": 1}).encode()

    def fake_urlopen(request):
        captured["headers"] = {
            name.lower(): value for name, value in request.header_items()
        }
        return Response()

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    assert load_bundle_from_url_sync("https://api.example.test/bundle", api_key="secret") == {
        "schemaVersion": 1
    }
    assert captured["headers"][API_KEY_HEADER] == "secret"
