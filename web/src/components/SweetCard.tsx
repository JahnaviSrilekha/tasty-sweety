"use client";
import Image from "next/image";
import { useId, useState } from "react";
import { catalog, type SizeId, type Sweet } from "@/lib/catalog";
import { formatWeight } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { useCart } from "./CartProvider";
import { buttonStyles } from "./ui";

/** `eager` loads the picture straight away, for the first cards on screen (NFR-1). */
export function SweetCard({ sweet, eager = false }: { sweet: Sweet; eager?: boolean }) {
  const { dispatch } = useCart();
  const [size, setSize] = useState<SizeId>("medium");
  const [added, setAdded] = useState<string | null>(null);
  const group = useId();
  const unavailable = !sweet.available;

  function add() {
    dispatch({ type: "add", sweetId: sweet.id, size });
    const label = catalog.sizes.find((s) => s.id === size)?.label.toLowerCase();
    setAdded(`Added a ${label} box of ${sweet.name}.`);
  }

  return (
    <article
      aria-label={sweet.name}
      data-available={sweet.available}
      className={`flex flex-col overflow-hidden rounded-2xl border border-line bg-surface ${unavailable ? "opacity-60 grayscale" : ""}`}
    >
      <Image
        src={sweet.image}
        alt=""
        width={320}
        height={240}
        unoptimized
        loading={eager ? "eager" : "lazy"}
        className="aspect-[4/3] w-full object-cover"
      />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-display text-lg font-semibold">{sweet.name}</h3>
          <p className="mt-1 text-sm text-muted">{sweet.description}</p>
        </div>

        <div role="radiogroup" aria-label={`Box size for ${sweet.name}`} className="grid grid-cols-3 gap-2">
          {catalog.sizes.map((s) => (
            <label
              key={s.id}
              className="flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-xl border border-line px-1 py-1.5 text-center text-xs has-[:checked]:border-brand has-[:checked]:bg-brand/10 has-[:disabled]:cursor-not-allowed has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent"
            >
              <input
                type="radio"
                name={group}
                value={s.id}
                checked={size === s.id}
                disabled={unavailable}
                onChange={() => setSize(s.id)}
                className="sr-only"
              />
              <span className="font-semibold">{s.label}</span>{" "}
              <span className="text-muted">{formatWeight(s.grams)}</span>{" "}
              <span className="font-semibold">{formatINR(sweet.prices[s.id])}</span>
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={add}
          disabled={unavailable}
          aria-label={`Add ${sweet.name} to cart`}
          className={`${buttonStyles.primary} mt-auto w-full`}
        >
          {unavailable ? "Unavailable" : "Add"}
        </button>
        <p role="status" aria-live="polite" className="min-h-5 text-xs text-ok">
          {added}
        </p>
      </div>
    </article>
  );
}
