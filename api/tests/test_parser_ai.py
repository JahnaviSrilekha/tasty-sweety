import json

import anthropic
import httpx2
import pytest

from app.assistant import FALLBACK_NOTE, understand
from app.catalog import load_catalog
from app.parser_ai import AiParser
from app.proposal import RawLine, RawProposal
from tests.fakes import FakeClient

MODEL = "anthropic.claude-opus-5-5"
TEXT = "2 large kaju katli and a small ladoo"
AI_RESULT = RawProposal(
    lines=[
        RawLine(sweet_id="kaju-katli", size="large", qty=2),
        RawLine(sweet_id="motichoor-ladoo", size="small", qty=1),
    ],
    not_understood=[],
    reply="Two large Kaju Katli and a small Motichoor Ladoo, coming up!",
)


def parser(**fake) -> tuple[AiParser, FakeClient]:
    client = FakeClient(**fake)
    return AiParser(client, model=MODEL, timeout_seconds=10), client


def test_AC_3_2_ai_result_is_validated_and_priced():
    ai, _ = parser(result=AI_RESULT)
    proposal, reply = understand(TEXT, load_catalog(), ai)
    assert proposal.parser == "ai"
    assert [(pl.sweet_id, pl.size, pl.qty) for pl in proposal.lines] == [
        ("kaju-katli", "large", 2),
        ("motichoor-ladoo", "small", 1),
    ]
    assert proposal.total == 258000
    assert reply == AI_RESULT.reply


def test_AC_3_3_ai_cannot_add_sweets_that_are_not_in_the_catalog():
    made_up = RawProposal(
        lines=[RawLine(sweet_id="chocolate-cake", size="large", qty=1)],
        not_understood=[],
        reply="Sure!",
    )
    ai, _ = parser(result=made_up)
    proposal, _ = understand("a chocolate cake", load_catalog(), ai)
    assert proposal.lines == []
    assert [(r.text, r.reason) for r in proposal.rejected] == [("chocolate-cake", "unknown_sweet")]


@pytest.mark.parametrize(
    "fake",
    [
        {"error": anthropic.APITimeoutError(request=httpx2.Request("POST", "https://bedrock"))},
        {"error": anthropic.APIConnectionError(request=httpx2.Request("POST", "https://bedrock"))},
        {"error": RuntimeError("no AWS credentials")},
        {"result": None},  # output did not fit the schema
        {"result": AI_RESULT, "stop_reason": "refusal"},
        {"result": AI_RESULT, "stop_reason": "max_tokens"},
    ],
    ids=["timeout", "connection", "other-error", "no-parsed-output", "refusal", "max-tokens"],
)
def test_AC_3_6_any_ai_failure_falls_back_to_rules_and_says_so(fake):
    ai, _ = parser(**fake)
    proposal, reply = understand(TEXT, load_catalog(), ai)
    assert proposal.parser == "rules"
    assert [(pl.sweet_id, pl.size, pl.qty) for pl in proposal.lines] == [
        ("kaju-katli", "large", 2),
        ("motichoor-ladoo", "small", 1),
    ]
    assert reply.endswith(FALLBACK_NOTE)


def test_AC_3_6_no_ai_configured_uses_rules_and_says_so():
    proposal, reply = understand(TEXT, load_catalog(), None)
    assert proposal.parser == "rules"
    assert reply.endswith(FALLBACK_NOTE)


def test_AC_3_6_request_has_a_10_second_timeout_and_structured_output():
    ai, client = parser(result=AI_RESULT)
    understand(TEXT, load_catalog(), ai)
    call = client.messages.calls[0]
    assert call["timeout"] == 10
    assert call["model"] == MODEL
    assert call["output_format"] is RawProposal
    assert call["output_config"] == {"effort": "low"}


def test_AC_3_7_only_the_message_and_catalog_names_are_sent():
    ai, client = parser(result=AI_RESULT)
    understand(TEXT, load_catalog(), ai)
    call = client.messages.calls[0]
    assert call["messages"] == [{"role": "user", "content": TEXT}]
    [system] = call["system"]
    assert system["cache_control"] == {"type": "ephemeral"}
    catalog_json = json.loads(system["text"].split("CATALOG:\n", 1)[1])
    assert [s["id"] for s in catalog_json] == [s.id for s in load_catalog().sweets]
    assert set(catalog_json[0]) == {"id", "name", "aliases"}
    assert set(call) <= {
        "model",
        "max_tokens",
        "system",
        "messages",
        "output_format",
        "output_config",
        "timeout",
    }


def test_AC_3_7_system_prompt_is_the_same_for_every_request():
    ai, client = parser(result=AI_RESULT)
    understand("one rasgulla", load_catalog(), ai)
    understand("two ladoo", load_catalog(), ai)
    first, second = client.messages.calls
    assert first["system"] == second["system"]  # stable prefix, so prompt caching works


def test_AC_3_8_ai_suggestions_go_through_the_same_checks():
    suggestion = RawProposal(
        lines=[
            RawLine(sweet_id="kaju-katli", size="large", qty=2),
            RawLine(sweet_id="soan-papdi", size="large", qty=150),
        ],
        not_understood=[],
        reply="For 20 people at Diwali, Kaju Katli and Soan Papdi are popular gifts.",
    )
    ai, client = parser(result=suggestion)
    proposal, _ = understand("something for Diwali for 20 people", load_catalog(), ai)
    assert [pl.sweet_id for pl in proposal.lines] == ["kaju-katli"]
    assert [r.reason for r in proposal.rejected] == ["bad_quantity"]
    assert "suggest" in client.messages.calls[0]["system"][0]["text"].lower()


def test_AC_3_2_real_sdk_request_and_parsing_with_a_mock_transport():
    """Runs the real Anthropic SDK against a canned HTTP reply, so the request shape is real."""
    seen = {}

    def handler(request: httpx2.Request) -> httpx2.Response:
        seen["body"] = json.loads(request.content)
        return httpx2.Response(
            200,
            json={
                "id": "msg_test",
                "type": "message",
                "role": "assistant",
                "model": MODEL,
                "content": [{"type": "text", "text": AI_RESULT.model_dump_json()}],
                "stop_reason": "end_turn",
                "stop_sequence": None,
                "usage": {"input_tokens": 10, "output_tokens": 10},
            },
        )

    client = anthropic.Anthropic(
        api_key="test", http_client=httpx2.Client(transport=httpx2.MockTransport(handler))
    )
    proposal, reply = understand(TEXT, load_catalog(), AiParser(client, MODEL, 10))
    assert proposal.parser == "ai" and reply == AI_RESULT.reply
    body = seen["body"]
    assert body["output_config"]["effort"] == "low"
    assert body["output_config"]["format"]["type"] == "json_schema"
    assert body["messages"] == [{"role": "user", "content": TEXT}]
