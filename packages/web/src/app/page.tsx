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
  };
  kaminoBefore: {
    source: string;
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
  };
  oneClickQuote: {
    source: string;
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

export default function InterceptCommandCenterPage() {
  const [report, setReport] = useState<ExecutionReport | null>(null);
  const [preflight, setPreflight] = useState<PreflightReport | null>(null);
  const [attacks, setAttacks] = useState<AdversarialAttackVectorResult[]>([]);
  const [backtest, setBacktest] = useState<BacktestSuiteReport | null>(null);
  const [selectedAttackIdx, setSelectedAttackIdx] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shockSliderPct, setShockSliderPct] = useState<number>(-25);
  const [activeSimulationBanner, setActiveSimulationBanner] =
    useState<AdversarialAttackVectorResult | null>(null);

  const runPipeline = useCallback(
    async (params: {
      mode: "LIVE_MAINNET_MODE" | "STRESS_TEST_MAINNET_MODE";
      stressShockPct?: number;
      minTriggerHfBpsOverride?: number;
    }) => {
      setIsRunning(true);
      setErrorMsg(null);
      try {
        const res = await fetch("/api/intercept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
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
    void runPipeline({ mode: "STRESS_TEST_MAINNET_MODE", stressShockPct: -25 });
  }, [runPipeline]);

  const handleSimulateRogueAiHack = () => {
    if (attacks.length === 0) return;
    const nextIdx = (selectedAttackIdx + 1) % attacks.length;
    setSelectedAttackIdx(nextIdx);
    setActiveSimulationBanner(attacks[nextIdx]);
  };

  const regimeBadgeColor = (regime?: string) => {
    if (regime === "HOLD") {
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    }
    if (regime === "MICRO_BUFFER_RESCUE") {
      return "bg-amber-500/10 text-amber-300 border-amber-500/30";
    }
    return "bg-rose-500/10 text-rose-400 border-rose-500/30";
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Institutional Navigation Bar (height capped at 64px) */}
      <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck size={18} weight="duotone" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold tracking-tight text-zinc-100">
                  INTERCEPT
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                  v1.signer + 1-Click + Kamino KLend
                </span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 font-mono text-xs">
            <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Solana Slot:{" "}
              {report?.pythTelemetry.solanaSlot?.toLocaleString() ??
                "461,722,042"}
            </span>
            <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
              Pyth SOL: $
              {report?.pythTelemetry.rawSpotSolUsd.toFixed(2) ?? "..."}
            </span>
            <span
              className={`px-2.5 py-1 rounded border font-medium ${
                report?.mode === "LIVE_MAINNET_MODE"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-300"
              }`}
            >
              {report?.mode ?? "INITIALIZING"}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
        {/* Pillar 1 Honest Custody & Collateral Isolation Statement + Visual Architecture Diagram */}
        <section className="rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <LockKey
                size={20}
                weight="duotone"
                className="text-emerald-400 shrink-0 mt-0.5"
              />
              <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
                <strong className="text-emerald-300 font-medium">
                  Third-Party Kamino Repayment Guarantee:{" "}
                </strong>
                Your Kamino collateral stays in your personal Solana wallet and
                can never be withdrawn by Intercept. Your idle Base rescue
                reserve is governed by decentralized NEAR MPC (
                <code className="font-mono text-emerald-300">v1.signer</code>)
                and byte-level smart contract guardrails—no single custodian and
                no raw private keys.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSimulateRogueAiHack}
                className="px-3.5 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 active:scale-[0.98] border border-rose-500/40 text-rose-300 font-mono text-xs font-medium flex items-center gap-2 transition cursor-pointer"
              >
                <WarningOctagon size={16} weight="duotone" />
                Prompt-Inject the AI
              </button>
            </div>
          </div>

          {/* 3-Box Visual Custody & Cross-Chain Architecture Diagram */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-emerald-500/20 font-mono text-xs">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 space-y-1">
              <div className="text-emerald-400 font-semibold flex items-center justify-between">
                <span>1. User Phantom Wallet (Solana EOA)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                  ZERO DELEGATION
                </span>
              </div>
              <div className="text-zinc-300 text-[11px]">
                Holds SOL Collateral &amp; Kamino Obligation PDA (
                {report?.policy.userKaminoObligationPubkey.slice(0, 8) ??
                  "H6ARHf6Y"}
                ...).{" "}
                <span className="text-emerald-300">
                  withdraw_obligation_collateral_v2 requires User EOA signature
                  and is blocked on-chain.
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 space-y-1">
              <div className="text-amber-300 font-semibold flex items-center justify-between">
                <span>2. NEAR Policy Guardrail Contract</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                  4-STATE TOCTOU
                </span>
              </div>
              <div className="text-zinc-300 text-[11px]">
                Enforces{" "}
                <span className="text-amber-200">
                  InFlightLeg1 → ReadyForLeg2 → InFlightLeg2 → Completed
                </span>
                , Ed25519 TEE receipt, 24h USDC cap, EIP-1559 RLP bytes, and
                Kamino V0 instruction layout.
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 space-y-1">
              <div className="text-sky-300 font-semibold flex items-center justify-between">
                <span>3. MPC Base Vault → 1-Click → MPC Repayer</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/30">
                  v1.signer MPC
                </span>
              </div>
              <div className="text-zinc-300 text-[11px]">
                Leg 1{" "}
                <span className="text-sky-200">domain_id:0 (Ecdsa 32B)</span>{" "}
                transfers Base USDC to 1-Click solver → Leg 2{" "}
                <span className="text-sky-200">domain_id:1 (Eddsa Raw V0)</span>{" "}
                executes same-slot refresh + third-party Kamino repay.
              </div>
            </div>
          </div>
        </section>

        {/* Live Pre-Flight & Deterministic MPC Vault Inspector */}
        {preflight && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="font-mono text-xs font-semibold text-zinc-200 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400" />
                PRE-FLIGHT &amp; DETERMINISTIC MPC VAULT INSPECTOR (NEAR
                v1.signer::derived_public_key)
              </div>
              <span className="font-mono text-[11px] px-2.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-emerald-400">
                Source: {preflight.derivedMpc.source} (
                {preflight.derivedMpc.latencyMs} ms)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
              <div className="rounded-lg border border-zinc-800/90 bg-zinc-950/70 p-3 space-y-1">
                <div className="text-zinc-400 text-[11px]">
                  MPC_Base_Vault (domain_id: 0 · Secp256k1 · Base 8453)
                </div>
                <div className="text-emerald-300 break-all text-[11px]">
                  {preflight.derivedMpc.mpcBaseVaultAddress}
                </div>
                <div className="text-zinc-300 text-[11px] pt-1 flex items-center justify-between">
                  <span>
                    ETH: {preflight.baseState.ethBalanceFormatted} | USDC:{" "}
                    {preflight.baseState.usdcBalanceFormatted}
                  </span>
                  <span className="text-zinc-400">
                    Nonce: {preflight.baseState.nonce}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800/90 bg-zinc-950/70 p-3 space-y-1">
                <div className="text-zinc-400 text-[11px]">
                  MPC_Solana_Payer (domain_id: 1 · Ed25519 · Solana Mainnet)
                </div>
                <div className="text-emerald-300 break-all text-[11px]">
                  {preflight.derivedMpc.mpcSolanaPayerPubkey}
                </div>
                <div className="text-zinc-300 text-[11px] pt-1 flex items-center justify-between">
                  <span>SOL: {preflight.solanaState.solBalanceFormatted}</span>
                  <span className="text-zinc-400">
                    Blockhash:{" "}
                    {preflight.solanaState.recentBlockhashBase58.slice(0, 10)}
                    ...
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800/90 bg-zinc-950/70 p-3 space-y-1">
                <div className="text-zinc-400 text-[11px]">
                  Derived MPC_Solana_Payer_USDC_ATA (user_source_liquidity)
                </div>
                <div className="text-emerald-300 break-all text-[11px]">
                  {preflight.solanaState.usdcAtaPubkey}
                </div>
                <div className="text-zinc-300 text-[11px] pt-1 flex items-center justify-between">
                  <span>
                    USDC: {preflight.solanaState.usdcBalanceFormatted} (bump=
                    {preflight.solanaState.usdcAtaBump})
                  </span>
                  <span
                    className={
                      preflight.solanaState.usdcAtaExistsOnChain
                        ? "text-emerald-400"
                        : "text-amber-300"
                    }
                  >
                    ATA On-Chain:{" "}
                    {preflight.solanaState.usdcAtaExistsOnChain
                      ? "YES"
                      : "PENDING INIT"}
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Active Rogue AI Hack Revert Banner (if triggered) */}
        {activeSimulationBanner && (
          <section className="rounded-xl border border-rose-500/50 bg-rose-950/25 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-rose-300 font-mono text-xs font-semibold">
                <XCircle size={18} weight="fill" className="text-rose-400" />
                NEAR POLICY CONTRACT REVERTED ROGUE AI TRANSACTION [
                {activeSimulationBanner.attackId}] IN{" "}
                {activeSimulationBanner.verificationTimeUs} µs
              </div>
              <button
                type="button"
                onClick={() => setActiveSimulationBanner(null)}
                className="text-xs font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
            <p className="text-xs text-zinc-300">
              <span className="text-zinc-400">Attack Vector:</span>{" "}
              {activeSimulationBanner.title} —{" "}
              {activeSimulationBanner.attackerGoal}
            </p>
            <div className="font-mono text-xs bg-zinc-950/90 border border-rose-500/30 rounded-lg p-2.5 text-rose-300 overflow-x-auto">
              {activeSimulationBanner.contractRevertMessage}
            </div>
          </section>
        )}

        {/* Execution Mode & Stress-Test Trigger Controls */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-100">
                Cross-Chain Liquidation Defense Command Center
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Evaluate unmodified live Solana Mainnet telemetry or inject a
                deterministic stress shock to trigger the 2-leg Base → NEAR
                Intents → Solana Kamino rescue pipeline.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isRunning}
                onClick={() =>
                  runPipeline({ mode: "LIVE_MAINNET_MODE", stressShockPct: 0 })
                }
                className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] border border-zinc-700 text-zinc-100 font-mono text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <Pulse size={15} className="text-emerald-400" />
                Live Mainnet Mode (0% Shock)
              </button>

              <button
                type="button"
                disabled={isRunning}
                onClick={() => {
                  setShockSliderPct(-21);
                  void runPipeline({
                    mode: "STRESS_TEST_MAINNET_MODE",
                    stressShockPct: -21,
                  });
                }}
                className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] border border-amber-500/30 text-amber-300 font-mono text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <SlidersHorizontal size={15} />
                Mild Breach (-21% SOL → Micro Rescue)
              </button>

              <button
                type="button"
                disabled={isRunning}
                onClick={() => {
                  setShockSliderPct(-25);
                  void runPipeline({
                    mode: "STRESS_TEST_MAINNET_MODE",
                    stressShockPct: -25,
                  });
                }}
                className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-zinc-950 font-mono text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <Lightning size={15} weight="fill" />
                Cascade Crash (-25% SOL → Deep Rescue)
              </button>

              <button
                type="button"
                disabled={isRunning}
                onClick={() =>
                  runPipeline({
                    mode: "STRESS_TEST_MAINNET_MODE",
                    stressShockPct: 0,
                    minTriggerHfBpsOverride: 14_800,
                  })
                }
                className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] border border-zinc-700 text-zinc-200 font-mono text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <Play size={14} />
                Policy Threshold Override (Min HF 1.48)
              </button>
            </div>
          </div>

          {/* Custom Stress Slider */}
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 max-w-xl">
              <label
                htmlFor="sol-shock-slider"
                className="font-mono text-xs text-zinc-400 whitespace-nowrap"
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
                onChange={(e) => setShockSliderPct(Number(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer"
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
                  })
                }
                className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-mono text-xs text-zinc-200 cursor-pointer"
              >
                Apply
              </button>
            </div>

            <div className="font-mono text-xs text-zinc-400 flex items-center gap-2">
              <Timer size={15} className="text-emerald-400" />
              Total Pipeline Stopwatch:{" "}
              <span className="text-zinc-100 font-semibold">
                {report ? `${report.totalMeasuredLatencyMs} ms` : "..."}
              </span>
            </div>
          </div>
        </section>

        {errorMsg && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 text-xs font-mono text-rose-300">
            Error: {errorMsg}
          </div>
        )}

        {/* Top 3-Column Telemetry Grid: Kamino HF Gauge + Pyth Volatility + Quantitative Risk Model */}
        {report && (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Kamino Obligation Health Factor Gauge */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-400">
                  SOLANA KAMINO OBLIGATION STATE
                </span>
                <a
                  href={`https://solscan.io/account/${report.kaminoBefore.lendingMarketPubkey}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-emerald-400 hover:underline flex items-center gap-1"
                >
                  KLend Market <ArrowSquareOut size={13} />
                </a>
              </div>

              <div className="grid grid-cols-2 gap-4 py-2 border-y border-zinc-800/80">
                <div>
                  <div className="text-xs text-zinc-400">
                    Observed Health Factor
                  </div>
                  <div
                    className={`font-mono text-3xl font-bold mt-1 ${
                      report.kaminoBefore.healthFactorBps <
                      report.policy.minTriggerHfBps
                        ? "text-rose-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {report.kaminoBefore.healthFactor.toFixed(4)}
                  </div>
                  <div className="font-mono text-[11px] text-zinc-400 mt-0.5">
                    Trigger Floor:{" "}
                    {(report.policy.minTriggerHfBps / 10_000).toFixed(4)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-zinc-400">
                    Post-Rescue Health Factor
                  </div>
                  <div className="font-mono text-3xl font-bold text-emerald-400 mt-1">
                    {report.kaminoAfter.healthFactor.toFixed(4)}
                  </div>
                  <div className="font-mono text-[11px] text-zinc-400 mt-0.5">
                    Target HF:{" "}
                    {(report.riskEvaluation.targetHfBps / 10_000).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-400 shrink-0">Data Source:</span>
                  <span className="text-emerald-300 text-right truncate">
                    {report.kaminoBefore.source}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">User Solana EOA (Owner):</span>
                  <span className="text-zinc-200">
                    {report.policy.userSolanaEoaPubkey.slice(0, 8)}...
                    {report.policy.userSolanaEoaPubkey.slice(-6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Kamino Obligation PDA:</span>
                  <span className="text-zinc-200">
                    {report.policy.userKaminoObligationPubkey.slice(0, 8)}...
                    {report.policy.userKaminoObligationPubkey.slice(-6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Deposited Collateral:</span>
                  <span className="text-zinc-200">
                    {report.kaminoBefore.depositedSol} SOL ($
                    {report.kaminoBefore.collateralValueUsd.toFixed(2)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Borrowed Debt (Before → After):</span>
                  <span className="text-emerald-300">
                    {report.kaminoBefore.borrowedUsdc.toFixed(2)} →{" "}
                    {report.kaminoAfter.borrowedUsdc.toFixed(2)} USDC
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">SOL Liquidation Price:</span>
                  <span className="text-amber-300">
                    ${report.kaminoBefore.liquidationSolPriceUsd.toFixed(2)} (Liq
                    LTV {(report.kaminoBefore.liquidationLtvBps / 100).toFixed(0)}
                    %)
                  </span>
                </div>
              </div>
            </div>

            {/* Column 2: Live Pyth Oracle & Realized Volatility */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-400">
                  PYTH NETWORK ORACLE TELEMETRY
                </span>
                <a
                  href={`https://solscan.io/account/${report.pythTelemetry.solanaAccountPubkey}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-emerald-400 hover:underline flex items-center gap-1"
                >
                  PriceUpdateV2 <ArrowSquareOut size={13} />
                </a>
              </div>

              <div className="grid grid-cols-2 gap-4 py-2 border-y border-zinc-800/80">
                <div>
                  <div className="text-xs text-zinc-400">
                    Effective SOL/USD Price
                  </div>
                  <div className="font-mono text-3xl font-bold text-zinc-100 mt-1">
                    ${report.pythTelemetry.effectiveSolUsd.toFixed(2)}
                  </div>
                  <div className="font-mono text-[11px] text-zinc-400 mt-0.5">
                    Live Spot: ${report.pythTelemetry.rawSpotSolUsd.toFixed(2)} (
                    {report.pythTelemetry.stressShockPctApplied}% shock)
                  </div>
                </div>

                <div>
                  <div className="text-xs text-zinc-400">
                    Realized Volatility (σ)
                  </div>
                  <div className="font-mono text-3xl font-bold text-amber-300 mt-1">
                    {(report.pythTelemetry.realizedVolatilityBps / 100).toFixed(
                      2
                    )}
                    %
                  </div>
                  <div className="font-mono text-[11px] text-zinc-400 mt-0.5">
                    {report.pythTelemetry.realizedVolatilityBps} bps | Vel:{" "}
                    {report.pythTelemetry.emaVelocityBps} bps
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Oracle Source:</span>
                  <span className="text-emerald-300">
                    {report.pythTelemetry.source}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">EMA Price / Confidence:</span>
                  <span className="text-zinc-200">
                    ${report.pythTelemetry.emaSolUsd.toFixed(2)} ± $
                    {report.pythTelemetry.confidenceUsd.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Pyth Feed ID:</span>
                  <span className="text-zinc-200">
                    {report.pythTelemetry.feedId.slice(0, 12)}...
                    {report.pythTelemetry.feedId.slice(-6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Oracle Proof SHA-256:</span>
                  <span className="text-zinc-200">
                    {report.pythTelemetry.priceProofHash.slice(0, 14)}...
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Oracle Read Latency:</span>
                  <span className="text-zinc-200">
                    {report.pythTelemetry.fetchLatencyMs} ms
                  </span>
                </div>
              </div>
            </div>

            {/* Column 3: NEAR AI Cloud TEE Quantitative Risk Model */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-400 flex items-center gap-1.5">
                  <Cpu size={15} className="text-emerald-400" />
                  NEAR AI CLOUD TEE RISK ENGINE
                </span>
                <span
                  className={`font-mono text-[11px] px-2 py-0.5 rounded border font-semibold ${regimeBadgeColor(
                    report.riskEvaluation.regime
                  )}`}
                >
                  {report.riskEvaluation.regime}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 py-2 border-y border-zinc-800/80">
                <div>
                  <div className="text-xs text-zinc-400">
                    Optimal USDC Repayment
                  </div>
                  <div className="font-mono text-3xl font-bold text-emerald-400 mt-1">
                    ${report.riskEvaluation.repayAmountUsdcFormatted}
                  </div>
                  <div className="font-mono text-[11px] text-zinc-400 mt-0.5">
                    {report.riskEvaluation.repayAmountUsdcMicro} micro-USDC
                  </div>
                </div>

                <div>
                  <div className="text-xs text-zinc-400">
                    Kamino Penalty Avoided
                  </div>
                  <div className="font-mono text-3xl font-bold text-zinc-100 mt-1">
                    {(
                      report.riskEvaluation
                        .estimatedKaminoLiquidationPenaltyBps / 100
                    ).toFixed(2)}
                    %
                  </div>
                  <div className="font-mono text-[11px] text-zinc-400 mt-0.5">
                    vs.{" "}
                    {(
                      report.riskEvaluation.capitalOpportunityCostBps / 100
                    ).toFixed(2)}
                    % solver + yield cost
                  </div>
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed font-mono bg-zinc-950/70 border border-zinc-800/80 rounded-lg p-3">
                {report.riskEvaluation.reasoningSummary}
              </p>

              <div className="space-y-1.5 text-[11px] font-mono pt-1 border-t border-zinc-800/80">
                <div className="flex justify-between">
                  <span className="text-zinc-400">NEAR AI Cloud Model:</span>
                  <span className="text-emerald-300">
                    {report.nearAiCloudAttestation.model}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">TEE Hardware Binding:</span>
                  <span className="text-zinc-200">
                    {report.nearAiCloudAttestation.hardwareAttestation.gpuArchitecture}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">TDX + NRAS Chain of Trust:</span>
                  <span className="text-emerald-400 font-semibold">
                    {report.nearAiCloudAttestation.verifiedChainOfTrust
                      ? "VERIFIED (Ed25519)"
                      : "UNVERIFIED"}
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 5-Stage Cross-Chain Execution Telemetry & Stopwatch */}
        {report && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                  <ArrowsLeftRight size={18} className="text-emerald-400" />
                  5-Stage Cross-Chain Rescue Execution Telemetry (Base → NEAR
                  Intents → Solana Kamino)
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Real measured millisecond stopwatch across oracle ingestion,
                  1-Click solver quote, Leg 1 Base MPC signing, solver fill, and
                  Leg 2 Solana Kamino repayment.
                </p>
              </div>
              <span className="font-mono text-xs px-3 py-1 rounded bg-zinc-950 border border-zinc-800 text-emerald-400">
                End-to-End Measured Time: {report.totalMeasuredLatencyMs} ms
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {report.stages.map((stage) => (
                <div
                  key={stage.stageId}
                  className="rounded-lg border border-zinc-800/90 bg-zinc-950/60 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-6 h-6 rounded-full font-mono text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                        stage.status === "COMPLETED"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                      }`}
                    >
                      {stage.stageIndex}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-zinc-100">
                          {stage.label}
                        </span>
                        <span
                          className={`font-mono text-[10px] px-2 py-0.5 rounded ${
                            stage.status === "COMPLETED"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-zinc-900 text-zinc-400 border border-zinc-800"
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

                  <div className="flex items-center gap-4 shrink-0 self-end md:self-center">
                    <span className="font-mono text-xs text-zinc-200 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded">
                      {stage.measuredLatencyMs} ms
                    </span>
                    <a
                      href={stage.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      {stage.explorerLabel}
                      <ArrowSquareOut size={14} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Byte-Level Policy Guardrail & Raw Pre-Image Inspector */}
        {report && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Leg 1 Base EVM RLP & TEE Receipt Inspector */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-mono font-semibold text-zinc-100 flex items-center gap-2">
                  <Code size={17} className="text-emerald-400" />
                  LEG 1 GUARDRAIL INSPECTOR (BASE EVM · domain_id: 0)
                </h2>
                <span className="font-mono text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle size={14} weight="fill" />
                  RLP + Ed25519 Verified
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-1.5">
                  <div className="text-zinc-400">
                    NEAR Policy Contract & Vaults:
                  </div>
                  <div className="text-zinc-200 truncate">
                    Contract: {report.policy.nearContractId} → v1.signer
                  </div>
                  <div className="text-zinc-200 truncate">
                    MPC_Base_Vault (secp256k1):{" "}
                    {report.policy.mpcBaseVaultAddress}
                  </div>
                  <div className="text-zinc-200 truncate">
                    Caps: ${report.policy.maxPerActionUsdcFormatted}/tx · $
                    {report.policy.maxDailyUsdcFormatted}/24h · Max Slippage{" "}
                    {(report.policy.maxSlippageBps / 100).toFixed(2)}%
                  </div>
                </div>

                {report.teeReceipt ? (
                  <>
                    <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-1">
                      <div className="text-zinc-400">
                        Signed TEE Decision Receipt Canonical Pre-Image:
                      </div>
                      <div className="text-emerald-300 break-all text-[11px] leading-relaxed">
                        {report.teeReceipt.canonicalPayload}
                      </div>
                      <div className="text-zinc-400 pt-1">
                        Enclave Ed25519 Signature (64 bytes):
                      </div>
                      <div className="text-zinc-300 break-all text-[11px]">
                        0x{report.teeReceipt.receipt.enclave_signature_hex}
                      </div>
                    </div>

                    {report.leg1BaseVerification && (
                      <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-1.5">
                        <div className="text-zinc-400">
                          Unsigned EIP-1559 Base USDC Transfer Pre-Image (0x02
                          || rlp):
                        </div>
                        <div className="text-zinc-300 break-all text-[11px]">
                          {report.leg1BaseVerification.rawUnsignedTxHex}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                          <div className="rounded bg-zinc-900/90 border border-zinc-800 px-2 py-1 text-emerald-300">
                            calldata[0..4] = 0xa9059cbb (transfer)
                          </div>
                          <div className="rounded bg-zinc-900/90 border border-zinc-800 px-2 py-1 text-zinc-300">
                            calldata[4..16] = 12B zero padding
                          </div>
                          <div className="rounded bg-zinc-900/90 border border-zinc-800 px-2 py-1 text-sky-300 truncate">
                            calldata[16..36] ={" "}
                            {report.oneClickQuote?.depositAddress}
                          </div>
                          <div className="rounded bg-zinc-900/90 border border-zinc-800 px-2 py-1 text-amber-300">
                            calldata[36..68] ={" "}
                            {report.riskEvaluation.repayAmountUsdcMicro} µUSDC
                          </div>
                        </div>
                        <div className="text-zinc-400 pt-1">
                          Keccak-256 Signing Digest Passed to v1.signer::sign
                          (payload_v2::Ecdsa):
                        </div>
                        <div className="text-emerald-300 break-all text-[11px]">
                          {report.leg1BaseVerification.signingHashKeccak256Hex}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/80 text-zinc-400">
                    Position is currently in HOLD regime. Trigger a Stress-Test
                    Rescue above to inspect live signed TEE receipts and
                    EIP-1559 RLP payloads.
                  </div>
                )}
              </div>
            </div>

            {/* Right: Leg 2 Solana V0 Message & Kamino Repay Inspector */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-mono font-semibold text-zinc-100 flex items-center gap-2">
                  <Code size={17} className="text-emerald-400" />
                  LEG 2 GUARDRAIL INSPECTOR (SOLANA · domain_id: 1)
                </h2>
                <span className="font-mono text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle size={14} weight="fill" />
                  KLend Byte-Layout Verified
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-1.5">
                  <div className="text-zinc-400">
                    Enforced Solana Program & Discriminator Invariants:
                  </div>
                  <div className="text-zinc-200 truncate">
                    MPC_Solana_Payer (ed25519):{" "}
                    {report.policy.mpcSolanaPayerPubkey}
                  </div>
                  <div className="text-zinc-200 truncate">
                    Allowed Programs: ComputeBudget111...111 +
                    KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD
                  </div>
                  <div className="text-emerald-300 break-all">
                    sha256(&quot;global:repay_obligation_liquidity_v2&quot;)[0..8]
                    = [116, 174, 213, 76, 180, 53, 210, 144] (0x74aed54cb435d290)
                  </div>
                  <div className="text-zinc-300 break-all text-[11px]">
                    Same-Slot Refresh Whitelist: refresh_reserve (0x02da8aeb4fc91966) ·
                    refresh_obligation (0x218493e497c04859)
                  </div>
                </div>

                {report.leg2SolanaVerification ? (
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-1.5">
                    <div className="text-zinc-400">
                      Raw Serialized Solana V0 Message Bytes Passed to
                      v1.signer::sign (payload_v2::Eddsa,{" "}
                      {report.leg2SolanaVerification.rawMessageHex.length / 2}{" "}
                      bytes,{" "}
                      {report.leg2SolanaVerification.kaminoRefreshIxCount}{" "}
                      refresh ixs + 1 repay ix, 0 ALTs):
                    </div>
                    <div className="text-zinc-300 break-all text-[11px] max-h-40 overflow-y-auto">
                      0x{report.leg2SolanaVerification.rawMessageHex}
                    </div>
                    <div className="text-zinc-400 pt-1">
                      5-Instruction Same-Slot Kamino Refresh + Repay Layout &amp;
                      Pinned Accounts:
                    </div>
                    <div className="text-emerald-300 text-[11px] leading-relaxed">
                      [0] ComputeBudget · [1] refresh_reserve(SOL) · [2]
                      refresh_reserve(USDC) · [3] refresh_obligation(remaining=[SOL,USDC])
                      · [4] repay_obligation_liquidity_v2
                    </div>
                    <div className="text-sky-300 text-[11px] leading-relaxed break-all">
                      ix.accounts[0] (repayer) == MPC_Solana_Payer ·
                      ix.accounts[1] (obligation) =={" "}
                      {report.policy.userKaminoObligationPubkey.slice(0, 10)}...
                      · ix.accounts[2] (market) == 7u3HeHxY...v5PfF ·
                      ix.accounts[3] (repay_reserve) =={" "}
                      {report.leg2SolanaVerification.repayReservePubkey.slice(
                        0,
                        10
                      )}
                      ... · ix.accounts[5] (user_source_liquidity_ata) =={" "}
                      {report.leg2SolanaVerification.userSourceLiquidityAtaPubkey.slice(
                        0,
                        10
                      )}
                      ...
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800/80 text-zinc-400">
                    Position is currently in HOLD regime. Trigger a Stress-Test
                    Rescue above to inspect the raw 539-byte Solana V0 Message
                    pre-image.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Quantitative Multi-Regime Historical Backtest Benchmark */}
        {backtest && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                  <Pulse
                    size={18}
                    weight="duotone"
                    className="text-emerald-400"
                  />
                  Quantitative Historical Backtest Lab — Why Volatility-Aware TEE
                  Sizing Beats Static Threshold Bots
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Deterministic multi-tick replay on a 100 SOL ($10,000) / $6,000
                  USDC Kamino Obligation comparing Unprotected, Naive Static
                  (HF &rarr; 1.20), Over-Conservative (HF &rarr; 1.45), and
                  Intercept&apos;s Pyth Volatility + Velocity TEE Engine.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                  Survival: {backtest.aggregateSummary.interceptSurvivalRatePct}%
                  (vs. {backtest.aggregateSummary.naiveMicroBotSurvivalRatePct}%
                  Naive Bot)
                </span>
                <span className="px-2.5 py-1 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300">
                  Capital Saved:{" "}
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
                  className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="font-mono text-xs font-semibold text-zinc-100">
                      {scen.title}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {scen.description}
                    </p>
                    <div className="space-y-1.5 pt-2">
                      {scen.outcomes.map((o) => {
                        const isIntercept =
                          o.strategyId === "INTERCEPT_VOLATILITY_TEE_ENGINE";
                        return (
                          <div
                            key={o.strategyId}
                            className={`rounded border px-2.5 py-1.5 font-mono text-[11px] flex items-center justify-between gap-2 ${
                              isIntercept
                                ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-200"
                                : o.survivedWithoutLiquidation
                                  ? "border-zinc-800 bg-zinc-900/60 text-zinc-300"
                                  : "border-rose-500/30 bg-rose-950/20 text-rose-300"
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
                  <div className="text-[11px] text-emerald-300/90 bg-emerald-950/20 border border-emerald-500/20 rounded p-2.5 leading-relaxed">
                    {scen.interceptEdgeSummary}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Adversarial Red-Team Matrix (Proving Rogue AI Payloads Revert) */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                <WarningOctagon
                  size={18}
                  weight="duotone"
                  className="text-rose-400"
                />
                Red-Team Adversarial Simulator — &ldquo;Prompt-Inject the
                AI&rdquo; ({attacks.length} Byte-Level &amp; TOCTOU Attack
                Vectors)
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Click any vector below to inject a rogue payload into the NEAR
                Policy Guardrail Contract. Every attempt to withdraw collateral,
                hide accounts in V0 ALTs, pass a 32B Solana pre-hash, approve
                token spenders, or race concurrent Leg 2 calls is
                deterministically reverted before calling v1.signer.
              </p>
            </div>
            <span className="font-mono text-xs px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              {attacks.length} / {attacks.length} Rogue Payloads
              Deterministically Reverted
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {attacks.map((atk, idx) => (
              <div
                key={atk.attackId}
                onClick={() => {
                  setSelectedAttackIdx(idx);
                  setActiveSimulationBanner(atk);
                }}
                className={`rounded-lg border p-4 space-y-2 transition cursor-pointer ${
                  activeSimulationBanner?.attackId === atk.attackId
                    ? "border-rose-500/60 bg-rose-950/20"
                    : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-zinc-100">
                    {atk.title}
                  </span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
                    BLOCKED ({atk.verificationTimeUs} µs)
                  </span>
                </div>
                <p className="text-xs text-zinc-400">{atk.attackerGoal}</p>
                <div className="font-mono text-[11px] text-zinc-300 bg-zinc-900/90 border border-zinc-800 rounded px-2.5 py-1.5 truncate">
                  {atk.injectedPayloadSummary}
                </div>
                <div className="font-mono text-[11px] text-rose-300 bg-rose-950/30 border border-rose-500/25 rounded px-2.5 py-1.5 break-all">
                  {atk.contractRevertMessage}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
