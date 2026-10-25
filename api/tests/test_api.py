import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import REPO_ROOT, Settings
from tests.contract import assert_matches_contract

OWNER_KEY = "test-owner-key"
NOW = datetime(2026, 10, 25, 6, 0, tzinfo=UTC)
CUSTOMER = {"name": "Asha Rao", "phone": "9876543210", "fulfilment": "pickup"}
TWO_LARGE_KAJU = [{"sweetId": "kaju-katli", "size": "large", "qty": 2}]


class Clock:
    def __init__(self):
        self.now = NOW

    def __call__(self) -> datetime:
        self.now += timedelta(seconds=1)
        return self.now


def make_client(tmp_path, owner_key=OWNER_KEY, catalog_path=None) -> TestClient:
    settings = Settings(
        catalog_path=catalog_path or REPO_ROOT / "shared" / "catalog.json",
        database_path=tmp_path / "orders.db",
        web_origin="http://localhost:3000",
        owner_key=owner_key,
    )
    return TestClient(create_app(settings, clock=Clock()))


@pytest.fixture
def client(tmp_path):
    return make_client(tmp_path)


def place(client, lines=TWO_LARGE_KAJU, expected_total=240000, key=None, customer=CUSTOMER):
    return client.post(
        "/orders",
        json={"lines": lines, "customer": customer, "expectedTotal": expected_total},
        headers={"Idempotency-Key": key or str(uuid.uuid4())},
    )


def owner(key=OWNER_KEY):
    return {"X-Owner-Key": key}


# --- T2.1 catalog and quote ---------------------------------------------------------------


def test_AC_1_1_catalog_lists_sweets_with_sizes_and_prices(client):
    response = client.get("/catalog")
    assert response.status_code == 200
    assert_matches_contract(response, "/catalog", "get")
    body = response.json()
    assert len(body["sweets"]) == 6
    assert body["sweets"][0]["prices"] == {"small": 32000, "medium": 62000, "large": 120000}


def test_AC_4_3_quote_prices_lines_on_the_server(client):
    response = client.post("/quote", json={"lines": TWO_LARGE_KAJU})
    assert response.status_code == 200
    assert_matches_contract(response, "/quote", "post")
    assert response.json()["total"] == 240000
    assert response.json()["lines"][0]["unitPrice"] == 120000


@pytest.mark.parametrize(
    "lines,code",
    [
        ([], "invalid_request"),
        ([{"sweetId": "kaju-katli", "size": "large", "qty": 0}], "invalid_request"),
        ([{"sweetId": "kaju-katli", "size": "large", "qty": 100}], "invalid_request"),
        ([{"sweetId": "kaju-katli", "size": "jumbo", "qty": 1}], "invalid_request"),
        ([{"sweetId": "no-such-sweet", "size": "small", "qty": 1}], "unknown_sweet"),
    ],
)
def test_AC_2_2_quote_rejects_bad_lines(client, lines, code):
    response = client.post("/quote", json={"lines": lines})
    assert response.status_code == 422
    assert_matches_contract(response, "/quote", "post")
    assert response.json()["error"]["code"] == code


def test_AC_1_3_unavailable_sweet_cannot_be_quoted_or_ordered(tmp_path, shared_dir):
    import json

    data = json.loads((shared_dir / "catalog.json").read_text())
    data["sweets"][0]["available"] = False
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps(data))
    client = make_client(tmp_path, catalog_path=path)

    quote = client.post("/quote", json={"lines": TWO_LARGE_KAJU})
    order = place(client)
    assert (quote.status_code, order.status_code) == (422, 422)
    assert quote.json()["error"]["code"] == order.json()["error"]["code"] == "unavailable"


# --- T2.2 place an order ------------------------------------------------------------------


def test_AC_4_2_AC_4_4_order_is_priced_by_server_and_numbered(client):
    response = place(client)
    assert response.status_code == 201
    assert_matches_contract(response, "/orders", "post")
    order = response.json()
    assert order["id"] == "TS-20261025-0001"
    assert order["total"] == 240000
    assert order["stage"] == "placed"


def test_AC_4_2_client_prices_are_ignored(client):
    lines = [{**TWO_LARGE_KAJU[0], "unitPrice": 1}]
    response = place(client, lines=lines)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_AC_4_3_changed_total_is_rejected_with_new_quote(client):
    response = place(client, expected_total=200000)
    assert response.status_code == 409
    assert_matches_contract(response, "/orders", "post")
    body = response.json()
    assert body["error"]["code"] == "total_changed"
    assert body["quote"]["total"] == 240000
    assert client.get("/orders/TS-20261025-0001").status_code == 404


def test_AC_4_5_same_key_returns_first_order_with_200(client):
    key = str(uuid.uuid4())
    first = place(client, key=key)
    again = place(client, key=key)
    assert (first.status_code, again.status_code) == (201, 200)
    assert_matches_contract(again, "/orders", "post")
    assert again.json() == first.json()
    assert place(client).json()["id"] == "TS-20261025-0002"


