import { describe, expect, it } from "vitest";
import { NEXT_STAGES, STAGES } from "./stages";

describe("AC-5.2 stage changes", () => {
  it("match the spec table exactly", () => {
    const pairs = STAGES.flatMap((from) => NEXT_STAGES[from].map((to) => `${from}->${to}`)).sort();
    expect(pairs).toEqual([
      "confirmed->cancelled",
      "confirmed->ready",
      "placed->cancelled",
      "placed->confirmed",
      "ready->completed",
    ]);
  });
});
