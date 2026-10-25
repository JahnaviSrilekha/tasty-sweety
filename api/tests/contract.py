"""Checks API responses against specs/001-sweet-ordering/contracts/openapi.yaml (task T2.5)."""

import json
from functools import lru_cache
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

ROOT = Path(__file__).resolve().parents[2]
OPENAPI = ROOT / "specs" / "001-sweet-ordering" / "contracts" / "openapi.yaml"
CATALOG_SCHEMA = ROOT / "shared" / "catalog.schema.json"


@lru_cache(maxsize=1)
def _spec() -> dict:
    return yaml.safe_load(OPENAPI.read_text())


def _walk(spec: dict, ref: str) -> dict:
    node = spec
    for part in ref.removeprefix("#/").split("/"):
        node = node[part.replace("~1", "/").replace("~0", "~")]
    return node


def assert_matches_contract(response, path: str, method: str) -> None:
    """`path` is the template as written in the contract, e.g. "/orders/{id}"."""
    spec = _spec()
    operation = spec["paths"][path][method.lower()]
    status = str(response.status_code)
    assert status in operation["responses"], f"{method} {path} has no {status} in the contract"
    declared = operation["responses"][status]
    if "$ref" in declared:
        declared = _walk(spec, declared["$ref"])
    schema = declared["content"]["application/json"]["schema"]

    # Validate with the contract document as the base, so its "#/components/..." refs resolve.
    document = {**spec, "x-check": schema}
    registry = Registry().with_resources(
        [
            (OPENAPI.as_uri(), Resource(contents=document, specification=DRAFT202012)),
            (
                CATALOG_SCHEMA.as_uri(),
                DRAFT202012.create_resource(json.loads(CATALOG_SCHEMA.read_text())),
            ),
        ]
    )
    validator = Draft202012Validator({"$ref": f"{OPENAPI.as_uri()}#/x-check"}, registry=registry)
    validator.validate(response.json())
