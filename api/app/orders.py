"""Orders and their stages (spec 001, REQ-5). Stages change only through TRANSITIONS."""

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.checkout import Customer
from app.pricing import CamelModel, PricedLine

Stage = Literal["placed", "confirmed", "ready", "completed", "cancelled"]
Actor = Literal["customer", "owner"]

STAGES: tuple[Stage, ...] = ("placed", "confirmed", "ready", "completed", "cancelled")
TRANSITIONS: dict[Stage, frozenset[Stage]] = {
    "placed": frozenset({"confirmed", "cancelled"}),
    "confirmed": frozenset({"ready", "cancelled"}),
    "ready": frozenset({"completed"}),
    "completed": frozenset(),
    "cancelled": frozenset(),
}


class InvalidTransition(Exception):
    def __init__(self, src: Stage, dst: str):
        super().__init__(f"an order cannot go from {src} to {dst}")
        self.src, self.dst = src, dst


class HistoryEntry(CamelModel):
    from_: Stage | None = Field(alias="from")
    to: Stage
    by: Actor
    at: datetime


class Order(CamelModel):
    id: str
    lines: list[PricedLine]
    total: int
    customer: Customer
    stage: Stage
    history: list[HistoryEntry]
    created_at: datetime


def new_order(
    order_id: str, lines: list[PricedLine], total: int, customer: Customer, now: datetime
) -> Order:
    return Order(
        id=order_id,
        lines=lines,
        total=total,
        customer=customer,
        stage="placed",
        history=[HistoryEntry(from_=None, to="placed", by="customer", at=now)],
        created_at=now,
    )


def transition(order: Order, to: str, by: Actor, now: datetime) -> Order:
    """Returns a new order at stage `to` (AC-5.2) with the change recorded (AC-5.3)."""
    if to not in TRANSITIONS[order.stage]:
        raise InvalidTransition(order.stage, to)
    entry = HistoryEntry(from_=order.stage, to=to, by=by, at=now)
    return order.model_copy(update={"stage": to, "history": [*order.history, entry]})
