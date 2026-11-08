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
    default: "Intercept — Zero-Trust Cross-Chain Liquidation Defense",
    template: "%s · Intercept",
  },
  description:
    "Autonomous Kamino Lend liquidation defense across Base and Solana powered by NEAR AI Cloud TEE, near-sdk-rs byte-level policy guardrails, v1.signer Chain Signatures, and NEAR Intents 1-Click.",
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
    "DeFi Security",
  ],
  openGraph: {
    type: "website",
    url: "https://intercept-inky.vercel.app",
    siteName: "Intercept",
    title: "Intercept — Zero-Trust Cross-Chain Liquidation Defense",
    description:
      "Non-custodial cross-chain Kamino rescue engine powered by NEAR AI Cloud TEE, deterministic Rust byte guardrails, v1.signer MPC, and NEAR Intents 1-Click.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Intercept — Zero-Trust Cross-Chain Liquidation Defense",
    description:
      "Non-custodial cross-chain Kamino rescue engine on NEAR: TEE reasoning + byte-level EIP-1559 & Solana V0 guardrails + v1.signer MPC + 1-Click.",
    creator: "@NEARProtocol",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh bg-background text-foreground antialiased selection:bg-zinc-200 selection:text-zinc-950">
        {children}
      </body>
    </html>
  );
}
