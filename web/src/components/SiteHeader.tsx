"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useCart } from "./CartProvider";

function NavLinks({ path }: { path: string | null }) {
  const { count, hydrated } = useCart();
  const link = (href: string) =>
    `inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${
      path === href ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
    }`;
  return (
    <nav aria-label="Main" className="flex items-center gap-1">
      <Link href="/" className={link("/")}>
        Shop
      </Link>
      <Link href="/cart" className={link("/cart")}>
        Cart
        {hydrated && count > 0 && (
          <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs text-on-brand tabular-nums">
            {count}
            <span className="sr-only"> boxes</span>
          </span>
        )}
      </Link>
    </nav>
  );
}

function ActiveNav() {
  return <NavLinks path={usePathname()} />;
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
        <Link href="/" className="flex min-h-11 items-center gap-2">
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-brand font-display text-lg text-on-brand">
            T
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">Tasty Sweety</span>
        </Link>
        {/* The current path is only known at request time, so it streams in (Next 16 cache components). */}
        <Suspense fallback={<NavLinks path={null} />}>
          <ActiveNav />
        </Suspense>
      </div>
    </header>
  );
}
