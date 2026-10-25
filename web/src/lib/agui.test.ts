import { describe, expect, it, vi } from "vitest";
import { assistantEvents, PROPOSAL, sseResponse } from "@/test/sse";
import { readEvents, runAssistant } from "./agui";

function handlers() {
  return { onProposal: vi.fn(), onText: vi.fn(), onError: vi.fn() };
}

describe("AG-UI stream reader", () => {
  it("reads events split across chunks", async () => {
    const response = sseResponse([{ type: "A", n: 1 }, { type: "B", text: "two\nlines" }], 3);
    const seen = [];
    for await (const e of readEvents(response.body!)) seen.push(e);
    expect(seen).toEqual([{ type: "A", n: 1 }, { type: "B", text: "two\nlines" }]);
  });
});

describe("AC-3.1 runAssistant", () => {
  it("posts an AG-UI RunAgentInput with the message", async () => {
    const fetchMock = vi.fn(async () => sseResponse(assistantEvents()));
    vi.stubGlobal("fetch", fetchMock);
    await runAssistant("2 large kaju katli", "thread-1", handlers());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/agent$/);
    const body = JSON.parse(init.body as string);
    expect(body.threadId).toBe("thread-1");
    expect(body.runId).toBeTruthy();
    expect(body.messages).toEqual([{ id: expect.any(String), role: "user", content: "2 large kaju katli" }]);
    expect((init.headers as Record<string, string>).Accept).toBe("text/event-stream");
  });

  it("streams text deltas and delivers the proposal once its tool call ends", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse(assistantEvents("Two large Kaju Katli!"))));
    const h = handlers();
    await runAssistant("x", "t", h);
    expect(h.onText.mock.calls.map((c) => c[0])).toEqual(["Two ", "large ", "Kaju ", "Katli!"]);
    expect(h.onProposal).toHaveBeenCalledExactlyOnceWith(PROPOSAL);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it("reports RUN_ERROR", async () => {
    const events = [
      { type: "RUN_STARTED", threadId: "t", runId: "r" },
      { type: "RUN_ERROR", message: "Please keep it under 500 characters.", code: "message_too_long" },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse(events)));
    const h = handlers();
    await runAssistant("x", "t", h);
    expect(h.onError).toHaveBeenCalledWith("Please keep it under 500 characters.");
  });

  it("reports a network failure or a bad status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const h = handlers();
    await runAssistant("x", "t", h);
    expect(h.onError).toHaveBeenCalledWith(expect.stringMatching(/couldn't reach/i));

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const h2 = handlers();
    await runAssistant("x", "t", h2);
    expect(h2.onError).toHaveBeenCalledOnce();
  });
});
