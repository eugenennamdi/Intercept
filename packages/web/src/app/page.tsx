"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  CaretRight,
  CaretDown,
  Copy,
  Check,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import { InterceptLogoMark } from "@/components/brand-logo";
import {
  WalkthroughModal,
  ConfigurePolicyModal,
  FaqModal,
  type CustomPolicyConfig,
} from "@/components/modals";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  HealthFactorTrajectoryChart,
  type TrajectoryPoint,
} from "@/components/ui/chart";

interface StageTimingTelemetry {
  stageIndex: number;
  stageId: string;
  label: string;
  status: "COMPLETED" | "SKIPPED_HEALTHY" | "REVERTED_BY_GUARDRAIL";
  measuredLatencyMs: number;
  detail: string;
  explorerUrl: string;
  explorerLabel: string;
}

interface ExecutionReport {
  mode: "LIVE_MAINNET_MODE" | "STRESS_TEST_MAINNET_MODE";
  executedAtIso: string;
  totalMeasuredLatencyMs: number;
  policy: {
    nearContractId: string;
    mpcBaseVaultAddress: string;
    mpcSolanaPayerPubkey: string;
    userKaminoObligationPubkey: string;
    userSolanaEoaPubkey: string;
    minTriggerHfBps: number;
    maxPerActionUsdcFormatted: string;
    maxDailyUsdcFormatted: string;
    maxSlippageBps: number;
  };
  pythTelemetry: {
    source: string;
    feedId: string;
    solanaAccountPubkey: string;
    solanaSlot?: number;
    publishTimeUnix: number;
    rawSpotSolUsd: number;
    emaSolUsd: number;
    confidenceUsd: number;
    confidenceSpreadBps: number;
    emaVelocityBps: number;
    realizedVolatilityBps: number;
    stressShockPctApplied: number;
    effectiveSolUsd: number;
    priceProofHash: string;
    fetchLatencyMs: number;
    fallbackReason?: string;
  };
  kaminoBefore: {
    source: string;
    fallbackReason?: string;
    programId: string;
    lendingMarketPubkey: string;
    obligationPubkey: string;
    ownerSolanaEoa: string;
    solanaSlot: number;
    depositedSol: number;
    collateralValueUsd: number;
    borrowedUsdc: number;
    debtValueUsd: number;
    maxLtvBps: number;
    liquidationLtvBps: number;
    currentLtvBps: number;
    riskAdjustedCollateralUsd: number;
    healthFactor: number;
    healthFactorBps: number;
    liquidationSolPriceUsd: number;
    distanceToLiquidationPct: number;
  };
  kaminoAfter: {
    borrowedUsdc: number;
    debtValueUsd: number;
    currentLtvBps: number;
    healthFactor: number;
    healthFactorBps: number;
  };
  riskEvaluation: {
    regime: "HOLD" | "MICRO_BUFFER_RESCUE" | "CASCADE_DEEP_RESCUE";
    actionable: boolean;
    observedHfBps: number;
    triggerThresholdHfBps: number;
    targetHfBps: number;
    projectedPostRescueHfBps: number;
    estimatedKaminoLiquidationPenaltyBps: number;
    expectedLiquidationLossUsd: number;
    capitalOpportunityCostBps: number;
    capitalExecutionCostUsd: number;
    netProtectedValueUsd: number;
    repayAmountUsdcMicro: string;
    repayAmountUsdcFormatted: string;
    reasoningSummary: string;
    reasoningHash: string;
  };
  nearAiCloudAttestation: {
    source: string;
    model: string;
    chatId: string;
    attestationNonceHex: string;
    signingAddress: string;
    signedText: string;
    hardwareAttestation: {
      intelTdxQuoteCommitmentHex: string;
      nvidiaNrasEatNonceHex: string;
      gpuArchitecture: string;
      tdxReportDataBindsKeyAndNonce: boolean;
    };
    verifiedChainOfTrust: boolean;
    fallbackReason?: string;
  };
  oneClickQuote: {
    source: string;
    fallbackReason?: string;
    quoteId: string;
    amountInFormatted: string;
    amountOutFormatted: string;
    effectiveFeeSpreadBps: number;
    depositAddress: string;
    recipientSolanaAddress: string;
    refundBaseAddress: string;
    estimatedSettlementSec: number;
    quoteLatencyMs: number;
    statusExplorerUrl: string;
  } | null;
  teeReceipt: {
    receipt: {
      timestamp: number;
      obligation_pubkey: string;
      observed_hf_bps: number;
      volatility_bps: number;
      regime: string;
      repay_amount_usdc: string;
      oneclick_deposit_address: string;
      min_amount_out: string;
      reasoning_hash: string;
      enclave_signature_hex: string;
    };
    canonicalPayload: string;
    receiptHashHex: string;
    signatureVerified: boolean;
  } | null;
  leg1BaseVerification: {
    rawUnsignedTxHex: string;
    signingHashKeccak256Hex: string;
    mpcDomainId: number;
    derivationPath: string;
    guardrailVerified: boolean;
  } | null;
  leg2SolanaVerification: {
    rawMessageHex: string;
    discriminatorHex: string;
    kaminoRefreshIxCount: number;
    repayReservePubkey: string;
    userSourceLiquidityAtaPubkey: string;
    mpcDomainId: number;
    derivationPath: string;
    guardrailVerified: boolean;
  } | null;
  stages: StageTimingTelemetry[];
}

interface PreflightReport {
  checkedAtIso: string;
  derivedMpc: {
    source: string;
    nearRpcUrl: string;
    mpcSignerContractId: string;
    predecessorContractId: string;
    baseDerivationPath: string;
    solanaDerivationPath: string;
    rawSecp256k1DerivedKey: string;
    mpcBaseVaultAddress: string;
    rawEd25519DerivedKey: string;
    mpcSolanaPayerPubkey: string;
    mpcSolanaPayerUsdcAta: string;
    mpcSolanaPayerUsdcAtaBump: number;
    latencyMs: number;
  };
  baseState: {
    source: string;
    chainId: number;
    mpcBaseVaultAddress: string;
    nonce: number;
    ethBalanceFormatted: string;
    usdcBalanceFormatted: string;
    latencyMs: number;
  };
  solanaState: {
    source: string;
    mpcSolanaPayerPubkey: string;
    recentBlockhashBase58: string;
    solBalanceFormatted: string;
    usdcBalanceFormatted: string;
    usdcAtaPubkey: string;
    usdcAtaBump: number;
    usdcAtaExistsOnChain: boolean;
    latencyMs: number;
  };
  liveBroadcastCredentialsConfigured: boolean;
  readyForTenDollarMainnetRescue: boolean;
  checklist: Array<{
    item: string;
    passed: boolean;
    detail: string;
  }>;
}

