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
  title: "INTERCEPT | Zero-Trust Cross-Chain Kamino Liquidation Defense",
  description:
    "Powered by NEAR AI Cloud (TEE), NEAR Policy Guardrail Contracts, NEAR Chain Signatures (v1.signer), and NEAR Intents (1-Click Swap API).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark`}
    >
      <body className="min-h-[100dvh] bg-zinc-950 text-zinc-100 antialiased selection:bg-emerald-500/20 selection:text-emerald-300 font-sans">
        {children}
      </body>
    </html>
  );
}
