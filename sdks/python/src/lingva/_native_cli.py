"""Compatibility import for SDK releases that formerly bundled the CLI.

Install lingva-cli separately. The SDK no longer owns the console entry point
or implements CLI installation/behavior; old imports share the new adapter.
"""

import sys

try:
    from lingva_cli import _launcher
except ImportError as error:
    raise ImportError("Lingva CLI moved to lingva-cli. Run: python -m pip install lingva-cli") from error

sys.modules[__name__] = _launcher
