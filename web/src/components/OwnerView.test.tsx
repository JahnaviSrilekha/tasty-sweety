// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { jsonResponse } from "@/test/sse";
import { OwnerView } from "./OwnerView";

function order(id: string, stage: string) {
  return {
    id, stage, total: 240000, createdAt: "2026-10-25T06:00:00Z",
    lines: [{ sweetId: "kaju-katli", size: "large", qty: 2, name: "Kaju Katli", unitPrice: 120000, lineTotal: 240000 }],
    customer: { name: "Asha Rao", phone: "9876543210", fulfilment: "pickup" },
    history: [{ from: null, to: "placed", by: "customer", at: "2026-10-25T06:00:00Z" }],
  };
}

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Owner key"), "secret");
  await user.click(screen.getByRole("button", { name: "Show orders" }));
}

describe("OwnerView", () => {
  it("AC-5.2 AC-5.4 shows customer details and only the allowed next stages", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      jsonResponse([order("TS-20261025-0002", "placed"), order("TS-20261025-0001", "completed")])));
    const user = userEvent.setup();
    render(<OwnerView />);
    await signIn(user);

    const placed = within(await screen.findByRole("article", { name: "Order TS-20261025-0002" }));
    expect(placed.getByText(/9876543210/)).toBeInTheDocument();
    expect(placed.getAllByRole("button").map((b) => b.textContent)).toEqual(["Confirmed", "Cancelled"]);

    const done = within(screen.getByRole("article", { name: "Order TS-20261025-0001" }));
    expect(done.queryAllByRole("button")).toHaveLength(0);
  });

  it("AC-5.2 moves an order to the next stage", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([order("TS-20261025-0002", "placed")]))
      .mockResolvedValueOnce(jsonResponse(order("TS-20261025-0002", "confirmed")));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<OwnerView />);
    await signIn(user);
    await user.click(await screen.findByRole("button", { name: "Confirmed" }));
    const card = within(screen.getByRole("article", { name: "Order TS-20261025-0002" }));
    expect(await card.findByText("Stage: Confirmed")).toBeInTheDocument();
    expect(card.getAllByRole("button").map((b) => b.textContent)).toEqual(["Ready", "Cancelled"]);
  });

  it("AC-5.4 a wrong key shows an error and no orders", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      jsonResponse({ error: { code: "unauthorized", message: "A valid owner key is needed" } }, 401)));
    const user = userEvent.setup();
    render(<OwnerView />);
    await signIn(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("That key isn't right.");
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });
});
