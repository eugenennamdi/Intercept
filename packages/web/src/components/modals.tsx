"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Check,
  Copy,
  CaretDown,
  CaretRight,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InterceptLogoMark } from "@/components/brand-logo";

export interface CustomPolicyConfig {
  userKaminoObligationPubkey: string;
  userSolanaWalletPubkey: string;
  minTriggerHfBps: number;
  maxPerActionUsdc: number;
  maxDailyUsdc: number;
  maxSlippageBps: number;
}

interface SolanaProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  publicKey?: { toString(): string };
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{
    publicKey: { toString(): string };
  }>;
}

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

declare global {
  interface Window {
    solana?: SolanaProvider;
    phantom?: { solana?: SolanaProvider };
    solflare?: SolanaProvider;
    ethereum?: EthereumProvider;
  }
}

/**
 * Shared accessible modal shell with concentric bezel framing and ESC / backdrop close
 */
function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-zinc-950/40 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`emil-enter bezel-shell w-full ${maxWidth} max-h-[90dvh] flex flex-col shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bezel-core flex flex-col max-h-[calc(90dvh-8px)] overflow-hidden">
          {/* Modal Header (Clean Title without redundant badge) */}
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 bg-white">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-950 text-zinc-50">
                  <InterceptLogoMark size={13} />
                </div>
                <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                  {title}
                </h2>
              </div>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="emil-press rounded-md border border-border bg-secondary/70 p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-white">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 1. WALKTHROUGH MODAL ("How Intercept Works")
 */
export function WalkthroughModal({
  open,
  onClose,
  onProceedToConfigure,
}: {
  open: boolean;
  onClose: () => void;
  onProceedToConfigure: () => void;
}) {
  const [step, setStep] = useState<number>(0);

  const steps = [
    {
      index: "01",
      shortLabel: "Keep Self-Custody",
      title: "Keep Full Self-Custody of Your Solana Position",
      summary:
        "Your SOL collateral and USDC loan stay inside your personal Solana wallet at all times.",
      whatYouDo:
        "You only provide your public Solana address or Kamino position address. Because Kamino Lend allows any authorized third party to pay down a loan's debt without granting withdrawal access, Intercept never asks for your private key or permission to touch your collateral.",
      guarantee:
        "Neither Intercept nor any automated agent can ever withdraw your SOL collateral.",
    },
    {
      index: "02",
      shortLabel: "Set Protection Rules",
      title: "Set Your Protection Rules & Spending Caps",
      summary:
        "You define strict rules that control exactly when a rescue triggers and the maximum USDC that can be spent.",
      whatYouDo:
        "You choose four settings: (1) the Kamino position to protect, (2) the Health Factor threshold that triggers a rescue (default 1.15x), (3) your maximum USDC limit per rescue, and (4) your maximum daily USDC limit.",
      guarantee:
        "Only you control these limits; the automated risk engine cannot override or raise them.",
    },
    {
      index: "03",
      shortLabel: "Hold Reserve on Base",
      title: "Hold Idle Reserve USDC on Base",
      summary:
        "A dedicated Base reserve vault holds your standby USDC until a market crash occurs.",
      whatYouDo:
        "You fund your Base reserve vault with USDC. As long as your Kamino Health Factor stays safely above your trigger threshold (e.g. 1.15x), 100% of your USDC remains untouched on Base.",
      guarantee:
        "Reserve funds are locked by on-chain rules to only pay down your specific Kamino loan.",
    },
    {
      index: "04",
      shortLabel: "Automatic Rescue",
      title: "Automatic Cross-Chain Rescue During a Crash",
      summary:
        "When a SOL price drop pushes your Health Factor below your threshold, Intercept bridges USDC from Base and repays your Solana debt in ~1.8 seconds.",
      whatYouDo:
        "Nothing manually — the risk engine measures the severity of the market drop, calculates the exact USDC repayment needed to restore a safe buffer (1.20x for mild dips or 1.45x for severe cascades), and settles the repayment automatically.",
      guarantee:
        "Every transaction is verified on-chain against your spending limits and destination address before execution.",
    },
  ];

  const current = steps[step];

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="How Intercept Works"
      subtitle="A 4-step overview of how your position is protected without giving up custody."
      maxWidth="max-w-2xl"
    >
      {/* Step Selector Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-[10px] bg-secondary p-1 border border-border">
        {steps.map((s, idx) => {
          const active = idx === step;
          return (
            <button
              key={s.index}
              type="button"
              onClick={() => setStep(idx)}
              className={`emil-press flex flex-col items-start rounded-[6px] px-2.5 py-2 text-left cursor-pointer ${
                active
                  ? "bg-white text-foreground shadow-xs border border-zinc-300"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="font-mono text-[10px] font-semibold text-zinc-500">
                STEP {s.index}
              </span>
              <span className="text-xs font-medium truncate w-full mt-0.5">
                {s.shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Step Detail Card */}
      <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <Badge variant="contrast">Step {current.index} of 04</Badge>
          <span className="text-[11px] font-medium text-muted-foreground">
            Non-Custodial Protection
          </span>
        </div>

        <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">
          {current.title}
        </h3>

        <p className="text-xs text-foreground leading-relaxed font-medium">
          {current.summary}
        </p>

        <div className="rounded-lg border border-border bg-white p-3.5 space-y-1.5 text-xs">
          <div className="font-semibold text-zinc-900">
            What you do in this step
          </div>
          <p className="text-muted-foreground leading-relaxed">
            {current.whatYouDo}
          </p>
        </div>

        <div className="rounded-lg border border-zinc-300 bg-zinc-100/80 px-3.5 py-2.5 text-xs text-zinc-900">
          <span className="font-semibold">Security Guarantee: </span>
          <span className="text-zinc-700">{current.guarantee}</span>
        </div>
      </div>

      {/* Summary Checklist of Proceeding */}
      <div className="rounded-lg border border-border p-3.5 space-y-2 text-xs">
        <div className="font-semibold text-foreground">
          What happens when you configure a policy:
        </div>
        <ul className="space-y-1.5 text-muted-foreground list-disc pl-4">
          <li>
            <strong className="text-foreground">Zero key sharing:</strong> You
            never share your Solana private key or grant collateral withdrawal
            permissions.
          </li>
          <li>
            <strong className="text-foreground">Custom limits:</strong> You set
            the exact Health Factor trigger and USDC spending caps for your
            position.
          </li>
          <li>
            <strong className="text-foreground">Risk-free simulation:</strong>{" "}
            You can test how your policy responds to simulated SOL flash crashes
            before depositing any funds.
          </li>
        </ul>
      </div>

      {/* Modal Footer Navigation */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={step === steps.length - 1}
            onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
          >
            Next Step
          </Button>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={() => {
            onClose();
            onProceedToConfigure();
          }}
        >
          <span>Configure Protection Policy</span>
          <CaretRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </ModalShell>
  );
}

