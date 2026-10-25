// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { jsonResponse } from "@/test/sse";
import { OrderStatus } from "./OrderStatus";

const ORDER = {
  id: "TS-20261025-0001", stage: "confirmed", total: 240000, fulfilment: "pickup",
  createdAt: "2026-10-25T06:00:00Z",
  lines: [{ sweetId: "kaju-katli", size: "large", qty: 2, name: "Kaju Katli", unitPrice: 120000, lineTotal: 240000 }],
  history: [
    { from: null, to: "placed", by: "customer", at: "2026-10-25T06:00:00Z" },
    { from: "placed", to: "confirmed", by: "owner", at: "2026-10-25T06:10:00Z" },
  ],
};

describe("OrderStatus", () => {
  it("AC-5.1 shows the lines, total and current stage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(ORDER)));
    render(<OrderStatus orderId="TS-20261025-0001" />);
    expect(await screen.findByRole("heading", { name: "Order TS-20261025-0001" })).toBeInTheDocument();
    expect(screen.getByText("Kaju Katli")).toBeInTheDocument();
    expect(screen.getByTestId("order-total")).toHaveTextContent("₹2,400");
    expect(screen.getByText("Confirmed").closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("AC-5.1 says when an order doesn't exist", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { code: "not_found", message: "x" } }, 404)));
    render(<OrderStatus orderId="TS-20990101-0001" />);
    expect(await screen.findByText(/couldn.t find order TS-20990101-0001/i)).toBeInTheDocument();
  });

  it("shows a cancelled order as cancelled", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ...ORDER, stage: "cancelled" })));
    render(<OrderStatus orderId="TS-20261025-0001" />);
    expect(await screen.findByText(/This order was cancelled/)).toBeInTheDocument();
  });
});
