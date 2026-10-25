// The cart (spec 001, REQ-2). Pure functions only: same cart + action -> same cart.
import { z } from "zod";
import { SIZE_IDS, findSweet, type Catalog, type SizeId } from "./catalog";
import type { Line } from "./pricing";

export type Cart = { lines: Line[] };

export type CartAction =
  | { type: "add"; sweetId: string; size: SizeId }
  | { type: "setQty"; sweetId: string; size: SizeId; qty: number }
  | { type: "remove"; sweetId: string; size: SizeId }
  | { type: "addMany"; lines: Line[] }
  | { type: "replace"; cart: Cart }
  | { type: "clear" };

export const EMPTY_CART: Cart = { lines: [] };
export const MIN_QTY = 1;
export const MAX_QTY = 99;
export const CART_STORAGE_KEY = "ts.cart.v1";

const clampQty = (qty: number) => Math.min(MAX_QTY, Math.max(MIN_QTY, qty));
const sameLine = (a: { sweetId: string; size: SizeId }, b: { sweetId: string; size: SizeId }) =>
  a.sweetId === b.sweetId && a.size === b.size;

/** Adds qty to the (sweetId, size) line, creating it if needed. Unavailable or unknown sweets are ignored (AC-1.3). */
function addQty(cart: Cart, catalog: Catalog, line: Line): Cart {
  if (!findSweet(catalog, line.sweetId)?.available) return cart;
  if (!Number.isInteger(line.qty) || line.qty < MIN_QTY) return cart;
  const existing = cart.lines.find((l) => sameLine(l, line));
  if (!existing) return { lines: [...cart.lines, { ...line, qty: clampQty(line.qty) }] };
  return {
    lines: cart.lines.map((l) => (l === existing ? { ...l, qty: clampQty(l.qty + line.qty) } : l)),
  };
}

export function cartReducerFor(catalog: Catalog) {
  return function cartReducer(cart: Cart, action: CartAction): Cart {
    switch (action.type) {
      case "add":
        return addQty(cart, catalog, { sweetId: action.sweetId, size: action.size, qty: 1 });
      case "addMany":
        return action.lines.reduce((c, line) => addQty(c, catalog, line), cart);
      case "setQty":
        if (!Number.isInteger(action.qty)) return cart;
        return {
          lines: cart.lines.map((l) => (sameLine(l, action) ? { ...l, qty: clampQty(action.qty) } : l)),
        };
      case "remove":
        return { lines: cart.lines.filter((l) => !sameLine(l, action)) };
      case "replace":
        return action.cart;
      case "clear":
        return EMPTY_CART;
    }
  };
}

/** Drops lines whose sweet or size is no longer in the catalog and says which (AC-2.5). */
export function reconcileCart(cart: Cart, catalog: Catalog): { cart: Cart; removed: Line[] } {
  const keep: Line[] = [];
  const removed: Line[] = [];
  for (const line of cart.lines) {
    const sweet = findSweet(catalog, line.sweetId);
    (sweet && SIZE_IDS.includes(line.size) ? keep : removed).push(line);
  }
  return { cart: removed.length ? { lines: keep } : cart, removed };
}

export const canCheckout = (cart: Cart) => cart.lines.length > 0;

const storedCart = z.object({
  lines: z.array(
    z.object({
      sweetId: z.string(),
      size: z.enum(SIZE_IDS),
      qty: z.number().int().min(MIN_QTY).max(MAX_QTY),
    }),
  ),
});

/** Reads the saved cart (AC-2.4). Missing, corrupt or blocked storage gives an empty cart. */
export function loadCart(storage: Storage): Cart {
  try {
    const raw = storage.getItem(CART_STORAGE_KEY);
    if (!raw) return EMPTY_CART;
    const parsed = storedCart.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_CART;
  } catch {
    return EMPTY_CART;
  }
}

export function saveCart(cart: Cart, storage: Storage): void {
  try {
    storage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Private mode or full storage: the cart just isn't kept between visits.
  }
}
