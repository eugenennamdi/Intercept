import crypto from "node:crypto";
import type { KaminoObligationTelemetry } from "./kamino-reader.ts";
import type { PythVolatilityTelemetry } from "./pyth-volatility.ts";

export type RiskRegime =
  | "HOLD"
  | "MICRO_BUFFER_RESCUE"
  | "CASCADE_DEEP_RESCUE";

export const TEE_RECEIPT_DOMAIN_PREFIX = "INTERCEPT_TEE_RECEIPT_V1";

export interface TeeEnclaveKeypair {
  publicKeyHex: string; // 32-byte raw Ed25519 public key hex
  privateKeyObject: crypto.KeyObject;
  publicKeyObject: crypto.KeyObject;
}

export interface TeeDecisionReceipt {
  timestamp: number;
  obligation_pubkey: string;
  observed_hf_bps: number;
  volatility_bps: number;
  regime: RiskRegime;
  repay_amount_usdc: string; // serialized as string for JSON u128 compatibility, or number
  oneclick_deposit_address: string;
  min_amount_out: string;
  reasoning_hash: string;
  enclave_signature_hex: string;
}

export interface QuantitativeRiskEvaluation {
  regime: RiskRegime;
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
  repayAmountUsdcMicro: bigint;
  repayAmountUsdcFormatted: string;
  reasoningSummary: string;
  reasoningHash: string;
}

/**
 * Generates a deterministic 32-byte Ed25519 keypair for the NEAR AI Cloud TEE enclave
 * from a 32-byte seed (using PKCS8 DER / SPKI DER wrapping via Node's built-in `node:crypto`).
 */
export function createTeeEnclaveKeypairFromSeed(
  seedHex: string = "42".repeat(32)
): TeeEnclaveKeypair {
  const seedBytes = Buffer.from(seedHex.replace(/^0x/, ""), "hex");
  if (seedBytes.length !== 32) {
    throw new Error(`Ed25519 seed must be 32 bytes, got ${seedBytes.length}`);
  }
  // ASN.1 PKCS#8 prefix for Ed25519 32-byte private key seed
  const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  const pkcs8Der = Buffer.concat([pkcs8Prefix, seedBytes]);
  const privateKeyObject = crypto.createPrivateKey({
    key: pkcs8Der,
    format: "der",
    type: "pkcs8",
  });
  const publicKeyObject = crypto.createPublicKey(privateKeyObject);
  const spkiDer = publicKeyObject.export({ format: "der", type: "spki" });
  // Last 32 bytes of Ed25519 SPKI DER are the raw 32-byte public key
  const rawPubkey = spkiDer.subarray(spkiDer.length - 32);

  return {
    publicKeyHex: rawPubkey.toString("hex"),
    privateKeyObject,
    publicKeyObject,
  };
}

/**
 * Normalizes a hex string by stripping `0x` and lowercasing (identical to Rust `TeeDecisionReceipt::normalize_hex`)
 */
export function normalizeHex(hexStr: string): string {
  return hexStr.replace(/^0x/i, "").toLowerCase();
}

/**
 * Formats the exact canonical ASCII pre-image verified by `contracts/policy-guardrail/src/tee_receipt.rs`:
 * `INTERCEPT_TEE_RECEIPT_V1|{timestamp}|{obligation_pubkey}|{observed_hf_bps}|{volatility_bps}|{regime}|{repay_amount_usdc}|0x{deposit_norm}|{min_amount_out}|0x{reasoning_norm}`
 */
export function formatCanonicalTeeReceiptPayload(receipt: {
  timestamp: number;
  obligation_pubkey: string;
  observed_hf_bps: number;
  volatility_bps: number;
  regime: RiskRegime;
  repay_amount_usdc: bigint | string | number;
  oneclick_deposit_address: string;
  min_amount_out: bigint | string | number;
  reasoning_hash: string;
}): string {
  const depositNorm = normalizeHex(receipt.oneclick_deposit_address);
  const reasoningNorm = normalizeHex(receipt.reasoning_hash);
  return [
    TEE_RECEIPT_DOMAIN_PREFIX,
    receipt.timestamp.toString(),
    receipt.obligation_pubkey,
    receipt.observed_hf_bps.toString(),
    receipt.volatility_bps.toString(),
    receipt.regime,
    receipt.repay_amount_usdc.toString(),
    `0x${depositNorm}`,
    receipt.min_amount_out.toString(),
    `0x${reasoningNorm}`,
  ].join("|");
}

/**
 * Computes the 32-byte SHA-256 receipt hash used by the NEAR contract for replay protection
 */
