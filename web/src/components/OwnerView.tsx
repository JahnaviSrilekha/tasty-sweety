"use client";
import { useState } from "react";
import { ApiError, changeStage, listOrders, type Order } from "@/lib/api";
import { catalog } from "@/lib/catalog";
import { boxes, formatTime, sizeLabel } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { NEXT_STAGES, STAGE_LABELS, type Stage } from "@/lib/stages";
import { Button, Card, inputStyles } from "./ui";

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "That key isn't right.";
    if (err.status === 503) return "Owner access isn't set up on the server yet.";
    return err.message;
  }
  return "Something went wrong. Please try again.";
}

const STAGE_TONE: Record<Stage, string> = {
  placed: "bg-accent-soft text-accent",
  confirmed: "bg-brand/10 text-brand",
  ready: "bg-ok-soft text-ok",
  completed: "bg-surface-2 text-muted",
  cancelled: "bg-danger-soft text-danger",
};

/** The shop owner's order list (spec 001, AC-5.2 to AC-5.4). */
export function OwnerView() {
  const [key, setKey] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy("list");
    try {
      setOrders(await listOrders(key));
    } catch (err) {
      setOrders(null);
      setError(messageFor(err));
    } finally {
      setBusy(null);
    }
  }

  async function move(order: Order, to: Stage) {
    setError(null);
    setBusy(order.id);
    try {
      const updated = await changeStage(key, order.id, to);
      setOrders((list) => list?.map((o) => (o.id === updated.id ? updated : o)) ?? null);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={load} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label htmlFor="owner-key" className="text-sm font-medium">
              Owner key
            </label>
            <input
              id="owner-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="current-password"
              className={inputStyles}
            />
          </div>
          <Button type="submit" disabled={!key || busy === "list"}>
            {orders ? "Refresh" : "Show orders"}
          </Button>
        </form>
      </Card>

      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      )}

      {orders?.length === 0 && <p className="text-muted">No orders yet.</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {orders?.map((o) => (
          <article key={o.id} aria-label={`Order ${o.id}`} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{o.id}</h2>
                <p className="text-xs text-muted">{formatTime(o.createdAt)}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_TONE[o.stage]}`}>
                Stage: {STAGE_LABELS[o.stage]}
              </span>
            </div>
            <div className="text-sm">
              <p className="font-medium">{o.customer.name}</p>
              <p>
                <a href={`tel:+91${o.customer.phone}`} className="text-brand underline-offset-4 hover:underline">
                  {o.customer.phone}
                </a>
              </p>
              <p className="text-muted">
                {o.customer.fulfilment === "delivery" ? `Delivery: ${o.customer.address}` : "Pickup from the shop"}
              </p>
            </div>
            <ul className="space-y-0.5 text-sm">
              {o.lines.map((l) => (
                <li key={`${l.sweetId}-${l.size}`} className="flex justify-between gap-2">
                  <span>
                    {l.name} · {sizeLabel(catalog, l.size)} · {boxes(l.qty)}
                  </span>
                  <span className="tabular-nums">{formatINR(l.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <p className="flex justify-between border-t border-line pt-2 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatINR(o.total)}</span>
            </p>
            {NEXT_STAGES[o.stage].length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted">Move to</span>
                {NEXT_STAGES[o.stage].map((to) => (
                  <Button
                    key={to}
                    variant={to === "cancelled" ? "secondary" : "primary"}
                    disabled={busy === o.id}
                    onClick={() => move(o, to)}
                  >
                    {STAGE_LABELS[to]}
                  </Button>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