def test_AC_4_5_retry_with_same_key_wins_over_a_changed_total(client):
    key = str(uuid.uuid4())
    first = place(client, key=key)
    again = place(client, key=key, expected_total=1)
    assert again.status_code == 200
    assert again.json()["id"] == first.json()["id"]


@pytest.mark.parametrize("headers", [{}, {"Idempotency-Key": "not-a-uuid"}])
def test_AC_4_5_idempotency_key_is_required(client, headers):
    response = client.post(
        "/orders",
        json={"lines": TWO_LARGE_KAJU, "customer": CUSTOMER, "expectedTotal": 240000},
        headers=headers,
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_AC_4_1_customer_details_are_checked_by_the_server(client):
    response = place(client, customer={**CUSTOMER, "phone": "12345"})
    assert response.status_code == 422
    assert_matches_contract(response, "/orders", "post")


# --- T2.3 order status --------------------------------------------------------------------


def test_AC_5_1_AC_5_5_status_shows_order_without_customer_details(client):
    placed = place(
        client,
        customer={**CUSTOMER, "fulfilment": "delivery", "address": "12 MG Road, Bengaluru 560001"},
    ).json()
    response = client.get(f"/orders/{placed['id']}")
    assert response.status_code == 200
    assert_matches_contract(response, "/orders/{id}", "get")
    body = response.json()
    assert body["stage"] == "placed" and body["total"] == 240000
    assert body["fulfilment"] == "delivery"
    assert "customer" not in body
    assert "9876543210" not in response.text and "MG Road" not in response.text


def test_AC_5_1_unknown_order_is_404(client):
    response = client.get("/orders/TS-20990101-0001")
    assert response.status_code == 404
    assert_matches_contract(response, "/orders/{id}", "get")
    assert response.json()["error"]["code"] == "not_found"


# --- T2.4 owner routes --------------------------------------------------------------------


def test_AC_5_4_owner_list_needs_the_key(client):
    place(client)
    for headers in ({}, owner("wrong")):
        response = client.get("/owner/orders", headers=headers)
        assert response.status_code == 401
        assert_matches_contract(response, "/owner/orders", "get")


def test_AC_5_4_owner_list_is_newest_first_with_customer_details(client):
    a = place(client).json()
    b = place(client).json()
    response = client.get("/owner/orders", headers=owner())
    assert response.status_code == 200
    assert_matches_contract(response, "/owner/orders", "get")
    assert [o["id"] for o in response.json()] == [b["id"], a["id"]]
    assert response.json()[0]["customer"]["phone"] == "9876543210"


def test_AC_5_4_owner_routes_are_off_until_a_key_is_set(tmp_path):
    client = make_client(tmp_path, owner_key=None)
    response = client.get("/owner/orders", headers=owner())
    assert response.status_code == 503
    assert_matches_contract(response, "/owner/orders", "get")
    assert response.json()["error"]["code"] == "owner_disabled"


def test_AC_5_2_AC_5_3_owner_moves_an_order_along(client):
    order_id = place(client).json()["id"]
    for stage in ("confirmed", "ready", "completed"):
        response = client.post(
            f"/owner/orders/{order_id}/stage", json={"to": stage}, headers=owner()
        )
        assert response.status_code == 200
        assert_matches_contract(response, "/owner/orders/{id}/stage", "post")
    history = client.get(f"/orders/{order_id}").json()["history"]
    assert [(h["from"], h["to"], h["by"]) for h in history] == [
        (None, "placed", "customer"),
        ("placed", "confirmed", "owner"),
        ("confirmed", "ready", "owner"),
        ("ready", "completed", "owner"),
    ]
    times = [h["at"] for h in history]
    assert times == sorted(times) and len(set(times)) == 4


def test_AC_5_2_disallowed_stage_change_is_409(client):
    order_id = place(client).json()["id"]
    response = client.post(
        f"/owner/orders/{order_id}/stage", json={"to": "completed"}, headers=owner()
    )
    assert response.status_code == 409
    assert_matches_contract(response, "/owner/orders/{id}/stage", "post")
    assert response.json()["error"]["code"] == "invalid_transition"
    assert client.get(f"/orders/{order_id}").json()["stage"] == "placed"


@pytest.mark.parametrize(
    "order_id,body,headers,status",
    [
        ("TS-20261025-0001", {"to": "confirmed"}, {}, 401),
        ("TS-20990101-0001", {"to": "confirmed"}, owner(), 404),
        ("TS-20261025-0001", {"to": "eaten"}, owner(), 422),
    ],
)
def test_AC_5_4_owner_stage_errors(client, order_id, body, headers, status):
    place(client)
    response = client.post(f"/owner/orders/{order_id}/stage", json=body, headers=headers)
    assert response.status_code == status
    assert_matches_contract(response, "/owner/orders/{id}/stage", "post")


def test_health(client):
    response = client.get("/health")
    assert_matches_contract(response, "/health", "get")
