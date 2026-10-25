// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithCart } from "@/test/render";
import { jsonResponse } from "@/test/sse";
import { CheckoutForm } from "./CheckoutForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const CART = { lines: [{ sweetId: "kaju-katli", size: "large" as const, qty: 2 }] };
const ORDER = { id: "TS-20261025-0001", total: 240000 };

beforeEach(() => push.mockReset());

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Name"), "Asha Rao");
  await user.type(screen.getByLabelText("Mobile number"), "9876543210");
}

describe("CheckoutForm", () => {
  it("AC-4.1 checks the details before sending", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderWithCart(<CheckoutForm />, CART);
    await user.type(screen.getByLabelText("Name"), "A");
    await user.type(screen.getByLabelText("Mobile number"), "12345");
    await user.click(screen.getByRole("button", { name: /Place order/ }));
    expect(screen.getByText("Name needs at least 2 letters")).toBeInTheDocument();
    expect(screen.getByText("Enter a 10-digit mobile number")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-4.1 asks for an address only for delivery", async () => {
    const user = userEvent.setup();
    renderWithCart(<CheckoutForm />, CART);
    expect(screen.queryByLabelText("Delivery address")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Delivery/ }));
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /Place order/ }));
    expect(screen.getByText("Address is needed for delivery")).toBeInTheDocument();
  });

  it("AC-4.2 AC-4.4 places the order, empties the cart and opens the status page", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(ORDER, 201));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const { cart } = renderWithCart(<CheckoutForm />, CART);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Place order for ₹2,400" }));
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toEqual({
      lines: CART.lines,
      customer: { name: "Asha Rao", phone: "9876543210", fulfilment: "pickup" },
      expectedTotal: 240000,
    });
    expect(cart().lines).toEqual([]);
    expect(push).toHaveBeenCalledWith("/orders/TS-20261025-0001");
  });

  it("AC-4.3 AC-4.5 a changed total needs a second confirm, with the same request key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "total_changed", message: "changed" },
        quote: { lines: [], total: 250000 } }, 409))
      .mockResolvedValueOnce(jsonResponse(ORDER, 201));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderWithCart(<CheckoutForm />, CART);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Place order for ₹2,400" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The total is now ₹2,500");
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Place order for ₹2,500" }));
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const keys = calls.map(([, init]) => (init.headers as Record<string, string>)["Idempotency-Key"]);
    expect(keys[0]).toBe(keys[1]);
    expect(JSON.parse(calls[1][1].body as string).expectedTotal).toBe(250000);
    expect(push).toHaveBeenCalledWith("/orders/TS-20261025-0001");
  });

  it("shows server errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      jsonResponse({ error: { code: "unavailable", message: "Kaju Katli is not available right now" } }, 422)));
    const user = userEvent.setup();
    renderWithCart(<CheckoutForm />, CART);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /Place order/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Kaju Katli is not available right now");
  });

  it("AC-4.6 place order is disabled offline and says why", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderWithCart(<CheckoutForm />, CART);
    expect(screen.getByRole("button", { name: /Place order/ })).toBeDisabled();
    expect(screen.getByText(/You.re offline/)).toBeInTheDocument();
  });

  it("AC-2.6 an empty cart has nothing to check out", () => {
    renderWithCart(<CheckoutForm />);
    expect(screen.getByText(/Your cart is empty/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Place order/ })).not.toBeInTheDocument();
  });
});
