import { describe, expect, it } from "vitest";
import { catalog, filterSweets } from "./catalog";

describe("AC-1.4 search", () => {
  it.each([
    ["", 6],
    ["   ", 6],
    ["KAJU", 1],
    ["syrup", 2],          // tag on gulab jamun and rasgulla
    ["diwali", 2],         // tag on kaju katli and soan papdi
    ["pak", 1],
    ["pizza", 0],
  ])("%j finds %i sweets", (query, count) => {
    expect(filterSweets(catalog.sweets, query)).toHaveLength(count);
  });

  it("keeps catalog order", () => {
    expect(filterSweets(catalog.sweets, "syrup").map((s) => s.id)).toEqual(["gulab-jamun", "rasgulla"]);
  });
});
