// The shared catalog (spec 001, REQ-1), copied from ../shared by scripts/sync-catalog.mjs.
import data from "@/generated/catalog.json";

export type SizeId = "small" | "medium" | "large";
export const SIZE_IDS: readonly SizeId[] = ["small", "medium", "large"];

export type Size = { id: SizeId; label: string; grams: number };

export type Sweet = {
  id: string;
  name: string;
  description: string;
  image: string;
  tags: string[];
  aliases: string[];
  available: boolean;
  prices: Record<SizeId, number>;
};

export type Catalog = { currency: "INR"; sizes: Size[]; sweets: Sweet[] };

export const catalog = data as Catalog;

export function findSweet(c: Catalog, sweetId: string): Sweet | undefined {
  return c.sweets.find((s) => s.id === sweetId);
}
