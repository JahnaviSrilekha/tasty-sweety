"use client";
import { useState } from "react";
import type { Proposal } from "@/lib/agui";
import { catalog } from "@/lib/catalog";
import { boxes, sizeLabel } from "@/lib/format";
import { formatINR } from "@/lib/money";
import type { Line } from "@/lib/pricing";
import { Button } from "./ui";

const REASONS: Record<Proposal["rejected"][number]["reason"], string> = {
  unknown_sweet: "not in our shop",
  unavailable: "not available right now",
  bad_quantity: "quantity must be 1 to 99",
  not_understood: "not understood",
};

/** Shows what the assistant proposes. Nothing reaches the cart until "Add to cart" (AC-3.5). */
export function ProposalCard({
  proposal,
  onAdd,
  onDismiss,
}: {
  proposal: Proposal;
  onAdd: (lines: Line[]) => void;
  onDismiss: () => void;
}) {
  const [lines, setLines] = useState(proposal.lines);
  const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  return (
    <div className="rounded-2xl border border-line bg-surface-2 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Suggested for your cart</h3>
      {lines.length > 0 ? (
        <ul className="mt-2 divide-y divide-line">
          {lines.map((l) => {
            const size = sizeLabel(catalog, l.size);
            return (
              <li key={`${l.sweetId}-${l.size}`} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{l.name}</p>
                  <p className="text-sm text-muted">
                    {size} · {boxes(l.qty)}
                    {l.sizeAssumed && (
                      <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                        size assumed
                      </span>
                    )}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{formatINR(l.lineTotal)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${l.name} ${size} from suggestion`}
                  onClick={() => setLines((ls) => ls.filter((x) => x !== l))}
                  className="grid size-11 place-items-center rounded-full text-xl text-muted hover:bg-surface hover:text-ink"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">Nothing left to add.</p>
      )}

      {proposal.rejected.length > 0 && (
        <div className="mt-3 rounded-xl bg-surface p-3 text-sm">
          <p className="font-semibold">Couldn’t add</p>
          <ul className="mt-1 list-disc pl-5 text-muted">
            {proposal.rejected.map((r, i) => (
              <li key={i}>
                {r.text} — {REASONS[r.reason]}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <span className="text-sm text-muted">Total</span>
        <span data-testid="proposal-total" className="text-lg font-semibold tabular-nums">
          {formatINR(total)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={lines.length === 0}
          onClick={() => onAdd(lines.map(({ sweetId, size, qty }) => ({ sweetId, size, qty })))}
          className="flex-1 sm:flex-none"
        >
          Add to cart
        </Button>
        <Button variant="secondary" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
