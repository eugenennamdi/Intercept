"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  LockKey,
  ShieldCheck,
  Cpu,
  Pulse,
  Wallet,
  Check,
  Copy,
  CaretDown,
  CaretRight,
  ArrowSquareOut,
  SlidersHorizontal,
  Question,
  Sparkle,
  TerminalWindow,
  CheckCircle,
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
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{
    publicKey: { toString: () => string };
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
 * Shared accessible modal shell with Emil Kowalski @starting-style scale(0.97) entry
 * and Escape key dismissal.
 */
function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  badge,
  maxWidth = "max-w-2xl",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
  maxWidth?: string;
  children: React.ReactNode;
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
          {/* Modal Header */}
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 bg-white">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-950 text-zinc-50">
                  <InterceptLogoMark size={13} />
                </div>
                <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                  {title}
                </h2>
                {badge && <Badge variant="secondary">{badge}</Badge>}
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
 * 1. WALKTHROUGH MODAL ("How Intercept Works & What Happens When You Proceed")
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
      title: "Read-Only Solana Position (Zero Key Sharing)",
      summary:
        "Your Kamino Lend obligation (SOL collateral + USDC debt) stays 100% inside your personal Solana wallet.",
      whatYouDo:
        "You only provide your public Solana address or Kamino Obligation pubkey. Because Kamino Lend natively allows third-party debt repayment (repay_obligation_liquidity_v2), Intercept never requests your Solana private key or withdrawal authority.",
      guarantee: "Impossible for the AI agent or NEAR MPC to withdraw your SOL collateral.",
    },
    {
      index: "02",
      title: "Lock Your Policy on NEAR (update_policy)",
      summary:
        "You set strict mathematical rules on guardrail.intercept-defi.near that govern when and how a rescue can occur.",
      whatYouDo:
        "By proceeding, you configure four parameters: (1) your pinned Kamino Obligation address, (2) your Health Factor trigger threshold (default 1.15x), (3) your max per-rescue USDC cap, and (4) your max daily USDC spend limit.",
      guarantee: "Only the policy owner can modify these bounds; the AI agent cannot alter them.",
    },
    {
      index: "03",
      title: "Fund Your Derived Base MPC Vault (v1.signer)",
      summary:
        "NEAR’s threshold MPC network derives a deterministic Base Mainnet vault (domain_id: 0) bound to the Guardrail contract.",
      whatYouDo:
        "You deposit idle USDC on Base (Chain 8453) into the derived MPC vault address (0x72fa...). While your Kamino position is healthy (HF >= 1.15x), 100% of your USDC remains untouched on Base.",
      guarantee: "Base USDC can only be transferred to a verified NEAR Intents 1-Click bridge quote.",
    },
    {
      index: "04",
      title: "Autonomous 2-Leg Rescue During a Flash Crash",
      summary:
        "When a SOL crash pushes your Health Factor below 1.15x, the TEE + Guardrail execute a 2-leg cross-chain rescue in ~1.8 seconds.",
      whatYouDo:
        "Nothing manually — the NEAR AI Cloud TEE (DeepSeek-V3.1 in Intel TDX) signs an Ed25519 rescue receipt, the Rust Guardrail verifies every raw byte of Leg 1 (Base EIP-1559) and Leg 2 (Solana V0 Kamino Repay), and v1.signer signs both legs.",
      guarantee: "Any tampered destination, selector, or gas-griefing fee triggers an instant Rust panic.",
    },
  ];

  const current = steps[step];

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="How Intercept Works"
      subtitle="A clear 4-step walkthrough of the zero-trust architecture and what happens when you proceed."
      badge="Product Walkthrough"
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
                {s.title.split(" (")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Step Detail Card */}
      <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <Badge variant="contrast">Step {current.index} of 04</Badge>
          <span className="font-mono text-[11px] text-muted-foreground">
            guardrail.intercept-defi.near
          </span>
        </div>

        <h3 className="text-base font-semibold tracking-[-0.02em] text-foreground">
          {current.title}
        </h3>

        <p className="text-xs text-foreground leading-relaxed font-medium">
          {current.summary}
        </p>

        <div className="rounded-lg border border-border bg-white p-3.5 space-y-1.5 text-xs">
          <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
            <Sparkle className="h-3.5 w-3.5" weight="fill" />
            <span>What you are doing in this step:</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            {current.whatYouDo}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-100/80 px-3 py-2 text-xs text-zinc-900 font-medium">
          <ShieldCheck className="h-4 w-4 shrink-0" weight="fill" />
          <span>Security Guarantee: {current.guarantee}</span>
        </div>
      </div>

      {/* Summary Checklist of Proceeding */}
      <div className="rounded-lg border border-border p-3.5 space-y-2 text-xs">
        <div className="font-semibold text-foreground">
          Summary — By proceeding to Configure Protection, you:
        </div>
        <ul className="space-y-1.5 text-muted-foreground">
          <li className="flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 text-zinc-900 shrink-0" weight="fill" />
            <span>
              <strong className="text-foreground">Never share</strong> your Solana
              private key or collateral withdrawal authority.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 text-zinc-900 shrink-0" weight="fill" />
            <span>
              <strong className="text-foreground">Pin your exact policy rules</strong>{" "}
              (Obligation pubkey, Trigger HF, USDC spend caps) in the live engine or on
              NEAR Mainnet.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 text-zinc-900 shrink-0" weight="fill" />
            <span>
              <strong className="text-foreground">Can test everything safely</strong>{" "}
              with simulated SOL flash crashes before depositing a single dollar.
            </span>
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
          <span>Proceed to Configure Policy</span>
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
  const [copiedCli, setCopiedCli] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  useEffect(() => {
    setObligation(currentConfig.userKaminoObligationPubkey);
    setSolanaWallet(currentConfig.userSolanaWalletPubkey);
    setTriggerHf(currentConfig.minTriggerHfBps / 10000);
    setMaxPerAction(currentConfig.maxPerActionUsdc);
    setMaxDaily(currentConfig.maxDailyUsdc);
    setSlippageBps(currentConfig.maxSlippageBps);
  }, [currentConfig, open]);

  // Native Read-Only Phantom / Solflare detection (0 npm bloat)
  const handleConnectSolana = useCallback(async () => {
    const provider =
      window.phantom?.solana ?? window.solana ?? window.solflare;
    if (!provider) {
      setWalletStatus(
        "No Solana extension detected in this browser. Paste any Kamino Obligation address below or use the Mainnet preset."
      );
      return;
    }
    try {
      const resp = await provider.connect({ onlyIfTrusted: false });
      const pubkey = resp.publicKey.toString();
      setSolanaWallet(pubkey);
      setWalletStatus(`Connected Solana Wallet (Read-Only): ${pubkey.slice(0, 8)}...${pubkey.slice(-6)}`);
    } catch (err) {
      setWalletStatus(`Wallet connection cancelled: ${(err as Error).message}`);
    }
  }, []);

  // Native Base EVM Wallet detection (MetaMask / Rabby / Coinbase)
  const handleConnectBaseEvm = useCallback(async () => {
    if (!window.ethereum) {
      setWalletStatus(
        "No EVM wallet detected. Copy the Base MPC Vault address below to transfer USDC from any wallet."
      );
      return;
    }
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (accounts?.[0]) {
        setEvmAddress(accounts[0]);
        // Request Base Mainnet (Chain ID 8453 = 0x2105)
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
  const maxPerActionMicro = String(Math.round(maxPerAction * 1_000_000));
  const maxDailyMicro = String(Math.round(maxDaily * 1_000_000));

  const updatePolicyArgsJson = JSON.stringify({
    user_kamino_obligation_pubkey: obligation.trim(),
    min_trigger_hf_bps: minTriggerHfBps,
    max_single_rescue_usdc: maxPerActionMicro,
    max_daily_rescue_usdc: maxDailyMicro,
    max_slippage_bps: slippageBps,
  });

  const nearCliCommand = `near contract call-function as-transaction ${nearContractId} update_policy json-args '${updatePolicyArgsJson}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as <YOUR_NEAR_ACCOUNT.near> network-config mainnet sign-with-keychain send`;

  const handleCopyCli = () => {
    navigator.clipboard.writeText(nearCliCommand);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 1800);
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
      subtitle="Connect your Solana position, set your NEAR Guardrail bounds, and apply them to the live engine."
      badge="Zero-Trust Setup"
      maxWidth="max-w-2xl"
    >
      {/* Clear Context Banner Explaining What Proceeding Does */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border bg-secondary/60 px-3.5 py-2.5 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <LockKey className="h-4 w-4 text-zinc-900 shrink-0" weight="duotone" />
          <span>
            <strong className="text-foreground">Non-Custodial:</strong> Connecting or
            applying a policy only pins public addresses & thresholds. No private keys
            are shared.
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenWalkthrough();
          }}
          className="font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600 shrink-0 cursor-pointer"
        >
          Read Walkthrough
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
              Target Kamino Obligation (Solana Mainnet)
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleConnectSolana()}
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>
              {solanaWallet
                ? `Connected: ${solanaWallet.slice(0, 6)}...`
                : "Detect Phantom / Solflare"}
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
            Kamino Obligation Pubkey (Base58)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={obligation}
              onChange={(e) => setObligation(e.target.value)}
              placeholder="Enter Kamino Obligation Base58 address..."
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

      {/* STEP 2: Guardrail Policy Bounds (update_policy) */}
      <div className="space-y-4 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 items-center rounded border border-zinc-300 bg-secondary px-1.5 font-mono text-[10px] font-semibold">
              STEP 2
            </span>
            <span className="text-sm font-semibold text-foreground">
              NEAR Guardrail Policy Parameters (update_policy)
            </span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {minTriggerHfBps} bps
          </span>
        </div>

        {/* Trigger HF Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Trigger Health Factor Threshold</span>
            </span>
            <span className="font-mono font-semibold text-foreground tabular-nums">
              {triggerHf.toFixed(2)}x ({minTriggerHfBps} bps)
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
              <option value={2}>2.00 USDC ($2 Micro Test)</option>
              <option value={10}>10.00 USDC ($10 Test)</option>
              <option value={500}>500.00 USDC</option>
              <option value={2500}>2,500.00 USDC (Default)</option>
              <option value={10000}>10,000.00 USDC</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground block">
              Max Daily Cap (USDC)
            </label>
            <select
              value={maxDaily}
              onChange={(e) => setMaxDaily(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 font-mono text-xs text-foreground"
            >
              <option value={10}>10.00 USDC</option>
              <option value={50}>50.00 USDC</option>
              <option value={1000}>1,000.00 USDC</option>
              <option value={5000}>5,000.00 USDC (Default)</option>
              <option value={25000}>25,000.00 USDC</option>
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
              <option value={25}>25 bps (0.25%)</option>
              <option value={50}>50 bps (0.50% Default)</option>
              <option value={100}>100 bps (1.00%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* STEP 3: On-Chain NEAR Command & Derived Base Vault */}
      <div className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 items-center rounded border border-zinc-300 bg-secondary px-1.5 font-mono text-[10px] font-semibold">
              STEP 3
            </span>
            <span className="text-sm font-semibold text-foreground">
              On-Chain NEAR Call & Derived Base MPC Vault
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleCopyCli}>
            {copiedCli ? (
              <>
                <Check className="h-3.5 w-3.5" weight="bold" />
                <span>Copied NEAR CLI</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy update_policy CLI</span>
              </>
            )}
          </Button>
        </div>

        <pre className="rounded-md border border-border bg-secondary/60 p-2.5 font-mono text-[11px] text-muted-foreground overflow-x-auto leading-relaxed">
          {nearCliCommand}
        </pre>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
          <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
            <div>
              <div className="text-[10px] font-mono text-muted-foreground">
                DERIVED BASE VAULT (domain_id: 0)
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
              {evmAddress ? `EVM: ${evmAddress.slice(0, 6)}...` : "Connect Base EVM"}
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
            <div>
              <div className="text-[10px] font-mono text-muted-foreground">
                DERIVED SOLANA PAYER (domain_id: 1)
              </div>
              <div className="font-mono font-medium text-foreground mt-0.5">
                {derivedSolanaPayer.slice(0, 10)}...{derivedSolanaPayer.slice(-8)}
              </div>
            </div>
            <a
              href={`https://nearblocks.io/address/${nearContractId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-zinc-900 hover:underline"
            >
              <span>NEARBlocks</span>
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
              <span>Policy Applied to Live Engine!</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" weight="fill" />
              <span>Apply Policy to Live Telemetry Engine</span>
            </>
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
      a: "Never. Your Solana wallet holds your Kamino Lend obligation (SOL collateral + USDC debt) in complete self-custody. Kamino Lend’s smart contract (`KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`) natively permits any third party to call `repay_obligation_liquidity_v2` to pay down an obligation’s debt without granting any right to withdraw collateral.",
    },
    {
      q: "What happens if the AI agent inside the TEE hallucinates or is 100% prompt-injected?",
      a: "Zero user funds can be stolen. Before NEAR’s `v1.signer` MPC network signs any transaction, `guardrail.intercept-defi.near` parses the raw unsigned bytes of both Leg 1 (Base EIP-1559 RLP) and Leg 2 (Solana V0 message). If the AI tries to change the ERC-20 selector, alter the recipient address, call Kamino `withdraw`, or set an excessive gas fee (> 50 gwei on Base or > 5M micro-lamports/CU on Solana), the Rust contract deterministically panics in under 1.5 milliseconds.",
    },
    {
      q: "How does a user configure `update_policy` on NEAR?",
      a: "Click 'Configure Policy' in the top bar. You can connect Phantom/Solflare (read-only) or paste your Kamino Obligation address, choose your Trigger Health Factor (e.g. 1.15x) and USDC spend caps, and click 'Apply Policy to Live Telemetry Engine' or copy the one-line `near-cli-rs` transaction command to sign `update_policy` on NEAR Mainnet.",
    },
    {
      q: "Why use a Volatility-Aware TEE Engine instead of a simple static bot?",
      a: "Our 3-regime backtest proves the flaw of static bots: a naive static bot that always buffers Health Factor to 1.20x gets liquidated during a violent -34% multi-candle cascade (-21.4% single candle exceeds a 1.20x buffer). Conversely, a static bot that always repays to 1.45x wastes 73.9% more idle Base USDC during calm pullbacks. Intercept reads Pyth confidence spread widening and EMA velocity inside the NEAR AI Cloud TEE to dynamically select between HOLD, MICRO_BUFFER_RESCUE (1.20x), and CASCADE_DEEP_RESCUE (1.45x).",
    },
    {
      q: "How does `v1.signer` handle both Base (EVM) and Solana signatures from one NEAR contract?",
      a: "Intercept uses NEAR Chain Signatures (`v1.signer`) multi-domain derivation: `domain_id: 0` (Secp256k1 / `Payload::V2::Ecdsa`) signs the 32-byte `keccak256(0x02 || RLP)` hash for the Base USDC transfer, while `domain_id: 1` (Ed25519 / `Payload::V2::Eddsa`) signs the raw 180–1232 byte Solana V0 message for the Kamino same-slot refresh + repayment.",
    },
    {
      q: "What is the minimum USD amount required to test a live rescue on Mainnet?",
      a: "As little as $1.00 to $2.00 USDC on Base! Base EIP-1559 gas costs less than $0.001, Solana transaction fees cost $0.0013 (plus ~0.002 SOL refundable ATA rent), and NEAR contract storage stake is refundable.",
    },
  ];

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Frequently Asked Questions"
      subtitle="Key architectural, security, and onboarding answers for DeFi borrowers and security auditors."
      badge="FAQ"
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
          Read Full Technical Documentation (/docs) →
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
            Configure Policy
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
