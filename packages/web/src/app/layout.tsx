import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Intercept — Cross-Chain Kamino Liquidation Defense",
  description:
    "Zero-trust cross-chain liquidation protection powered by NEAR AI Cloud TEE, NEAR Policy Guardrail, v1.signer Chain Signatures, and NEAR Intents 1-Click.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh bg-background text-foreground antialiased selection:bg-zinc-800 selection:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
