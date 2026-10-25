"""Prices and totals (spec 001, AC-2.3, AC-4.2). Integers in paise only."""

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.catalog import Catalog, SizeId


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class Line(CamelModel):
    sweet_id: str
    size: SizeId
    qty: int = Field(ge=1, le=99)


class PricedLine(Line):
    name: str
    unit_price: int
    line_total: int


class Quote(CamelModel):
    lines: list[PricedLine]
    total: int


def price_lines(lines: list[Line], catalog: Catalog) -> Quote:
    """Raises KeyError for a sweet or size that is not in the catalog."""
    priced = []
    for line in lines:
        sweet = catalog.sweet(line.sweet_id)
        unit_price = sweet.prices[line.size]
        priced.append(
            PricedLine(
                **line.model_dump(),
                name=sweet.name,
                unit_price=unit_price,
                line_total=unit_price * line.qty,
            )
        )
    return Quote(lines=priced, total=sum(pl.line_total for pl in priced))
