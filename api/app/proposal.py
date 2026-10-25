"""Assistant proposals (spec 001, REQ-3). A parser (AI or rules) produces a RawProposal;
validate() checks it against the catalog in plain code before anyone sees it (AC-3.3)."""

from typing import Literal

from pydantic import BaseModel, Field

from app.catalog import Catalog, SizeId
from app.pricing import CamelModel

MIN_QTY, MAX_QTY = 1, 99
DEFAULT_SIZE: SizeId = "medium"

Parser = Literal["ai", "rules"]
RejectReason = Literal["unknown_sweet", "unavailable", "bad_quantity", "not_understood"]


class RawLine(BaseModel):
    sweet_id: str = Field(description="Catalog id of the sweet, exactly as listed")
    size: SizeId | None = Field(description="Box size, or null when the customer did not say")
    qty: int = Field(description="Number of boxes")


class RawProposal(BaseModel):
    lines: list[RawLine]
    not_understood: list[str] = Field(description="Parts of the message that match no sweet")
    reply: str = Field(description="One short, friendly sentence to the customer")


class ProposalLine(CamelModel):
    sweet_id: str
    name: str
    size: SizeId
    qty: int
    unit_price: int
    line_total: int
    size_assumed: bool


class Rejected(CamelModel):
    text: str
    reason: RejectReason


class Proposal(CamelModel):
    parser: Parser
    lines: list[ProposalLine]
    rejected: list[Rejected]
    total: int


def validate(raw: RawProposal, catalog: Catalog, parser: Parser) -> Proposal:
    rejected: list[Rejected] = []
    merged: dict[tuple[str, SizeId], tuple[int, bool]] = {}  # (sweet, size) -> (qty, assumed)

    for line in raw.lines:
        try:
            sweet = catalog.sweet(line.sweet_id)
        except KeyError:
            rejected.append(Rejected(text=line.sweet_id, reason="unknown_sweet"))
            continue
        if not sweet.available:
            rejected.append(Rejected(text=sweet.name, reason="unavailable"))
            continue
        if not MIN_QTY <= line.qty <= MAX_QTY:
            rejected.append(Rejected(text=f"{line.qty} × {sweet.name}", reason="bad_quantity"))
            continue
        size = line.size or DEFAULT_SIZE
        qty, assumed = merged.get((sweet.id, size), (0, True))
        merged[(sweet.id, size)] = (qty + line.qty, assumed and line.size is None)

    lines: list[ProposalLine] = []
    for (sweet_id, size), (qty, assumed) in merged.items():
        sweet = catalog.sweet(sweet_id)
        if qty > MAX_QTY:
            rejected.append(Rejected(text=f"{qty} × {sweet.name}", reason="bad_quantity"))
            continue
        unit_price = sweet.prices[size]
        lines.append(
            ProposalLine(
                sweet_id=sweet_id,
                name=sweet.name,
                size=size,
                qty=qty,
                unit_price=unit_price,
                line_total=unit_price * qty,
                size_assumed=assumed,
            )
        )

    rejected += [Rejected(text=t, reason="not_understood") for t in raw.not_understood if t.strip()]
    return Proposal(
        parser=parser, lines=lines, rejected=rejected, total=sum(pl.line_total for pl in lines)
    )