export function computeTeeReceiptHashHex(
  receipt: Parameters<typeof formatCanonicalTeeReceiptPayload>[0]
): string {
  const canonical = formatCanonicalTeeReceiptPayload(receipt);
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Quantitative Risk & De-Risking Engine:
 * Evaluates live Kamino Obligation health, Pyth SOL/USD volatility & downward velocity,
 * Kamino dynamic liquidation penalty (300 bps - 1000 bps), and Base opportunity cost
 * to select Regime A (`HOLD`), Regime B (`MICRO_BUFFER_RESCUE`), or Regime C (`CASCADE_DEEP_RESCUE`).
 */
export function evaluateDynamicDeRiskingModel(params: {
  kamino: KaminoObligationTelemetry;
  pyth: PythVolatilityTelemetry;
  minTriggerHfBps: number; // e.g. 11500 (1.1500)
  maxPerActionUsdcMicro: bigint;
  remainingDailyUsdcMicro: bigint;
  availableBaseVaultUsdcMicro: bigint;
  baseSupplyAprBps?: number; // e.g. 480 bps (4.80% Aave/Morpho Base USDC yield)
  solverSpreadBps?: number; // e.g. 12 bps (0.12% 1-Click solver spread)
}): QuantitativeRiskEvaluation {
  const {
    kamino,
    pyth,
    minTriggerHfBps,
    maxPerActionUsdcMicro,
    remainingDailyUsdcMicro,
    availableBaseVaultUsdcMicro,
    baseSupplyAprBps = 480,
    solverSpreadBps = 12,
  } = params;

  const observedHfBps = kamino.healthFactorBps;
  const volBps = pyth.realizedVolatilityBps;
  const velocityBps = pyth.emaVelocityBps;

  // Estimate Kamino dynamic liquidation bonus (300 bps minimum up to 1000 bps max as HF approaches 1.00)
  const breachSeverityRatio = Math.max(
    0,
    Math.min(1, (minTriggerHfBps - observedHfBps) / 1_500)
  );
  const estimatedKaminoLiquidationPenaltyBps = Math.round(
    300 + breachSeverityRatio * 700
  );

  // Opportunity cost of deploying Base USDC (solver spread + 7-day foregone Base yield)
  const sevenDayYieldBps = Math.round((baseSupplyAprBps * 7) / 365);
  const capitalOpportunityCostBps = solverSpreadBps + sevenDayYieldBps;

  // Determine regime:
  // - If observedHfBps >= minTriggerHfBps: HOLD
  // - If observedHfBps < minTriggerHfBps:
  //   - If observedHfBps < 11000 (1.10) OR volBps >= 5500 OR velocityBps <= -400 -> CASCADE_DEEP_RESCUE (target HF = max(1.45, trigger + 0.30))
  //   - Else -> MICRO_BUFFER_RESCUE (target HF = max(1.20, trigger + 0.05))
  let regime: RiskRegime = "HOLD";
  let targetHfBps = observedHfBps;

  if (observedHfBps < minTriggerHfBps) {
    const isHighVolOrSevereBreach =
      observedHfBps < 11_000 || volBps >= 5_500 || velocityBps <= -400;
    if (isHighVolOrSevereBreach) {
      regime = "CASCADE_DEEP_RESCUE";
      targetHfBps = Math.max(14_500, minTriggerHfBps + 3_000);
    } else {
      regime = "MICRO_BUFFER_RESCUE";
      targetHfBps = Math.max(12_000, minTriggerHfBps + 500);
    }
  }

  let repayAmountUsdcMicro = 0n;
  if (regime !== "HOLD" && kamino.debtValueUsd > 0) {
    // Target Debt USD = (riskAdjustedCollateralUsd * 10000) / targetHfBps
    const targetDebtUsd =
      (kamino.riskAdjustedCollateralUsd * 10_000) / targetHfBps;
    const rawRequiredRepayUsd = Math.max(
      0,
      kamino.debtValueUsd - targetDebtUsd
    );
    const rawMicro = BigInt(Math.ceil(rawRequiredRepayUsd * 1_000_000));

    // Cap against policy per-action, 24h remaining allowance,available Base vault balance, and total debt
    const maxAllowed = [
      rawMicro,
      maxPerActionUsdcMicro,
      remainingDailyUsdcMicro,
      availableBaseVaultUsdcMicro,
      kamino.borrowedUsdcMicro,
    ].reduce((min, cur) => (cur < min ? cur : min), rawMicro);

    // Ensure at least 100,000 micro-USDC ($0.10) if actionable
    repayAmountUsdcMicro = maxAllowed > 0n ? maxAllowed : 0n;
  }

  const repayUsd = Number(repayAmountUsdcMicro) / 1_000_000;
  const remainingDebtUsd = Math.max(0, kamino.debtValueUsd - repayUsd);
  const projectedPostRescueHfBps =
    remainingDebtUsd > 0.0001
      ? Math.round(
          (kamino.riskAdjustedCollateralUsd / remainingDebtUsd) * 10_000
        )
      : 99_999;

  const expectedLiquidationLossUsd = Number(
    (
      (kamino.collateralValueUsd * estimatedKaminoLiquidationPenaltyBps) /
      10_000
    ).toFixed(4)
  );
  const capitalExecutionCostUsd = Number(
    ((repayUsd * capitalOpportunityCostBps) / 10_000).toFixed(4)
  );
  const netProtectedValueUsd = Number(
    Math.max(0, expectedLiquidationLossUsd - capitalExecutionCostUsd).toFixed(4)
  );

  const reasoningSummary =
    regime === "HOLD"
      ? `Observed HF ${(observedHfBps / 10_000).toFixed(4)} >= threshold ${(minTriggerHfBps / 10_000).toFixed(4)} (Pyth SOL $${pyth.effectiveSolUsd.toFixed(2)}, vol ${volBps} bps). Position healthy; preserving Base USDC yield.`
      : `Regime ${regime} triggered: Observed HF ${(observedHfBps / 10_000).toFixed(4)} < threshold ${(minTriggerHfBps / 10_000).toFixed(4)} under Pyth SOL $${pyth.effectiveSolUsd.toFixed(2)} (vol ${volBps} bps, velocity ${velocityBps} bps). Kamino liquidation penalty risk (${estimatedKaminoLiquidationPenaltyBps} bps = $${expectedLiquidationLossUsd.toFixed(2)}) outweighs cross-chain cost (${capitalOpportunityCostBps} bps = $${capitalExecutionCostUsd.toFixed(4)}). Repaying ${(Number(repayAmountUsdcMicro) / 1_000_000).toFixed(2)} USDC to restore HF -> ${(projectedPostRescueHfBps / 10_000).toFixed(4)}.`;

  const reasoningTrace = JSON.stringify({
    obligationPubkey: kamino.obligationPubkey,
    observedHfBps,
    minTriggerHfBps,
    targetHfBps,
    projectedPostRescueHfBps,
    pythFeedId: pyth.feedId,
    effectiveSolUsd: pyth.effectiveSolUsd,
    volBps,
    velocityBps,
    priceProofHash: pyth.priceProofHash,
    estimatedKaminoLiquidationPenaltyBps,
    capitalOpportunityCostBps,
    repayAmountUsdcMicro: repayAmountUsdcMicro.toString(),
  });
  const reasoningHash =
    "0x" +
    crypto.createHash("sha256").update(reasoningTrace, "utf8").digest("hex");

  return {
    regime,
    actionable: regime !== "HOLD" && repayAmountUsdcMicro > 0n,
    observedHfBps,
    triggerThresholdHfBps: minTriggerHfBps,
    targetHfBps,
    projectedPostRescueHfBps,
    estimatedKaminoLiquidationPenaltyBps,
    expectedLiquidationLossUsd,
    capitalOpportunityCostBps,
    capitalExecutionCostUsd,
    netProtectedValueUsd,
    repayAmountUsdcMicro,
    repayAmountUsdcFormatted: (
      Number(repayAmountUsdcMicro) / 1_000_000
    ).toFixed(2),
    reasoningSummary,
    reasoningHash,
  };
}

/**
 * Signs a deterministic `TeeDecisionReceipt` inside the TEE enclave using Ed25519
 */
export function signTeeDecisionReceipt(params: {
  enclaveKeypair: TeeEnclaveKeypair;
  timestampSec: number;
  obligationPubkey: string;
  observedHfBps: number;
  volatilityBps: number;
  regime: RiskRegime;
  repayAmountUsdcMicro: bigint;
  oneclickDepositAddress: string;
  minAmountOutMicro: bigint;
  reasoningHash: string;
}): {
  receipt: TeeDecisionReceipt;
  canonicalPayload: string;
  receiptHashHex: string;
} {
  const unsignedReceipt = {
    timestamp: params.timestampSec,
    obligation_pubkey: params.obligationPubkey,
    observed_hf_bps: params.observedHfBps,
    volatility_bps: params.volatilityBps,
    regime: params.regime,
    repay_amount_usdc: params.repayAmountUsdcMicro.toString(),
    oneclick_deposit_address: params.oneclickDepositAddress.toLowerCase(),
    min_amount_out: params.minAmountOutMicro.toString(),
    reasoning_hash: params.reasoningHash.toLowerCase(),
  };

  const canonicalPayload = formatCanonicalTeeReceiptPayload(unsignedReceipt);
  const sigBuffer = crypto.sign(
    null,
    Buffer.from(canonicalPayload, "utf8"),
    params.enclaveKeypair.privateKeyObject
  );
  const receiptHashHex = computeTeeReceiptHashHex(unsignedReceipt);

  return {
    receipt: {
      ...unsignedReceipt,
      enclave_signature_hex: sigBuffer.toString("hex"),
    },
    canonicalPayload,
    receiptHashHex,
  };
}

/**
 * Verifies a signed `TeeDecisionReceipt` against the enclave's Ed25519 public key
 */
export function verifyTeeDecisionReceiptSignature(
  receipt: TeeDecisionReceipt,
  enclavePublicKeyObject: crypto.KeyObject
): boolean {
  const canonicalPayload = formatCanonicalTeeReceiptPayload(receipt);
  const sigBytes = Buffer.from(
    normalizeHex(receipt.enclave_signature_hex),
    "hex"
  );
  if (sigBytes.length !== 64) return false;
  return crypto.verify(
    null,
    Buffer.from(canonicalPayload, "utf8"),
    enclavePublicKeyObject,
    sigBytes
  );
}
