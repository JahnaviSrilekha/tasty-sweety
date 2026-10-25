"""The shared catalog (spec 001, REQ-1). Read once from shared/catalog.json."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from app.settings import load_settings

SizeId = Literal["small", "medium", "large"]


class Size(BaseModel):
    id: SizeId
    label: str
    grams: int


class Sweet(BaseModel):
    id: str
    name: str
    description: str
    image: str
    tags: list[str]
    aliases: list[str]
    available: bool
    prices: dict[SizeId, int]


class Catalog(BaseModel):
    currency: Literal["INR"]
    sizes: list[Size]
    sweets: list[Sweet]

    def sweet(self, sweet_id: str) -> Sweet:
        for sweet in self.sweets:
            if sweet.id == sweet_id:
                return sweet
        raise KeyError(sweet_id)

    def price(self, sweet_id: str, size: str) -> int:
        return self.sweet(sweet_id).prices[size]


def read_catalog(path: Path) -> Catalog:
    return Catalog.model_validate(json.loads(path.read_text()))


@lru_cache(maxsize=1)
def load_catalog() -> Catalog:
    return read_catalog(load_settings().catalog_path)