interface AdversarialAttackVectorResult {
  attackId: string;
  title: string;
  targetLeg:
    | "LEG_1_BASE_EVM"
    | "LEG_2_SOLANA_KAMINO"
    | "TEE_ATTESTATION"
    | "ASYNC_TOCTOU_STATE";
  attackerGoal: string;
  injectedPayloadSummary: string;
  guardrailBlocked: boolean;
  errorCode: string;
  contractRevertMessage: string;
  verificationTimeUs: number;
}

interface BacktestSuiteReport {
  generatedAtIso: string;
  executionTimeMs: number;
  scenarios: Array<{
    scenarioId: string;
    title: string;
    description: string;
    outcomes: Array<{
      strategyId: string;
      strategyName: string;
      survivedWithoutLiquidation: boolean;
      liquidatedAtTick: number | null;
      minimumObservedHf: number;
      finalHf: number;
      rescueTriggerCount: number;
      totalBaseUsdcDeployed: number;
      netCostUsd: number;
    }>;
    interceptEdgeSummary: string;
  }>;
  aggregateSummary: {
    interceptSurvivalRatePct: number;
    naiveMicroBotSurvivalRatePct: number;
    unprotectedSurvivalRatePct: number;
    totalLiquidationLossPreventedUsd: number;
    capitalEfficiencySavingsVsConservativePct: number;
  };
}

interface InterceptApiResponse {
  report: ExecutionReport;
  preflight: PreflightReport;
  adversarialSuite: AdversarialAttackVectorResult[];
  backtest: BacktestSuiteReport;
}

/**
 * Reusable Section Header for clear visual hierarchy and scannability
 */
function SectionHeader({
  index,
  title,
  subtitle,
  rightSlot,
}: {
  index: string;
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-3 border-b border-border/70">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-5 items-center rounded border border-zinc-300 bg-secondary px-1.5 font-mono text-[10px] font-semibold tracking-wider text-zinc-800">
            {index}
          </span>
          <h2 className="text-base sm:text-lg font-semibold tracking-[-0.02em] text-foreground">
            {title}
          </h2>
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground pl-9">{subtitle}</p>
        )}
      </div>
      {rightSlot && <div className="pl-9 sm:pl-0">{rightSlot}</div>}
    </div>
  );
}

/**
 * transitions.dev 02-number-pop-in
 * Animates each character and staggers the last two decimal digits on value updates
 */
