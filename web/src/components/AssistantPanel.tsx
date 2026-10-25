"use client";
import { useEffect, useRef, useState } from "react";
import { runAssistant, type Proposal } from "@/lib/agui";
import { boxes } from "@/lib/format";
import type { Line } from "@/lib/pricing";
import { useOnline } from "@/lib/useOnline";
import { useCart } from "./CartProvider";
import { ProposalCard } from "./ProposalCard";
import { Button, Card, inputStyles } from "./ui";

export const MAX_MESSAGE_CHARS = 500;

/** "Type your order" (spec 001, REQ-3). Talks to the api over AG-UI. */
export function AssistantPanel() {
  const online = useOnline();
  const { dispatch } = useCart();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const threadId = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || busy || !online) return;
    abort.current?.abort();
    abort.current = new AbortController();
    threadId.current ??= crypto.randomUUID();
    setBusy(true);
    setReply("");
    setError(null);
    setProposal(null);
    setAdded(null);
    await runAssistant(
      message,
      threadId.current,
      {
        onProposal: setProposal,
        onText: (delta) => setReply((r) => r + delta),
        onError: setError,
      },
      abort.current.signal,
    );
    setBusy(false);
  }

  function addToCart(lines: Line[]) {
    dispatch({ type: "addMany", lines });
    setProposal(null);
    setReply("");
    setText("");
    setAdded(`Added ${boxes(lines.reduce((n, l) => n + l.qty, 0))} to your cart.`);
  }

  return (
    <Card aria-labelledby="assistant-heading" className="space-y-3">
      <div>
        <h2 id="assistant-heading" className="font-display text-xl font-semibold">
          Type your order
        </h2>
        <p className="text-sm text-muted">Say it your way, and we’ll fill the boxes for you to check.</p>
      </div>
      <form onSubmit={ask} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="assistant-input" className="sr-only">
          What would you like to order?
        </label>
        <input
          id="assistant-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_MESSAGE_CHARS}
          disabled={!online}
          placeholder="e.g. 2 large kaju katli and a small box of ladoo"
          autoComplete="off"
          className={inputStyles}
        />
        <Button type="submit" disabled={!online || busy || !text.trim()} className="sm:w-28">
          {busy ? "Thinking…" : "Ask"}
        </Button>
      </form>
      {!online && <p className="text-sm text-muted">The assistant needs an internet connection.</p>}
      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      )}
      {reply && (
        <p aria-live="polite" className="text-ink">
          {reply}
        </p>
      )}
      {proposal && <ProposalCard proposal={proposal} onAdd={addToCart} onDismiss={() => setProposal(null)} />}
      <p role="status" aria-live="polite" className="text-sm text-ok empty:hidden">
        {added}
      </p>
    </Card>
  );
}
