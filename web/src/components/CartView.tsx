"use client";
import Image from "next/image";
import Link from "next/link";
import { MAX_QTY, MIN_QTY } from "@/lib/cart";
import { catalog, findSweet } from "@/lib/catalog";
import { formatWeight, sizeLabel } from "@/lib/format";
import { formatINR } from "@/lib/money";
import type { Line } from "@/lib/pricing";
import { useCart } from "./CartProvider";
import { Button, ButtonLink, Card } from "./ui";

function QtyInput({ line, label }: { line: Line; label: string }) {
  const { dispatch } = useCart();
  return (
    <input
      type="number"
      inputMode="numeric"
      min={MIN_QTY}
      max={MAX_QTY}
      defaultValue={line.qty}
      aria-label={`Quantity of ${label}`}
      onBlur={(e) => {
        const qty = Number.parseInt(e.target.value, 10);
        if (Number.isNaN(qty)) e.target.value = String(line.qty);
        else dispatch({ type: "setQty", sweetId: line.sweetId, size: line.size, qty });
      }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="h-11 w-14 rounded-lg border border-line bg-surface text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}

export function RemovedNotice() {
  const { removed, dismissRemoved } = useCart();
  if (removed.length === 0) return null;
  const names = removed.map((l) => findSweet(catalog, l.sweetId)?.name ?? l.sweetId).join(", ");
  return (
    <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl bg-accent-soft p-3 text-sm">
      <p className="flex-1">
        {names} {removed.length === 1 ? "is" : "are"} no longer sold and {removed.length === 1 ? "was" : "were"} removed
        from your cart.
      </p>
      <Button variant="ghost" onClick={dismissRemoved} className="-my-2 !min-h-9 !px-3">
        OK
      </Button>
    </div>
  );
}

export function CartView() {
  const { cart, quote, hydrated, dispatch } = useCart();

  if (!hydrated) return <p className="text-muted">Loading your cart…</p>;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="min-w-0">
        <RemovedNotice />
        {cart.lines.length === 0 ? (
          <Card className="text-center">
            <p className="text-muted">Your cart is empty.</p>
            <ButtonLink href="/" variant="secondary" className="mt-3">
              Browse sweets
            </ButtonLink>
          </Card>
        ) : (
          <ul className="space-y-3">
            {quote.lines.map((l) => {
              const sweet = findSweet(catalog, l.sweetId)!;
              const size = sizeLabel(catalog, l.size);
              const label = `${l.name} ${size}`;
              const grams = catalog.sizes.find((s) => s.id === l.size)!.grams;
              return (
                <li key={`${l.sweetId}-${l.size}`} className="space-y-3 rounded-2xl border border-line bg-surface p-3">
                  <div className="flex gap-3">
                    <Image src={sweet.image} alt="" width={80} height={60} unoptimized className="h-15 w-20 shrink-0 rounded-xl object-cover" />
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">{l.name}</p>
                        <p className="text-sm text-muted">
                          {size} · {formatWeight(grams)} · {formatINR(l.unitPrice)} each
                        </p>
                      </div>
                      <span data-testid={`line-total-${l.sweetId}-${l.size}`} className="font-semibold tabular-nums">
                        {formatINR(l.lineTotal)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Decrease ${label}`}
                        onClick={() => dispatch({ type: "setQty", sweetId: l.sweetId, size: l.size, qty: l.qty - 1 })}
                        className="grid size-11 place-items-center rounded-full border border-line text-lg hover:bg-surface-2"
                      >
                        −
                      </button>
                      <QtyInput key={l.qty} line={l} label={label} />
                      <button
                        type="button"
                        aria-label={`Increase ${label}`}
                        onClick={() => dispatch({ type: "setQty", sweetId: l.sweetId, size: l.size, qty: l.qty + 1 })}
                        className="grid size-11 place-items-center rounded-full border border-line text-lg hover:bg-surface-2"
                      >
                        +
                      </button>
                    </div>
                    <Button
                      variant="ghost"
                      aria-label={`Remove ${label}`}
                      onClick={() => dispatch({ type: "remove", sweetId: l.sweetId, size: l.size })}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Card className="space-y-3 lg:sticky lg:top-20">
        <div className="flex items-center justify-between">
          <span className="text-muted">Total</span>
          <span data-testid="cart-total" className="text-xl font-semibold tabular-nums">
            {formatINR(quote.total)}
          </span>
        </div>
        <p className="text-xs text-muted">The shop confirms the final price when you place the order.</p>
        {cart.lines.length === 0 ? (
          <Button disabled className="w-full">
            Checkout
          </Button>
        ) : (
          <ButtonLink href="/checkout" className="w-full">
            Checkout
          </ButtonLink>
        )}
        <Link href="/" className="block text-center text-sm text-muted underline-offset-4 hover:underline">
          Keep shopping
        </Link>
      </Card>
    </div>
  );
}
