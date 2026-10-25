// Prices and totals (spec 001, AC-2.3). Must match api/app/pricing.py: both run
// shared/pricing-cases.json. The server's total is the one that counts (AC-4.2).
import { findSweet, type Catalog, type SizeId } from "./catalog";

export type Line = { sweetId: string; size: SizeId; qty: number };
export type PricedLine = Line & { name: string; unitPrice: number; lineTotal: number };
export type Quote = { lines: PricedLine[]; total: number };

export function priceLines(lines: Line[], catalog: Catalog): Quote {
  const priced = lines.map((line) => {
    const sweet = findSweet(catalog, line.sweetId);
    if (!sweet) throw new Error(`unknown sweet: ${line.sweetId}`);
    const unitPrice = sweet.prices[line.size];
    return { ...line, name: sweet.name, unitPrice, lineTotal: unitPrice * line.qty };
  });
  return { lines: priced, total: priced.reduce((sum, l) => sum + l.lineTotal, 0) };
}
