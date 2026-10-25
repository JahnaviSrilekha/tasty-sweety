// HTTP client for the api (contract: specs/001-sweet-ordering/contracts/openapi.yaml).
import type { SizeId } from "./catalog";
import type { Line, PricedLine, Quote } from "./pricing";
import type { Customer } from "./schemas";
import type { Stage } from "./stages";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type HistoryEntry = { from: Stage | null; to: Stage; by: "customer" | "owner"; at: string };

export type PublicOrder = {
  id: string;
  lines: PricedLine[];
  total: number;
  fulfilment: Customer["fulfilment"];
  stage: Stage;
  history: HistoryEntry[];
  createdAt: string;
};

export type Order = Omit<PublicOrder, "fulfilment"> & { customer: Customer };

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError("network", "We couldn't reach the shop. Check your connection and try again.", 0);
  }
}

async function errorFrom(response: Response): Promise<ApiError> {
  try {
    const body = await response.json();
    return new ApiError(body.error.code, body.error.message, response.status);
  } catch {
    return new ApiError("http_error", `The shop answered with an error (${response.status}).`, response.status);
  }
}

const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});

export type PlaceOrderResult = { kind: "placed"; order: Order } | { kind: "total_changed"; quote: Quote };

/** Sends only ids, sizes and quantities; the server works out prices (AC-4.2). */
export async function placeOrder(
  body: { lines: Line[]; customer: Customer; expectedTotal: number },
  idempotencyKey: string,
): Promise<PlaceOrderResult> {
  const response = await request("/orders", json(body, { "Idempotency-Key": idempotencyKey }));
  if (response.ok) return { kind: "placed", order: await response.json() };
  if (response.status === 409) {
    const data = await response.json();
    if (data?.error?.code === "total_changed") return { kind: "total_changed", quote: data.quote };
  }
  throw await errorFrom(response);
}

export async function getOrder(id: string): Promise<PublicOrder | null> {
  const response = await request(`/orders/${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw await errorFrom(response);
  return response.json();
}

const owner = (key: string) => ({ "X-Owner-Key": key });

export async function listOrders(ownerKey: string): Promise<Order[]> {
  const response = await request("/owner/orders", { headers: owner(ownerKey) });
  if (!response.ok) throw await errorFrom(response);
  return response.json();
}

export async function changeStage(ownerKey: string, id: string, to: Stage): Promise<Order> {
  const response = await request(`/owner/orders/${encodeURIComponent(id)}/stage`, json({ to }, owner(ownerKey)));
  if (!response.ok) throw await errorFrom(response);
  return response.json();
}

export type { SizeId };
