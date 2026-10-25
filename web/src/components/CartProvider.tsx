"use client";
// Holds the cart for the whole app (spec 001, REQ-2): reducer + saved copy in localStorage.
import { createContext, use, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { EMPTY_CART, cartReducerFor, loadCart, reconcileCart, saveCart, type Cart, type CartAction } from "@/lib/cart";
import { catalog } from "@/lib/catalog";
import { priceLines, type Line, type Quote } from "@/lib/pricing";

type CartContextValue = {
  cart: Cart;
  dispatch: (action: CartAction) => void;
  /** Display prices only; the server's total is the one that counts (AC-4.2). */
  quote: Quote;
  count: number;
  /** False until the saved cart has been read, so pages don't flash "empty". */
  hydrated: boolean;
  /** Lines dropped because they are no longer in the catalog (AC-2.5). */
  removed: Line[];
  dismissRemoved: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const reducer = cartReducerFor(catalog);

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function CartProvider({
  children,
  initialCart,
  storage,
}: {
  children: ReactNode;
  initialCart?: Cart;
  storage?: Storage | null;
}) {
  const [cart, dispatch] = useReducer(reducer, initialCart ?? EMPTY_CART);
  const [hydrated, setHydrated] = useState(initialCart !== undefined);
  const [removed, setRemoved] = useState<Line[]>([]);

  useEffect(() => {
    if (initialCart !== undefined) return;
    const store = storage === undefined ? browserStorage() : storage;
    const result = reconcileCart(store ? loadCart(store) : EMPTY_CART, catalog);
    dispatch({ type: "replace", cart: result.cart });
    // Reading browser storage has to wait until after the first render (no storage on the server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemoved(result.removed);
    setHydrated(true);
  }, [initialCart, storage]);

  useEffect(() => {
    if (!hydrated) return;
    const store = storage === undefined ? browserStorage() : storage;
    if (store) saveCart(cart, store);
  }, [cart, hydrated, storage]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      dispatch,
      quote: priceLines(cart.lines, catalog),
      count: cart.lines.reduce((n, l) => n + l.qty, 0),
      hydrated,
      removed,
      dismissRemoved: () => setRemoved([]),
    }),
    [cart, hydrated, removed],
  );
  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartContextValue {
  const value = use(CartContext);
  if (!value) throw new Error("useCart must be used inside <CartProvider>");
  return value;
}
