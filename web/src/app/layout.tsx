import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import { Suspense } from "react";
import { CartBar } from "@/components/CartBar";
import { CartProvider } from "@/components/CartProvider";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Tasty Sweety", template: "%s · Tasty Sweety" },
  description: "Fresh Indian sweets by the box: small, medium and large.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf8f1" },
    { media: "(prefers-color-scheme: dark)", color: "#17100c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <CartProvider>
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 sm:pb-12">{children}</main>
          <Suspense fallback={null}>
            <CartBar />
          </Suspense>
        </CartProvider>
      </body>
    </html>
  );
}
