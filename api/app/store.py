"""Order storage in SQLite (spec 001, AC-4.4, AC-4.5). Orders are kept as JSON documents."""

import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from app.checkout import Customer
from app.orders import Order, new_order
from app.pricing import PricedLine

SHOP_TZ = ZoneInfo("Asia/Kolkata")

SCHEMA = """
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS daily_counters (
    day TEXT PRIMARY KEY,
    last INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id)
);
"""


class OrderStore:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self._path = path
        with closing(self._connect()) as db:
            db.executescript(SCHEMA)

    def _connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self._path, isolation_level=None)
        db.execute("PRAGMA foreign_keys = ON")
        return db

    def create_order(
        self,
        lines: list[PricedLine],
        total: int,
        customer: Customer,
        idempotency_key: str,
        now: datetime,
    ) -> tuple[Order, bool]:
        """Returns (order, created). A key seen before returns its first order (AC-4.5)."""
        day = now.astimezone(SHOP_TZ).strftime("%Y%m%d")
        db = self._connect()
        try:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute(
                "SELECT o.data FROM idempotency_keys k JOIN orders o ON o.id = k.order_id"
                " WHERE k.key = ?",
                (idempotency_key,),
            ).fetchone()
            if row:
                db.execute("COMMIT")
                return Order.model_validate_json(row[0]), False

            number = db.execute(
                "INSERT INTO daily_counters (day, last) VALUES (?, 1)"
                " ON CONFLICT(day) DO UPDATE SET last = last + 1 RETURNING last",
                (day,),
            ).fetchone()[0]
            if number > 9999:
                raise RuntimeError(f"more than 9999 orders on {day}")
            order = new_order(f"TS-{day}-{number:04d}", lines, total, customer, now)
            db.execute(
                "INSERT INTO orders (id, created_at, data) VALUES (?, ?, ?)",
                (order.id, order.created_at.astimezone(UTC).isoformat(), _to_json(order)),
            )
            db.execute(
                "INSERT INTO idempotency_keys (key, order_id) VALUES (?, ?)",
                (idempotency_key, order.id),
            )
            db.execute("COMMIT")
            return order, True
        except BaseException:
            if db.in_transaction:
                db.execute("ROLLBACK")
            raise
        finally:
            db.close()

    def get_by_idempotency_key(self, key: str) -> Order | None:
        with closing(self._connect()) as db:
            row = db.execute(
                "SELECT o.data FROM idempotency_keys k JOIN orders o ON o.id = k.order_id"
                " WHERE k.key = ?",
                (key,),
            ).fetchone()
        return Order.model_validate_json(row[0]) if row else None

    def get(self, order_id: str) -> Order | None:
        with closing(self._connect()) as db:
            row = db.execute("SELECT data FROM orders WHERE id = ?", (order_id,)).fetchone()
        return Order.model_validate_json(row[0]) if row else None

    def save(self, order: Order) -> None:
        with closing(self._connect()) as db:
            db.execute("UPDATE orders SET data = ? WHERE id = ?", (_to_json(order), order.id))

    def list_orders(self) -> list[Order]:
        with closing(self._connect()) as db:
            rows = db.execute(
                "SELECT data FROM orders ORDER BY created_at DESC, id DESC"
            ).fetchall()
        return [Order.model_validate_json(r[0]) for r in rows]


def _to_json(order: Order) -> str:
    return order.model_dump_json(by_alias=True)
