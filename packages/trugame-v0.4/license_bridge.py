"""
TruGame → json-chamber Black Box control plane bridge.

All TruGame engine entry points call require_alive("trugame")
before doing real work.
"""

from __future__ import annotations

import sys
from pathlib import Path

_SDK = Path(__file__).resolve().parent.parent / "json-chamber-sdk"
if _SDK.is_dir() and str(_SDK) not in sys.path:
    sys.path.insert(0, str(_SDK))

try:
    from json_chamber import (
        LicenseError,
        apply_entitlement,
        license_status,
        require_alive,
    )
except ImportError as e:  # pragma: no cover
    raise ImportError(
        "json-chamber is required for TruGame Black Box licensing. "
        "Place json-chamber-sdk next to trugame-v0.4 or install the package."
    ) from e

PRODUCT = "trugame"


def gate() -> dict:
    """Call at engine start / tick / pack / net. Raises LicenseError if dead."""
    return require_alive(PRODUCT)


def status() -> dict:
    return license_status(PRODUCT)


def activate(entitlement_token: dict | str) -> dict:
    """Apply a server-issued entitlement (after Stripe or manual PACKAGE ACCESS)."""
    return apply_entitlement(entitlement_token)


__all__ = ["LicenseError", "PRODUCT", "gate", "status", "activate"]