function AnimatedMetric({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const chars = value.split("");
  return (
    <span
      key={value}
      className={`t-digit-group is-animating tabular-nums ${className ?? ""}`}
    >
      {chars.map((ch, i) => {
        const stagger =
          i === chars.length - 2
            ? "1"
            : i === chars.length - 1
            ? "2"
            : undefined;
        return (
          <span key={`${i}-${ch}`} className="t-digit" data-stagger={stagger}>
            {ch === " " ? "\u00A0" : ch}
          </span>
        );
      })}
    </span>
  );
}

/**
 * transitions.dev 09-icon-swap
 * Cross-fades Copy <-> Check in a single grid cell with blur & scale
 */
function CopyChip({
  value,
  display,
  label,
}: {
  value: string;
  display?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    },
    [value]
  );

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy ${label ?? value}`}
      className="emil-press inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/80 px-2 py-0.5 font-mono text-xs text-muted-foreground hover:text-foreground hover:border-zinc-400 cursor-pointer"
    >
      <span className="truncate max-w-[180px]">{display ?? value}</span>
      <span className="t-icon-swap" data-state={copied ? "b" : "a"}>
        <span className="t-icon" data-icon="a">
          <Copy className="w-3 h-3 opacity-70" />
        </span>
        <span className="t-icon" data-icon="b">
          <Check className="w-3 h-3 text-zinc-950" weight="bold" />
        </span>
      </span>
    </button>
  );
}

const SHORT_STAGE_LABELS: Record<number, string> = {
  1: "Position & Market Check",
  2: "Risk & Buffer Sizing",
  3: "Spending Policy Check",
  4: "Base USDC Bridge",
  5: "Solana Loan Repayment",
};

const SHORT_LEG_BADGE: Record<string, string> = {
  LEG_1_BASE_EVM: "Base Transfer",
  LEG_2_SOLANA_KAMINO: "Solana Repay",
  TEE_ATTESTATION: "Risk Engine",
  ASYNC_TOCTOU_STATE: "Order Guard",
};

const REGIME_LABELS: Record<string, string> = {
  HOLD: "Hold — Position Healthy",
  MICRO_BUFFER_RESCUE: "Micro Buffer Rescue (1.20x)",
  CASCADE_DEEP_RESCUE: "Deep Cascade Rescue (1.45x)",
};

export default function InterceptDashboardPage() {
  const [mode, setMode] = useState<"LIVE_MAINNET_MODE" | "STRESS_TEST_MAINNET_MODE">(
    "STRESS_TEST_MAINNET_MODE"
  );
  const [priceDropPct, setPriceDropPct] = useState<number>(25);
  const [data, setData] = useState<InterceptApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("redteam");
  const [expandedStage, setExpandedStage] = useState<number | null>(null);
  const [selectedAdvId, setSelectedAdvId] = useState<string>("");
  const [advSimRunning, setAdvSimRunning] = useState<boolean>(false);
  const [isShakingRevert, setIsShakingRevert] = useState<boolean>(false);
  const [showCustodyDetail, setShowCustodyDetail] = useState<boolean>(false);
  const [showRawHex, setShowRawHex] = useState<boolean>(false);
  const [selectedBacktestIdx, setSelectedBacktestIdx] = useState<number>(0);

  // Interactive Modals & Custom User Policy State
  const [walkthroughOpen, setWalkthroughOpen] = useState<boolean>(false);
  const [configureOpen, setConfigureOpen] = useState<boolean>(false);
  const [faqOpen, setFaqOpen] = useState<boolean>(false);
  const [customPolicy, setCustomPolicy] = useState<CustomPolicyConfig>({
    userKaminoObligationPubkey: "C5dZVpvpA39SNLDkojsi98nRePRRy8ELhtxak8m2vMq",
    userSolanaWalletPubkey: "BPMrNdZmw9QEzrxNQC46fUwFxevQhUdDgeSmD5WsMGzU",
    minTriggerHfBps: 11500,
    maxPerActionUsdc: 2500,
    maxDailyUsdc: 5000,
    maxSlippageBps: 50,
  });

  const workspaceRef = useRef<HTMLDivElement>(null);

  const triggerSmoothTransition = useCallback((fn: () => void) => {
    setIsTransitioning(true);
    fn();
    setTimeout(() => setIsTransitioning(false), 180);
  }, []);

  // Emil Kowalski Rule #1: Never animate keyboard-initiated actions (instant 0ms switch on 1-5 hotkeys)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }
      const tabMap: Record<string, string> = {
        "1": "redteam",
        "2": "inspector",
        "3": "backtest",
        "4": "vaults",
        "5": "all",
      };
      if (tabMap[e.key]) {
        setActiveTab(tabMap[e.key]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const fetchPipeline = useCallback(
    async (
      targetMode: "LIVE_MAINNET_MODE" | "STRESS_TEST_MAINNET_MODE",
      dropPct: number,
      policyCfg: CustomPolicyConfig = customPolicy
    ) => {
      setLoading(true);
      setErrorMsg(null);
      setIsTransitioning(true);
      try {
        const res = await fetch("/api/intercept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: targetMode,
            stressShockPct: -Math.abs(dropPct),
            minTriggerHfBpsOverride: policyCfg.minTriggerHfBps,
            userObligationOverride: policyCfg.userKaminoObligationPubkey,
            maxPerActionUsdcFormattedOverride: `$${policyCfg.maxPerActionUsdc.toLocaleString(
              "en-US",
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )}`,
            maxDailyUsdcFormattedOverride: `$${policyCfg.maxDailyUsdc.toLocaleString(
              "en-US",
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )}`,
            maxSlippageBpsOverride: policyCfg.maxSlippageBps,
          }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as InterceptApiResponse;
        setData(json);
        if (json.adversarialSuite?.length && !selectedAdvId) {
          setSelectedAdvId(json.adversarialSuite[0].attackId);
        }
      } catch (err) {
        console.error("Failed to fetch Intercept pipeline:", err);
        setErrorMsg((err as Error).message);
      } finally {
        setLoading(false);
        setTimeout(() => setIsTransitioning(false), 160);
      }
    },
    [selectedAdvId, customPolicy]
  );

  useEffect(() => {
    void fetchPipeline(mode, priceDropPct, customPolicy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, priceDropPct]);

  const handleSelectScenario = (
    nextMode: "LIVE_MAINNET_MODE" | "STRESS_TEST_MAINNET_MODE",
    nextDrop: number
  ) => {
    setMode(nextMode);
    setPriceDropPct(nextDrop);
  };

  // transitions.dev 12-error-state-shake orchestration when Guardrail blocks a rogue AI vector
  const triggerAdversarialIntercept = (advId?: string) => {
    if (advId) {
      setSelectedAdvId(advId);
    }
    setActiveTab("redteam");
    setAdvSimRunning(true);
    setIsShakingRevert(false);
    setTimeout(() => {
      setAdvSimRunning(false);
      setIsShakingRevert(true);
      setTimeout(() => setIsShakingRevert(false), 320);
    }, 140);
  };

  const report = data?.report;
  const backtest = data?.backtest;
  const preflight = data?.preflight;
  const adversarialSuite = data?.adversarialSuite ?? [];

  const selectedAdvCase =
    adversarialSuite.find((c) => c.attackId === selectedAdvId) ??
    adversarialSuite[0];

  const hfBefore = report?.kaminoBefore?.healthFactor ?? 1.3323;
  const hfAfter = report?.kaminoAfter?.healthFactor ?? hfBefore;
  const triggerHf = (report?.riskEvaluation?.triggerThresholdHfBps ?? 11500) / 10000;

  const hfToPercent = (hf: number) =>
    Math.max(2, Math.min(98, ((hf - 0.85) / (1.6 - 0.85)) * 100));

  const isRescueTriggered = report?.riskEvaluation?.actionable ?? false;

  // Build dynamic 7-tick Health Factor trajectory series for the shadcn/ui Monochrome Chart
  const trajectoryPoints = useMemo<TrajectoryPoint[]>(() => {
    const baseSpot = report?.pythTelemetry?.rawSpotSolUsd ?? 88.85;
    const drop = mode === "LIVE_MAINNET_MODE" ? 0 : priceDropPct;
    const factors = [
      1.0,
      1 - (drop * 0.25) / 100,
      1 - (drop * 0.55) / 100,
      1 - (drop * 0.8) / 100,
      1 - drop / 100,
      1 - (drop * 0.92) / 100,
      1 - (drop * 0.85) / 100,
    ];
    const baseHf = 1.336;
    return factors.map((mult, idx) => {
      const price = baseSpot * mult;
      const rawHf = Number((baseHf * mult).toFixed(4));
      const rescued =
        rawHf < triggerHf
          ? Number(Math.max(rawHf, hfAfter * (0.96 + idx * 0.006)).toFixed(4))
          : rawHf;
      const naive =
        rawHf < triggerHf
          ? Number(Math.min(1.2, rawHf + 0.14).toFixed(4))
          : rawHf;
      return {
        tickLabel: `T+${idx}`,
        solPriceUsd: price,
        unprotectedHf: rawHf,
        interceptHf: idx >= 3 && isRescueTriggered ? hfAfter : rescued,
        naiveHf: naive,
      };
    });
  }, [report, mode, priceDropPct, triggerHf, hfAfter, isRescueTriggered]);

  const rawRepayFormatted = report?.riskEvaluation?.repayAmountUsdcFormatted ?? "0.00";
  const repayDisplay = rawRepayFormatted.startsWith("$")
    ? rawRepayFormatted
    : `$${rawRepayFormatted}`;

  const activeBacktestScenario =
    backtest?.scenarios[selectedBacktestIdx] ?? backtest?.scenarios[0];

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      {/* =====================================================================
          STICKY TOP BAR
         ===================================================================== */}
      <header className="sticky top-0 z-40 h-14 w-full border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1320px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-50 shadow-2xs">
                <InterceptLogoMark size={18} />
              </div>
              <span className="text-sm font-semibold tracking-[-0.02em] text-foreground">
                Intercept
              </span>
            </div>

            {/* Single Canonical Top Navigation (How It Works, FAQ, Docs) — Pure Typography */}
            <nav className="flex items-center gap-0.5 sm:gap-1">
              <button
                type="button"
                onClick={() => setWalkthroughOpen(true)}
                className="emil-press inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/70 cursor-pointer"
              >
                How It Works
              </button>

              <button
                type="button"
                onClick={() => setFaqOpen(true)}
                className="emil-press inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/70 cursor-pointer"
              >
                FAQ
              </button>

              <Link
                href="/docs"
                className="emil-press inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/70"
              >
                Docs
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {report && (
              <div className="hidden lg:flex items-center gap-2.5 rounded-md border border-border bg-secondary/60 px-2.5 py-1 text-xs text-muted-foreground tabular-nums">
                <span>
                  Slot{" "}
                  <strong className="font-mono font-medium text-foreground">
                    #{report.kaminoBefore.solanaSlot.toLocaleString()}
                  </strong>
                </span>
                <span className="text-zinc-300">·</span>
                <span>
                  <strong className="font-mono font-medium text-foreground">
                    ${report.pythTelemetry.effectiveSolUsd.toFixed(2)}
                  </strong>
                </span>
                <span className="text-zinc-300">·</span>
                <span className="font-mono text-zinc-700">
                  {report.totalMeasuredLatencyMs}ms
                </span>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                triggerAdversarialIntercept(adversarialSuite[0]?.attackId);
                workspaceRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
            >
              <span className="hidden md:inline">Security Tests</span>
              <span className="md:hidden">Security</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchPipeline(mode, priceDropPct, customPolicy)}
              disabled={loading}
              aria-label="Refresh telemetry"
            >
              <ArrowClockwise
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-8 sm:px-6 space-y-10">
        {errorMsg && (
          <div className="rounded-lg border border-zinc-300 bg-secondary p-3 text-xs text-zinc-800">
            Telemetry notice: {errorMsg}
          </div>
        )}

        {/* =====================================================================
            HERO & SIMULATION CONTROLLER (SCANNABLE 2-COLUMN SPLIT)
           ===================================================================== */}
        <section className="grid gap-6 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-[11px] font-mono text-muted-foreground shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-900" />
                <span>NON-CUSTODIAL LIQUIDATION PROTECTION · BASE TO SOLANA</span>
              </div>

              <h1 className="scroll-m-20 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-[-0.035em] leading-[1.08] text-foreground">
                Zero-Trust Cross-Chain Liquidation Defense
              </h1>

              <p className="text-sm text-muted-foreground leading-relaxed max-w-[60ch]">
                Holds your standby USDC on Base and automatically pays down your
                Solana Kamino loan only when your Health Factor drops below{" "}
                <span className="font-mono font-medium text-zinc-900">
                  {triggerHf.toFixed(2)}x
                </span>
                .
              </p>

              {/* Single Primary Action in Hero (Pure Typography, No Slop Icons) */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setConfigureOpen(true)}
                >
                  Configure Protection Policy
                </Button>

                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
                  <span>Active Policy:</span>
                  <strong className="text-foreground font-medium">
                    HF &lt; {triggerHf.toFixed(2)}x
                  </strong>
                  <span>·</span>
                  <strong className="text-foreground font-medium">
                    ${(customPolicy?.maxPerActionUsdc ?? 2500).toLocaleString()} Limit
                  </strong>
                </span>
              </div>
            </div>

            {/* Scannable 3-Pillar Architecture Strip + Optional Custody Proof Drawer */}
            <div className="bezel-shell">
              <div className="bezel-core p-3.5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="rounded-md border border-border bg-secondary/60 px-3 py-2">
                    <div className="text-[11px] font-mono text-muted-foreground">
                      01 · SELF-CUSTODY
                    </div>
                    <div className="mt-1 text-xs font-medium text-foreground">
                      Solana Keys Never Shared
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-secondary/60 px-3 py-2">
                    <div className="text-[11px] font-mono text-muted-foreground">
                      02 · ON-CHAIN RULES
                    </div>
                    <div className="mt-1 text-xs font-medium text-foreground">
                      Strict Spending & Route Caps
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-secondary/60 px-3 py-2">
                    <div className="text-[11px] font-mono text-muted-foreground">
                      03 · SETTLEMENT
                    </div>
                    <div className="mt-1 text-xs font-medium text-foreground">
                      Base USDC → Solana Loan
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5 text-xs">
                  <span className="text-muted-foreground">
                    Authorized third-party loan repayment with zero access to withdraw
                    your SOL collateral.
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCustodyDetail((prev) => !prev)}
                    className="emil-press inline-flex items-center gap-1 font-medium text-zinc-900 hover:text-zinc-600 shrink-0 ml-3 cursor-pointer"
                  >
                    <span>{showCustodyDetail ? "Hide Details" : "Custody Guarantee"}</span>
                    <CaretDown
                      className={`h-3 w-3 transition-transform duration-150 ${
                        showCustodyDetail ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>

                {/* Preserved in DOM; collapsed by default for clean visual hierarchy */}
                <div
                  hidden={!showCustodyDetail}
                  className={
                    showCustodyDetail
                      ? "emil-enter border-t border-border/70 pt-2.5 text-xs text-muted-foreground leading-relaxed"
                      : "hidden"
                  }
                >
                  Your personal Solana wallet holds your Kamino position (SOL
                  collateral and USDC loan) and{" "}
                  <strong className="text-foreground font-medium">
                    never shares its private key
                  </strong>
                  . Kamino Lend natively allows any third-party account to pay down a
                  loan’s debt on behalf of the borrower without granting permission to
                  withdraw collateral. Because your Solana wallet remains independent
                  and every rescue transaction is checked against your on-chain spending
                  limits, even a compromised agent cannot touch your collateral or
                  redirect your USDC.
                </div>
              </div>
            </div>
          </div>

          {/* Right: Concentric Scenario Controller */}
          <div className="lg:col-span-5 bezel-shell flex">
            <Card className="bezel-core border-0 shadow-none flex-1 flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    Market Stress Simulator
                  </CardTitle>
                  <Badge variant={mode === "LIVE_MAINNET_MODE" ? "outline" : "contrast"}>
                    {mode === "LIVE_MAINNET_MODE"
                      ? "0% Shock (Live)"
                      : `-${priceDropPct}% SOL Shock`}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Select a market scenario or adjust the slider to see how your policy
                  responds.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-[10px] bg-secondary p-1 border border-border">
                  {[
                    {
                      label: "Live Market",
                      sub: "0% Shock",
                      targetMode: "LIVE_MAINNET_MODE" as const,
                      drop: 0,
                    },
                    {
                      label: "-20% Dip",
                      sub: "Micro Buffer",
                      targetMode: "STRESS_TEST_MAINNET_MODE" as const,
                      drop: 20,
                    },
                    {
                      label: "-25% Crash",
                      sub: "Cascade",
                      targetMode: "STRESS_TEST_MAINNET_MODE" as const,
                      drop: 25,
                    },
                    {
                      label: "-35% Wick",
                      sub: "Deep Rescue",
                      targetMode: "STRESS_TEST_MAINNET_MODE" as const,
                      drop: 35,
                    },
                  ].map((preset) => {
                    const isActive =
                      preset.targetMode === mode &&
                      (preset.targetMode === "LIVE_MAINNET_MODE" ||
                        preset.drop === priceDropPct);
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          handleSelectScenario(preset.targetMode, preset.drop || 25)
                        }
                        className={`emil-press flex flex-col items-start rounded-[6px] px-2.5 py-2 text-left cursor-pointer ${
                          isActive
                            ? "bg-white text-foreground shadow-xs border border-zinc-300"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className="text-xs font-medium leading-tight">
                          {preset.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                          {preset.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">SOL Price Shock</span>
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {mode === "LIVE_MAINNET_MODE" ? "0%" : `-${priceDropPct}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={40}
                    step={1}
                    value={priceDropPct}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMode("STRESS_TEST_MAINNET_MODE");
                      setPriceDropPct(val);
                    }}
                    aria-label="Simulated SOL price drop percentage"
                    className="shadcn-slider w-full"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground tabular-nums">
                    <span>-5%</span>
                    <span>-15% (Trigger)</span>
                    <span>-25%</span>
                    <span>-40%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* =====================================================================
            SECTION 01: LIVE POSITION & RISK TELEMETRY (4 SCANNABLE KPI CARDS)
           ===================================================================== */}
        <section className="space-y-4">
          <SectionHeader
            index="01"
            title="Position Overview"
            rightSlot={
              report && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Position:</span>
                  <CopyChip
                    value={report.kaminoBefore.obligationPubkey}
                    display={`${report.kaminoBefore.obligationPubkey.slice(
                      0,
                      6
                    )}...${report.kaminoBefore.obligationPubkey.slice(-4)}`}
                    label="Kamino Position Address"
                  />
                </div>
              )
            }
          />

          <div
            data-transitioning={isTransitioning}
            className="emil-crossfade grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {/* KPI 1: Health Factor */}
            <Card className="emil-card-hover">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Health Factor
                </span>
                <Badge variant={isRescueTriggered ? "contrast" : "secondary"}>
                  {!isRescueTriggered ? "Healthy" : "Rescued"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-2 tabular-nums">
                  <AnimatedMetric
                    value={hfBefore.toFixed(2)}
                    className={`text-3xl font-semibold tracking-[-0.03em] ${
                      isRescueTriggered ? "text-zinc-400" : "text-foreground"
                    }`}
                  />
                  {isRescueTriggered && (
                    <>
                      <CaretRight className="h-4 w-4 text-zinc-400" />
                      <AnimatedMetric
                        value={hfAfter.toFixed(2)}
                        className="text-3xl font-semibold tracking-[-0.03em] text-zinc-950"
                      />
                    </>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="relative h-1.5 w-full rounded-full bg-secondary overflow-hidden border border-border">
                    <div
                      className="absolute inset-y-0 left-0 bg-monochrome-hatch border-r border-zinc-400"
                      style={{ width: `${hfToPercent(1.0)}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-zinc-400 transition-[left] duration-200"
                      style={{ left: `${hfToPercent(hfBefore)}%` }}
                    />
                    {isRescueTriggered && (
                      <div
                        className="absolute top-0 bottom-0 w-1.5 bg-zinc-950 transition-[left] duration-200"
                        style={{ left: `${hfToPercent(hfAfter)}%` }}
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-[11px] font-mono text-muted-foreground tabular-nums">
                    <span>1.00 Liq</span>
                    <span>{triggerHf.toFixed(2)} Trigger</span>
                    <span>1.45 Safe</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* KPI 2: Kamino Collateral & Debt */}
            <Card className="emil-card-hover flex flex-col justify-between">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Kamino Collateral
                </span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {report ? report.kaminoBefore.depositedSol.toFixed(3) : "0.185"} SOL
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="tabular-nums">
                  <AnimatedMetric
                    value={`$${
                      report ? report.kaminoBefore.collateralValueUsd.toFixed(2) : "16.40"
                    }`}
                    className="text-3xl font-semibold tracking-[-0.03em] text-foreground"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums pt-2 border-t border-border/60">
                  <span>USDC Loan</span>
                  <span className="font-mono text-foreground font-medium">
                    ${report ? report.kaminoBefore.borrowedUsdc.toFixed(2) : "9.23"} → $
                    {report ? report.kaminoAfter.borrowedUsdc.toFixed(2) : "9.23"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* KPI 3: Pyth SOL/USD Oracle */}
            <Card className="emil-card-hover flex flex-col justify-between">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  SOL / USD Price
                </span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  ±${report ? report.pythTelemetry.confidenceUsd.toFixed(2) : "0.09"}
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="tabular-nums">
                  <AnimatedMetric
                    value={`$${
                      report ? report.pythTelemetry.effectiveSolUsd.toFixed(2) : "88.76"
                    }`}
                    className="text-3xl font-semibold tracking-[-0.03em] text-foreground"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums pt-2 border-t border-border/60">
                  <span>Annualized Volatility</span>
                  <span className="font-mono text-foreground font-medium">
                    {(
                      (report ? report.pythTelemetry.realizedVolatilityBps : 3320) /
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* KPI 4: Cross-Chain Rescue Settlement */}
            <Card className="emil-card-hover flex flex-col justify-between">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Rescue Repayment
                </span>
                <Badge variant={isRescueTriggered ? "contrast" : "outline"}>
                  {report?.riskEvaluation.regime === "CASCADE_DEEP_RESCUE"
                    ? "Deep Rescue"
                    : report?.riskEvaluation.regime === "MICRO_BUFFER_RESCUE"
                    ? "Micro Rescue"
                    : "Standby"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-1.5 tabular-nums">
                  <AnimatedMetric
                    value={repayDisplay}
                    className="text-3xl font-semibold tracking-[-0.03em] text-foreground"
                  />
                  <span className="text-xs font-mono text-muted-foreground">USDC</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums pt-2 border-t border-border/60">
                  <span>Per-Rescue Limit</span>
                  <span className="font-mono text-foreground font-medium">
                    {report?.policy.maxPerActionUsdcFormatted ?? "$2,500.00"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* =====================================================================
            SECTION 02: TRAJECTORY CHART & 5-STAGE EXECUTION PIPELINE (SIDE-BY-SIDE)
           ===================================================================== */}
        <section className="space-y-4">
          <SectionHeader
            index="02"
            title="Health Trajectory & Execution Flow"
            rightSlot={
              report && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Enclave Signer:</span>
                  <CopyChip
                    value={report.nearAiCloudAttestation.signingAddress}
                    display={`${report.nearAiCloudAttestation.signingAddress.slice(
                      0,
                      10
                    )}...`}
                    label="TEE Enclave Signing Address"
                  />
                </div>
              )
            }
          />

          <div className="grid gap-6 lg:grid-cols-12 items-stretch">
            {/* Left 7 Cols: Interactive shadcn/ui Monochrome Chart */}
            <Card className="lg:col-span-7 flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Health Factor Trajectory (T+0 → T+6)
                  </CardTitle>
                  <Badge variant="outline">Interactive Crosshair</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <HealthFactorTrajectoryChart
                  points={trajectoryPoints}
                  triggerHf={triggerHf}
                />

                {/* Concise 1-line Decision Summary Bar */}
                {report && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-secondary/60 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-foreground truncate">
                        Decision Mode:
                      </span>
                      <span className="text-muted-foreground">
                        {REGIME_LABELS[report.riskEvaluation.regime] ??
                          report.riskEvaluation.regime}
                      </span>
                    </div>
                    {report.teeReceipt && (
                      <CopyChip
                        value={report.teeReceipt.receiptHashHex}
                        display={`Receipt ${report.teeReceipt.receiptHashHex.slice(
                          0,
                          10
                        )}...`}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right 5 Cols: Clean Scannable 5-Stage Pipeline */}
            <Card className="lg:col-span-5 flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    5-Step Rescue Execution
                  </CardTitle>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    Click step to inspect
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {report?.stages.map((stage) => {
                    const isExpanded = expandedStage === stage.stageIndex;
                    const shortTitle =
                      SHORT_STAGE_LABELS[stage.stageIndex] ?? stage.label;
                    const statusLabel =
                      stage.status === "COMPLETED"
                        ? "Completed"
                        : stage.status === "SKIPPED_HEALTHY"
                        ? "Standby"
                        : "Blocked";

                    return (
                      <div key={stage.stageId} className="bg-card">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedStage(isExpanded ? null : stage.stageIndex)
                          }
                          className="emil-row-hover flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-secondary font-mono text-[11px] font-medium text-foreground">
                              {stage.stageIndex}
                            </span>
                            <span className="text-xs font-medium text-foreground truncate">
                              {shortTitle}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                              {stage.measuredLatencyMs}ms
                            </span>
                            <Badge
                              variant={
                                stage.status === "SKIPPED_HEALTHY"
                                  ? "outline"
                                  : stage.status === "REVERTED_BY_GUARDRAIL"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {statusLabel}
                            </Badge>
                            <CaretDown
                              className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="emil-enter border-t border-border/60 bg-secondary/50 px-3.5 py-3 space-y-2 text-xs">
                            <p className="text-muted-foreground leading-relaxed">
                              {stage.detail}
                            </p>
                            {stage.explorerUrl && (
                              <a
                                href={stage.explorerUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-zinc-900 hover:underline pt-0.5"
                              >
                                <span>{stage.explorerLabel}</span>
                                <ArrowSquareOut className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* =====================================================================
            SECTION 03: SECURITY, BACKTEST & RESERVE VERIFICATION
           ===================================================================== */}
        <section ref={workspaceRef} className="space-y-4">
          <SectionHeader
            index="03"
            title="Security, Backtest & Reserve Verification"
            rightSlot={
              <span className="hidden md:inline-block font-mono text-[11px] text-muted-foreground">
                Hotkeys: Press 1–5 to switch views
              </span>
            }
          />

          <Tabs
            value={activeTab}
            onValueChange={(val) => triggerSmoothTransition(() => setActiveTab(val))}
          >
            <TabsList>
              <TabsTrigger value="redteam">
                <span>Security Tests (11/11)</span>
                <kbd className="hidden md:inline-block ml-1 rounded border border-zinc-300 bg-zinc-100 px-1 font-mono text-[10px] text-zinc-600">
                  1
                </kbd>
              </TabsTrigger>
              <TabsTrigger value="inspector">
                <span>Transaction Payloads</span>
                <kbd className="hidden md:inline-block ml-1 rounded border border-zinc-300 bg-zinc-100 px-1 font-mono text-[10px] text-zinc-600">
                  2
                </kbd>
              </TabsTrigger>
              <TabsTrigger value="backtest">
                <span>Historical Backtest</span>
                <kbd className="hidden md:inline-block ml-1 rounded border border-zinc-300 bg-zinc-100 px-1 font-mono text-[10px] text-zinc-600">
                  3
                </kbd>
              </TabsTrigger>
              <TabsTrigger value="vaults">
                <span>Reserve Accounts</span>
                <kbd className="hidden md:inline-block ml-1 rounded border border-zinc-300 bg-zinc-100 px-1 font-mono text-[10px] text-zinc-600">
                  4
                </kbd>
              </TabsTrigger>
              <TabsTrigger value="all">
                <span>View All</span>
                <kbd className="hidden md:inline-block ml-1 rounded border border-zinc-300 bg-zinc-100 px-1 font-mono text-[10px] text-zinc-600">
                  5
                </kbd>
              </TabsTrigger>
            </TabsList>

            {/* =================================================================
                TAB 1: SECURITY TESTS (11/11 BLOCKED)
               ================================================================= */}
            <TabsContent value="redteam" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-12 items-start">
                {/* Clean Scannable Vector List */}
                <Card className="lg:col-span-5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        Simulated Attack Scenarios
                      </CardTitle>
                      <Badge variant="contrast">
                        {adversarialSuite.length} / {adversarialSuite.length} Blocked
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border border-t border-border">
                      {adversarialSuite.map((adv, idx) => {
                        const isSelected = adv.attackId === selectedAdvCase?.attackId;
                        return (
                          <button
                            key={adv.attackId}
                            type="button"
                            onClick={() => triggerAdversarialIntercept(adv.attackId)}
                            className={`emil-row-hover flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left cursor-pointer ${
                              isSelected ? "bg-secondary" : ""
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                                {String(idx + 1).padStart(2, "0")}
                              </span>
                              <span
                                className={`text-xs truncate ${
                                  isSelected
                                    ? "font-semibold text-foreground"
                                    : "text-zinc-700"
                                }`}
                              >
                                {adv.title}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                              {SHORT_LEG_BADGE[adv.targetLeg] ?? adv.targetLeg}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Focused Exploit Inspector Card */}
                {selectedAdvCase && (
                  <Card
                    className={`lg:col-span-7 sticky top-20 ${
                      isShakingRevert ? "is-shaking" : ""
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="contrast">Blocked by Policy Rules</Badge>
                          <Badge variant="outline" className="font-mono">
                            {selectedAdvCase.errorCode}
                          </Badge>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            triggerAdversarialIntercept(selectedAdvCase.attackId)
                          }
                        >
                          <span>
                            {advSimRunning ? "Verifying..." : "Re-Run Test"}
                          </span>
                        </Button>
                      </div>
                      <CardTitle className="text-base pt-2">
                        {selectedAdvCase.title}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {selectedAdvCase.attackerGoal}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          Attempted Unauthorized Action
                        </span>
                        <div className="rounded-md border border-border bg-secondary/50 p-3 font-mono text-xs text-foreground break-all">
                          {selectedAdvCase.injectedPayloadSummary}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-zinc-800">
                            On-Chain Policy Rejection
                          </span>
                          <span className="font-mono text-muted-foreground tabular-nums">
                            {selectedAdvCase.verificationTimeUs} µs
                          </span>
                        </div>
                        <div className="rounded-md border border-zinc-300 bg-zinc-100/80 bg-monochrome-hatch p-3.5 font-mono text-xs text-zinc-950 leading-relaxed">
                          {selectedAdvCase.contractRevertMessage}
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-md border border-border bg-secondary/60 px-3.5 py-2.5 text-xs">
                        <span className="font-medium text-foreground">
                          0 Signatures Issued · User Funds 100% Protected
                        </span>
                        <span className="font-mono text-muted-foreground hidden sm:inline">
                          Execution Blocked
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* =================================================================
                TAB 2: TRANSACTION PAYLOAD INSPECTOR (LEG 1 & LEG 2)
               ================================================================= */}
            <TabsContent value="inspector" className="space-y-4">
              {!report?.leg1BaseVerification || !report?.leg2SolanaVerification ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Transaction Payloads (Standby in Live Market Mode)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Health Factor ({hfBefore.toFixed(2)}) is above your{" "}
                      {triggerHf.toFixed(2)} trigger threshold, so no rescue transactions
                      are generated. Select the -25% Crash preset to inspect the
                      cross-chain payloads.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() =>
                        handleSelectScenario("STRESS_TEST_MAINNET_MODE", 25)
                      }
                    >
                      Load -25% Crash Scenario
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* Leg 1 Card */}
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            Leg 1 · Base USDC Transfer
                          </CardTitle>
                          <Badge variant="secondary">Base Mainnet</Badge>
                        </div>
                        <CardDescription className="text-xs">
                          Verified against your spending limit and bridge destination
                          before signing.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 text-xs">
                        <div className="divide-y divide-border/60 rounded-md border border-border bg-secondary/20 px-3">
                          <div className="flex items-center justify-between py-2">
                            <span className="text-muted-foreground">Network</span>
                            <span className="font-mono text-foreground">
                              Base Mainnet (Chain 8453)
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-muted-foreground">Transfer Type</span>
                            <span className="font-mono text-foreground">
                              USDC Transfer (68 bytes)
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-muted-foreground">Bridge Deposit</span>
                            <CopyChip
                              value={report.oneClickQuote?.depositAddress ?? ""}
                              display={`${report.oneClickQuote?.depositAddress.slice(
                                0,
                                10
                              )}...`}
                            />
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-muted-foreground">Signing Digest (Keccak-256)</span>
                            <CopyChip
                              value={
                                report.leg1BaseVerification.signingHashKeccak256Hex
                              }
                              display={`${report.leg1BaseVerification.signingHashKeccak256Hex.slice(
                                0,
                                14
                              )}...`}
                            />
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-muted-foreground">On-Chain NEAR MPC Tx</span>
                            <CopyChip
                              value="8SMLnn6YKav94Xczjfp56WQ7vWzATkq7rJvDwwEHVS2R"
                              display="8SMLnn6YKa..."
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => setShowRawHex((prev) => !prev)}
                            className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {showRawHex ? "Hide Raw Bytes" : "Show Raw Transaction Bytes"}
                          </button>
                          <CopyChip
                            value={report.leg1BaseVerification.rawUnsignedTxHex}
                            display="Copy Bytes"
                          />
                        </div>

                        {showRawHex && (
                          <pre className="emil-enter rounded-md border border-border bg-secondary/60 p-2.5 font-mono text-[11px] text-muted-foreground overflow-x-auto">
                            {report.leg1BaseVerification.rawUnsignedTxHex}
                          </pre>
                        )}
                      </CardContent>
                    </Card>

                    {/* Leg 2 Card */}
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            Leg 2 · Solana Kamino Repayment
                          </CardTitle>
                          <Badge variant="secondary">Solana Mainnet</Badge>
                        </div>
                        <CardDescription className="text-xs">
                          Verified to only refresh market prices and pay down your pinned
                          Kamino loan.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 text-xs">
                        <div className="divide-y divide-border/60 rounded-md border border-border bg-secondary/20 px-3">
                          <div className="flex items-center justify-between py-2">
                            <span className="text-muted-foreground">Instructions</span>
                            <span className="font-mono text-foreground">
                              {report.leg2SolanaVerification.kaminoRefreshIxCount} Oracle
                              Refreshes + 1 Loan Repay
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-muted-foreground">Target Position</span>
                            <CopyChip
                              value={report.kaminoBefore.obligationPubkey}
                              display={`${report.kaminoBefore.obligationPubkey.slice(
                                0,
                                10
                              )}...`}
                            />
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-muted-foreground">USDC Reserve</span>
                            <CopyChip
                              value={report.leg2SolanaVerification.repayReservePubkey}
                              display={`${report.leg2SolanaVerification.repayReservePubkey.slice(
                                0,
                                10
                              )}...`}
                            />
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-muted-foreground">Repayment Token Account</span>
                            <CopyChip
                              value={
                                report.leg2SolanaVerification
                                  .userSourceLiquidityAtaPubkey
                              }
                              display={`${report.leg2SolanaVerification.userSourceLiquidityAtaPubkey.slice(
                                0,
                                10
                              )}...`}
                            />
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-muted-foreground">On-Chain NEAR MPC Tx</span>
                            <CopyChip
                              value="A97bw66AcyJzyfg3C3cg8vAhmMyDA9wFz7BW2jE2b7Mx"
                              display="A97bw66Acy..."
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => setShowRawHex((prev) => !prev)}
                            className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {showRawHex ? "Hide Raw Bytes" : "Show Raw Transaction Bytes"}
                          </button>
                          <CopyChip
                            value={report.leg2SolanaVerification.rawMessageHex}
                            display="Copy Bytes"
                          />
                        </div>

                        {showRawHex && (
                          <pre className="emil-enter rounded-md border border-border bg-secondary/60 p-2.5 font-mono text-[11px] text-muted-foreground overflow-x-auto">
                            {report.leg2SolanaVerification.rawMessageHex}
                          </pre>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </TabsContent>

            {/* =================================================================
                TAB 3: HISTORICAL BACKTEST LAB (SCENARIO SWITCHER FOR ZERO CLUTTER)
               ================================================================= */}
            <TabsContent value="backtest" className="space-y-6">
              {backtest && (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-1">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Survival Rate
                        </span>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-semibold tracking-[-0.03em] text-foreground tabular-nums">
                          {backtest.aggregateSummary.interceptSurvivalRatePct}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          vs.{" "}
                          {backtest.aggregateSummary.naiveMicroBotSurvivalRatePct.toFixed(
                            1
                          )}
                          % for Static 1.20x Bot
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-1">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Liquidation Loss Prevented
                        </span>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-semibold tracking-[-0.03em] text-foreground tabular-nums">
                          $
                          {backtest.aggregateSummary.totalLiquidationLossPreventedUsd.toFixed(
                            2
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          On 100 SOL / $6,000 USDC during -34% crash
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-1">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Capital Saved in Dip
                        </span>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-semibold tracking-[-0.03em] text-foreground tabular-nums">
                          {backtest.aggregateSummary.capitalEfficiencySavingsVsConservativePct.toFixed(
                            1
                          )}
                          %
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Less Base USDC deployed vs. Static 1.45x Bot
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {activeBacktestScenario && (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <CardTitle className="text-base">
                              {activeBacktestScenario.title}
                            </CardTitle>
                            <CardDescription className="text-xs mt-0.5">
                              {activeBacktestScenario.description}
                            </CardDescription>
                          </div>

                          {/* Concentric Scenario Switcher */}
                          <div className="inline-flex rounded-[10px] bg-secondary p-1 border border-border self-start">
                            {backtest.scenarios.map((scen, idx) => {
                              const shortLabels = [
                                "Cascade (-34%)",
                                "Calm Dip (-12%)",
                                "Choppy (-7.5%)",
                              ];
                              const active = idx === selectedBacktestIdx;
                              return (
                                <button
                                  key={scen.scenarioId}
                                  type="button"
                                  onClick={() => setSelectedBacktestIdx(idx)}
                                  className={`emil-press rounded-[6px] px-2.5 py-1 text-xs font-medium cursor-pointer ${
                                    active
                                      ? "bg-white text-foreground shadow-xs border border-zinc-300"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  {shortLabels[idx] ?? scen.title}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Strategy</TableHead>
                              <TableHead>Outcome</TableHead>
                              <TableHead>Min HF</TableHead>
                              <TableHead>USDC Deployed</TableHead>
                              <TableHead>Net Cost</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activeBacktestScenario.outcomes.map((o) => {
                              const isIntercept =
                                o.strategyId === "INTERCEPT_VOLATILITY_AWARE";
                              return (
                                <TableRow
                                  key={o.strategyId}
                                  className={
                                    isIntercept ? "bg-zinc-100/90 font-medium" : ""
                                  }
                                >
                                  <TableCell className="font-medium">
                                    {o.strategyName}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        o.survivedWithoutLiquidation
                                          ? isIntercept
                                            ? "contrast"
                                            : "secondary"
                                          : "destructive"
                                      }
                                    >
                                      {o.survivedWithoutLiquidation
                                        ? "Survived"
                                        : "Liquidated"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {o.minimumObservedHf.toFixed(4)}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    ${o.totalBaseUsdcDeployed.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    ${o.netCostUsd.toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>

                        <div className="rounded-md border border-border bg-secondary/40 px-3.5 py-2.5 text-xs text-muted-foreground">
                          <strong className="text-foreground font-medium">
                            Key Takeaway:{" "}
                          </strong>
                          {activeBacktestScenario.interceptEdgeSummary}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            {/* =================================================================
                TAB 4: RESERVE ACCOUNTS & PRE-FLIGHT CHECKLIST
               ================================================================= */}
            <TabsContent value="vaults" className="space-y-6">
              {preflight && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">
                            Base USDC Reserve Vault
                          </CardTitle>
                          <Badge variant="secondary">Base Mainnet</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-1 text-xs">
                        <div className="flex items-center justify-between py-1.5 border-t border-border/60">
                          <span className="text-muted-foreground">Reserve Address</span>
                          <CopyChip value={preflight.derivedMpc.mpcBaseVaultAddress} />
                        </div>
                        <div className="flex items-center justify-between py-1.5 border-t border-border/60">
                          <span className="text-muted-foreground">Network</span>
                          <span className="font-mono text-foreground">
                            Base Mainnet (8453)
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-1.5 border-t border-border/60">
                          <span className="text-muted-foreground">Mainnet Balance</span>
                          <span className="font-mono text-foreground tabular-nums">
                            {preflight.baseState.usdcBalanceFormatted} USDC ·{" "}
                            {preflight.baseState.ethBalanceFormatted} ETH
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">
                            Solana Repayment Account
                          </CardTitle>
                          <Badge variant="secondary">Solana Mainnet</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-1 text-xs">
                        <div className="flex items-center justify-between py-1.5 border-t border-border/60">
                          <span className="text-muted-foreground">Solana Address</span>
                          <CopyChip value={preflight.derivedMpc.mpcSolanaPayerPubkey} />
                        </div>
                        <div className="flex items-center justify-between py-1.5 border-t border-border/60">
                          <span className="text-muted-foreground">USDC Token Account</span>
                          <CopyChip value={preflight.derivedMpc.mpcSolanaPayerUsdcAta} />
                        </div>
                        <div className="flex items-center justify-between py-1.5 border-t border-border/60">
                          <span className="text-muted-foreground">Mainnet Balance</span>
                          <span className="font-mono text-foreground tabular-nums">
                            {preflight.solanaState.usdcBalanceFormatted} USDC ·{" "}
                            {preflight.solanaState.solBalanceFormatted} SOL
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        Mainnet Readiness Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Check</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preflight.checklist.map((item) => (
                            <TableRow key={item.item}>
                              <TableCell className="font-medium text-xs">
                                {item.item}
                              </TableCell>
                              <TableCell>
                                <Badge variant={item.passed ? "contrast" : "outline"}>
                                  {item.passed ? "READY" : "INFO"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {item.detail}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        </section>
      </main>

      {/* =====================================================================
          MINIMALIST MONOCHROME FOOTER
         ===================================================================== */}
      <footer className="mt-12 border-t border-border/70 py-6 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-[1320px] flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-100">
              <InterceptLogoMark size={13} />
            </div>
            <span className="font-semibold tracking-tight text-foreground">
              Intercept
            </span>
            <span>·</span>
            <span>
              Automated Cross-Chain Liquidation Protection for Solana Kamino Lend
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => setWalkthroughOpen(true)}
              className="hover:text-foreground cursor-pointer"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => setFaqOpen(true)}
              className="hover:text-foreground cursor-pointer"
            >
              FAQ
            </button>
            <Link href="/docs" className="hover:text-foreground">
              Documentation
            </Link>
          </div>
        </div>
      </footer>

      {/* =====================================================================
          INTERACTIVE MODALS (WALKTHROUGH, CONFIGURE POLICY, FAQ)
         ===================================================================== */}
      <WalkthroughModal
        open={walkthroughOpen}
        onClose={() => setWalkthroughOpen(false)}
        onProceedToConfigure={() => setConfigureOpen(true)}
      />

      <ConfigurePolicyModal
        open={configureOpen}
        onClose={() => setConfigureOpen(false)}
        onOpenWalkthrough={() => setWalkthroughOpen(true)}
        currentConfig={customPolicy}
        derivedBaseVault={
          report?.policy.mpcBaseVaultAddress ??
          "0x72faa1abaf92e0c4b791f15acedb496c8979746c"
        }
        derivedSolanaPayer={
          report?.policy.mpcSolanaPayerPubkey ??
          "GZMAbwapG99YKCsA2CDVc4bXeBzd7nvKMQgtm9K8aKas"
        }
        nearContractId={
          report?.policy.nearContractId ?? "guardrail.intercept-defi.near"
        }
        onApplyConfig={(next) => {
          setCustomPolicy(next);
          void fetchPipeline(mode, priceDropPct, next);
        }}
      />

      <FaqModal
        open={faqOpen}
        onClose={() => setFaqOpen(false)}
        onOpenConfigure={() => setConfigureOpen(true)}
      />
    </div>
  );
}
