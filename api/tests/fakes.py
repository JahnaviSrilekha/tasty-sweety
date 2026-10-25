"""A stand-in for the Anthropic client: records the request, returns or raises what it's told."""

from types import SimpleNamespace


class FakeMessages:
    def __init__(self, result=None, error=None, stop_reason="end_turn"):
        self.result, self.error, self.stop_reason = result, error, stop_reason
        self.calls: list[dict] = []

    def parse(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return SimpleNamespace(stop_reason=self.stop_reason, parsed_output=self.result)


class FakeClient:
    def __init__(self, **kwargs):
        self.messages = FakeMessages(**kwargs)
