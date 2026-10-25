"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ApiError, placeOrder } from "@/lib/api";
import { catalog } from "@/lib/catalog";
import { boxes, sizeLabel } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { customerSchema } from "@/lib/schemas";
import { useOnline } from "@/lib/useOnline";
import { useCart } from "./CartProvider";
import { Button, ButtonLink, Card, inputStyles } from "./ui";

type Fulfilment = "pickup" | "delivery";
type FieldErrors = Partial<Record<"name" | "phone" | "address", string>>;

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Checkout (spec 001, REQ-4). */
export function CheckoutForm() {
  const router = useRouter();
  const online = useOnline();
  const { cart, quote, hydrated, dispatch } = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfilment, setFulfilment] = useState<Fulfilment>("pickup");
  const [address, setAddress] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [newTotal, setNewTotal] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [placedId, setPlacedId] = useState<string | null>(null);
  // One key per checkout attempt, kept across retries so a double tap makes one order (AC-4.5).
  const idempotencyKey = useRef<string | null>(null);

  const expectedTotal = newTotal ?? quote.total;

  if (placedId) return <p className="text-muted">Order {placedId} placed. Opening your order…</p>;
  if (!hydrated) return <p className="text-muted">Loading your cart…</p>;
  if (cart.lines.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-muted">Your cart is empty.</p>
        <ButtonLink href="/" variant="secondary" className="mt-3">
          Browse sweets
        </ButtonLink>
      </Card>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    const parsed = customerSchema.safeParse({
      name,
      phone,
      fulfilment,
      address: fulfilment === "delivery" && address.trim() ? address : undefined,
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const result = await placeOrder({ lines: cart.lines, customer: parsed.data, expectedTotal }, idempotencyKey.current);
      if (result.kind === "total_changed") {
        setNewTotal(result.quote.total);
        setProblem(
          `The total is now ${formatINR(result.quote.total)} (it was ${formatINR(expectedTotal)}). Please check and place the order again.`,
        );
        return;
      }
      setPlacedId(result.order.id);
      dispatch({ type: "clear" });
      router.push(`/orders/${result.order.id}`);
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const invalid = (field: keyof FieldErrors) =>
    errors[field] ? { "aria-invalid": true, "aria-describedby": `${field}-error` } : {};

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
      <Card className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Your details</h2>
        <Field id="name" label="Name" error={errors.name}>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={inputStyles} {...invalid("name")} />
        </Field>
        <Field id="phone" label="Mobile number" error={errors.phone}>
          <input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            placeholder="10 digits"
            className={inputStyles}
            {...invalid("phone")}
          />
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">How do you want it?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["pickup", "Pickup from the shop"],
                ["delivery", "Delivery"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line px-3 has-[:checked]:border-brand has-[:checked]:bg-brand/10"
              >
                <input
                  type="radio"
                  name="fulfilment"
                  value={value}
                  checked={fulfilment === value}
                  onChange={() => setFulfilment(value)}
                  className="size-4 accent-[var(--brand)]"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {fulfilment === "delivery" && (
          <Field id="address" label="Delivery address" error={errors.address}>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              maxLength={300}
              autoComplete="street-address"
              className={`${inputStyles} py-2`}
              {...invalid("address")}
            />
            <p className="text-xs text-muted">Delivery is free. The shop will call to confirm a time.</p>
          </Field>
        )}
      </Card>

      <Card className="space-y-3 lg:sticky lg:top-20">
        <h2 className="font-display text-lg font-semibold">Your order</h2>
        <ul className="space-y-1 text-sm">
          {quote.lines.map((l) => (
            <li key={`${l.sweetId}-${l.size}`} className="flex justify-between gap-2">
              <span>
                {l.name} · {sizeLabel(catalog, l.size)} · {boxes(l.qty)}
              </span>
              <span className="tabular-nums">{formatINR(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="text-muted">Total</span>
          <span className="text-xl font-semibold tabular-nums">{formatINR(expectedTotal)}</span>
        </div>
        {problem && (
          <p role="alert" className="rounded-xl bg-accent-soft p-3 text-sm">
            {problem}
          </p>
        )}
        {!online && <p className="text-sm text-muted">You’re offline. Connect to the internet to place your order.</p>}
        <Button type="submit" disabled={!online || busy} className="w-full">
          {busy ? "Placing order…" : `Place order for ${formatINR(expectedTotal)}`}
        </Button>
        <p className="text-xs text-muted">Pay at pickup or on delivery.</p>
      </Card>
    </form>
  );
}
