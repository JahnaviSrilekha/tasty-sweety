// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CART_STORAGE_KEY } from "@/lib/cart";
import { renderWithCart } from "@/test/render";
import { CartProvider } from "./CartProvider";
import { CartView } from "./CartView";

const TWO_LINES = {
  lines: [
    { sweetId: "kaju-katli", size: "large" as const, qty: 2 },
    { sweetId: "rasgulla", size: "small" as const, qty: 1 },
  ],
};

describe("CartView", () => {
  it("AC-2.3 shows line totals and the cart total", () => {
    renderWithCart(<CartView />, TWO_LINES);
    expect(screen.getByTestId("line-total-kaju-katli-large")).toHaveTextContent("₹2,400");
    expect(screen.getByTestId("line-total-rasgulla-small")).toHaveTextContent("₹150");
    expect(screen.getByTestId("cart-total")).toHaveTextContent("₹2,550");
  });

  it("AC-2.2 changes quantity with the stepper and removes a line", async () => {
    const user = userEvent.setup();
    const { cart } = renderWithCart(<CartView />, TWO_LINES);
    await user.click(screen.getByRole("button", { name: "Increase Kaju Katli Large" }));
    await user.click(screen.getByRole("button", { name: "Decrease Rasgulla Small" }));
    expect(cart().lines.map((l) => l.qty)).toEqual([3, 1]); // 1 is the minimum
    await user.click(screen.getByRole("button", { name: "Remove Rasgulla Small" }));
    expect(cart().lines).toEqual([{ sweetId: "kaju-katli", size: "large", qty: 3 }]);
    expect(screen.getByTestId("cart-total")).toHaveTextContent("₹3,600");
  });

  it("AC-2.2 quantity can be typed and is kept between 1 and 99", async () => {
    const user = userEvent.setup();
    const { cart } = renderWithCart(<CartView />, TWO_LINES);
    const qty = screen.getByRole("spinbutton", { name: "Quantity of Kaju Katli Large" });
    await user.clear(qty);
    await user.type(qty, "150");
    await user.tab();
    expect(cart().lines[0].qty).toBe(99);
  });

  it("AC-2.6 checkout is disabled while the cart is empty", () => {
    renderWithCart(<CartView />);
    expect(screen.getByText(/Your cart is empty/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Checkout" })).toBeDisabled();
  });

  it("AC-2.6 checkout is a link when the cart has items", () => {
    renderWithCart(<CartView />, TWO_LINES);
    expect(screen.getByRole("link", { name: "Checkout" })).toHaveAttribute("href", "/checkout");
  });

  it("AC-2.4 AC-2.5 reads the saved cart and says which item was removed", async () => {
    const data = new Map([[CART_STORAGE_KEY, JSON.stringify({
      lines: [
        { sweetId: "kaju-katli", size: "small", qty: 1 },
        { sweetId: "old-sweet", size: "small", qty: 2 },
      ],
    })]]);
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    } as unknown as Storage;
    render(<CartProvider storage={storage}><CartView /></CartProvider>);
    expect(await screen.findByRole("alert")).toHaveTextContent(/old-sweet.*no longer sold/i);
    expect(screen.getByTestId("cart-total")).toHaveTextContent("₹320");
    expect(JSON.parse(data.get(CART_STORAGE_KEY)!).lines).toHaveLength(1);
  });
});
