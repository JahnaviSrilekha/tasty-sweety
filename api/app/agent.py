"""The order assistant as an AG-UI run (spec 001, design §5): one request in,
a stream of AG-UI events out. The proposal travels as the `propose_cart_lines` tool call."""

import logging
import re
import uuid
from collections.abc import Iterator

from ag_ui.core import (
    BaseEvent,
    RunAgentInput,
    RunErrorEvent,
    RunFinishedEvent,
    RunStartedEvent,
    StepFinishedEvent,
    StepStartedEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
    TextMessageStartEvent,
    ToolCallArgsEvent,
    ToolCallEndEvent,
    ToolCallStartEvent,
)

from app.assistant import understand
from app.catalog import Catalog
from app.parser_ai import AiParser

log = logging.getLogger(__name__)

MAX_MESSAGE_CHARS = 500
TOOL_NAME = "propose_cart_lines"
STEP = "understand"


def last_user_text(run: RunAgentInput) -> str:
    for message in reversed(run.messages):
        if message.role != "user":
            continue
        content = message.content
        if isinstance(content, str):
            return content.strip()
        return " ".join(p.text for p in content if getattr(p, "type", None) == "text").strip()
    return ""


def run_events(run: RunAgentInput, catalog: Catalog, ai: AiParser | None) -> Iterator[BaseEvent]:
    # Sent before any slow work so the screen reacts at once (NFR-4).
    yield RunStartedEvent(thread_id=run.thread_id, run_id=run.run_id)

    text = last_user_text(run)
    if not text:
        yield RunErrorEvent(message="Please type what you would like to order.", code="no_message")
        return
    if len(text) > MAX_MESSAGE_CHARS:
        yield RunErrorEvent(
            message=f"Please keep it under {MAX_MESSAGE_CHARS} characters.",
            code="message_too_long",
        )
        return

    yield StepStartedEvent(step_name=STEP)
    try:
        proposal, reply = understand(text, catalog, ai)
    except Exception:
        log.exception("assistant run failed")
        yield RunErrorEvent(message="Something went wrong. Please try again.", code="internal")
        return
    yield StepFinishedEvent(step_name=STEP)

    tool_call_id = f"call_{uuid.uuid4().hex}"
    yield ToolCallStartEvent(tool_call_id=tool_call_id, tool_call_name=TOOL_NAME)
    yield ToolCallArgsEvent(
        tool_call_id=tool_call_id, delta=proposal.model_dump_json(by_alias=True)
    )
    yield ToolCallEndEvent(tool_call_id=tool_call_id)

    message_id = f"msg_{uuid.uuid4().hex}"
    yield TextMessageStartEvent(message_id=message_id, role="assistant")
    for chunk in re.findall(r"\S+\s*", reply):
        yield TextMessageContentEvent(message_id=message_id, delta=chunk)
    yield TextMessageEndEvent(message_id=message_id)

    yield RunFinishedEvent(thread_id=run.thread_id, run_id=run.run_id)
