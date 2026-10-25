// Checkout customer details (spec 001, AC-4.1). Same rules as api/app/checkout.py;
// both run shared/checkout-cases.json. The server checks again.
import { z } from "zod";

export const customerSchema = z
  .strictObject({
    name: z.string().trim().min(2, "Name needs at least 2 letters").max(60, "Name is too long"),
    phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number"),
    fulfilment: z.enum(["pickup", "delivery"]),
    address: z.string().trim().min(10, "Address is too short").max(300, "Address is too long").optional(),
  })
  .refine((c) => c.fulfilment !== "delivery" || c.address !== undefined, {
    message: "Address is needed for delivery",
    path: ["address"],
  })
  .transform(({ address, ...rest }) => (rest.fulfilment === "delivery" ? { ...rest, address } : rest));

export type Customer = { name: string; phone: string; fulfilment: "pickup" | "delivery"; address?: string };

// The schema's output must fit Customer.
const _fits: (c: z.output<typeof customerSchema>) => Customer = (c) => c;
void _fits;
