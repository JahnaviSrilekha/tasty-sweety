import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderStatus } from "@/components/OrderStatus";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

async function OrderFromParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderStatus orderId={decodeURIComponent(id)} />;
}

export default function OrderPage({ params }: PageProps<"/orders/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading your order…</p>}>
      <OrderFromParams params={params} />
    </Suspense>
  );
}
