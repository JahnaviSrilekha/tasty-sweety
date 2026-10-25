"""AI order parser: Claude on Amazon Bedrock with structured output (spec 001, design §5).
Its result is only a suggestion; proposal.validate() checks it against the catalog."""

import json

from app.catalog import Catalog
from app.proposal import RawProposal

INSTRUCTIONS = """You turn a sweet shop customer's message into order lines.

Use only sweets from the catalog below, by their exact id. Box sizes are small (250 g),
medium (500 g) and large (1 kg); "1 kg" or "big" means large, "half kg" means medium.
Use size null when the customer gives no size. qty is the number of boxes.

If the customer asks you to suggest something (an occasion or a number of people), propose
a sensible mix from the catalog, about one 500 g box for every 8 to 10 people.

Put any part of the message that names something not in the catalog into not_understood.
Write reply as one short, friendly sentence. Never ask for or repeat personal details.

CATALOG:
"""


class AiParserError(Exception):
    pass


class AiParser:
    def __init__(self, client, model: str, timeout_seconds: float, max_tokens: int = 4096):
        self._client = client
        self._model = model
        self._timeout = timeout_seconds
        self._max_tokens = max_tokens

    @staticmethod
    def system_prompt(catalog: Catalog) -> str:
        names = [{"id": s.id, "name": s.name, "aliases": s.aliases} for s in catalog.sweets]
        return INSTRUCTIONS + json.dumps(names, indent=1, ensure_ascii=False)

    def parse(self, message: str, catalog: Catalog) -> RawProposal:
        """Sends only the message and the catalog names (AC-3.7). Raises on any failure."""
        response = self._client.messages.parse(
            model=self._model,
            max_tokens=self._max_tokens,
            system=[
                {
                    "type": "text",
                    "text": self.system_prompt(catalog),
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": message}],
            output_format=RawProposal,
            output_config={"effort": "low"},
            timeout=self._timeout,
        )
        if response.stop_reason != "end_turn":
            raise AiParserError(f"model stopped with {response.stop_reason}")
        if response.parsed_output is None:
            raise AiParserError("model output did not fit the schema")
        return response.parsed_output


def bedrock_parser(aws_region: str, model: str, timeout_seconds: float) -> AiParser:
    from anthropic import AnthropicBedrockMantle

    client = AnthropicBedrockMantle(aws_region=aws_region, max_retries=0)
    return AiParser(client, model=model, timeout_seconds=timeout_seconds)
