"""Order assistant (spec 001, REQ-3): AI parser if it works, rule parser if not,
then the same plain-code checks either way."""

import logging

from app.catalog import Catalog
from app.parser_ai import AiParser
from app.parser_rules import parse_rules
from app.proposal import Proposal, validate

log = logging.getLogger(__name__)

FALLBACK_NOTE = "(The AI assistant isn't available right now, so I used simple matching.)"


def understand(message: str, catalog: Catalog, ai: AiParser | None) -> tuple[Proposal, str]:
    """Returns the checked proposal and a short reply for the customer."""
    if ai is not None:
        try:
            raw = ai.parse(message, catalog)
            return validate(raw, catalog, "ai"), raw.reply
        except Exception as exc:  # noqa: BLE001 - any AI failure must leave the shop working (AC-3.6)
            log.warning("AI parser failed, using rules: %s", type(exc).__name__)
    raw = parse_rules(message, catalog)
    return validate(raw, catalog, "rules"), f"{raw.reply} {FALLBACK_NOTE}"