/**
 * 2. CONFIGURE POLICY & CONNECT POSITION MODAL
 */
export function ConfigurePolicyModal({
  open,
  onClose,
  onOpenWalkthrough,
  currentConfig,
  derivedBaseVault,
  derivedSolanaPayer,
  nearContractId,
  onApplyConfig,
}: {
  open: boolean;
  onClose: () => void;
  onOpenWalkthrough: () => void;
  currentConfig: CustomPolicyConfig;
  derivedBaseVault: string;
  derivedSolanaPayer: string;
  nearContractId: string;
  onApplyConfig: (next: CustomPolicyConfig) => void;
}) {
  const [obligation, setObligation] = useState(
    currentConfig.userKaminoObligationPubkey
  );
  const [solanaWallet, setSolanaWallet] = useState(
    currentConfig.userSolanaWalletPubkey
  );
  const [triggerHf, setTriggerHf] = useState(
    currentConfig.minTriggerHfBps / 10000
  );
  const [maxPerAction, setMaxPerAction] = useState(
    currentConfig.maxPerActionUsdc
  );
  const [maxDaily, setMaxDaily] = useState(currentConfig.maxDailyUsdc);
  const [slippageBps, setSlippageBps] = useState(currentConfig.maxSlippageBps);

  const [walletStatus, setWalletStatus] = useState<string | null>(null);
  const [evmAddress, setEvmAddress] = useState<string | null>(null);
  const [copiedVault, setCopiedVault] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  useEffect(() => {
    setObligation(currentConfig.userKaminoObligationPubkey);
    setSolanaWallet(currentConfig.userSolanaWalletPubkey);
    setTriggerHf(currentConfig.minTriggerHfBps / 10000);
    setMaxPerAction(currentConfig.maxPerActionUsdc);
    setMaxDaily(currentConfig.maxDailyUsdc);
    setSlippageBps(currentConfig.maxSlippageBps);
  }, [currentConfig, open]);

  // Native Read-Only Phantom / Solflare detection
  const handleConnectSolana = useCallback(async () => {
    const provider =
      window.phantom?.solana ?? window.solana ?? window.solflare;
    if (!provider) {
      setWalletStatus(
        "No Solana wallet extension found. Paste any Kamino position address below or use the Mainnet preset."
      );
      return;
    }
    try {
      const resp = await provider.connect({ onlyIfTrusted: false });
      const pubkey = resp.publicKey.toString();
      setSolanaWallet(pubkey);
      setWalletStatus(
        `Connected Solana Wallet (Read-Only): ${pubkey.slice(0, 8)}...${pubkey.slice(-6)}`
      );
    } catch (err) {
      setWalletStatus(`Wallet connection cancelled: ${(err as Error).message}`);
    }
  }, []);

  // Native Base EVM Wallet detection (MetaMask / Rabby / Coinbase)
  const handleConnectBaseEvm = useCallback(async () => {
    if (!window.ethereum) {
      setWalletStatus(
        "No EVM wallet detected. Copy the Base Reserve Address below to transfer USDC from any wallet."
      );
      return;
    }
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (accounts?.[0]) {
        setEvmAddress(accounts[0]);
        await window.ethereum
          .request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x2105" }],
          })
          .catch(() => undefined);
      }
    } catch (err) {
      setWalletStatus(`EVM connection cancelled: ${(err as Error).message}`);
    }
  }, []);

  const minTriggerHfBps = Math.round(triggerHf * 10000);

  const handleCopyVault = () => {
    navigator.clipboard.writeText(derivedBaseVault);
    setCopiedVault(true);
    setTimeout(() => setCopiedVault(false), 1800);
  };

  const handleApplyLive = () => {
    onApplyConfig({
      userKaminoObligationPubkey:
        obligation.trim() || "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG",
      userSolanaWalletPubkey: solanaWallet.trim(),
      minTriggerHfBps,
      maxPerActionUsdc: maxPerAction,
      maxDailyUsdc: maxDaily,
      maxSlippageBps: slippageBps,
    });
    setAppliedSuccess(true);
    setTimeout(() => {
      setAppliedSuccess(false);
      onClose();
    }, 650);
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Configure Protection Policy"
      subtitle="Link your Solana position, choose your rescue thresholds, and set your USDC spending limits."
      maxWidth="max-w-2xl"
    >
      {/* Clear Context Banner Explaining What Proceeding Does */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border bg-secondary/60 px-3.5 py-2.5 text-xs">
        <span className="text-muted-foreground">
          <strong className="text-foreground">Non-Custodial:</strong> Linking a
          position only registers public addresses and safety thresholds. No
          private keys are shared.
        </span>
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenWalkthrough();
          }}
          className="font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600 shrink-0 cursor-pointer"
        >
          How It Works
        </button>
      </div>

      {/* STEP 1: Connect / Paste Solana Position */}
      <div className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 items-center rounded border border-zinc-300 bg-secondary px-1.5 font-mono text-[10px] font-semibold">
              STEP 1
            </span>
            <span className="text-sm font-semibold text-foreground">
              Your Kamino Position (Solana)
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleConnectSolana()}
          >
            <span>
              {solanaWallet
                ? `Connected: ${solanaWallet.slice(0, 6)}...`
                : "Connect Phantom / Solflare"}
            </span>
          </Button>
        </div>

        {walletStatus && (
          <div className="rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-[11px] font-mono text-muted-foreground">
            {walletStatus}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground block">
            Kamino Position Address
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={obligation}
              onChange={(e) => setObligation(e.target.value)}
              placeholder="Enter your Solana Kamino position address..."
              className="flex-1 rounded-md border border-border bg-secondary/40 px-3 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setObligation("H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG")
              }
            >
              Mainnet Preset
            </Button>
          </div>
        </div>
      </div>

      {/* STEP 2: Protection Threshold & Spending Limits */}
      <div className="space-y-4 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 items-center rounded border border-zinc-300 bg-secondary px-1.5 font-mono text-[10px] font-semibold">
              STEP 2
            </span>
            <span className="text-sm font-semibold text-foreground">
              Protection Threshold & Spending Limits
            </span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            Trigger &lt; {triggerHf.toFixed(2)}x
          </span>
        </div>

        {/* Trigger HF Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Minimum Health Factor Trigger
            </span>
            <span className="font-mono font-semibold text-foreground tabular-nums">
              {triggerHf.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min={1.05}
            max={1.35}
            step={0.01}
            value={triggerHf}
            onChange={(e) => setTriggerHf(Number(e.target.value))}
            className="shadcn-slider w-full"
          />
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground tabular-nums">
            <span>1.05x (Aggressive)</span>
            <span>1.15x (Recommended)</span>
            <span>1.25x (Conservative)</span>
            <span>1.35x (Early Buffer)</span>
          </div>
        </div>

        {/* Spend Caps & Slippage Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground block">
              Max Per-Rescue (USDC)
            </label>
            <select
              value={maxPerAction}
              onChange={(e) => setMaxPerAction(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 font-mono text-xs text-foreground"
            >
              <option value={2}>$2.00 USDC (Micro Test)</option>
              <option value={10}>$10.00 USDC (Small Test)</option>
              <option value={500}>$500.00 USDC</option>
              <option value={2500}>$2,500.00 USDC (Default)</option>
              <option value={10000}>$10,000.00 USDC</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground block">
              Max Daily Limit (USDC)
            </label>
            <select
              value={maxDaily}
              onChange={(e) => setMaxDaily(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 font-mono text-xs text-foreground"
            >
              <option value={10}>$10.00 USDC</option>
              <option value={50}>$50.00 USDC</option>
              <option value={1000}>$1,000.00 USDC</option>
              <option value={5000}>$5,000.00 USDC (Default)</option>
              <option value={25000}>$25,000.00 USDC</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground block">
              Max Bridge Slippage
            </label>
            <select
              value={slippageBps}
              onChange={(e) => setSlippageBps(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 font-mono text-xs text-foreground"
            >
              <option value={25}>0.25%</option>
              <option value={50}>0.50% (Default)</option>
              <option value={100}>1.00%</option>
            </select>
          </div>
        </div>
      </div>

      {/* STEP 3: Reserve & Settlement Accounts */}
      <div className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 items-center rounded border border-zinc-300 bg-secondary px-1.5 font-mono text-[10px] font-semibold">
              STEP 3
            </span>
            <span className="text-sm font-semibold text-foreground">
              Reserve & Settlement Accounts
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopyVault}>
            {copiedVault ? (
              <>
                <Check className="h-3.5 w-3.5" weight="bold" />
                <span>Copied Base Vault</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Base Vault Address</span>
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2.5">
            <div>
              <div className="text-[11px] text-muted-foreground">
                Base USDC Reserve Vault
              </div>
              <div className="font-mono font-medium text-foreground mt-0.5">
                {derivedBaseVault.slice(0, 10)}...{derivedBaseVault.slice(-8)}
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleConnectBaseEvm()}
            >
              {evmAddress
                ? `Base: ${evmAddress.slice(0, 6)}...`
                : "Connect Base Wallet"}
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2.5">
            <div>
              <div className="text-[11px] text-muted-foreground">
                Solana Repayment Account
              </div>
              <div className="font-mono font-medium text-foreground mt-0.5">
                {derivedSolanaPayer.slice(0, 10)}...
                {derivedSolanaPayer.slice(-8)}
              </div>
            </div>
            <a
              href={`https://nearblocks.io/address/${nearContractId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-zinc-900 hover:underline"
            >
              <span>Explorer</span>
              <ArrowSquareOut className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="default" size="sm" onClick={handleApplyLive}>
          {appliedSuccess ? (
            <>
              <Check className="h-3.5 w-3.5" weight="bold" />
              <span>Policy Saved</span>
            </>
          ) : (
            <span>Save Protection Policy</span>
          )}
        </Button>
      </div>
    </ModalShell>
  );
}

/**
 * 3. FAQ MODAL POPUP
 */
export function FaqModal({
  open,
  onClose,
  onOpenConfigure,
}: {
  open: boolean;
  onClose: () => void;
  onOpenConfigure: () => void;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: "Do I ever share my Solana private key or grant collateral withdrawal permissions?",
      a: "Never. Your Solana wallet holds your SOL collateral and USDC loan in complete self-custody. Kamino Lend natively allows any third-party account to pay down a loan's debt without granting any permission to withdraw collateral or borrow additional funds.",
    },
    {
      q: "What happens if the automated risk engine makes a bad decision or is compromised?",
      a: "Your funds remain protected by strict on-chain rules. Before any transaction is signed, the smart contract independently checks the destination address, token amount, and network fees. Any attempt to send funds to an unauthorized address, exceed your spending cap, or withdraw collateral is automatically rejected.",
    },
    {
      q: "How do I set up protection for my Kamino position?",
      a: "Click 'Configure Protection Policy' on the dashboard. Connect your wallet (read-only) or paste your Kamino position address, choose your minimum Health Factor trigger (such as 1.15x) and USDC spending limits, and click 'Save Protection Policy'.",
    },
    {
      q: "Why use an adaptive risk engine instead of a fixed repayment bot?",
      a: "Fixed bots fail in one of two ways: a bot that always tops up your Health Factor to 1.20x can still get liquidated during a sharp multi-candle crash, while a bot that always repays to 1.45x locks up 73.9% more USDC than needed during minor pullbacks. Intercept measures real-time market volatility to choose the right buffer automatically.",
    },
    {
      q: "How does Intercept move USDC from Base to Solana without a centralized custodian?",
      a: "Intercept uses decentralized multi-party computation (MPC) accounts bound to your on-chain policy rules. When your Health Factor drops below your threshold, the Base reserve vault bridges the exact required USDC to Solana and immediately pays down your Kamino loan.",
    },
    {
      q: "What is the minimum amount needed to test a live rescue on Mainnet?",
      a: "As little as $1.00 to $2.00 USDC on Base. Network transaction fees on Base and Solana cost less than $0.01 combined, and you can also simulate any market crash on the dashboard for free before funding a reserve.",
    },
  ];

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Frequently Asked Questions"
      subtitle="Clear answers on custody, security limits, and how cross-chain protection works."
      maxWidth="max-w-2xl"
    >
      <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
        {faqs.map((item, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div key={item.q} className="bg-white">
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="emil-row-hover flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
              >
                <span className="text-xs sm:text-sm font-medium text-foreground">
                  {item.q}
                </span>
                <CaretDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <div className="emil-enter border-t border-border/60 bg-secondary/40 px-4 py-3.5 text-xs text-muted-foreground leading-relaxed">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <a
          href="/docs"
          className="text-xs font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600"
        >
          Read Technical Documentation →
        </a>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              onClose();
              onOpenConfigure();
            }}
          >
            Configure Protection Policy
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
