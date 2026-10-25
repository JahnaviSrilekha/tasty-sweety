// Small shared building blocks. Every control is at least 44px tall (AC-6.1).
import Link from "next/link";
import type { ComponentProps } from "react";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const buttonStyles = {
  primary: `${base} bg-brand text-on-brand hover:bg-brand-strong`,
  secondary: `${base} border border-line bg-surface text-ink hover:bg-surface-2`,
  ghost: `${base} text-muted hover:bg-surface-2 hover:text-ink`,
};

type Variant = keyof typeof buttonStyles;

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" className={`${buttonStyles[variant]} ${className}`} {...props} />;
}

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${buttonStyles[variant]} ${className}`} {...props} />;
}

export function Card({ className = "", ...props }: ComponentProps<"section">) {
  return <section className={`rounded-2xl border border-line bg-surface p-4 sm:p-6 ${className}`} {...props} />;
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <header className="mb-5">
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{children}</h1>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
    </header>
  );
}

export const inputStyles =
  "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none";
