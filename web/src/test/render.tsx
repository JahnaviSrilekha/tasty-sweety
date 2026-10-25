import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { CartProvider, useCart } from "@/components/CartProvider";
import type { Cart } from "@/lib/cart";

/** Renders inside a CartProvider and exposes the live cart for assertions. */
export function renderWithCart(ui: ReactElement, initialCart: Cart = { lines: [] }) {
  const state: { cart: Cart } = { cart: initialCart };
  function Spy() {
    state.cart = useCart().cart;
    return null;
  }
  const result = render(
    <CartProvider initialCart={initialCart} storage={null}>
      {ui}
      <Spy />
    </CartProvider>,
  );
  return { ...result, cart: () => state.cart };
}
