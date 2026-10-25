from datetime import UTC, datetime

import pytest

from app.checkout import Customer
from app.orders import STAGES, TRANSITIONS, InvalidTransition, Order, new_order, transition
from app.pricing import PricedLine

T0 = datetime(2026, 10, 25, 9, 30, tzinfo=UTC)
T1 = datetime(2026, 10, 25, 10, 0, tzinfo=UTC)

ALLOWED = {
    ("placed", "confirmed"),
    ("placed", "cancelled"),
    ("confirmed", "ready"),
    ("confirmed", "cancelled"),
    ("ready", "completed"),
}


def make_order(stage="placed") -> Order:
    order = new_order(
        order_id="TS-20261025-0001",
        lines=[
            PricedLine(
                sweetId="rasgulla",
                size="small",
                qty=1,
                name="Rasgulla",
                unitPrice=15000,
                lineTotal=15000,
            )
        ],
        total=15000,
        customer=Customer(name="Asha", phone="9876543210", fulfilment="pickup"),
        now=T0,
    )
    return order.model_copy(update={"stage": stage})


def test_AC_5_1_new_order_starts_placed_with_history():
    order = make_order()
    assert order.stage == "placed"
    assert [(h.from_, h.to, h.by) for h in order.history] == [(None, "placed", "customer")]


def test_AC_5_2_transition_table_is_exactly_the_spec():
    table = {(a, b) for a, targets in TRANSITIONS.items() for b in targets}
    assert table == ALLOWED


@pytest.mark.parametrize("src,dst", sorted(ALLOWED))
def test_AC_5_2_allowed_transitions(src, dst):
    assert transition(make_order(src), dst, by="owner", now=T1).stage == dst


@pytest.mark.parametrize(
    "src,dst",
    sorted((a, b) for a in STAGES for b in STAGES if (a, b) not in ALLOWED),
)
def test_AC_5_2_every_other_transition_is_rejected(src, dst):
    with pytest.raises(InvalidTransition):
        transition(make_order(src), dst, by="owner", now=T1)


def test_AC_5_3_transition_records_who_and_when():
    order = transition(make_order(), "confirmed", by="owner", now=T1)
    last = order.history[-1]
    assert (last.from_, last.to, last.by, last.at) == ("placed", "confirmed", "owner", T1)
    assert len(order.history) == 2


def test_transition_does_not_change_the_original():
    order = make_order()
    transition(order, "confirmed", by="owner", now=T1)
    assert order.stage == "placed" and len(order.history) == 1


def test_order_json_uses_camel_case_and_from_key():
    data = make_order().model_dump(mode="json", by_alias=True)
    assert data["history"][0]["from"] is None
    assert "createdAt" in data and data["lines"][0]["unitPrice"] == 15000
