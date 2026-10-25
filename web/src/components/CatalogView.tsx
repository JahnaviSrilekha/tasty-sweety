"use client";
import { useState } from "react";
import { catalog, filterSweets } from "@/lib/catalog";
import { SweetCard } from "./SweetCard";
import { inputStyles } from "./ui";

export function CatalogView() {
  const [query, setQuery] = useState("");
  const sweets = filterSweets(catalog.sweets, query);
  return (
    <section aria-labelledby="catalog-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="catalog-heading" className="font-display text-xl font-semibold">
          All sweets
        </h2>
        <input
          type="search"
          aria-label="Search sweets"
          placeholder="Search sweets or occasions"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${inputStyles} sm:max-w-xs`}
        />
      </div>
      {sweets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">
          No sweets match “{query.trim()}”.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sweets.map((sweet, i) => (
            <SweetCard key={sweet.id} sweet={sweet} eager={i < 3} />
          ))}
        </div>
      )}
    </section>
  );
}
