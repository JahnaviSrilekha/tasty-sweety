import type { Catalog, SizeId } from "./catalog";

export function formatWeight(grams: number): string {
  return grams >= 1000 ? `${grams / 1000} kg` : `${grams} g`;
}

export function sizeLabel(catalog: Catalog, size: SizeId): string {
  return catalog.sizes.find((s) => s.id === size)?.label ?? size;
}

export function boxes(qty: number): string {
  return `${qty} ${qty === 1 ? "box" : "boxes"}`;
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
