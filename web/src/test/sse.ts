// Builds fetch responses for tests.

export function sseResponse(events: object[], chunkSize = 7): Response {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  const bytes = new TextEncoder().encode(text);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Uneven chunks, so the reader has to handle events split across reads.
      for (let i = 0; i < bytes.length; i += chunkSize) controller.enqueue(bytes.slice(i, i + chunkSize));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export const PROPOSAL = {
  parser: "ai",
  lines: [
    { sweetId: "kaju-katli", name: "Kaju Katli", size: "large", qty: 2, unitPrice: 120000, lineTotal: 240000, sizeAssumed: false },
    { sweetId: "gulab-jamun", name: "Gulab Jamun", size: "medium", qty: 1, unitPrice: 30000, lineTotal: 30000, sizeAssumed: true },
  ],
  rejected: [{ text: "jalebi", reason: "unknown_sweet" }],
  total: 270000,
};

export function assistantEvents(reply = "Here you go!", proposal: object = PROPOSAL): object[] {
  const args = JSON.stringify(proposal);
  return [
    { type: "RUN_STARTED", threadId: "t", runId: "r" },
    { type: "STEP_STARTED", stepName: "understand" },
    { type: "STEP_FINISHED", stepName: "understand" },
    { type: "TOOL_CALL_START", toolCallId: "c1", toolCallName: "propose_cart_lines" },
    { type: "TOOL_CALL_ARGS", toolCallId: "c1", delta: args.slice(0, 20) },
    { type: "TOOL_CALL_ARGS", toolCallId: "c1", delta: args.slice(20) },
    { type: "TOOL_CALL_END", toolCallId: "c1" },
    { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant" },
    ...reply.split(/(?<= )/).map((delta) => ({ type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta })),
    { type: "TEXT_MESSAGE_END", messageId: "m1" },
    { type: "SOMETHING_NEW", note: "unknown events are ignored" },
    { type: "RUN_FINISHED", threadId: "t", runId: "r" },
  ];
}
