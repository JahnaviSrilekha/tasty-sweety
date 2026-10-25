// Money is integer paise everywhere (constitution §2). Display only, never for maths.
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** 120000 -> "₹1,200" (AC-1.2). */
export function formatINR(paise: number): string {
  if (!Number.isInteger(paise)) throw new Error(`paise must be an integer, got ${paise}`);
  return inr.format(paise / 100);
}
