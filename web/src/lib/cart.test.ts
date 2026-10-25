import { describe, expect, it } from "vitest";
import {
  CART_STORAGE_KEY,
  EMPTY_CART,
  canCheckout,
  cartReducerFor,
  loadCart,
  reconcileCart,
  saveCart,
  type Cart,
} from "./cart";
import { catalog, type Catalog } from "./catalog";

const reduce = cartReducerFor(catalog);
const cart = (...lines: Cart["lines"]): Cart => ({ lines });

describe("AC-2.1 add", () => {
  it("adds a new line with quantity 1", () => {
    expect(reduce(EMPTY_CART, { type: "add", sweetId: "kaju-katli", size: "small" })).toEqual(
      cart({ sweetId: "kaju-katli", size: "small", qty: 1 }),
    );
  });

  it("adds one to an existing line of the same sweet and size", () => {
    const start = cart({ sweetId: "kaju-katli", size: "small", qty: 2 });
    expect(reduce(start, { type: "add", sweetId: "kaju-katli", size: "small" })).toEqual(
      cart({ sweetId: "kaju-katli", size: "small", qty: 3 }),
    );
  });

  it("keeps a different size as its own line", () => {
    const start = cart({ sweetId: "kaju-katli", size: "small", qty: 1 });
    expect(reduce(start, { type: "add", sweetId: "kaju-katli", size: "large" }).lines).toHaveLength(2);
  });

  it("does not go above 99", () => {
    const start = cart({ sweetId: "kaju-katli", size: "small", qty: 99 });
    expect(reduce(start, { type: "add", sweetId: "kaju-katli", size: "small" })).toEqual(start);
  });
});

describe("AC-1.3 unavailable sweets", () => {
  const closed: Catalog = {
    ...catalog,
    sweets: catalog.sweets.map((s) => (s.id === "rasgulla" ? { ...s, available: false } : s)),
  };

  it("cannot be added", () => {
    const r = cartReducerFor(closed);
    expect(r(EMPTY_CART, { type: "add", sweetId: "rasgulla", size: "small" })).toEqual(EMPTY_CART);
    expect(
      r(EMPTY_CART, { type: "addMany", lines: [{ sweetId: "rasgulla", size: "small", qty: 2 }] }),
    ).toEqual(EMPTY_CART);
  });

  it("unknown sweets cannot be added either", () => {
    expect(reduce(EMPTY_CART, { type: "add", sweetId: "nope", size: "small" })).toEqual(EMPTY_CART);
  });
});

describe("AC-2.2 change quantity and remove", () => {
  const start = cart(
    { sweetId: "gulab-jamun", size: "medium", qty: 2 },
    { sweetId: "rasgulla", size: "small", qty: 1 },
  );

  it("sets a quantity", () => {
    const next = reduce(start, { type: "setQty", sweetId: "gulab-jamun", size: "medium", qty: 7 });
    expect(next.lines[0].qty).toBe(7);
  });

  it.each([
    [0, 1],
    [-5, 1],
    [150, 99],
  ])("clamps %i to %i", (qty, expected) => {
    const next = reduce(start, { type: "setQty", sweetId: "gulab-jamun", size: "medium", qty });
    expect(next.lines[0].qty).toBe(expected);
  });

  it("ignores a quantity that is not a whole number", () => {
    expect(reduce(start, { type: "setQty", sweetId: "gulab-jamun", size: "medium", qty: 2.5 })).toEqual(start);
  });

  it("removes a line", () => {
    expect(reduce(start, { type: "remove", sweetId: "gulab-jamun", size: "medium" })).toEqual(
      cart({ sweetId: "rasgulla", size: "small", qty: 1 }),
    );
  });

  it("clears the cart", () => {
    expect(reduce(start, { type: "clear" })).toEqual(EMPTY_CART);
  });
});

describe("AC-3.5 addMany (accepted proposal)", () => {
  it("merges with existing lines and caps at 99", () => {
    const start = cart({ sweetId: "mysore-pak", size: "large", qty: 95 });
    const next = reduce(start, {
      type: "addMany",
      lines: [
        { sweetId: "mysore-pak", size: "large", qty: 10 },
        { sweetId: "soan-papdi", size: "small", qty: 2 },
        { sweetId: "soan-papdi", size: "small", qty: 1 },
      ],
    });
    expect(next).toEqual(
      cart(
        { sweetId: "mysore-pak", size: "large", qty: 99 },
        { sweetId: "soan-papdi", size: "small", qty: 3 },
      ),
    );
  });
});

describe("AC-2.5 reconcile with the catalog", () => {
  it("removes lines whose sweet left the catalog and reports them", () => {
    const smaller: Catalog = { ...catalog, sweets: catalog.sweets.filter((s) => s.id !== "rasgulla") };
    const start = cart(
      { sweetId: "rasgulla", size: "small", qty: 1 },
      { sweetId: "kaju-katli", size: "large", qty: 1 },
    );
    expect(reconcileCart(start, smaller)).toEqual({
      cart: cart({ sweetId: "kaju-katli", size: "large", qty: 1 }),
      removed: [{ sweetId: "rasgulla", size: "small", qty: 1 }],
    });
  });

  it("removes lines with a size that is not in the catalog", () => {
    const start = { lines: [{ sweetId: "kaju-katli", size: "jumbo", qty: 1 }] } as unknown as Cart;
    expect(reconcileCart(start, catalog).cart).toEqual(EMPTY_CART);
  });

  it("changes nothing when every line is valid", () => {
    const start = cart({ sweetId: "kaju-katli", size: "large", qty: 1 });
    expect(reconcileCart(start, catalog)).toEqual({ cart: start, removed: [] });
  });
});

describe("AC-2.6 checkout needs items", () => {
  it("is disabled for an empty cart", () => {
    expect(canCheckout(EMPTY_CART)).toBe(false);
    expect(canCheckout(cart({ sweetId: "kaju-katli", size: "small", qty: 1 }))).toBe(true);
  });
});

describe("AC-2.4 saved cart", () => {
  function memoryStorage(): Storage {
    const data = new Map<string, string>();
    return {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
      clear: () => data.clear(),
      key: (i) => [...data.keys()][i] ?? null,
      get length() {
        return data.size;
      },
    };
  }

  it("round-trips through storage", () => {
    const storage = memoryStorage();
    const saved = cart({ sweetId: "kaju-katli", size: "small", qty: 4 });
    saveCart(saved, storage);
    expect(loadCart(storage)).toEqual(saved);
  });

  it("returns an empty cart when nothing is saved", () => {
    expect(loadCart(memoryStorage())).toEqual(EMPTY_CART);
  });

  it("returns an empty cart for corrupt data", () => {
    const storage = memoryStorage();
    storage.setItem(CART_STORAGE_KEY, "{not json");
    expect(loadCart(storage)).toEqual(EMPTY_CART);
    storage.setItem(CART_STORAGE_KEY, JSON.stringify({ lines: [{ sweetId: 1 }] }));
    expect(loadCart(storage)).toEqual(EMPTY_CART);
  });

  it("does not throw when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(loadCart(blocked)).toEqual(EMPTY_CART);
    expect(() => saveCart(EMPTY_CART, blocked)).not.toThrow();
  });
});
