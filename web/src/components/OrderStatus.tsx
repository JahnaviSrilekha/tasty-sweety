"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiError, getOrder, type PublicOrder } from "@/lib/api";
import { catalog } from "@/lib/catalog";
import { boxes, formatTime, sizeLabel } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { PROGRESS, STAGE_LABELS } from "@/lib/stages";
import { Button, ButtonLink, Card } from "./ui";

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error"; message: string }
  | { kind: "ready"; order: PublicOrder };

/** Order status (spec 001, AC-5.1). Shows no customer details (AC-5.5). */
export function OrderStatus({ orderId }: { orderId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    try {
      const order = await getOrder(orderId);
      setState(order ? { kind: "ready", order } : { kind: "missing" });
    } catch (err) {
      setState({ kind: "error", message: err instanceof ApiError ? err.message : "Something went wrong." });
    }
  }, [orderId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching on mount is the point here
    void load();
  }, [load]);

  if (state.kind === "loading") return <p className="text-muted">Loading your order…</p>;
  if (state.kind === "missing")
    return (
      <Card className="text-center">
        <p>We couldn’t find order {orderId}.</p>
        <ButtonLink href="/" variant="secondary" className="mt-3">
          Back to the shop
        </ButtonLink>
      </Card>
    );
  if (state.kind === "error")
    return (
      <Card className="space-y-3">
        <p role="alert">{state.message}</p>
        <Button variant="secondary" onClick={load}>
          Try again
        </Button>
      </Card>
    );

  const { order } = state;
  const reachedAt = new Map(order.history.map((h) => [h.to, h.at]));
  const cancelled = order.stage === "cancelled";

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold">Order {order.id}</h1>
            <p className="text-sm text-muted">
              Placed {formatTime(order.createdAt)} · {order.fulfilment === "delivery" ? "Delivery" : "Pickup from the shop"}
            </p>
          </div>
          <Button variant="secondary" onClick={load}>
            Refresh
          </Button>
        </div>

        {cancelled ? (
          <p className="rounded-xl bg-danger-soft p-3 text-danger">This order was cancelled. Please call the shop if this is unexpected.</p>
        ) : (
          <ol className="grid grid-cols-4 gap-2">
            {PROGRESS.map((stage, i) => {
              const done = reachedAt.has(stage);
              const current = order.stage === stage;
              return (
                <li key={stage} aria-current={current ? "step" : undefined} className="flex flex-col gap-1.5">
                  <span className={`h-1.5 rounded-full ${done ? "bg-brand" : "bg-line"}`} />
                  <span className={`text-xs font-semibold sm:text-sm ${done ? "text-ink" : "text-muted"}`}>
                    {STAGE_LABELS[stage]}
                  </span>
                  <span className="text-[11px] text-muted sm:text-xs">
                    {done ? formatTime(reachedAt.get(stage)!) : i === PROGRESS.indexOf(order.stage) + 1 ? "Next" : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-semibold">What you ordered</h2>
        <ul className="space-y-1 text-sm">
          {order.lines.map((l) => (
            <li key={`${l.sweetId}-${l.size}`} className="flex justify-between gap-2">
              <span>
                <span>{l.name}</span> · {sizeLabel(catalog, l.size)} · {boxes(l.qty)}
              </span>
              <span className="tabular-nums">{formatINR(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t border-line pt-3">
          <span className="text-muted">Total</span>
          <span data-testid="order-total" className="text-xl font-semibold tabular-nums">
            {formatINR(order.total)}
          </span>
        </p>
      </Card>
    </div>
  );
}
