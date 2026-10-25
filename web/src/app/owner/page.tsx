import type { Metadata } from "next";
import { OwnerView } from "@/components/OwnerView";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Orders (owner)", robots: { index: false } };

export default function OwnerPage() {
  return (
    <>
      <PageTitle sub="For the shop owner. Enter the owner key to see and move orders.">Orders</PageTitle>
      <OwnerView />
    </>
  );
}
