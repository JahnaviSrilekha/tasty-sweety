from datetime import UTC, datetime, timedelta

import pytest

from app.checkout import Customer
from app.orders import transition
from app.pricing import PricedLine
from app.store import OrderStore

CUSTOMER = Customer(name="Asha", phone="9876543210", fulfilment="pickup")
LINES = [
    PricedLine(
        sweetId="rasgulla", size="small", qty=1, name="Rasgulla", unitPrice=15000, lineTotal=15000
    )
]
# 2026-10-25 20:00 UTC is already 2026-10-26 in India.
LATE_UTC = datetime(2026, 10, 25, 20, 0, tzinfo=UTC)


@pytest.fixture
def store(tmp_path):
    return OrderStore(tmp_path / "orders.db")


def place(store, key, now=LATE_UTC):
    return store.create_order(LINES, 15000, CUSTOMER, idempotency_key=key, now=now)


def test_AC_4_4_order_numbers_use_india_date_and_daily_counter(store):
    first, _ = place(store, "k1")
    second, _ = place(store, "k2")
    assert first.id == "TS-20261026-0001"
    assert second.id == "TS-20261026-0002"


def test_AC_4_4_counter_restarts_each_day(store):
    place(store, "k1")
    next_day, _ = place(store, "k2", now=LATE_UTC + timedelta(days=1))
    assert next_day.id == "TS-20261027-0001"


def test_AC_4_5_same_idempotency_key_returns_the_first_order(store):
    first, created_first = place(store, "same")
    again, created_again = place(store, "same")
    assert (created_first, created_again) == (True, False)
    assert again == first
    assert len(store.list_orders()) == 1


def test_AC_4_5_survives_reopening_the_database(tmp_path):
    first, _ = place(OrderStore(tmp_path / "orders.db"), "same")
    again, created = place(OrderStore(tmp_path / "orders.db"), "same")
    assert (again.id, created) == (first.id, False)


def test_AC_5_1_get_returns_saved_order(store):
    order, _ = place(store, "k1")
    assert store.get(order.id) == order
    assert store.get("TS-20990101-0001") is None


def test_AC_5_3_saved_transition_is_kept(store):
    order, _ = place(store, "k1")
    store.save(transition(order, "confirmed", by="owner", now=LATE_UTC + timedelta(minutes=5)))
    saved = store.get(order.id)
    assert saved.stage == "confirmed"
    assert [h.to for h in saved.history] == ["placed", "confirmed"]


def test_AC_5_4_list_is_newest_first(store):
    a, _ = place(store, "k1")
    b, _ = place(store, "k2", now=LATE_UTC + timedelta(minutes=1))
    assert [o.id for o in store.list_orders()] == [b.id, a.id]


def test_AC_4_5_order_can_be_found_by_its_idempotency_key(store):
    order, _ = place(store, "k1")
    assert store.get_by_idempotency_key("k1") == order
    assert store.get_by_idempotency_key("other") is None
