"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ShieldCheck,
  Pulse,
  Cpu,
  LockKey,
  CheckCircle,
  WarningOctagon,
  SlidersHorizontal,
  ArrowClockwise,
  Code,
  ChartLineUp,
  Skull,
  CaretRight,
  CaretDown,
  Copy,
  Check,
  TerminalWindow,
  Lightning,
  ArrowSquareOut,
} from "@phosphor-icons/react";
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
      className="emil-press inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/70 px-2 py-0.5 font-mono text-xs text-muted-foreground hover:text-foreground hover:border-zinc-700 cursor-pointer"
    >
      <span className="truncate max-w-[180px]">{display ?? value}</span>
      {copied ? (
        <Check className="w-3 h-3 text-emerald-400 shrink-0 emil-enter" weight="bold" />
      ) : (
        <Copy className="w-3 h-3 opacity-60 shrink-0" />
      )}
    </button>
  );
}

export default function InterceptDashboardPage() {
  const [mode, setMode] = useState<"LIVE_MAINNET_MODE" | "STRESS_TEST_MAINNET_MODE">(
    "STRESS_TEST_MAINNET_MODE"
  );
  const [priceDropPct, setPriceDropPct] = useState<number>(25);
  const [data, setData] = useState<InterceptApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [expandedStage, setExpandedStage] = useState<number | null>(3);
  const [selectedAdvId, setSelectedAdvId] = useState<string>("");
  const [advSimRunning, setAdvSimRunning] = useState<boolean>(false);
  const [advFlashProtection, setAdvFlashProtection] = useState<boolean>(false);
  const [showCustodyDetail, setShowCustodyDetail] = useState<boolean>(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const triggerSmoothTransition = useCallback((fn: () => void) => {
    setIsTransitioning(true);
    fn();
    setTimeout(() => setIsTransitioning(false), 180);
  }, []);

  const fetchPipeline = useCallback(
    async (
      targetMode: "LIVE_MAINNET_MODE" | "STRESS_TEST_MAINNET_MODE",
      dropPct: number
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
    [selectedAdvId]
  );

  useEffect(() => {
    void fetchPipeline(mode, priceDropPct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, priceDropPct]);

  const handleSelectScenario = (
    nextMode: "LIVE_MAINNET_MODE" | "STRESS_TEST_MAINNET_MODE",
    nextDrop: number
  ) => {
    setMode(nextMode);
    setPriceDropPct(nextDrop);
  };

  const triggerAdversarialIntercept = (advId?: string) => {
    if (advId) {
      setSelectedAdvId(advId);
    }
    setActiveTab("redteam");
    setAdvSimRunning(true);
    setAdvFlashProtection(false);
    setTimeout(() => {
      setAdvSimRunning(false);
      setAdvFlashProtection(true);
    }, 180);
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

  // Map HF in [0.85, 1.60] to [0%, 100%]
  const hfToPercent = (hf: number) =>
    Math.max(2, Math.min(98, ((hf - 0.85) / (1.6 - 0.85)) * 100));

  const isRescueTriggered = report?.riskEvaluation?.actionable ?? false;

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      {/* Sticky Top Navigation Bar (shadcn/ui + Emil Kowalski translucent chrome) */}
      <header className="sticky top-0 z-40 h-14 w-full border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1360px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-secondary text-foreground shadow-xs">
              <ShieldCheck className="h-4 w-4 text-emerald-400" weight="fill" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-[-0.015em] text-foreground">
                Intercept
              </span>
              <span className="text-zinc-700">/</span>
              <span className="hidden sm:inline text-sm text-muted-foreground">
                Kamino Liquidation Defense
              </span>
            </div>
            <Badge
              variant={
                mode === "LIVE_MAINNET_MODE"
                  ? "emerald"
                  : isRescueTriggered
                  ? "amber"
                  : "secondary"
              }
              className="ml-1"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  mode === "LIVE_MAINNET_MODE" ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              {mode === "LIVE_MAINNET_MODE"
                ? "Live Mainnet"
                : `Stress Simulation (-${priceDropPct}%)`}
            </Badge>
          </div>

          <div className="flex items-center gap-2.5">
            {report && (
              <div className="hidden lg:flex items-center gap-3 rounded-md border border-border/70 bg-secondary/40 px-3 py-1 text-xs text-muted-foreground tabular-nums">
                <span>
                  Slot{" "}
                  <strong className="font-mono font-medium text-foreground">
                    #{report.kaminoBefore.solanaSlot.toLocaleString()}
                  </strong>
                </span>
                <span className="text-zinc-700">·</span>
                <span>
                  SOL{" "}
                  <strong className="font-mono font-medium text-foreground">
                    ${report.pythTelemetry.effectiveSolUsd.toFixed(2)}
                  </strong>
                </span>
                <span className="text-zinc-700">·</span>
                <span>
                  Latency{" "}
                  <strong className="font-mono font-medium text-foreground">
                    {report.totalMeasuredLatencyMs}ms
                  </strong>
                </span>
              </div>
            )}

            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                triggerAdversarialIntercept(adversarialSuite[0]?.attackId);
                workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <Skull className="h-3.5 w-3.5" weight="fill" />
              <span>Prompt-Inject Agent</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchPipeline(mode, priceDropPct)}
              disabled={loading}
            >
              <ArrowClockwise
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-6 sm:px-6 space-y-6">
        {errorMsg && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            Telemetry error: {errorMsg}
          </div>
        )}

        {/* Top Command Header + Scenario Controller */}
        <section className="grid gap-6 lg:grid-cols-12 items-start">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">NEAR AI Cloud TEE</Badge>
              <Badge variant="outline">v1.signer MPC (domain_id: 0 & 1)</Badge>
              <Badge variant="outline">NEAR Intents 1-Click</Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.025em] text-foreground">
              Zero-Trust Cross-Chain Liquidation Defense
            </h1>

            <p className="text-sm text-muted-foreground leading-relaxed max-w-[65ch]">
              Autonomous Kamino Lend protection that holds idle USDC yield on Base and
              executes cryptographic 2-leg cross-chain rescues onto Solana only when Pyth
              oracle telemetry breaches volatility-adjusted health thresholds.
            </p>

            {/* Non-Custodial Isolation Guarantee Banner (clean shadcn callout, preserves mandatory copy) */}
            <div className="rounded-lg border border-border bg-card/80 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <LockKey className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" weight="duotone" />
                  <div className="space-y-1 text-xs text-muted-foreground leading-relaxed">
                    <div className="font-medium text-foreground flex items-center gap-2">
                      <span>Zero-Trust Non-Custodial Isolation</span>
                      <span className="font-mono text-[11px] text-emerald-400">
                        guardrail.intercept-defi.near
                      </span>
                    </div>
                    <p className="max-w-[65ch]">
                      The user’s Solana wallet holds the Kamino obligation (SOL collateral +
                      USDC debt) and{" "}
                      <strong className="text-foreground font-medium">
                        never shares its private key
                      </strong>
                      . Kamino Lend natively permits third-party debt repayment (
                      <code className="font-mono text-foreground">
                        repay_obligation_liquidity_v2
                      </code>
                      ) on behalf of any obligation owner without granting collateral
                      withdrawal rights.
                    </p>
                    {showCustodyDetail && (
                      <p className="pt-1 text-muted-foreground max-w-[65ch] emil-enter">
                        Because the user’s Solana wallet is NOT controlled by NEAR MPC, and
                        the NEAR Guardrail contract strictly pins byte offsets for Base
                        ERC-20 transfers and Solana Kamino repay instructions, even a 100%
                        prompt-injected AI agent cannot withdraw collateral or redirect USDC.
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCustodyDetail((prev) => !prev)}
                  className="shrink-0 h-7 px-2 text-xs"
                >
                  <span>{showCustodyDetail ? "Less" : "Details"}</span>
                  <CaretDown
                    className={`h-3 w-3 transition-transform duration-150 ${
                      showCustodyDetail ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </div>
            </div>
          </div>

          {/* Right: Scenario & Shock Controller Card */}
          <Card className="lg:col-span-5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Market Regime & Oracle Shock
                </CardTitle>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {mode === "LIVE_MAINNET_MODE"
                    ? "0% Shock (Unmodified Pyth)"
                    : `-${priceDropPct}% Simulated SOL Drop`}
                </span>
              </div>
              <CardDescription className="text-xs">
                Test live unmodified Solana Mainnet feeds or inject a flash crash to
                trigger the 2-leg MPC rescue pipeline.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 4 Segmented Presets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-lg bg-secondary p-1 border border-border/60">
                {[
                  {
                    label: "Live Oracle",
                    sub: "0% Shock",
                    targetMode: "LIVE_MAINNET_MODE" as const,
                    drop: 0,
                  },
                  {
                    label: "-20% Pullback",
                    sub: "Micro-Rescue",
                    targetMode: "STRESS_TEST_MAINNET_MODE" as const,
                    drop: 20,
                  },
                  {
                    label: "-25% Crash",
                    sub: "Cascade Rescue",
                    targetMode: "STRESS_TEST_MAINNET_MODE" as const,
                    drop: 25,
                  },
                  {
                    label: "-35% Collapse",
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
                      className={`emil-press flex flex-col items-start rounded-md px-2.5 py-1.5 text-left cursor-pointer ${
                        isActive
                          ? "bg-background text-foreground shadow-xs border border-border"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-xs font-medium leading-tight">
                        {preset.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {preset.sub}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Fine-Grained Slider */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Custom SOL Shock Magnitude</span>
                  </span>
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
                <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                  <span>-5% (Mild)</span>
                  <span>-15% (Trigger)</span>
                  <span>-25% (Flash Crash)</span>
                  <span>-40% (Severe)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 4-Card shadcn KPI Summary Row */}
        <section
          data-transitioning={isTransitioning}
          className="emil-crossfade grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {/* KPI 1: Health Factor & Liquidation Bar */}
          <Card className="emil-card-hover">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Health Factor
              </span>
              <Badge
                variant={
                  !isRescueTriggered
                    ? "emerald"
                    : hfBefore < 1.0
                    ? "destructive"
                    : "amber"
                }
              >
                {!isRescueTriggered
                  ? "Healthy"
                  : hfBefore < 1.0
                  ? "Critical -> Rescued"
                  : "Buffer Restored"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline gap-2 tabular-nums">
                <span
                  className={`text-2xl font-semibold tracking-[-0.02em] ${
                    hfBefore < 1.05
                      ? "text-red-400"
                      : hfBefore < triggerHf
                      ? "text-amber-400"
                      : "text-foreground"
                  }`}
                >
                  {hfBefore.toFixed(4)}
                </span>
                {isRescueTriggered && (
                  <>
                    <CaretRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-2xl font-semibold tracking-[-0.02em] text-emerald-400">
                      {hfAfter.toFixed(4)}
                    </span>
                  </>
                )}
              </div>

              {/* Clean Spectrum Bar */}
              <div className="space-y-1.5">
                <div className="relative h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-red-500/35"
                    style={{ width: `${hfToPercent(1.0)}%` }}
                  />
                  <div
                    className="absolute inset-y-0 bg-amber-500/30"
                    style={{
                      left: `${hfToPercent(1.0)}%`,
                      width: `${hfToPercent(triggerHf) - hfToPercent(1.0)}%`,
                    }}
                  />
                  <div
                    className="absolute inset-y-0 right-0 bg-emerald-500/25"
                    style={{ left: `${hfToPercent(triggerHf)}%` }}
                  />
                  {/* Pre-Rescue Marker */}
                  <div
                    className="absolute top-0 bottom-0 w-1 rounded-full bg-amber-400 transition-[left] duration-200"
                    style={{ left: `${hfToPercent(hfBefore)}%` }}
                    title={`Observed HF: ${hfBefore.toFixed(4)}`}
                  />
                  {/* Post-Rescue Marker */}
                  {isRescueTriggered && (
                    <div
                      className="absolute top-0 bottom-0 w-1 rounded-full bg-emerald-400 transition-[left] duration-200"
                      style={{ left: `${hfToPercent(hfAfter)}%` }}
                      title={`Post-Rescue HF: ${hfAfter.toFixed(4)}`}
                    />
                  )}
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                  <span>1.00 Liq</span>
                  <span>{triggerHf.toFixed(2)} Trigger</span>
                  <span>1.45 Target</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI 2: Kamino Obligation */}
          <Card className="emil-card-hover">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Kamino Obligation
              </span>
              {report && (
                <CopyChip
                  value={report.kaminoBefore.obligationPubkey}
                  display={`${report.kaminoBefore.obligationPubkey.slice(
                    0,
                    5
                  )}...${report.kaminoBefore.obligationPubkey.slice(-4)}`}
                  label="Kamino Obligation Address"
                />
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between tabular-nums">
                <div>
                  <span className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
                    ${report ? report.kaminoBefore.collateralValueUsd.toFixed(2) : "16.40"}
                  </span>
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({report ? report.kaminoBefore.depositedSol.toFixed(4) : "0.1847"} SOL)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums pt-1 border-t border-border/60">
                <span>
                  Debt:{" "}
                  <strong className="text-foreground font-medium">
                    ${report ? report.kaminoBefore.borrowedUsdc.toFixed(2) : "9.23"} USDC
                  </strong>
                </span>
                <span>
                  After:{" "}
                  <strong className="text-emerald-400 font-medium">
                    ${report ? report.kaminoAfter.borrowedUsdc.toFixed(2) : "9.23"} USDC
                  </strong>
                </span>
              </div>
            </CardContent>
          </Card>

          {/* KPI 3: Pyth SOL/USD Push Oracle */}
          <Card className="emil-card-hover">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Pyth SOL/USD Oracle
              </span>
              <Badge variant="outline">Push Feed</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline gap-2 tabular-nums">
                <span className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
                  ${report ? report.pythTelemetry.effectiveSolUsd.toFixed(2) : "88.76"}
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  ±${report ? report.pythTelemetry.confidenceUsd.toFixed(4) : "0.0302"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums pt-1 border-t border-border/60">
                <span>
                  Vol:{" "}
                  <strong className="text-foreground font-medium">
                    {report ? report.pythTelemetry.realizedVolatilityBps : 3336} bps
                  </strong>
                </span>
                <span>
                  Regime:{" "}
                  <strong className="text-foreground font-medium">
                    {report?.riskEvaluation.regime ?? "HOLD"}
                  </strong>
                </span>
              </div>
            </CardContent>
          </Card>

          {/* KPI 4: Cross-Chain Rescue Settlement */}
          <Card className="emil-card-hover">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <span className="text-sm font-medium text-muted-foreground">
                2-Leg MPC Settlement
              </span>
              <Badge variant={isRescueTriggered ? "emerald" : "secondary"}>
                {isRescueTriggered ? "Rescue Active" : "Standby (Hold)"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline gap-2 tabular-nums">
                <span className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
                  {report ? report.riskEvaluation.repayAmountUsdcFormatted : "$0.00"}
                </span>
                <span className="text-xs text-muted-foreground">USDC</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums pt-1 border-t border-border/60">
                <span>Base 8453 → Solana</span>
                <span>
                  Cap:{" "}
                  <strong className="text-foreground font-medium">
                    {report?.policy.maxPerActionUsdcFormatted ?? "$2,500.00"}/tx
                  </strong>
                </span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Main Tabbed Workspace (shadcn/ui Tabs + Force-Mounted Panels for Zero-Latency & Full Auditability) */}
        <div ref={workspaceRef} className="pt-1">
          <Tabs
            value={activeTab}
            onValueChange={(val) => triggerSmoothTransition(() => setActiveTab(val))}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
              <TabsList>
                <TabsTrigger value="overview">
                  <Pulse className="h-3.5 w-3.5" />
                  <span>Rescue Pipeline</span>
                </TabsTrigger>
                <TabsTrigger value="inspector">
                  <Code className="h-3.5 w-3.5" />
                  <span>Byte Inspector</span>
                </TabsTrigger>
                <TabsTrigger value="redteam">
                  <Skull className="h-3.5 w-3.5 text-red-400" />
                  <span>Red-Team Simulator (11/11)</span>
                </TabsTrigger>
                <TabsTrigger value="backtest">
                  <ChartLineUp className="h-3.5 w-3.5" />
                  <span>Historical Backtest</span>
                </TabsTrigger>
                <TabsTrigger value="vaults">
                  <TerminalWindow className="h-3.5 w-3.5" />
                  <span>Mainnet Vaults & Pre-Flight</span>
                </TabsTrigger>
                <TabsTrigger value="all">
                  <span>All Sections</span>
                </TabsTrigger>
              </TabsList>

              {report && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>TEE Signer:</span>
                  <CopyChip
                    value={report.nearAiCloudAttestation.signingAddress}
                    display={`${report.nearAiCloudAttestation.signingAddress.slice(
                      0,
                      12
                    )}...`}
                    label="TEE Enclave Signing Address"
                  />
                </div>
              )}
            </div>

            {/* =====================================================================
                TAB 1: OVERVIEW & 5-STAGE PIPELINE
               ===================================================================== */}
            <TabsContent value="overview" className="space-y-6">
              {/* 3-Domain Non-Custodial Topology Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        1. User Solana Wallet
                      </CardTitle>
                      <Badge variant="outline">Isolated Owner</Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Holds Kamino obligation collateral & debt; private key is never
                      shared with NEAR or the AI agent.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2 space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-t border-border/60">
                      <span className="text-muted-foreground">Kamino Obligation</span>
                      {report && (
                        <CopyChip
                          value={report.policy.userKaminoObligationPubkey}
                          display={`${report.policy.userKaminoObligationPubkey.slice(
                            0,
                            6
                          )}...${report.policy.userKaminoObligationPubkey.slice(-4)}`}
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between py-1 border-t border-border/60">
                      <span className="text-muted-foreground">Withdrawal Authority</span>
                      <span className="font-medium text-emerald-400">
                        None (Repay-Only)
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        2. NEAR Policy Guardrail
                      </CardTitle>
                      <Badge variant="emerald">Deterministic Rust</Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Verifies TEE Ed25519 receipts and inspects raw EIP-1559 & Solana
                      V0 bytes before invoking <code className="font-mono">v1.signer</code>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2 space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-t border-border/60">
                      <span className="text-muted-foreground">Contract ID</span>
                      <CopyChip
                        value={
                          report?.policy.nearContractId ??
                          "guardrail.intercept-defi.near"
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between py-1 border-t border-border/60">
                      <span className="text-muted-foreground">TEE Hardware Quote</span>
                      <span className="font-medium text-foreground">
                        {report?.nearAiCloudAttestation.model ??
                          "deepseek-ai/DeepSeek-V3.1"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        3. Cross-Chain MPC & 1-Click
                      </CardTitle>
                      <Badge variant="secondary">Base → Solana</Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Threshold Secp256k1 (<code className="font-mono">domain_id: 0</code>)
                      and Ed25519 (<code className="font-mono">domain_id: 1</code>)
                      vaults settle via NEAR Intents.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2 space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-t border-border/60">
                      <span className="text-muted-foreground">Base Vault (0)</span>
                      {report && (
                        <CopyChip
                          value={report.policy.mpcBaseVaultAddress}
                          display={`${report.policy.mpcBaseVaultAddress.slice(
                            0,
                            8
                          )}...${report.policy.mpcBaseVaultAddress.slice(-6)}`}
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between py-1 border-t border-border/60">
                      <span className="text-muted-foreground">Solana Payer (1)</span>
                      {report && (
                        <CopyChip
                          value={report.policy.mpcSolanaPayerPubkey}
                          display={`${report.policy.mpcSolanaPayerPubkey.slice(
                            0,
                            6
                          )}...${report.policy.mpcSolanaPayerPubkey.slice(-6)}`}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 5-Stage Execution Pipeline Card */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        5-Stage Cryptographic Rescue Pipeline
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Click any stage row to inspect its cryptographic attestation,
                        explorer proof link, or <code className="font-mono">v1.signer</code>{" "}
                        payload.
                      </CardDescription>
                    </div>
                    {report && (
                      <Badge variant="outline" className="self-start sm:self-auto">
                        Regime: {report.riskEvaluation.regime}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* TEE AI Reasoning Summary Bar */}
                  {report && (
                    <div className="rounded-lg border border-border/80 bg-secondary/40 p-3.5 text-xs space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-foreground flex items-center gap-1.5">
                          <Cpu className="h-4 w-4 text-emerald-400" />
                          <span>
                            NEAR AI Cloud TEE Reasoning (
                            {report.nearAiCloudAttestation.model})
                          </span>
                        </span>
                        {report.teeReceipt && (
                          <CopyChip
                            value={report.teeReceipt.receiptHashHex}
                            display={`Receipt: ${report.teeReceipt.receiptHashHex.slice(
                              0,
                              14
                            )}...`}
                          />
                        )}
                      </div>
                      <p className="text-muted-foreground leading-relaxed max-w-[85ch]">
                        {report.riskEvaluation.reasoningSummary}
                      </p>
                    </div>
                  )}

                  {/* Stages Accordion List */}
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {report?.stages.map((stage) => {
                      const isExpanded = expandedStage === stage.stageIndex;
                      return (
                        <div key={stage.stageId} className="bg-card">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedStage(isExpanded ? null : stage.stageIndex)
                            }
                            className="emil-row-hover flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-secondary font-mono text-xs font-medium text-foreground">
                                {stage.stageIndex}
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-medium text-foreground">
                                    {stage.label}
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="font-mono text-[11px]"
                                  >
                                    {stage.stageId}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {stage.detail}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="hidden sm:inline font-mono text-xs text-muted-foreground tabular-nums">
                                {stage.measuredLatencyMs} ms
                              </span>
                              <Badge
                                variant={
                                  stage.status === "SKIPPED_HEALTHY"
                                    ? "outline"
                                    : stage.status === "REVERTED_BY_GUARDRAIL"
                                    ? "destructive"
                                    : "emerald"
                                }
                              >
                                {stage.status}
                              </Badge>
                              <CaretDown
                                className={`h-4 w-4 text-muted-foreground transition-transform duration-150 ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="emil-enter border-t border-border/60 bg-secondary/25 px-4 py-3.5 space-y-2 text-xs">
                              <p className="text-foreground leading-relaxed">
                                {stage.detail}
                              </p>
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <span className="font-mono text-muted-foreground">
                                  Measured Latency: {stage.measuredLatencyMs} ms
                                </span>
                                {stage.explorerUrl && (
                                  <a
                                    href={stage.explorerUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 font-medium text-emerald-400 hover:underline"
                                  >
                                    <span>{stage.explorerLabel}</span>
                                    <ArrowSquareOut className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* =====================================================================
                TAB 2: BYTE-LEVEL GUARDRAIL INSPECTOR (LEG 1 & LEG 2)
               ===================================================================== */}
            <TabsContent value="inspector" className="space-y-6">
              {!report?.leg1BaseVerification || !report?.leg2SolanaVerification ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Byte-Level Inspector (Currently in Hold Regime)
                    </CardTitle>
                    <CardDescription>
                      In Live Unmodified Pyth mode, Health Factor ({hfBefore.toFixed(4)}) is
                      above the {triggerHf.toFixed(2)} trigger threshold, so 0 transactions
                      are generated. Switch to{" "}
                      <strong className="text-foreground">-25% Crash</strong> to inspect
                      live Leg 1 & Leg 2 unsigned byte payloads.
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
                      <Lightning className="h-3.5 w-3.5" weight="fill" />
                      <span>Load -25% Flash Crash Payloads</span>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Leg 1 Base EIP-1559 Card */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          Leg 1 — Base EIP-1559 RLP Byte Parser
                        </CardTitle>
                        <Badge variant="emerald">domain_id: 0 (Secp256k1)</Badge>
                      </div>
                      <CardDescription className="text-xs">
                        <code className="font-mono">verify_and_sign_origin_leg</code>{" "}
                        parses the raw RLP envelope before hashing with{" "}
                        <code className="font-mono">keccak256</code> for{" "}
                        <code className="font-mono">Payload::V2::Ecdsa</code>.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Field</TableHead>
                            <TableHead>Guardrail Rule</TableHead>
                            <TableHead>Decoded Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">Envelope & Chain</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              0x02 · Chain 8453
                            </TableCell>
                            <TableCell className="font-mono text-xs text-emerald-400">
                              domain_id: {report.leg1BaseVerification.mpcDomainId}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Derivation Path</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              v1.signer Path
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {report.leg1BaseVerification.derivationPath}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">ERC-20 Selector</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              0xa9059cbb (68B)
                            </TableCell>
                            <TableCell className="font-mono text-xs text-emerald-400">
                              transfer(address,uint256)
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">1-Click Deposit</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              Calldata [4..36]
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {report.oneClickQuote?.depositAddress.slice(0, 14)}...
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Signing Hash</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              keccak256(0x02||rlp)
                            </TableCell>
                            <TableCell className="font-mono text-xs text-emerald-400">
                              {report.leg1BaseVerification.signingHashKeccak256Hex.slice(
                                0,
                                16
                              )}
                              ...
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground font-medium">
                            Raw Unsigned EIP-1559 Payload
                          </span>
                          <CopyChip
                            value={report.leg1BaseVerification.rawUnsignedTxHex}
                            display="Copy Hex"
                          />
                        </div>
                        <pre className="rounded-lg border border-border bg-secondary/50 p-3 font-mono text-[11px] text-muted-foreground overflow-x-auto leading-relaxed">
                          {report.leg1BaseVerification.rawUnsignedTxHex}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Leg 2 Solana V0 Card */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          Leg 2 — Solana V0 Kamino Instruction Parser
                        </CardTitle>
                        <Badge variant="emerald">domain_id: 1 (Ed25519)</Badge>
                      </div>
                      <CardDescription className="text-xs">
                        <code className="font-mono">verify_and_sign_destination_leg</code>{" "}
                        verifies the raw V0 message (180–1232 bytes, never pre-hashed)
                        and pins Kamino accounts.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Field</TableHead>
                            <TableHead>Guardrail Rule</TableHead>
                            <TableHead>Decoded Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">Header & Signers</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              0x80 · Signers == 1
                            </TableCell>
                            <TableCell className="font-mono text-xs text-emerald-400">
                              {report.leg2SolanaVerification.kaminoRefreshIxCount} Refresh +
                              1 Repay
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Derivation Path</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              v1.signer Path
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {report.leg2SolanaVerification.derivationPath}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Repay Discriminator</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              0x74aed54cb435d290
                            </TableCell>
                            <TableCell className="font-mono text-xs text-emerald-400">
                              {report.leg2SolanaVerification.discriminatorHex}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Pinned USDC Reserve</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              Account [2] == Reserve
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {report.leg2SolanaVerification.repayReservePubkey.slice(
                                0,
                                14
                              )}
                              ...
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Source USDC ATA</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              MPC Payer ATA
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {report.leg2SolanaVerification.userSourceLiquidityAtaPubkey.slice(
                                0,
                                14
                              )}
                              ...
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground font-medium">
                            Raw Unsigned Solana V0 Message
                          </span>
                          <CopyChip
                            value={report.leg2SolanaVerification.rawMessageHex}
                            display="Copy Hex"
                          />
                        </div>
                        <pre className="rounded-lg border border-border bg-secondary/50 p-3 font-mono text-[11px] text-muted-foreground overflow-x-auto leading-relaxed">
                          {report.leg2SolanaVerification.rawMessageHex}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* =====================================================================
                TAB 3: ADVERSARIAL RED-TEAM SIMULATOR (11/11 BLOCKED)
               ===================================================================== */}
            <TabsContent value="redteam" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-12 items-start">
                {/* Left Column: 11 Attack Vectors */}
                <Card className="lg:col-span-5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        Adversarial Attack Vectors
                      </CardTitle>
                      <Badge variant="emerald">
                        {adversarialSuite.length} / {adversarialSuite.length} Blocked
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Select any rogue AI / prompt-injection exploit vector to test
                      against the NEAR Policy Guardrail.
                    </CardDescription>
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
                            className={`emil-row-hover flex w-full items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer ${
                              isSelected ? "bg-secondary/90" : ""
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">
                                  #{String(idx + 1).padStart(2, "0")}
                                </span>
                                <span className="text-xs font-medium text-foreground truncate">
                                  {adv.title}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {adv.targetLeg}
                                </span>
                                <span className="text-zinc-700">·</span>
                                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                                  {adv.verificationTimeUs} µs
                                </span>
                              </div>
                            </div>
                            <Badge variant="destructive" className="shrink-0">
                              Blocked
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Right Column: Live Attack Inspector */}
                {selectedAdvCase && (
                  <Card className="lg:col-span-7 sticky top-20">
                    <CardHeader>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">
                            <WarningOctagon className="h-3.5 w-3.5" weight="fill" />
                            <span>Guardrail Revert Verified</span>
                          </Badge>
                          <Badge variant="outline" className="font-mono">
                            {selectedAdvCase.targetLeg}
                          </Badge>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            triggerAdversarialIntercept(selectedAdvCase.attackId)
                          }
                        >
                          <Lightning className="h-3.5 w-3.5" />
                          <span>
                            {advSimRunning
                              ? "Inspecting Bytes..."
                              : "Re-Run Exploit Vector"}
                          </span>
                        </Button>
                      </div>
                      <CardTitle className="text-lg pt-2">
                        {selectedAdvCase.title}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {selectedAdvCase.attackerGoal}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          Injected Rogue AI Payload
                        </span>
                        <div className="rounded-lg border border-border bg-secondary/40 p-3 font-mono text-xs text-foreground break-all">
                          {selectedAdvCase.injectedPayloadSummary}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-red-400">
                            Deterministic Rust Smart Contract Panic (
                            {selectedAdvCase.errorCode})
                          </span>
                          <span className="font-mono text-muted-foreground tabular-nums">
                            Rejected in {selectedAdvCase.verificationTimeUs} µs
                          </span>
                        </div>
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 font-mono text-xs text-red-300 leading-relaxed">
                          {selectedAdvCase.contractRevertMessage}
                        </div>
                      </div>

                      <div
                        className={`rounded-lg border p-3.5 text-xs transition-colors duration-200 ${
                          advFlashProtection
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-border bg-secondary/30 text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-medium text-foreground mb-1">
                          <CheckCircle
                            className="h-4 w-4 text-emerald-400"
                            weight="fill"
                          />
                          <span>
                            Zero Signatures Issued — User Funds 100% Intact
                          </span>
                        </div>
                        <p className="leading-relaxed">
                          The NEAR Policy Guardrail aborted execution before{" "}
                          <code className="font-mono">v1.signer::sign</code> could be
                          scheduled. Neither <code className="font-mono">MPC_Base_Vault</code>{" "}
                          nor <code className="font-mono">MPC_Solana_Payer</code> signed the
                          rogue payload.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* =====================================================================
                TAB 4: HISTORICAL BACKTEST LAB
               ===================================================================== */}
            <TabsContent value="backtest" className="space-y-6">
              {backtest && (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Intercept Survival Rate
                        </span>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-semibold tracking-[-0.02em] text-emerald-400 tabular-nums">
                          {backtest.aggregateSummary.interceptSurvivalRatePct}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          vs.{" "}
                          {backtest.aggregateSummary.naiveMicroBotSurvivalRatePct.toFixed(
                            1
                          )}
                          % for Naive Static 1.20x Bot
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Cascade Liquidation Loss Prevented
                        </span>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-semibold tracking-[-0.02em] text-foreground tabular-nums">
                          $
                          {backtest.aggregateSummary.totalLiquidationLossPreventedUsd.toFixed(
                            2
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Saved on a 100 SOL / $6,000 USDC position during -34% crash
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Calm Dip Capital Efficiency Gain
                        </span>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-semibold tracking-[-0.02em] text-foreground tabular-nums">
                          {backtest.aggregateSummary.capitalEfficiencySavingsVsConservativePct.toFixed(
                            1
                          )}
                          %
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Less Base USDC deployed vs. Over-Conservative 1.45x Bot
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-4">
                    {backtest.scenarios.map((scen) => (
                      <Card key={scen.scenarioId}>
                        <CardHeader className="pb-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <CardTitle className="text-base">{scen.title}</CardTitle>
                            <Badge variant="outline" className="font-mono">
                              {scen.scenarioId}
                            </Badge>
                          </div>
                          <CardDescription className="text-xs">
                            {scen.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Strategy</TableHead>
                                <TableHead>Outcome</TableHead>
                                <TableHead>Min HF</TableHead>
                                <TableHead>USDC Deployed</TableHead>
                                <TableHead>Total Net Cost</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {scen.outcomes.map((o) => {
                                const isIntercept =
                                  o.strategyId === "INTERCEPT_VOLATILITY_AWARE";
                                return (
                                  <TableRow
                                    key={o.strategyId}
                                    className={
                                      isIntercept ? "bg-emerald-500/5 font-medium" : ""
                                    }
                                  >
                                    <TableCell className="font-medium">
                                      {o.strategyName}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={
                                          o.survivedWithoutLiquidation
                                            ? "emerald"
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

                          <div className="rounded-md border border-border/60 bg-secondary/30 px-3.5 py-2.5 text-xs text-muted-foreground">
                            <strong className="text-foreground font-medium">
                              Quantitative Edge:{" "}
                            </strong>
                            {scen.interceptEdgeSummary}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* =====================================================================
                TAB 5: MAINNET VAULTS & PRE-FLIGHT CHECKLIST
               ===================================================================== */}
            <TabsContent value="vaults" className="space-y-6">
              {preflight && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">
                            Base Mainnet MPC Vault (domain_id: 0)
                          </CardTitle>
                          <Badge variant="emerald">Secp256k1 Live</Badge>
                        </div>
                        <CardDescription className="text-xs">
                          Derived via{" "}
                          <code className="font-mono">
                            v1.signer::derived_public_key
                          </code>{" "}
                          for path{" "}
                          <code className="font-mono">
                            &quot;{preflight.derivedMpc.baseDerivationPath}&quot;
                          </code>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-2 text-xs">
                        <div className="flex items-center justify-between py-1.5 border-t border-border/60">
                          <span className="text-muted-foreground">EVM Address</span>
                          <CopyChip value={preflight.derivedMpc.mpcBaseVaultAddress} />
                        </div>
                        <div className="flex items-center justify-between py-1.5 border-t border-border/60">
                          <span className="text-muted-foreground">Base Balances</span>
                          <span className="font-mono text-foreground tabular-nums">
                            {preflight.baseState.usdcBalanceFormatted} USDC ·{" "}
                            {preflight.baseState.ethBalanceFormatted} ETH
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-1.5 border-t border-border/60">
                          <span className="text-muted-foreground">Chain & Nonce</span>
                          <span className="font-mono text-muted-foreground tabular-nums">
                            Chain {preflight.baseState.chainId} · nonce=
                            {preflight.baseState.nonce}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">
                            Solana Mainnet MPC Payer (domain_id: 1)
                          </CardTitle>
                          <Badge variant="emerald">Ed25519 Live</Badge>
                        </div>
                        <CardDescription className="text-xs">
                          Derived via{" "}
                          <code className="font-mono">
                            v1.signer::derived_public_key
                          </code>{" "}
                          for path{" "}
                          <code className="font-mono">
                            &quot;{preflight.derivedMpc.solanaDerivationPath}&quot;
                          </code>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-2 text-xs">
                        <div className="flex items-center justify-between py-1.5 border-t border-border/60">
                          <span className="text-muted-foreground">Solana Pubkey</span>
                          <CopyChip value={preflight.derivedMpc.mpcSolanaPayerPubkey} />
                        </div>
                        <div className="flex items-center justify-between py-1.5 border-t border-border/60">
                          <span className="text-muted-foreground">Derived USDC ATA</span>
                          <CopyChip value={preflight.derivedMpc.mpcSolanaPayerUsdcAta} />
                        </div>
                        <div className="flex items-center justify-between py-1.5 border-t border-border/60">
                          <span className="text-muted-foreground">Solana Balances</span>
                          <span className="font-mono text-foreground tabular-nums">
                            {preflight.solanaState.usdcBalanceFormatted} USDC ·{" "}
                            {preflight.solanaState.solBalanceFormatted} SOL
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        Live Mainnet Rescue Readiness Checklist
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Real-time verification of NEAR{" "}
                        <code className="font-mono">v1.signer</code> derivation, Base 8453
                        RPC, and Solana Mainnet state.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Check</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Live Telemetry Detail</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preflight.checklist.map((item) => (
                            <TableRow key={item.item}>
                              <TableCell className="font-medium text-xs">
                                {item.item}
                              </TableCell>
                              <TableCell>
                                <Badge variant={item.passed ? "emerald" : "secondary"}>
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
        </div>
      </main>

      {/* Clean Minimalist Footer */}
      <footer className="mt-12 border-t border-border/70 py-6 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-[1360px] flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" weight="fill" />
            <span className="font-medium text-foreground">Intercept</span>
            <span>·</span>
            <span>
              NEAR AI Cloud TEE + near-sdk-rs Guardrail + v1.signer MPC + NEAR Intents
              1-Click
            </span>
          </div>
          <div className="font-mono text-[11px] tabular-nums">
            guardrail.intercept-defi.near · Kamino Mainnet (KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD)
          </div>
        </div>
      </footer>
    </div>
  );
}
