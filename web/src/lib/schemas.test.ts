import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { customerSchema } from "./schemas";

type Case = { name: string; valid: boolean; customer: unknown; normalised?: unknown };
const cases: Case[] = JSON.parse(
  readFileSync(new URL("../../../shared/checkout-cases.json", import.meta.url), "utf8"),
).cases;

describe("AC-4.1 checkout customer details", () => {
  it.each(cases)("shared case: $name", ({ valid, customer, normalised }) => {
    const result = customerSchema.safeParse(customer);
    expect(result.success).toBe(valid);
    if (valid) expect(result.data).toEqual(normalised);
  });
});
