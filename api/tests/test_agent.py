import json

import pytest
from fastapi.testclient import TestClient

from app.assistant import FALLBACK_NOTE
from app.main import create_app
from app.parser_ai import AiParser
from app.proposal import Proposal, RawLine, RawProposal
from app.settings import REPO_ROOT, Settings
from tests.contract import assert_matches_contract
from tests.fakes import FakeClient

EXPECTED_ORDER = [
    "RUN_STARTED",
    "STEP_STARTED",
    "STEP_FINISHED",
    "TOOL_CALL_START",
    "TOOL_CALL_ARGS",
    "TOOL_CALL_END",
    "TEXT_MESSAGE_START",
    "TEXT_MESSAGE_CONTENT",
    "TEXT_MESSAGE_END",
    "RUN_FINISHED",
]


def make_client(tmp_path, ai_parser=None) -> TestClient:
    settings = Settings(
        catalog_path=REPO_ROOT / "shared" / "catalog.json",
        database_path=tmp_path / "orders.db",
        web_origin="http://localhost:3000",
        owner_key=None,
    )
    return TestClient(create_app(settings, ai_parser=ai_parser))


def run_input(*texts, role="user"):
    return {
        "threadId": "thread-1",
        "runId": "run-1",
        "state": {},
        "messages": [{"id": f"m{i}", "role": role, "content": t} for i, t in enumerate(texts)],
        "tools": [],
        "context": [],
        "forwardedProps": {},
    }


def events(response) -> list[dict]:
    assert response.headers["content-type"].startswith("text/event-stream")
    out = []
    for block in response.text.strip().split("\n\n"):
        assert block.startswith("data: ")
        out.append(json.loads(block.removeprefix("data: ")))
    return out


def collapse(types: list[str]) -> list[str]:
    """Several TEXT_MESSAGE_CONTENT chunks count as one step of the sequence."""
    return [t for i, t in enumerate(types) if i == 0 or t != types[i - 1]]


@pytest.fixture
def client(tmp_path):
    return make_client(tmp_path)


def test_AC_3_1_events_come_in_the_designed_order(client):
    evs = events(client.post("/agent", json=run_input("2 large kaju katli")))
    assert collapse([e["type"] for e in evs]) == EXPECTED_ORDER
    assert evs[0]["threadId"] == evs[-1]["threadId"] == "thread-1"
    assert evs[0]["runId"] == evs[-1]["runId"] == "run-1"
    assert evs[1]["stepName"] == evs[2]["stepName"] == "understand"


def test_AC_3_1_reply_is_streamed_in_chunks(client):
    evs = events(client.post("/agent", json=run_input("2 large kaju katli")))
    chunks = [e["delta"] for e in evs if e["type"] == "TEXT_MESSAGE_CONTENT"]
    assert len(chunks) > 1
    assert "".join(chunks).endswith(FALLBACK_NOTE)
    ids = {e["messageId"] for e in evs if e["type"].startswith("TEXT_MESSAGE")}
    assert len(ids) == 1


def test_AC_3_5_proposal_is_sent_as_the_propose_cart_lines_tool_call(client):
    evs = events(client.post("/agent", json=run_input("2 large kaju katli, 1 small jalebi")))
    start = next(e for e in evs if e["type"] == "TOOL_CALL_START")
    assert start["toolCallName"] == "propose_cart_lines"
    args = "".join(e["delta"] for e in evs if e["type"] == "TOOL_CALL_ARGS")
    proposal = Proposal.model_validate_json(args)
    assert [(pl.sweet_id, pl.size, pl.qty, pl.line_total) for pl in proposal.lines] == [
        ("kaju-katli", "large", 2, 240000)
    ]
    assert [r.reason for r in proposal.rejected] == ["not_understood"]
    assert proposal.parser == "rules"
    assert {e["toolCallId"] for e in evs if e["type"].startswith("TOOL_CALL")} == {
        start["toolCallId"]
    }


def test_AC_3_1_uses_the_last_user_message(client):
    body = run_input("1 small rasgulla", "3 large mysore pak")
    args = "".join(
        e["delta"]
        for e in events(client.post("/agent", json=body))
        if e["type"] == "TOOL_CALL_ARGS"
    )
    assert [line["sweetId"] for line in json.loads(args)["lines"]] == ["mysore-pak"]


def test_AC_3_2_ai_parser_is_used_when_configured(tmp_path):
    fake = FakeClient(
        result=RawProposal(
            lines=[RawLine(sweet_id="rasgulla", size=None, qty=2)],
            not_understood=[],
            reply="Two boxes of Rasgulla!",
        )
    )
    client = make_client(tmp_path, ai_parser=AiParser(fake, "anthropic.claude-opus-5-5", 10))
    evs = events(client.post("/agent", json=run_input("couple of rasgullas")))
    args = json.loads("".join(e["delta"] for e in evs if e["type"] == "TOOL_CALL_ARGS"))
    assert args["parser"] == "ai"
    assert args["lines"][0]["sizeAssumed"] is True
    assert "".join(e["delta"] for e in evs if e["type"] == "TEXT_MESSAGE_CONTENT") == (
        "Two boxes of Rasgulla!"
    )


@pytest.mark.parametrize(
    "body,code",
    [
        (run_input(), "no_message"),
        (run_input("   "), "no_message"),
        (run_input("hello", role="assistant"), "no_message"),
        (run_input("x" * 501), "message_too_long"),
    ],
    ids=["no-messages", "blank", "only-assistant", "too-long"],
)
def test_bad_messages_end_with_run_error(client, body, code):
    evs = events(client.post("/agent", json=body))
    assert [e["type"] for e in evs] == ["RUN_STARTED", "RUN_ERROR"]
    assert evs[1]["code"] == code


def test_unexpected_failure_ends_with_run_error(tmp_path, monkeypatch):
    client = make_client(tmp_path)
    monkeypatch.setattr("app.agent.understand", lambda *a: 1 / 0)
    evs = events(client.post("/agent", json=run_input("2 large kaju katli")))
    assert [e["type"] for e in evs] == ["RUN_STARTED", "STEP_STARTED", "RUN_ERROR"]
    assert evs[-1]["code"] == "internal"


def test_malformed_run_input_is_422(client):
    response = client.post("/agent", json={"messages": "nope"})
    assert response.status_code == 422
    assert_matches_contract(response, "/agent", "post")
