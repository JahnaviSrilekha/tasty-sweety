import json
from pathlib import Path

import pytest

SHARED = Path(__file__).resolve().parents[2] / "shared"


@pytest.fixture(scope="session")
def shared_dir() -> Path:
    return SHARED


@pytest.fixture(scope="session")
def pricing_cases() -> list[dict]:
    return json.loads((SHARED / "pricing-cases.json").read_text())["cases"]


@pytest.fixture(scope="session")
def checkout_cases() -> list[dict]:
    return json.loads((SHARED / "checkout-cases.json").read_text())["cases"]
