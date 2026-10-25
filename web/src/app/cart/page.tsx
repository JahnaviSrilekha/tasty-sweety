import type { Metadata } from "next";
import { CartView } from "@/components/CartView";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <>
      <PageTitle>Your cart</PageTitle>
      <CartView />
    </>
  );
}
