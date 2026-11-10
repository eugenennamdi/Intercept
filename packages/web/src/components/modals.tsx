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
      title: "Keep Full Self-Custody of Your Solana Collateral",
      summary:
        "Your SOL collateral and Kamino obligation remain inside your personal Solana wallet at all times.",
      whatYouDo:
        "Register only your public Solana wallet or Kamino obligation address. Because Kamino Lend natively permits third-party debt repayment without granting withdrawal or borrowing authority, Intercept never requests your private key or collateral delegation.",
      guarantee:
        "Neither Intercept nor any off-chain agent can ever withdraw your SOL collateral or draw additional debt.",
    },
    {
      index: "02",
      shortLabel: "Lock NEAR Policy",
      title: "Define Your Trigger & Spending Caps on NEAR",
      summary:
        "An on-chain NEAR smart contract enforces exactly when a rescue can execute and the maximum USDC that can move.",
      whatYouDo:
        "Configure four parameters: (1) your pinned Kamino obligation address, (2) your minimum Health Factor trigger (default 1.15x), (3) your per-rescue USDC limit, and (4) your rolling 24-hour USDC cap.",
      guarantee:
        "Only the policy owner can modify these bounds; the off-chain risk engine holds zero administrative permissions.",
    },
    {
      index: "03",
      shortLabel: "Hold Base Reserve",
      title: "Hold Productive Standby USDC on Base",
      summary:
        "A keyless NEAR Chain Signatures vault on Base holds your standby USDC until volatility breaches your threshold.",
      whatYouDo:
        "Fund your derived Base USDC Reserve Vault. As long as your Kamino Health Factor remains at or above your trigger (e.g. 1.15x), 100% of your Base USDC stays untouched.",
      guarantee:
        "The NEAR guardrail contract rejects any signing request when your Health Factor is healthy above your trigger.",
    },
    {
      index: "04",
      shortLabel: "Automated Rescue",
      title: "Sub-2s Cross-Chain Settlement via NEAR Intents",
      summary:
        "When a SOL drawdown pushes your Health Factor below your threshold, NEAR bridges Base USDC and repays your Solana debt automatically.",
      whatYouDo:
        "Nothing manually—NEAR AI Cloud evaluates live Pyth volatility in a hardware enclave, sizes the exact repayment needed (1.20x for calm pullbacks or 1.45x for severe cascades), and settles via NEAR Intents 1-Click.",
      guarantee:
        "Every raw EIP-1559 and Solana V0 payload is byte-verified on NEAR before v1.signer issues an MPC signature.",
    },
  ];

  const current = steps[step];

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="How Intercept Works"
      subtitle="Protect your Solana Kamino collateral from 5%–10% liquidation penalties using standby Base USDC and NEAR."
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
        obligation.trim() || "C5dZVpvpA39SNLDkojsi98nRePRRy8ELhtxak8m2vMq",
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
      subtitle="Register your public Kamino obligation, set your Health Factor trigger, and enforce on-chain USDC spending caps."
      maxWidth="max-w-2xl"
    >
      {/* Clear Context Banner Explaining What Proceeding Does */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border bg-secondary/60 px-3.5 py-2.5 text-xs">
        <span className="text-muted-foreground">
          <strong className="text-foreground">Non-Custodial on NEAR:</strong>{" "}
          Linking a position registers only public addresses and smart contract
          spending rules—zero private keys are shared.
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
                setObligation("C5dZVpvpA39SNLDkojsi98nRePRRy8ELhtxak8m2vMq")
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
              <option value={2}>$2.00 USDC</option>
              <option value={10}>$10.00 USDC</option>
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
              href={`https://${
                nearContractId.endsWith(".testnet")
                  ? "testnet.nearblocks.io"
                  : "nearblocks.io"
              }/address/${nearContractId}`}
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
      a: "Never. Your personal Solana wallet retains full self-custody of your SOL collateral and Kamino obligation. Kamino Lend natively permits third-party debt repayment (repay_obligation_liquidity_v2) without granting authority to withdraw collateral or borrow additional liquidity.",
    },
    {
      q: "What happens if the off-chain AI engine hallucinates or is compromised?",
      a: "User funds remain protected by deterministic Rust smart contract guardrails on NEAR. Before NEAR Chain Signatures (v1.signer) signs any payload, the contract byte-parses the raw Base EIP-1559 RLP bytes and Solana V0 message bytes—immediately rejecting unauthorized recipients, ERC-20 approvals, excessive gas fees, spending-cap breaches, or collateral withdrawal instructions.",
    },
    {
      q: "Why is Intercept built on NEAR Protocol?",
      a: "NEAR uniquely unifies all four primitives required for trustless cross-chain risk defense in one stack: NEAR AI Cloud for hardware-attested confidential inference, near-sdk-rs smart contracts for deterministic byte-level policy enforcement, Chain Signatures (v1.signer) for keyless multi-curve signing across Base (Secp256k1) and Solana (Ed25519), and NEAR Intents 1-Click for sub-2s cross-chain USDC settlement.",
    },
    {
      q: "Why use a volatility-aware risk engine instead of a fixed threshold bot?",
      a: "Fixed threshold scripts fail DeFi borrowers in two ways: a static 1.20x top-up bot leaves too thin a buffer and gets liquidated during sharp multi-candle cascades, while a static 1.45x bot deploys 73.9% more Base USDC than necessary during calm pullbacks. Intercept evaluates real-time Pyth volatility, confidence spread, and EMA velocity to select the optimal buffer automatically.",
    },
    {
      q: "How do I configure protection for my Kamino position?",
      a: "Click 'Configure Protection Policy' on the dashboard, connect Phantom or Solflare in read-only mode (or paste your Kamino obligation address), set your Health Factor trigger and USDC spending caps, and save your policy. When ready for live coverage, fund your derived Base USDC Reserve Vault.",
    },
    {
      q: "What is the minimum reserve needed to verify live cross-chain settlement?",
      a: "As little as $2.00 USDC on Base. Combined L2 and Solana network fees cost less than $0.01 per rescue, and you can stress-test any SOL drawdown scenario on the dashboard before funding your vault.",
    },
  ];

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Frequently Asked Questions"
      subtitle="Clear answers on self-custody, NEAR smart contract guardrails, and cross-chain debt protection."
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
