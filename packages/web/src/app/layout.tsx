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
  metadataBase: new URL("https://intercept-inky.vercel.app"),
  title: {
    default: "Intercept — Non-Custodial Cross-Chain Liquidation Defense on NEAR",
    template: "%s · Intercept",
  },
  description:
    "Protect Solana Kamino positions from liquidation penalties using standby USDC on Base—built on NEAR Intents, Chain Signatures, Smart Contract Guardrails, and Confidential AI.",
  applicationName: "Intercept",
  keywords: [
    "NEAR Protocol",
    "NEAR AI Cloud",
    "Chain Signatures",
    "v1.signer",
    "NEAR Intents",
    "1-Click API",
    "Kamino Lend",
    "Solana",
    "Base",
    "DeFi Risk Infrastructure",
  ],
  openGraph: {
    type: "website",
    url: "https://intercept-inky.vercel.app",
    siteName: "Intercept",
    title: "Intercept — Non-Custodial Cross-Chain Liquidation Defense on NEAR",
    description:
      "Keep SOL collateral in self-custody on Solana and standby USDC on Base. NEAR Confidential AI, byte-level Rust guardrails, Chain Signatures, and Intents prevent liquidations automatically.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Intercept — Non-Custodial Cross-Chain Liquidation Defense on NEAR",
    description:
      "Cross-chain liquidation defense for DeFi borrowers built on NEAR Intents, Chain Signatures (v1.signer), Rust policy guardrails, and Confidential AI.",
    creator: "@NEARProtocol",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh bg-background text-foreground antialiased selection:bg-zinc-900 selection:text-zinc-50">
        {children}
      </body>
    </html>
  );
}
