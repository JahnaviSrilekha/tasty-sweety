import type { Metadata } from "next";
import { CheckoutForm } from "@/components/CheckoutForm";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <>
      <PageTitle sub="Pickup or free delivery. Pay when you collect.">Checkout</PageTitle>
      <CheckoutForm />
    </>
  );
}
