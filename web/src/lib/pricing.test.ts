import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalog } from "./catalog";
import { formatINR } from "./money";
import { priceLines, type Line } from "./pricing";

type Case = { name: string; lines: Line[]; lineTotals: number[]; total: number };
const cases: Case[] = JSON.parse(
  readFileSync(new URL("../../../shared/pricing-cases.json", import.meta.url), "utf8"),
).cases;

describe("AC-2.3 pricing", () => {
  it.each(cases)("shared case: $name", ({ lines, lineTotals, total }) => {
    const quote = priceLines(lines, catalog);
    expect(quote.lines.map((l) => l.lineTotal)).toEqual(lineTotals);
    expect(quote.total).toBe(total);
  });

  it("totals are whole paise", () => {
    const quote = priceLines(cases.at(-1)!.lines, catalog);
    expect(quote.lines.every((l) => Number.isInteger(l.lineTotal))).toBe(true);
    expect(Number.isInteger(quote.total)).toBe(true);
  });

  it("unknown sweet throws", () => {
    expect(() => priceLines([{ sweetId: "nope", size: "small", qty: 1 }], catalog)).toThrow();
  });
});

describe("AC-1.2 rupee formatting", () => {
  it.each([
    [0, "₹0"],
    [32000, "₹320"],
    [120000, "₹1,200"],
    [11880000, "₹1,18,800"],
  ])("%i paise -> %s", (paise, text) => {
    expect(formatINR(paise)).toBe(text);
  });

  it("rejects non-integer paise", () => {
    expect(() => formatINR(1.5)).toThrow();
  });
});
