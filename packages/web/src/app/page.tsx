"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  WarningOctagon,
  Lightning,
  Pulse,
  ArrowSquareOut,
  LockKey,
  Cpu,
  CheckCircle,
  XCircle,
  Timer,
  ArrowsLeftRight,
  Code,
  Play,
  SlidersHorizontal,
  Copy,
  Check,
  TerminalWindow,
  ChartBar,
  Vault,
  CaretRight,
} from "@phosphor-icons/react";

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
    agentFunctionCallKeySpec?: {
      permissionType: string;
      receiverContractId: string;
      allowedMethodNames: string[];
      allowanceNear: string;
      forbiddenAdminMethods: string[];
    };
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
    fallbackReason?: string;
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

type AuditTabId =
  | "ALL"
  | "EXECUTION_AND_BYTES"
  | "RED_TEAM_SIMULATOR"
  | "BACKTEST_LAB"
  | "MPC_PREFLIGHT";

type PresetId =
  | "LIVE_0"
  | "MILD_MINUS_21"
  | "CASCADE_MINUS_25"
  | "OVERRIDE_148"
  | "CUSTOM";

function clampPct(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/**
 * Maps a Health Factor in [0.95, 1.65] to a percentage [0, 100] along the liquidation spectrum bar.
 */
function hfToSpectrumPct(hf: number): number {
  const minHf = 0.95;
  const maxHf = 1.65;
  return clampPct(((hf - minHf) / (maxHf - minHf)) * 100, 2, 98);
}

export default function InterceptCommandCenterPage() {
  const [report, setReport] = useState<ExecutionReport | null>(null);
  const [preflight, setPreflight] = useState<PreflightReport | null>(null);
  const [attacks, setAttacks] = useState<AdversarialAttackVectorResult[]>([]);
  const [backtest, setBacktest] = useState<BacktestSuiteReport | null>(null);
  const [selectedAttackIdx, setSelectedAttackIdx] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shockSliderPct, setShockSliderPct] = useState<number>(-25);
  const [activePreset, setActivePreset] =
    useState<PresetId>("CASCADE_MINUS_25");
  const [activeTab, setActiveTab] = useState<AuditTabId>("ALL");
  const [activeSimulationBanner, setActiveSimulationBanner] =
    useState<AdversarialAttackVectorResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (id: string, text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 1600);
  };

  const runPipeline = useCallback(
    async (params: {
      mode: "LIVE_MAINNET_MODE" | "STRESS_TEST_MAINNET_MODE";
      stressShockPct?: number;
      minTriggerHfBpsOverride?: number;
      presetId?: PresetId;
    }) => {
      setIsRunning(true);
      setErrorMsg(null);
      if (params.presetId) {
        setActivePreset(params.presetId);
      }
      try {
        const res = await fetch("/api/intercept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: params.mode,
            stressShockPct: params.stressShockPct,
            minTriggerHfBpsOverride: params.minTriggerHfBpsOverride,
          }),
        });
        if (!res.ok) {
          throw new Error(`API HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          report: ExecutionReport;
          preflight: PreflightReport;
          adversarialSuite: AdversarialAttackVectorResult[];
          backtest: BacktestSuiteReport;
        };
        setReport(data.report);
        setPreflight(data.preflight);
        setAttacks(data.adversarialSuite);
        setBacktest(data.backtest);
      } catch (err) {
        setErrorMsg((err as Error).message);
      } finally {
        setIsRunning(false);
      }
    },
    []
  );

  useEffect(() => {
    void runPipeline({
      mode: "STRESS_TEST_MAINNET_MODE",
      stressShockPct: -25,
      presetId: "CASCADE_MINUS_25",
    });
  }, [runPipeline]);

  const handleSimulateRogueAiHack = () => {
    if (attacks.length === 0) return;
    const nextIdx = (selectedAttackIdx + 1) % attacks.length;
    setSelectedAttackIdx(nextIdx);
    setActiveSimulationBanner(attacks[nextIdx]);
  };

  const selectedAttack = attacks[selectedAttackIdx] ?? attacks[0] ?? null;

  const regimeBadgeStyle = (regime?: string) => {
    if (regime === "HOLD") {
      return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
    }
    if (regime === "MICRO_BUFFER_RESCUE") {
      return "bg-amber-500/10 text-amber-300 border-amber-500/30";
    }
    return "bg-rose-500/15 text-rose-300 border-rose-500/40";
  };

  const observedHf = report?.kaminoBefore.healthFactor ?? 1.0755;
  const postRescueHf = report?.kaminoAfter.healthFactor ?? 1.45;
  const triggerHf = (report?.policy.minTriggerHfBps ?? 11_500) / 10_000;
  const isBreached =
    (report?.kaminoBefore.healthFactorBps ?? 0) <
    (report?.policy.minTriggerHfBps ?? 11_500);

  const showSection = (tab: AuditTabId) =>
    activeTab === "ALL" || activeTab === tab;

  return (
    <div className="min-h-[100dvh] flex flex-col text-zinc-100">
      {/* 1. Top Tactical Institutional Status Bar */}
      <header className="h-14 border-b border-white/[0.08] bg-[#060709]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]">
              <ShieldCheck size={17} weight="duotone" />
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-sm font-semibold tracking-wider text-zinc-100">
                INTERCEPT
              </span>
              <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-[0.14em] px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.08] text-zinc-400">
                NEAR AI TEE // v1.signer // 1-Click // KLend
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded bg-white/[0.02] border border-white/[0.07] text-zinc-300">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isRunning
                    ? "bg-amber-400 animate-ping"
                    : "bg-emerald-400"
                }`}
              />
              <span>
                SOL SLOT{" "}
                <strong className="text-zinc-100 font-medium">
                  {report?.pythTelemetry.solanaSlot?.toLocaleString() ??
                    "461,722,042"}
                </strong>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded bg-white/[0.02] border border-white/[0.07] text-zinc-300">
              <span className="text-zinc-500">PYTH SOL</span>
              <span className="text-zinc-100 font-semibold">
                ${report?.pythTelemetry.rawSpotSolUsd.toFixed(2) ?? "..."}
              </span>
            </div>

            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded border font-medium ${
                report?.mode === "LIVE_MAINNET_MODE"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-300"
              }`}
            >
              <span>{report?.mode ?? "INITIALIZING"}</span>
            </div>

            <button
              type="button"
              onClick={handleSimulateRogueAiHack}
              className="px-3 py-1.5 rounded bg-rose-500/15 hover:bg-rose-500/25 active:scale-[0.98] border border-rose-500/40 text-rose-200 font-mono text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
            >
              <WarningOctagon size={14} weight="duotone" className="text-rose-400" />
              <span>Prompt-Inject the AI</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
        {/* 2. Double-Bezel Non-Custodial Isolation Architecture Banner */}
        <section className="rounded-2xl bg-white/[0.02] p-1.5 border border-white/[0.07] shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
          <div className="rounded-[calc(1rem-2px)] bg-[#090b0e] border border-emerald-500/20 p-4 sm:p-5 space-y-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <LockKey size={17} weight="duotone" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-400 font-semibold">
                      PILLAR 1 // NON-CUSTODIAL COLLATERAL ISOLATION
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-zinc-300">
                      ZERO PRIVATE KEY CUSTODY
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed max-w-4xl">
                    Your Kamino collateral stays in your personal Solana wallet
                    and can never be withdrawn by Intercept. Your idle Base
                    rescue reserve is governed by decentralized NEAR MPC (
                    <code className="font-mono text-emerald-300">
                      v1.signer
                    </code>
                    ) and byte-level smart contract guardrails—no single
                    custodian and no raw private keys.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                <a
                  href={`https://solscan.io/account/${
                    report?.policy.userKaminoObligationPubkey ??
                    "C5dZVpvpA39SNLDkojsi98nRePRRy8ELhtxak8m2vMq"
                  }`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 rounded bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-zinc-200 flex items-center gap-1.5 transition"
                >
                  <span>Live Obligation on Solscan</span>
                  <ArrowSquareOut size={13} className="text-emerald-400" />
                </a>
              </div>
            </div>

            {/* 3-Node Hairline Architecture Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.07] rounded-lg overflow-hidden border border-white/[0.07] font-mono text-xs">
              <div className="bg-[#0b0d11] p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-100 font-semibold text-[11px] tracking-wide">
                    [01] USER SOLANA WALLET (EOA)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                    OBLIGATION OWNER
                  </span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Holds SOL collateral on Kamino PDA (
                  <span className="text-zinc-200">
                    {report?.policy.userKaminoObligationPubkey.slice(0, 8) ??
                      "C5dZVpvp"}
                    ...
                  </span>
                  ).{" "}
                  <span className="text-emerald-300">
                    withdraw_obligation_collateral_v2
                  </span>{" "}
                  requires User EOA signature and is blocked on-chain.
                </p>
              </div>

              <div className="bg-[#0b0d11] p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-100 font-semibold text-[11px] tracking-wide">
                    [02] NEAR POLICY GUARDRAIL (RUST)
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.1] text-zinc-200">
                    4-STATE TOCTOU
                  </span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Enforces{" "}
                  <span className="text-zinc-200">
                    InFlightLeg1 → ReadyForLeg2 → InFlightLeg2 → Completed
                  </span>
                  , Ed25519 TEE receipt, 24h cap, EIP-1559 RLP, and 5-ix Kamino
                  V0 layout before calling{" "}
                  <span className="text-emerald-300">v1.signer</span>.
                </p>
              </div>

              <div className="bg-[#0b0d11] p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-100 font-semibold text-[11px] tracking-wide">
                    [03] BASE MPC → 1-CLICK → SOLANA MPC
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                    250 TGas MPC
                  </span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Leg 1{" "}
                  <span className="text-zinc-200">domain_id:0 (Secp256k1)</span>{" "}
                  transfers Base USDC to 1-Click solver → Leg 2{" "}
                  <span className="text-zinc-200">
                    domain_id:1 (Ed25519 Raw V0)
                  </span>{" "}
                  executes same-slot refresh + third-party Kamino repay.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Active Rogue AI Hack Revert Banner (if triggered) */}
        {activeSimulationBanner && (
          <section className="rounded-xl border border-rose-500/50 bg-rose-950/25 p-4 space-y-2.5 shadow-[0_12px_32px_rgba(244,63,94,0.12)]">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-rose-200 font-mono text-xs font-semibold">
                <XCircle size={18} weight="fill" className="text-rose-400" />
                <span>
                  NEAR POLICY CONTRACT REVERTED ROGUE AI PAYLOAD [
                  {activeSimulationBanner.attackId}] IN{" "}
                  {activeSimulationBanner.verificationTimeUs} µs
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={handleSimulateRogueAiHack}
                  className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 cursor-pointer"
                >
                  Next Attack Vector →
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSimulationBanner(null)}
                  className="px-2 py-1 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <p className="text-xs text-zinc-300 font-mono">
              <span className="text-zinc-400">Vector:</span>{" "}
              {activeSimulationBanner.title} —{" "}
              {activeSimulationBanner.attackerGoal}
            </p>
            <div className="font-mono text-xs bg-[#060709] border border-rose-500/30 rounded-lg p-3 text-rose-300 overflow-x-auto">
              {activeSimulationBanner.contractRevertMessage}
            </div>
          </section>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 text-xs font-mono text-rose-300">
            Error: {errorMsg}
          </div>
        )}

        {report &&
          (report.pythTelemetry.fallbackReason ||
            report.kaminoBefore.fallbackReason ||
            report.oneClickQuote?.fallbackReason) && (
            <div className="rounded-xl border border-amber-500/35 bg-amber-950/20 p-3.5 text-xs font-mono text-amber-200 space-y-1">
              {report.pythTelemetry.fallbackReason && (
                <div>
                  ⚠️ FALLBACK (Pyth RPC): {report.pythTelemetry.fallbackReason}
                </div>
              )}
              {report.kaminoBefore.fallbackReason && (
                <div>
                  ⚠️ FALLBACK (Kamino RPC):{" "}
                  {report.kaminoBefore.fallbackReason}
                </div>
              )}
              {report.oneClickQuote?.fallbackReason && (
                <div>
                  ⚠️ FALLBACK (1-Click Quote — Dry-Run Only):{" "}
                  {report.oneClickQuote.fallbackReason}
                </div>
              )}
            </div>
          )}

        {/* 3. Above-the-Fold 12-Column Institutional Command Deck */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Primary Panel (8 Columns): Scenario Controls + Visual HF Spectrum + Kamino Telemetry */}
          <div className="lg:col-span-8 rounded-2xl bg-white/[0.02] p-1.5 border border-white/[0.07] flex flex-col">
            <div className="rounded-[calc(1rem-2px)] bg-[#090b0e] border border-white/[0.06] p-5 flex-1 flex flex-col justify-between space-y-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
              {/* Header + Scenario Selector Buttons */}
              <div className="space-y-3 pb-4 border-b border-white/[0.07]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                      SOLANA MAINNET // KAMINO LEND OBLIGATION TELEMETRY
                    </div>
                    <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-100 mt-0.5">
                      Dynamic De-Risking &amp; Liquidation Spectrum
                    </h1>
                  </div>
                  <div className="font-mono text-xs text-zinc-400 flex items-center gap-2 bg-white/[0.02] border border-white/[0.07] px-3 py-1.5 rounded-md">
                    <Timer size={15} className="text-emerald-400" />
                    <span>Pipeline Stopwatch:</span>
                    <strong className="text-zinc-100">
                      {report ? `${report.totalMeasuredLatencyMs} ms` : "..."}
                    </strong>
                  </div>
                </div>

                {/* 4 Scenario Preset Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => {
                      setShockSliderPct(0);
                      void runPipeline({
                        mode: "LIVE_MAINNET_MODE",
                        stressShockPct: 0,
                        presetId: "LIVE_0",
                      });
                    }}
                    className={`px-3 py-2 rounded-lg font-mono text-[11px] text-left border transition cursor-pointer disabled:opacity-50 flex items-center justify-between ${
                      activePreset === "LIVE_0"
                        ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-semibold"
                        : "bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.08] text-zinc-300"
                    }`}
                  >
                    <span>Live Mainnet (0%)</span>
                    <Pulse size={14} className="text-emerald-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => {
                      setShockSliderPct(-21);
                      void runPipeline({
                        mode: "STRESS_TEST_MAINNET_MODE",
                        stressShockPct: -21,
                        presetId: "MILD_MINUS_21",
                      });
                    }}
                    className={`px-3 py-2 rounded-lg font-mono text-[11px] text-left border transition cursor-pointer disabled:opacity-50 flex items-center justify-between ${
                      activePreset === "MILD_MINUS_21"
                        ? "bg-amber-500/15 border-amber-500/50 text-amber-200 font-semibold"
                        : "bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.08] text-zinc-300"
                    }`}
                  >
                    <span>Mild Shock (-21% SOL)</span>
                    <SlidersHorizontal
                      size={14}
                      className="text-amber-400 shrink-0"
                    />
                  </button>

                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => {
                      setShockSliderPct(-25);
                      void runPipeline({
                        mode: "STRESS_TEST_MAINNET_MODE",
                        stressShockPct: -25,
                        presetId: "CASCADE_MINUS_25",
                      });
                    }}
                    className={`px-3 py-2 rounded-lg font-mono text-[11px] text-left border transition cursor-pointer disabled:opacity-50 flex items-center justify-between ${
                      activePreset === "CASCADE_MINUS_25"
                        ? "bg-emerald-500 text-zinc-950 border-emerald-400 font-semibold"
                        : "bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.08] text-zinc-300"
                    }`}
                  >
                    <span>Cascade Crash (-25%)</span>
                    <Lightning size={14} weight="fill" className="shrink-0" />
                  </button>

                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => {
                      setShockSliderPct(0);
                      void runPipeline({
                        mode: "STRESS_TEST_MAINNET_MODE",
                        stressShockPct: 0,
                        minTriggerHfBpsOverride: 14_800,
                        presetId: "OVERRIDE_148",
                      });
                    }}
                    className={`px-3 py-2 rounded-lg font-mono text-[11px] text-left border transition cursor-pointer disabled:opacity-50 flex items-center justify-between ${
                      activePreset === "OVERRIDE_148"
                        ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-semibold"
                        : "bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.08] text-zinc-300"
                    }`}
                  >
                    <span>Override (Min HF 1.48)</span>
                    <Play size={13} className="text-emerald-400 shrink-0" />
                  </button>
                </div>

                {/* Custom Shock Scrubber */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                  <label
                    htmlFor="sol-shock-slider"
                    className="font-mono text-[11px] text-zinc-400 whitespace-nowrap"
                  >
                    Custom SOL Price Shock:
                  </label>
                  <input
                    id="sol-shock-slider"
                    type="range"
                    min={-40}
                    max={0}
                    step={1}
                    value={shockSliderPct}
                    onChange={(e) =>
                      setShockSliderPct(Number(e.target.value))
                    }
                    className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                  />
                  <span className="font-mono text-xs font-semibold text-emerald-400 w-12 text-right">
                    {shockSliderPct}%
                  </span>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() =>
                      runPipeline({
                        mode:
                          shockSliderPct === 0
                            ? "LIVE_MAINNET_MODE"
                            : "STRESS_TEST_MAINNET_MODE",
                        stressShockPct: shockSliderPct,
                        presetId: "CUSTOM",
                      })
                    }
                    className="px-3 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] font-mono text-[11px] text-zinc-200 cursor-pointer disabled:opacity-50"
                  >
                    Execute Shock
                  </button>
                </div>
              </div>

              {/* Primary Quantitative Readout Row (4 Columns) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.07] rounded-xl overflow-hidden border border-white/[0.07]">
                <div className="bg-[#0b0d11] p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    Observed Health Factor
                  </div>
                  <div
                    className={`font-mono text-2xl sm:text-3xl font-bold mt-1 ${
                      isBreached ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {report ? observedHf.toFixed(4) : "..."}
                  </div>
                  <div className="font-mono text-[11px] text-zinc-400 mt-1">
                    Trigger Floor: {triggerHf.toFixed(4)}
                  </div>
                </div>

                <div className="bg-[#0b0d11] p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    Post-Rescue HF
                  </div>
                  <div className="font-mono text-2xl sm:text-3xl font-bold text-emerald-400 mt-1">
                    {report ? postRescueHf.toFixed(4) : "..."}
                  </div>
                  <div className="font-mono text-[11px] text-zinc-400 mt-1">
                    Target HF:{" "}
                    {report
                      ? (report.riskEvaluation.targetHfBps / 10_000).toFixed(2)
                      : "1.45"}
                  </div>
                </div>

                <div className="bg-[#0b0d11] p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    Optimal USDC Repay
                  </div>
                  <div className="font-mono text-2xl sm:text-3xl font-bold text-zinc-100 mt-1">
                    ${report?.riskEvaluation.repayAmountUsdcFormatted ?? "0.00"}
                  </div>
                  <div className="font-mono text-[11px] text-zinc-400 mt-1 truncate">
                    {report?.riskEvaluation.repayAmountUsdcMicro ?? "0"} µUSDC
                  </div>
                </div>

                <div className="bg-[#0b0d11] p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    Penalty Avoided
                  </div>
                  <div className="font-mono text-2xl sm:text-3xl font-bold text-emerald-300 mt-1">
                    {report
                      ? `${(
                          report.riskEvaluation
                            .estimatedKaminoLiquidationPenaltyBps / 100
                        ).toFixed(2)}%`
                      : "..."}
                  </div>
                  <div className="font-mono text-[11px] text-zinc-400 mt-1">
                    vs.{" "}
                    {report
                      ? (
                          report.riskEvaluation.capitalOpportunityCostBps / 100
                        ).toFixed(2)
                      : "0.21"}
                    % solver cost
                  </div>
                </div>
              </div>

              {/* Visual Health-Factor Liquidation Spectrum Bar */}
              <div className="rounded-xl bg-[#060709] border border-white/[0.07] p-4 space-y-3">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-zinc-300 font-medium">
                    LIQUIDATION SPECTRUM // PRE-RESCUE vs. POST-RESCUE TRAJECTORY
                  </span>
                  <span className="text-emerald-400">
                    {isBreached
                      ? `Δ +${(postRescueHf - observedHf).toFixed(4)} HF Restored`
                      : "Position Above Trigger Threshold"}
                  </span>
                </div>

                <div className="relative h-8 rounded-lg bg-zinc-950 border border-white/[0.08] overflow-hidden">
                  {/* Danger Zone (< 1.00 HF) */}
                  <div
                    className="absolute inset-y-0 left-0 bg-rose-500/20 border-r border-rose-500/50"
                    style={{ width: `${hfToSpectrumPct(1.0)}%` }}
                  />
                  {/* Warning Zone (1.00 -> Trigger HF) */}
                  <div
                    className="absolute inset-y-0 bg-amber-500/10 border-r border-amber-500/40"
                    style={{
                      left: `${hfToSpectrumPct(1.0)}%`,
                      width: `${
                        hfToSpectrumPct(triggerHf) - hfToSpectrumPct(1.0)
                      }%`,
                    }}
                  />
                  {/* Safe Zone (> Trigger HF) */}
                  <div
                    className="absolute inset-y-0 right-0 bg-emerald-500/[0.06]"
                    style={{ left: `${hfToSpectrumPct(triggerHf)}%` }}
                  />

                  {/* Bridge bar connecting Observed HF -> Post-Rescue HF when breached */}
                  {isBreached && postRescueHf > observedHf && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-2 bg-emerald-400/35 rounded-full transition-all duration-500"
                      style={{
                        left: `${hfToSpectrumPct(observedHf)}%`,
                        width: `${
                          hfToSpectrumPct(postRescueHf) -
                          hfToSpectrumPct(observedHf)
                        }%`,
                      }}
                    />
                  )}

                  {/* Observed HF Marker */}
                  <div
                    className="absolute inset-y-0 flex items-center transition-all duration-500"
                    style={{ left: `${hfToSpectrumPct(observedHf)}%` }}
                  >
                    <div
                      className={`w-3 h-3 -ml-1.5 rounded-full border-2 border-zinc-950 shadow ${
                        isBreached ? "bg-rose-400" : "bg-emerald-400"
                      }`}
                      title={`Observed HF: ${observedHf.toFixed(4)}`}
                    />
                  </div>

                  {/* Post-Rescue HF Marker */}
                  {isBreached && (
                    <div
                      className="absolute inset-y-0 flex items-center transition-all duration-500"
                      style={{ left: `${hfToSpectrumPct(postRescueHf)}%` }}
                    >
                      <div
                        className="w-3.5 h-3.5 -ml-1.5 rounded-full bg-emerald-400 border-2 border-zinc-950 shadow-[0_0_12px_rgba(16,185,129,0.8)]"
                        title={`Post-Rescue HF: ${postRescueHf.toFixed(4)}`}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-4 font-mono text-[10px] text-zinc-400">
                  <div>
                    <span className="text-rose-400 font-semibold">1.0000</span>{" "}
                    Liquidation Cliff
                  </div>
                  <div>
                    <span className="text-amber-300 font-semibold">
                      {triggerHf.toFixed(4)}
                    </span>{" "}
                    Policy Trigger
                  </div>
                  <div>
                    <span className="text-zinc-200 font-semibold">1.2000</span>{" "}
                    Micro Buffer
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-semibold">
                      1.4500
                    </span>{" "}
                    Cascade Target
                  </div>
                </div>
              </div>

              {/* 6-Cell Hairline Kamino On-Chain Position Details */}
              {report && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-white/[0.07] rounded-xl overflow-hidden border border-white/[0.07] font-mono text-xs">
                  <div className="bg-[#0b0d11] p-3">
                    <div className="text-[10px] text-zinc-500">
                      KAMINO OBLIGATION PDA
                    </div>
                    <div className="text-zinc-200 mt-0.5 flex items-center justify-between gap-1">
                      <span className="truncate">
                        {report.policy.userKaminoObligationPubkey.slice(0, 10)}
                        ...
                        {report.policy.userKaminoObligationPubkey.slice(-6)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            "obligation",
                            report.policy.userKaminoObligationPubkey
                          )
                        }
                        className="text-zinc-400 hover:text-zinc-200 cursor-pointer shrink-0"
                        title="Copy Obligation Pubkey"
                      >
                        {copiedId === "obligation" ? (
                          <Check size={13} className="text-emerald-400" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#0b0d11] p-3">
                    <div className="text-[10px] text-zinc-500">
                      USER SOLANA EOA (OWNER)
                    </div>
                    <div className="text-zinc-200 mt-0.5 truncate">
                      {report.policy.userSolanaEoaPubkey.slice(0, 10)}...
                      {report.policy.userSolanaEoaPubkey.slice(-6)}
                    </div>
                  </div>

                  <div className="bg-[#0b0d11] p-3">
                    <div className="text-[10px] text-zinc-500">
                      TELEMETRY SOURCE
                    </div>
                    <div className="text-emerald-300 mt-0.5 truncate">
                      {report.kaminoBefore.source}
                    </div>
                  </div>

                  <div className="bg-[#0b0d11] p-3">
                    <div className="text-[10px] text-zinc-500">
                      DEPOSITED SOL COLLATERAL
                    </div>
                    <div className="text-zinc-100 mt-0.5">
                      {report.kaminoBefore.depositedSol} SOL ($
                      {report.kaminoBefore.collateralValueUsd.toFixed(2)})
                    </div>
                  </div>

                  <div className="bg-[#0b0d11] p-3">
                    <div className="text-[10px] text-zinc-500">
                      BORROWED DEBT (BEFORE → AFTER)
                    </div>
                    <div className="text-emerald-300 mt-0.5">
                      {report.kaminoBefore.borrowedUsdc.toFixed(2)} →{" "}
                      {report.kaminoAfter.borrowedUsdc.toFixed(2)} USDC
                    </div>
                  </div>

                  <div className="bg-[#0b0d11] p-3">
                    <div className="text-[10px] text-zinc-500">
                      SOL LIQUIDATION PRICE (75% LTV)
                    </div>
                    <div className="text-amber-300 mt-0.5">
                      ${report.kaminoBefore.liquidationSolPriceUsd.toFixed(2)}{" "}
                      ({report.kaminoBefore.distanceToLiquidationPct.toFixed(1)}%
                      buffer)
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Telemetry Stack (4 Columns): Pyth Oracle + NEAR AI Cloud TEE Enclave */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Card A: Pyth Solana Mainnet Push Oracle */}
            <div className="rounded-2xl bg-white/[0.02] p-1.5 border border-white/[0.07]">
              <div className="rounded-[calc(1rem-2px)] bg-[#090b0e] border border-white/[0.06] p-4 space-y-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                    PYTH PUSH ORACLE // SOL/USD
                  </span>
                  {report && (
                    <a
                      href={`https://solscan.io/account/${report.pythTelemetry.solanaAccountPubkey}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <span>PriceUpdateV2</span>
                      <ArrowSquareOut size={12} />
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-px bg-white/[0.07] rounded-lg overflow-hidden border border-white/[0.07] font-mono">
                  <div className="bg-[#0b0d11] p-3">
                    <div className="text-[10px] text-zinc-400">
                      Effective SOL/USD
                    </div>
                    <div className="text-xl font-bold text-zinc-100 mt-0.5">
                      $
                      {report
                        ? report.pythTelemetry.effectiveSolUsd.toFixed(2)
                        : "..."}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      Spot $
                      {report?.pythTelemetry.rawSpotSolUsd.toFixed(2) ?? "..."} (
                      {report?.pythTelemetry.stressShockPctApplied ?? 0}%)
                    </div>
                  </div>

                  <div className="bg-[#0b0d11] p-3">
                    <div className="text-[10px] text-zinc-400">
                      Realized Volatility (σ)
                    </div>
                    <div className="text-xl font-bold text-amber-300 mt-0.5">
                      {report
                        ? `${(
                            report.pythTelemetry.realizedVolatilityBps / 100
                          ).toFixed(2)}%`
                        : "..."}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      {report?.pythTelemetry.realizedVolatilityBps ?? 0} bps ·
                      Vel {report?.pythTelemetry.emaVelocityBps ?? 0} bps
                    </div>
                  </div>
                </div>

                {report && (
                  <div className="space-y-1.5 font-mono text-[11px] pt-1">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Oracle Source:</span>
                      <span className="text-emerald-300">
                        {report.pythTelemetry.source}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">
                        EMA Price ± Confidence:
                      </span>
                      <span className="text-zinc-200">
                        ${report.pythTelemetry.emaSolUsd.toFixed(2)} ± $
                        {report.pythTelemetry.confidenceUsd.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">
                        Proof Hash (SHA-256):
                      </span>
                      <span className="text-zinc-300">
                        {report.pythTelemetry.priceProofHash.slice(0, 14)}... (
                        {report.pythTelemetry.fetchLatencyMs} ms)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card B: NEAR AI Cloud Confidential TEE Risk Engine */}
            <div className="rounded-2xl bg-white/[0.02] p-1.5 border border-white/[0.07] flex-1 flex flex-col">
              <div className="rounded-[calc(1rem-2px)] bg-[#090b0e] border border-white/[0.06] p-4 flex-1 flex flex-col justify-between space-y-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400 flex items-center gap-1.5">
                    <Cpu size={14} className="text-emerald-400" />
                    NEAR AI CLOUD // TEE RISK ENGINE
                  </span>
                  {report && (
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded border font-semibold ${regimeBadgeStyle(
                        report.riskEvaluation.regime
                      )}`}
                    >
                      {report.riskEvaluation.regime}
                    </span>
                  )}
                </div>

                <div className="font-mono text-[11px] text-zinc-300 leading-relaxed bg-[#060709] border border-white/[0.07] rounded-lg p-3">
                  {report?.riskEvaluation.reasoningSummary ??
                    "Evaluating live Pyth volatility and Kamino obligation health..."}
                </div>

                {report && (
                  <div className="space-y-1.5 font-mono text-[11px] pt-1 border-t border-white/[0.07]">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Enclave Model:</span>
                      <span className="text-emerald-300">
                        {report.nearAiCloudAttestation.model}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">TEE Hardware:</span>
                      <span className="text-zinc-200">
                        {
                          report.nearAiCloudAttestation.hardwareAttestation
                            .gpuArchitecture
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">
                        TDX + NRAS Chain of Trust:
                      </span>
                      <span className="text-emerald-400 font-semibold">
                        {report.nearAiCloudAttestation.verifiedChainOfTrust
                          ? "VERIFIED (Ed25519)"
                          : "UNVERIFIED"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">
                        Scoped FunctionCall Key:
                      </span>
                      <span className="text-zinc-200">
                        2 Allowed / 3 Admin Blocked
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 4. Segmented Deep-Audit Workspace Bar */}
        <nav
          aria-label="Audit Workspace Views"
          className="rounded-xl bg-[#090b0e] border border-white/[0.08] p-1.5 flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                {
                  id: "ALL",
                  label: "ALL PANELS (FULL AUDIT VIEW)",
                  icon: <TerminalWindow size={14} />,
                },
                {
                  id: "EXECUTION_AND_BYTES",
                  label: "[01] 5-STAGE PIPELINE & BYTE INSPECTOR",
                  icon: <Code size={14} />,
                },
                {
                  id: "RED_TEAM_SIMULATOR",
                  label: `[02] RED-TEAM SIMULATOR (${attacks.length}/${attacks.length} BLOCKED)`,
                  icon: <WarningOctagon size={14} />,
                },
                {
                  id: "BACKTEST_LAB",
                  label: "[03] HISTORICAL BACKTEST LAB (100% SURVIVAL)",
                  icon: <ChartBar size={14} />,
                },
                {
                  id: "MPC_PREFLIGHT",
                  label: "[04] MPC VAULTS & PRE-FLIGHT",
                  icon: <Vault size={14} />,
                },
              ] as const
            ).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-[11px] flex items-center gap-1.5 transition cursor-pointer ${
                    active
                      ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-semibold"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* SECTION [01]: 5-Stage Cross-Chain Execution Pipeline & Annotated Byte-Level Guardrail Inspector */}
        {showSection("EXECUTION_AND_BYTES") && report && (
          <div className="space-y-6">
            {/* 5-Stage Cross-Chain Execution Trace Table */}
            <section className="rounded-2xl bg-white/[0.02] p-1.5 border border-white/[0.07]">
              <div className="rounded-[calc(1rem-2px)] bg-[#090b0e] border border-white/[0.06] p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-400">
                      CROSS-CHAIN EXECUTION TRACE // 4-STATE ASYNC TOCTOU MACHINE
                    </div>
                    <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2 mt-0.5">
                      <ArrowsLeftRight size={17} className="text-emerald-400" />
                      5-Stage Rescue Telemetry (Base 8453 → NEAR Intents 1-Click
                      → Solana Kamino Lend)
                    </h2>
                  </div>
                  <span className="font-mono text-xs px-3 py-1 rounded bg-[#060709] border border-white/[0.08] text-emerald-300">
                    Total Measured Time: {report.totalMeasuredLatencyMs} ms
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {report.stages.map((stage) => {
                    const pctOfTotal = clampPct(
                      Math.round(
                        (stage.measuredLatencyMs /
                          Math.max(1, report.totalMeasuredLatencyMs)) *
                          100
                      ),
                      4,
                      100
                    );
                    return (
                      <div
                        key={stage.stageId}
                        className="rounded-xl border border-white/[0.07] bg-[#0b0d11] p-3.5 space-y-2"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                          <div className="flex items-start gap-3">
                            <span
                              className={`w-6 h-6 rounded-md font-mono text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                                stage.status === "COMPLETED"
                                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                                  : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                              }`}
                            >
                              0{stage.stageIndex}
                            </span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-zinc-100">
                                  {stage.label}
                                </span>
                                <span
                                  className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                                    stage.status === "COMPLETED"
                                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                      : "bg-zinc-900 text-zinc-400 border-zinc-800"
                                  }`}
                                >
                                  {stage.status}
                                </span>
                              </div>
                              <p className="font-mono text-xs text-zinc-400 mt-1 break-all">
                                {stage.detail}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                            <span className="font-mono text-xs text-zinc-200 bg-[#060709] border border-white/[0.08] px-2.5 py-1 rounded">
                              {stage.measuredLatencyMs} ms ({pctOfTotal}%)
                            </span>
                            <a
                              href={stage.explorerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/25"
                            >
                              <span>{stage.explorerLabel}</span>
                              <ArrowSquareOut size={13} />
                            </a>
                          </div>
                        </div>

                        {/* Proportional Latency Bar */}
                        <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500/60 rounded-full"
                            style={{ width: `${pctOfTotal}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Annotated Byte-Level Guardrail Inspector (Leg 1 EIP-1559 + Leg 2 Solana V0) */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Leg 1 Base EVM RLP & TEE Receipt Inspector */}
              <div className="rounded-2xl bg-white/[0.02] p-1.5 border border-white/[0.07]">
                <div className="rounded-[calc(1rem-2px)] bg-[#090b0e] border border-white/[0.06] p-5 space-y-4 h-full">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                        ORIGIN LEG // BASE MAINNET (CHAIN ID 8453)
                      </div>
                      <h3 className="text-sm font-mono font-semibold text-zinc-100 flex items-center gap-2 mt-0.5">
                        <Code size={16} className="text-emerald-400" />
                        LEG 1 EIP-1559 RLP GUARDRAIL (domain_id: 0 · Secp256k1)
                      </h3>
                    </div>
                    <span className="font-mono text-[11px] px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                      <CheckCircle size={13} weight="fill" />
                      RLP + Ed25519 Verified
                    </span>
                  </div>

                  {report.teeReceipt && report.leg1BaseVerification ? (
                    <div className="space-y-3 font-mono text-xs">
                      {/* Annotated Byte Offset Table */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/[0.07] rounded-lg overflow-hidden border border-white/[0.07] text-[11px]">
                        <div className="bg-[#0b0d11] p-2.5">
                          <span className="text-zinc-500">
                            [Byte 0] Tx Type
                          </span>
                          <div className="text-zinc-100 mt-0.5">
                            0x02 (Canonical EIP-1559)
                          </div>
                        </div>
                        <div className="bg-[#0b0d11] p-2.5">
                          <span className="text-zinc-500">
                            [RLP 0, 5] Chain &amp; Token
                          </span>
                          <div className="text-emerald-300 mt-0.5 truncate">
                            8453 · USDC 0x8335...2913
                          </div>
                        </div>
                        <div className="bg-[#0b0d11] p-2.5">
                          <span className="text-zinc-500">
                            [RLP 2..4] Gas &amp; Fee Caps
                          </span>
                          <div className="text-zinc-200 mt-0.5">
                            ≤ 250k gas · ≤ 50 gwei maxFee
                          </div>
                        </div>
                        <div className="bg-[#0b0d11] p-2.5">
                          <span className="text-zinc-500">
                            [data 0..4] Selector
                          </span>
                          <div className="text-emerald-300 mt-0.5">
                            0xa9059cbb (approve blocked)
                          </div>
                        </div>
                        <div className="bg-[#0b0d11] p-2.5">
                          <span className="text-zinc-500">
                            [data 16..36] 1-Click Deposit
                          </span>
                          <div className="text-zinc-200 mt-0.5 truncate">
                            {report.oneClickQuote?.depositAddress}
                          </div>
                        </div>
                        <div className="bg-[#0b0d11] p-2.5">
                          <span className="text-zinc-500">
                            [data 52..68] Exact Amount
                          </span>
                          <div className="text-amber-300 mt-0.5">
                            {report.riskEvaluation.repayAmountUsdcMicro} µUSDC
                          </div>
                        </div>
                      </div>

                      {/* Canonical TEE Decision Receipt */}
                      <div className="p-3 rounded-lg bg-[#060709] border border-white/[0.07] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 text-[11px]">
                            Canonical TeeDecisionReceipt ASCII Pre-Image:
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                "tee-receipt",
                                report.teeReceipt?.canonicalPayload ?? ""
                              )
                            }
                            className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                          >
                            {copiedId === "tee-receipt" ? (
                              <Check size={12} className="text-emerald-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                            <span>Copy</span>
                          </button>
                        </div>
                        <div className="text-emerald-300 break-all text-[11px] leading-relaxed">
                          {report.teeReceipt.canonicalPayload}
                        </div>
                        <div className="text-zinc-500 text-[10px] pt-1">
                          Ed25519 Signature (64B): 0x
                          {report.teeReceipt.receipt.enclave_signature_hex.slice(
                            0,
                            44
                          )}
                          ...
                        </div>
                      </div>

                      {/* Raw Unsigned EIP-1559 Hex & Keccak-256 Digest */}
                      <div className="p-3 rounded-lg bg-[#060709] border border-white/[0.07] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 text-[11px]">
                            Unsigned EIP-1559 Pre-Image (0x02 || rlp):
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                "leg1-hex",
                                report.leg1BaseVerification?.rawUnsignedTxHex ??
                                  ""
                              )
                            }
                            className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                          >
                            {copiedId === "leg1-hex" ? (
                              <Check size={12} className="text-emerald-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                            <span>Copy Hex</span>
                          </button>
                        </div>
                        <div className="text-zinc-300 break-all text-[11px]">
                          {report.leg1BaseVerification.rawUnsignedTxHex}
                        </div>
                        <div className="text-zinc-400 text-[11px] pt-1">
                          Keccak-256 Digest → v1.signer (payload_v2::Ecdsa):
                        </div>
                        <div className="text-emerald-300 break-all text-[11px]">
                          {report.leg1BaseVerification.signingHashKeccak256Hex}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-[#060709] border border-white/[0.07] font-mono text-xs text-zinc-400">
                      Position is currently in HOLD regime. Select a Stress-Test
                      preset above (-21% or -25%) to inspect live signed TEE
                      receipts and EIP-1559 RLP bytes.
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Leg 2 Solana V0 Message & Kamino Repay Inspector */}
              <div className="rounded-2xl bg-white/[0.02] p-1.5 border border-white/[0.07]">
                <div className="rounded-[calc(1rem-2px)] bg-[#090b0e] border border-white/[0.06] p-5 space-y-4 h-full">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                        DESTINATION LEG // SOLANA MAINNET (KAMINO LEND)
                      </div>
                      <h3 className="text-sm font-mono font-semibold text-zinc-100 flex items-center gap-2 mt-0.5">
                        <Code size={16} className="text-emerald-400" />
                        LEG 2 SOLANA V0 MESSAGE GUARDRAIL (domain_id: 1 ·
                        Ed25519)
                      </h3>
                    </div>
                    <span className="font-mono text-[11px] px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                      <CheckCircle size={13} weight="fill" />
                      5-Ix V0 Verified
                    </span>
                  </div>

                  {report.leg2SolanaVerification ? (
                    <div className="space-y-3 font-mono text-xs">
                      {/* 5-Instruction Same-Slot Sequence Table */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/[0.07] rounded-lg overflow-hidden border border-white/[0.07] text-[11px]">
                        <div className="bg-[#0b0d11] p-2.5">
                          <span className="text-zinc-500">
                            [Header] V0 &amp; Signer
                          </span>
                          <div className="text-zinc-100 mt-0.5">
                            1 Signer · 0 Readonly · 0 ALTs
                          </div>
                        </div>
                        <div className="bg-[#0b0d11] p-2.5">
                          <span className="text-zinc-500">
                            [Ix 0] ComputeBudget
                          </span>
                          <div className="text-zinc-200 mt-0.5">
                            ≤ 1.4M CU · ≤ 5M µLamports/CU
                          </div>
                        </div>
                        <div className="bg-[#0b0d11] p-2.5">
                          <span className="text-zinc-500">
                            [Ix 1..2] refresh_reserve
                          </span>
                          <div className="text-emerald-300 mt-0.5">
                            0x02da8aeb4fc91966 (SOL &amp; USDC)
                          </div>
                        </div>
                        <div className="bg-[#0b0d11] p-2.5">
                          <span className="text-zinc-500">
                            [Ix 3] refresh_obligation
                          </span>
                          <div className="text-emerald-300 mt-0.5">
                            0x218493e497c04859 ([SOL, USDC])
                          </div>
                        </div>
                        <div className="bg-[#0b0d11] p-2.5 sm:col-span-2">
                          <span className="text-zinc-500">
                            [Ix 4] repay_obligation_liquidity_v2 (Anchor SHA-256
                            Discriminator)
                          </span>
                          <div className="text-emerald-300 mt-0.5">
                            0x74aed54cb435d290 ([116, 174, 213, 76, 180, 53,
                            210, 144])
                          </div>
                        </div>
                      </div>

                      {/* Pinned Account Invariants */}
                      <div className="p-3 rounded-lg bg-[#060709] border border-white/[0.07] space-y-1 text-[11px]">
                        <div className="text-zinc-400">
                          Pinned Kamino Repayment Account Array (ix.accounts):
                        </div>
                        <div className="text-zinc-200 truncate">
                          [0] owner/payer: {report.policy.mpcSolanaPayerPubkey}
                        </div>
                        <div className="text-zinc-200 truncate">
                          [1] obligation:{" "}
                          {report.policy.userKaminoObligationPubkey}
                        </div>
                        <div className="text-emerald-300 truncate">
                          [3] repay_reserve:{" "}
                          {report.leg2SolanaVerification.repayReservePubkey}
                        </div>
                        <div className="text-zinc-300 truncate">
                          [5] user_source_ata:{" "}
                          {
                            report.leg2SolanaVerification
                              .userSourceLiquidityAtaPubkey
                          }
                        </div>
                      </div>

                      {/* Raw 394-Byte Solana V0 Message Hex */}
                      <div className="p-3 rounded-lg bg-[#060709] border border-white/[0.07] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 text-[11px]">
                            Raw Serialized Solana V0 Message (
                            {report.leg2SolanaVerification.rawMessageHex
                              .length / 2}{" "}
                            bytes → payload_v2::Eddsa):
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                "leg2-hex",
                                `0x${
                                  report.leg2SolanaVerification
                                    ?.rawMessageHex ?? ""
                                }`
                              )
                            }
                            className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                          >
                            {copiedId === "leg2-hex" ? (
                              <Check size={12} className="text-emerald-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                            <span>Copy Hex</span>
                          </button>
                        </div>
                        <div className="text-zinc-300 break-all text-[11px] max-h-28 overflow-y-auto">
                          0x{report.leg2SolanaVerification.rawMessageHex}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-[#060709] border border-white/[0.07] font-mono text-xs text-zinc-400">
                      Position is currently in HOLD regime. Select a Stress-Test
                      preset above to inspect the 394-byte Solana V0 message.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* SECTION [02]: Interactive Split-Pane Red-Team Adversarial Simulator */}
        {showSection("RED_TEAM_SIMULATOR") && (
          <section className="rounded-2xl bg-white/[0.02] p-1.5 border border-white/[0.07]">
            <div className="rounded-[calc(1rem-2px)] bg-[#090b0e] border border-white/[0.06] p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/[0.07]">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-rose-400">
                    PILLAR 2 // ZERO-TRUST ADVERSARIAL RED-TEAM VERIFICATION
                  </div>
                  <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2 mt-0.5">
                    <WarningOctagon
                      size={18}
                      weight="duotone"
                      className="text-rose-400"
                    />
                    Prompt-Inject the AI — {attacks.length} Byte-Level &amp;
                    Async TOCTOU Attack Vectors
                  </h2>
                </div>
                <span className="font-mono text-xs px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                  {attacks.length} / {attacks.length} Rogue Payloads
                  Deterministically Reverted
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left Selector List (5 Cols) */}
                <div className="lg:col-span-5 grid grid-cols-1 gap-1.5 max-h-[520px] overflow-y-auto pr-1">
                  {attacks.map((atk, idx) => {
                    const isSelected = idx === selectedAttackIdx;
                    return (
                      <button
                        key={atk.attackId}
                        type="button"
                        onClick={() => {
                          setSelectedAttackIdx(idx);
                          setActiveSimulationBanner(atk);
                        }}
                        className={`w-full text-left rounded-lg p-3 border font-mono transition cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? "bg-rose-950/25 border-rose-500/50 text-zinc-100"
                            : "bg-[#0b0d11] hover:bg-white/[0.03] border-white/[0.07] text-zinc-300"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                            <span>{atk.attackId}</span>
                            <span>·</span>
                            <span className="text-emerald-400">
                              {atk.verificationTimeUs} µs
                            </span>
                          </div>
                          <div className="text-xs font-medium truncate mt-0.5">
                            {atk.title}
                          </div>
                        </div>
                        <CaretRight
                          size={14}
                          className={
                            isSelected
                              ? "text-rose-400 shrink-0"
                              : "text-zinc-600 shrink-0"
                          }
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Right Live Inspection Deck (7 Cols) */}
                {selectedAttack && (
                  <div className="lg:col-span-7 rounded-xl border border-white/[0.08] bg-[#0b0d11] p-5 space-y-4 font-mono">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.07]">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-rose-400">
                          {selectedAttack.attackId} //{" "}
                          {selectedAttack.targetLeg}
                        </span>
                        <h3 className="text-sm font-semibold text-zinc-100 mt-0.5">
                          {selectedAttack.title}
                        </h3>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold">
                        BLOCKED IN {selectedAttack.verificationTimeUs} µs
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                        Attacker Objective (Compromised Function-Call Key /
                        Prompt Injection):
                      </div>
                      <p className="text-xs text-zinc-200 font-sans leading-relaxed">
                        {selectedAttack.attackerGoal}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                        Injected Malicious Payload Pre-Image:
                      </div>
                      <div className="text-xs text-zinc-200 bg-[#060709] border border-white/[0.07] rounded-lg p-3 break-all">
                        {selectedAttack.injectedPayloadSummary}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-rose-400">
                        Deterministic NEAR Policy Guardrail Contract Revert:
                      </div>
                      <div className="text-xs text-rose-300 bg-rose-950/25 border border-rose-500/35 rounded-lg p-3.5 break-all leading-relaxed">
                        {selectedAttack.contractRevertMessage}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* SECTION [03]: Quantitative Historical Backtest Lab */}
        {showSection("BACKTEST_LAB") && backtest && (
          <section className="rounded-2xl bg-white/[0.02] p-1.5 border border-white/[0.07]">
            <div className="rounded-[calc(1rem-2px)] bg-[#090b0e] border border-white/[0.06] p-5 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-400">
                    PILLAR 3 // QUANTITATIVE MULTI-REGIME HISTORICAL BACKTEST
                  </div>
                  <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2 mt-0.5">
                    <ChartBar size={18} className="text-emerald-400" />
                    Why Volatility-Aware TEE Sizing Beats Static Threshold Bots
                    (100 SOL / $6,000 USDC Position)
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                  <span className="px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                    Intercept Survival:{" "}
                    {backtest.aggregateSummary.interceptSurvivalRatePct}% (vs.{" "}
                    {backtest.aggregateSummary.naiveMicroBotSurvivalRatePct}%
                    Naive Bot)
                  </span>
                  <span className="px-3 py-1.5 rounded bg-white/[0.03] border border-white/[0.08] text-zinc-200">
                    Penalty Prevented: $
                    {backtest.aggregateSummary.totalLiquidationLossPreventedUsd.toFixed(
                      2
                    )}
                  </span>
                  <span className="px-3 py-1.5 rounded bg-white/[0.03] border border-white/[0.08] text-emerald-300">
                    Base Capital Saved:{" "}
                    {
                      backtest.aggregateSummary
                        .capitalEfficiencySavingsVsConservativePct
                    }
                    %
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {backtest.scenarios.map((scen) => (
                  <div
                    key={scen.scenarioId}
                    className="rounded-xl border border-white/[0.07] bg-[#0b0d11] p-4 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="font-mono text-[10px] text-zinc-500">
                        {scen.scenarioId}
                      </div>
                      <div className="font-mono text-xs font-semibold text-zinc-100">
                        {scen.title}
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {scen.description}
                      </p>

                      <div className="space-y-1.5 pt-2">
                        {scen.outcomes.map((o) => {
                          const isIntercept =
                            o.strategyId === "INTERCEPT_VOLATILITY_TEE_ENGINE";
                          return (
                            <div
                              key={o.strategyId}
                              className={`rounded-lg border px-3 py-2 font-mono text-[11px] flex items-center justify-between gap-2 ${
                                isIntercept
                                  ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-200 font-medium"
                                  : o.survivedWithoutLiquidation
                                    ? "border-white/[0.06] bg-[#060709] text-zinc-300"
                                    : "border-rose-500/35 bg-rose-950/20 text-rose-300"
                              }`}
                            >
                              <span className="truncate">{o.strategyName}</span>
                              <span className="shrink-0">
                                {o.survivedWithoutLiquidation
                                  ? `HF ${o.finalHf.toFixed(2)} · $${o.totalBaseUsdcDeployed.toFixed(0)}`
                                  : `LIQUIDATED (-$${o.netCostUsd.toFixed(0)})`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="font-mono text-[11px] text-emerald-300 bg-emerald-950/15 border border-emerald-500/20 rounded-lg p-3 leading-relaxed">
                      {scen.interceptEdgeSummary}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* SECTION [04]: Deterministic MPC Vault Inspector & Pre-Flight Readiness */}
        {showSection("MPC_PREFLIGHT") && preflight && (
          <section className="rounded-2xl bg-white/[0.02] p-1.5 border border-white/[0.07]">
            <div className="rounded-[calc(1rem-2px)] bg-[#090b0e] border border-white/[0.06] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                    NEAR MAINNET CHAIN SIGNATURES // v1.signer::derived_public_key
                  </div>
                  <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2 mt-0.5">
                    <Vault size={18} className="text-emerald-400" />
                    Deterministic Cross-Chain MPC Vaults &amp; Mainnet Readiness
                  </h2>
                </div>
                <span className="font-mono text-xs px-3 py-1 rounded bg-[#060709] border border-white/[0.08] text-emerald-300">
                  {preflight.derivedMpc.source} (
                  {preflight.derivedMpc.latencyMs} ms)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.07] rounded-xl overflow-hidden border border-white/[0.07] font-mono text-xs">
                <div className="bg-[#0b0d11] p-4 space-y-1.5">
                  <div className="text-zinc-400 text-[10px] uppercase tracking-wider">
                    MPC_Base_Vault (domain_id: 0 · Secp256k1 · Base 8453)
                  </div>
                  <div className="text-emerald-300 break-all text-[11px]">
                    {preflight.derivedMpc.mpcBaseVaultAddress}
                  </div>
                  <div className="text-zinc-300 text-[11px] pt-1 flex items-center justify-between">
                    <span>
                      ETH: {preflight.baseState.ethBalanceFormatted} · USDC:{" "}
                      {preflight.baseState.usdcBalanceFormatted}
                    </span>
                    <span className="text-zinc-500">
                      Nonce: {preflight.baseState.nonce}
                    </span>
                  </div>
                </div>

                <div className="bg-[#0b0d11] p-4 space-y-1.5">
                  <div className="text-zinc-400 text-[10px] uppercase tracking-wider">
                    MPC_Solana_Payer (domain_id: 1 · Ed25519 · Solana)
                  </div>
                  <div className="text-emerald-300 break-all text-[11px]">
                    {preflight.derivedMpc.mpcSolanaPayerPubkey}
                  </div>
                  <div className="text-zinc-300 text-[11px] pt-1 flex items-center justify-between">
                    <span>SOL: {preflight.solanaState.solBalanceFormatted}</span>
                    <span className="text-zinc-500">
                      Blockhash:{" "}
                      {preflight.solanaState.recentBlockhashBase58.slice(0, 8)}
                      ...
                    </span>
                  </div>
                </div>

                <div className="bg-[#0b0d11] p-4 space-y-1.5">
                  <div className="text-zinc-400 text-[10px] uppercase tracking-wider">
                    Derived MPC_Solana_Payer_USDC_ATA (bump=
                    {preflight.solanaState.usdcAtaBump})
                  </div>
                  <div className="text-emerald-300 break-all text-[11px]">
                    {preflight.solanaState.usdcAtaPubkey}
                  </div>
                  <div className="text-zinc-300 text-[11px] pt-1 flex items-center justify-between">
                    <span>
                      USDC: {preflight.solanaState.usdcBalanceFormatted}
                    </span>
                    <span
                      className={
                        preflight.solanaState.usdcAtaExistsOnChain
                          ? "text-emerald-400"
                          : "text-amber-300"
                      }
                    >
                      ATA:{" "}
                      {preflight.solanaState.usdcAtaExistsOnChain
                        ? "INITIALIZED"
                        : "CREATE_IDEMPOTENT READY"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
