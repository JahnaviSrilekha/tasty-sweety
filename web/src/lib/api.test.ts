import { describe, expect, it, vi } from "vitest";
import { jsonResponse } from "@/test/sse";
import { ApiError, changeStage, getOrder, listOrders, placeOrder } from "./api";

const LINES = [{ sweetId: "kaju-katli", size: "large" as const, qty: 2 }];
const CUSTOMER = { name: "Asha", phone: "9876543210", fulfilment: "pickup" as const };
const QUOTE = { lines: [], total: 240000 };

describe("AC-4.2 placeOrder", () => {
  it("sends only lines, customer and the total seen, with the idempotency key", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: "TS-20261025-0001" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    const result = await placeOrder({ lines: LINES, customer: CUSTOMER, expectedTotal: 240000 }, "key-1");
    expect(result).toEqual({ kind: "placed", order: { id: "TS-20261025-0001" } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/orders$/);
    expect(JSON.parse(init.body as string)).toEqual({ lines: LINES, customer: CUSTOMER, expectedTotal: 240000 });
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("key-1");
  });

  it("AC-4.3 returns the new quote when the total changed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      jsonResponse({ error: { code: "total_changed", message: "changed" }, quote: QUOTE }, 409)));
    const result = await placeOrder({ lines: LINES, customer: CUSTOMER, expectedTotal: 1 }, "k");
    expect(result).toEqual({ kind: "total_changed", quote: QUOTE });
  });

  it("throws ApiError with the server's code for other errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      jsonResponse({ error: { code: "unavailable", message: "Kaju Katli is not available" } }, 422)));
    await expect(placeOrder({ lines: LINES, customer: CUSTOMER, expectedTotal: 1 }, "k")).rejects.toMatchObject({
      code: "unavailable",
      message: "Kaju Katli is not available",
      status: 422,
    });
  });

  it("turns a network failure into an ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const err = await placeOrder({ lines: LINES, customer: CUSTOMER, expectedTotal: 1 }, "k").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("network");
  });
});

describe("AC-5.1 getOrder", () => {
  it("returns null for 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { code: "not_found", message: "x" } }, 404)));
    expect(await getOrder("TS-20990101-0001")).toBeNull();
  });

  it("encodes the id in the URL", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: "a/b" }));
    vi.stubGlobal("fetch", fetchMock);
    await getOrder("a/b");
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toMatch(/\/orders\/a%2Fb$/);
  });
});

describe("AC-5.4 owner calls send the owner key", () => {
  it("lists orders and changes stage with X-Owner-Key", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    await listOrders("secret");
    await changeStage("secret", "TS-20261025-0001", "confirmed");
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([, init]) => (init.headers as Record<string, string>)["X-Owner-Key"])).toEqual(["secret", "secret"]);
    expect(calls[1][0]).toMatch(/\/owner\/orders\/TS-20261025-0001\/stage$/);
    expect(JSON.parse(calls[1][1].body as string)).toEqual({ to: "confirmed" });
  });
});
