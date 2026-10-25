"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { boxes } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { useCart } from "./CartProvider";

/** Bottom bar on phones with the cart count and total (design §7). */
export function CartBar() {
  const { count, quote, hydrated } = useCart();
  const path = usePathname();
  if (!hydrated || count === 0 || path === "/cart" || path === "/checkout") return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
      <Link
        href="/cart"
        className="flex min-h-12 items-center justify-between rounded-full bg-brand px-5 font-semibold text-on-brand"
      >
        <span>
          {boxes(count)} · <span className="tabular-nums">{formatINR(quote.total)}</span>
        </span>
        <span>View cart →</span>
      </Link>
    </div>
  );
}
