import json

import jsonschema
import pytest

from app.catalog import Catalog, load_catalog


def test_AC_1_5_shared_catalog_matches_schema(shared_dir):
    schema = json.loads((shared_dir / "catalog.schema.json").read_text())
    data = json.loads((shared_dir / "catalog.json").read_text())
    jsonschema.validate(data, schema)


def test_AC_1_5_sweet_ids_are_unique(shared_dir):
    data = json.loads((shared_dir / "catalog.json").read_text())
    ids = [s["id"] for s in data["sweets"]]
    assert len(ids) == len(set(ids))


def test_AC_1_5_api_loads_the_shared_catalog():
    catalog = load_catalog()
    assert isinstance(catalog, Catalog)
    assert catalog.price("kaju-katli", "small") == 32000
    assert [s.id for s in catalog.sizes] == ["small", "medium", "large"]


def test_unknown_sweet_or_size_raises():
    catalog = load_catalog()
    with pytest.raises(KeyError):
        catalog.price("barfi-that-does-not-exist", "small")
    with pytest.raises(KeyError):
        catalog.price("kaju-katli", "huge")
