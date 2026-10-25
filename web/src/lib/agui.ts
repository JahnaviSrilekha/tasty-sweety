// Minimal AG-UI client for the order assistant (spec 001, design §5): posts a RunAgentInput
// and reads the Server-Sent Events stream. Unknown event types are ignored.
import { API_URL } from "./api";
import type { SizeId } from "./catalog";

export type ProposalLine = {
  sweetId: string;
  name: string;
  size: SizeId;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  sizeAssumed: boolean;
};

export type Proposal = {
  parser: "ai" | "rules";
  lines: ProposalLine[];
  rejected: { text: string; reason: "unknown_sweet" | "unavailable" | "bad_quantity" | "not_understood" }[];
  total: number;
};

export type AgUiEvent = { type: string; [key: string]: unknown };

export const PROPOSAL_TOOL = "propose_cart_lines";

export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<AgUiEvent> {
  const reader = body.pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let end: number;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) yield JSON.parse(data);
    }
  }
}

export type AssistantHandlers = {
  onProposal: (proposal: Proposal) => void;
  onText: (delta: string) => void;
  onError: (message: string) => void;
};

const newId = () => crypto.randomUUID();

export async function runAssistant(
  text: string,
  threadId: string,
  handlers: AssistantHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        threadId,
        runId: newId(),
        messages: [{ id: newId(), role: "user", content: text }],
        state: {},
        tools: [],
        context: [],
        forwardedProps: {},
      }),
      signal,
    });
  } catch {
    if (!signal?.aborted) handlers.onError("We couldn't reach the assistant. Check your connection and try again.");
    return;
  }
  if (!response.ok || !response.body) {
    handlers.onError("The assistant couldn't help with that just now. Please try again.");
    return;
  }

  const toolArgs = new Map<string, { name: string; args: string }>();
  try {
    for await (const event of readEvents(response.body)) {
      switch (event.type) {
        case "TOOL_CALL_START":
          toolArgs.set(event.toolCallId as string, { name: event.toolCallName as string, args: "" });
          break;
        case "TOOL_CALL_ARGS": {
          const call = toolArgs.get(event.toolCallId as string);
          if (call) call.args += event.delta as string;
          break;
        }
        case "TOOL_CALL_END": {
          const call = toolArgs.get(event.toolCallId as string);
          if (call?.name === PROPOSAL_TOOL) handlers.onProposal(JSON.parse(call.args));
          break;
        }
        case "TEXT_MESSAGE_CONTENT":
          handlers.onText(event.delta as string);
          break;
        case "RUN_ERROR":
          handlers.onError((event.message as string) || "Something went wrong. Please try again.");
          break;
      }
    }
  } catch {
    if (!signal?.aborted) handlers.onError("The connection to the assistant dropped. Please try again.");
  }
}
