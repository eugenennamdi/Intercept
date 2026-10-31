import assert from "node:assert/strict";
import test from "node:test";
import {
  DEMO_CALIBRATED_OBLIGATION_SOURCE,
  deserializeKaminoObligationAccount,
  evaluateKaminoObligationHealth,
  KAMINO_MAIN_MARKET_PUBKEY,
  KAMINO_OBLIGATION_ACCOUNT_DISCRIMINATOR,
  KAMINO_SOL_RESERVE_PUBKEY,
  KAMINO_USDC_RESERVE_PUBKEY,
} from "./kamino-reader.ts";
import {
  buildSolanaCreateIdempotentUsdcAtaInstruction,
  deriveMpcAddressesFromNearSigner,
  secp256k1DerivedKeyToEvmAddress,
} from "./mainnet-broadcaster.ts";
import { fetchOneClickRescueQuote } from "./oneclick-client.ts";
import {
  executeInterceptRescuePipeline,
  runAdversarialAttackSuite,
  runQuantitativeBacktestSuite,
} from "./orchestrator.ts";
import { verifyNearAiCloudAttestationBundle } from "./near-ai-cloud.ts";
import {
  assembleSignedEip1559Transaction,
  assembleSignedSolanaVersionedTransaction,
  base58Decode,
  buildErc20TransferCalldata,
  buildSolanaKaminoRepayMessageBytes,
  buildUnsignedEip1559TxBytes,
  deriveSolanaAssociatedTokenAddress,
  ERC20_APPROVE_SELECTOR_HEX,
  isOnEd25519Curve,
  KAMINO_MAINNET_USDC_RESERVE_PUBKEY,
  keccak256Hex,
  REFRESH_OBLIGATION_DISCRIMINATOR,
  REFRESH_OBLIGATION_FARMS_FOR_RESERVE_DISCRIMINATOR,
  REFRESH_RESERVES_BATCH_DISCRIMINATOR,
  REFRESH_RESERVE_DISCRIMINATOR,
  REPAY_OBLIGATION_LIQUIDITY_V1_DISCRIMINATOR,
  REPAY_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR,
  verifyEip1559BaseUsdcTransferBytes,
  verifySolanaKaminoRepayMessageBytes,
  WITHDRAW_OBLIGATION_COLLATERAL_V2_DISCRIMINATOR,
} from "./payload-builder.ts";
import { calculateVolatilityAndVelocityBps } from "./pyth-volatility.ts";
import {
  createTeeEnclaveKeypairFromSeed,
  evaluateDynamicDeRiskingModel,
  signTeeDecisionReceipt,
  verifyTeeDecisionReceiptSignature,
} from "./risk-engine.ts";

test("Anchor discriminators match SHA-256 preimages for Kamino v2, v1, and all 4 same-slot refresh instructions", () => {
  assert.deepEqual(
    Array.from(REPAY_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR),
    [116, 174, 213, 76, 180, 53, 210, 144]
  );
  assert.deepEqual(
    Array.from(REPAY_OBLIGATION_LIQUIDITY_V1_DISCRIMINATOR),
    [145, 178, 13, 225, 76, 240, 147, 72]
  );
  assert.deepEqual(
    Array.from(REFRESH_RESERVE_DISCRIMINATOR),
    [2, 218, 138, 235, 79, 201, 25, 102]
  );
  assert.deepEqual(
    Array.from(REFRESH_RESERVES_BATCH_DISCRIMINATOR),
    [144, 110, 26, 103, 162, 204, 252, 147]
  );
  assert.deepEqual(
    Array.from(REFRESH_OBLIGATION_DISCRIMINATOR),
    [33, 132, 147, 228, 151, 192, 72, 89]
  );
  assert.deepEqual(
    Array.from(REFRESH_OBLIGATION_FARMS_FOR_RESERVE_DISCRIMINATOR),
    [140, 144, 253, 21, 10, 74, 248, 3]
  );

  // Verify canonical Ethereum Keccak-256 (0x01 padding)
  assert.equal(
    keccak256Hex(Buffer.alloc(0)),
    "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
  );
  assert.equal(
    keccak256Hex(Buffer.from("transfer(address,uint256)", "utf8")).slice(0, 10),
    "0xa9059cbb"
  );
});

test("Quantitative Risk Engine selects HOLD, MICRO_BUFFER_RESCUE, and CASCADE_DEEP_RESCUE accurately", () => {
  const basePyth = {
    source: "PYTH_SOLANA_MAINNET_PUSH_ORACLE" as const,
    feedId: "0xef0d",
    solanaAccountPubkey: "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE",
    publishTimeUnix: 1793550000,
    rawSpotSolUsd: 180,
    emaSolUsd: 180,
    confidenceUsd: 0.05,
    confidenceSpreadBps: 3,
    emaVelocityBps: 0,
    realizedVolatilityBps: 3200,
    stressShockPctApplied: 0,
    effectiveSolUsd: 180,
    usdcSpotUsd: 1.0,
    priceProofHash: "0x" + "11".repeat(32),
    fetchLatencyMs: 12,
  };

  // Case 1: Healthy position (HF = 1.41 > 1.15) -> HOLD
  const healthyKamino = evaluateKaminoObligationHealth({
    obligationPubkey: "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG",
    ownerSolanaEoa: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    depositedSol: 0.065,
    borrowedUsdc: 6.2,
    solPriceUsd: 180,
  });
  const evalHold = evaluateDynamicDeRiskingModel({
    kamino: healthyKamino,
    pyth: basePyth,
    minTriggerHfBps: 11_500,
    maxPerActionUsdcMicro: 50_000_000n,
    remainingDailyUsdcMicro: 250_000_000n,
    availableBaseVaultUsdcMicro: 15_000_000n,
  });
  assert.equal(evalHold.regime, "HOLD");
  assert.equal(evalHold.repayAmountUsdcMicro, 0n);

  // Case 2: Mild breach (1.10 <= HF < 1.15) with low volatility -> MICRO_BUFFER_RESCUE (target HF 1.20)
  // 0.065 SOL * $144 * 0.75 = $7.02 risk-adj collateral / $6.20 debt = 1.1322 HF
  const mildKamino = evaluateKaminoObligationHealth({
    obligationPubkey: "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG",
    ownerSolanaEoa: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    depositedSol: 0.065,
    borrowedUsdc: 6.2,
    solPriceUsd: 144,
  });
  const evalMicro = evaluateDynamicDeRiskingModel({
    kamino: mildKamino,
    pyth: { ...basePyth, effectiveSolUsd: 144, realizedVolatilityBps: 3600 },
    minTriggerHfBps: 11_500,
    maxPerActionUsdcMicro: 50_000_000n,
    remainingDailyUsdcMicro: 250_000_000n,
    availableBaseVaultUsdcMicro: 15_000_000n,
  });
  assert.equal(evalMicro.regime, "MICRO_BUFFER_RESCUE");
  assert.equal(evalMicro.targetHfBps, 12_000);
  assert.ok(evalMicro.repayAmountUsdcMicro > 0n);

  // Case 3: Severe crash (-25% SOL to $135) with high volatility -> CASCADE_DEEP_RESCUE (target HF 1.45)
  const volMetrics = calculateVolatilityAndVelocityBps({
    spotPrice: 180,
    emaPrice: 180,
    confidenceUsd: 0.12,
    stressShockPct: -25,
  });
  const cascadeKamino = evaluateKaminoObligationHealth({
    obligationPubkey: "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG",
    ownerSolanaEoa: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    depositedSol: 0.065,
    borrowedUsdc: 6.2,
    solPriceUsd: volMetrics.effectiveSolUsd,
  });
  const evalCascade = evaluateDynamicDeRiskingModel({
    kamino: cascadeKamino,
    pyth: {
      ...basePyth,
      effectiveSolUsd: volMetrics.effectiveSolUsd,
      emaVelocityBps: volMetrics.emaVelocityBps,
      realizedVolatilityBps: volMetrics.realizedVolatilityBps,
    },
    minTriggerHfBps: 11_500,
    maxPerActionUsdcMicro: 50_000_000n,
    remainingDailyUsdcMicro: 250_000_000n,
    availableBaseVaultUsdcMicro: 15_000_000n,
  });
  assert.equal(evalCascade.regime, "CASCADE_DEEP_RESCUE");
  assert.equal(evalCascade.targetHfBps, 14_500);
  assert.ok(evalCascade.repayAmountUsdcMicro > evalMicro.repayAmountUsdcMicro);
});

test("TEE Ed25519 receipt signing and verification rejects tampering", () => {
  const enclave = createTeeEnclaveKeypairFromSeed();
  const rogue = createTeeEnclaveKeypairFromSeed("99".repeat(32));

  const signed = signTeeDecisionReceipt({
    enclaveKeypair: enclave,
    timestampSec: 1793550000,
    obligationPubkey: "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG",
    observedHfBps: 10_612,
    volatilityBps: 8_200,
    regime: "CASCADE_DEEP_RESCUE",
    repayAmountUsdcMicro: 1_663_794n,
    oneclickDepositAddress: "0x9999999999999999999999999999999999999999",
    minAmountOutMicro: 1_647_156n,
    reasoningHash: "0x" + "ab".repeat(32),
  });

  assert.equal(
    verifyTeeDecisionReceiptSignature(signed.receipt, enclave.publicKeyObject),
    true
  );
  assert.equal(
    verifyTeeDecisionReceiptSignature(signed.receipt, rogue.publicKeyObject),
    false
  );
});

test("Byte-level Leg 1 EIP-1559 and Leg 2 Solana V0 verifiers accept valid txs and reject rogue txs", async () => {
  const deposit = "0x9999999999999999999999999999999999999999";
  const amount = 5_000_000n;
  const validCalldata = buildErc20TransferCalldata(deposit, amount);
  const validTx = buildUnsignedEip1559TxBytes({
    nonce: 3,
    calldata: validCalldata,
  });

  const checkOk = verifyEip1559BaseUsdcTransferBytes({
    rawUnsignedTxHex: validTx.rawUnsignedTxHex,
    expectedDepositAddressHex: deposit,
    expectedRepayAmountUsdcMicro: amount,
  });
  assert.equal(checkOk.ok, true);

  // Reject ERC-20 approve
  const approveCalldata = buildErc20TransferCalldata(
    deposit,
    amount,
    ERC20_APPROVE_SELECTOR_HEX
  );
  const approveTx = buildUnsignedEip1559TxBytes({
    nonce: 3,
    calldata: approveCalldata,
  });
  const checkApprove = verifyEip1559BaseUsdcTransferBytes({
    rawUnsignedTxHex: approveTx.rawUnsignedTxHex,
    expectedDepositAddressHex: deposit,
    expectedRepayAmountUsdcMicro: amount,
  });
  assert.equal(checkApprove.ok, false);
  assert.equal(checkApprove.errorCode, "FORBIDDEN_SELECTOR");

  // Reject Kamino collateral withdrawal on Leg 2
  const mpcPayer = "GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre";
  const obligation = "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG";
  const withdrawMsg = buildSolanaKaminoRepayMessageBytes({
    versionedV0: true,
    mpcSolanaPayerPubkey: mpcPayer,
    userObligationPubkey: obligation,
    repayAmountUsdcMicro: amount,
    customDiscriminator: WITHDRAW_OBLIGATION_COLLATERAL_V2_DISCRIMINATOR,
  });
  const checkSolWithdraw = verifySolanaKaminoRepayMessageBytes({
    rawMessageHex: withdrawMsg.rawMessageHex,
    expectedMpcSolanaPayerPubkey: mpcPayer,
    expectedUserObligationPubkey: obligation,
    minRepayAmountUsdcMicro: amount,
    maxRepayAmountUsdcMicro: amount,
  });
  assert.equal(checkSolWithdraw.ok, false);
  assert.equal(checkSolWithdraw.errorCode, "FORBIDDEN_KAMINO_WITHDRAW");

  // End-to-end Stress Test pipeline and adversarial suite
  const stressReport = await executeInterceptRescuePipeline({
    mode: "STRESS_TEST_MAINNET_MODE",
    stressShockPct: -25,
  });
  assert.equal(stressReport.riskEvaluation.actionable, true);
  assert.ok(
    stressReport.kaminoAfter.healthFactorBps >
      stressReport.kaminoBefore.healthFactorBps
  );

  const attacks = runAdversarialAttackSuite();
  assert.equal(attacks.length, 11);
  for (const atk of attacks) {
    assert.equal(atk.guardrailBlocked, true, `Attack ${atk.attackId} must be blocked`);
  }

  // Verify Quantitative Historical Backtest Suite
  const backtest = runQuantitativeBacktestSuite();
  assert.equal(backtest.scenarios.length, 3);
  assert.equal(backtest.aggregateSummary.interceptSurvivalRatePct, 100);
  assert.ok(backtest.aggregateSummary.totalLiquidationLossPreventedUsd > 500);
  assert.ok(
    backtest.aggregateSummary.capitalEfficiencySavingsVsConservativePct > 70
  );
});

test("Multi-instruction Kamino refresh+repay passes, sneaking withdraw after refresh fails, and 32-byte pre-hash is rejected", async () => {
  const mpcPayer = "GZMAbwapG99YKCsA2CDVc4bXeBzd7nvKMQgtm9K8aKas";
  const obligation = "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG";
  const amount = 10_000_000n;

  // 1. Valid 5-instruction message: [ComputeBudget, refresh_reserve(SOL), refresh_reserve(USDC), refresh_obligation, repay_obligation_liquidity_v2]
  const validFullMsg = buildSolanaKaminoRepayMessageBytes({
    versionedV0: true,
    mpcSolanaPayerPubkey: mpcPayer,
    userObligationPubkey: obligation,
    repayAmountUsdcMicro: amount,
    includeComputeBudget: true,
    includeRefreshInstructions: true,
  });
  const checkValid = verifySolanaKaminoRepayMessageBytes({
    rawMessageHex: validFullMsg.rawMessageHex,
    expectedMpcSolanaPayerPubkey: mpcPayer,
    expectedUserObligationPubkey: obligation,
    minRepayAmountUsdcMicro: amount,
    maxRepayAmountUsdcMicro: amount,
  });
  assert.equal(checkValid.ok, true);
  assert.equal(checkValid.decoded?.computeBudgetIxCount, 1);
  assert.equal(checkValid.decoded?.kaminoRefreshIxCount, 3);
  assert.equal(checkValid.decoded?.repayAmountUsdcMicro, amount);
  assert.equal(
    checkValid.decoded?.repayReservePubkey,
    KAMINO_MAINNET_USDC_RESERVE_PUBKEY
  );

  // Verify deterministic Solana USDC ATA derivation & off-curve PDA invariant
  const derivedAta = deriveSolanaAssociatedTokenAddress(mpcPayer);
  assert.equal(isOnEd25519Curve(derivedAta.ataPubkeyBytes), false);
  assert.equal(isOnEd25519Curve(base58Decode(mpcPayer)), true);
  assert.equal(
    checkValid.decoded?.userSourceLiquidityPubkey,
    derivedAta.ataPubkeyBase58
  );

  // Reject rogue repay_reserve at ix.accounts[3]
  const rogueRepayReserveMsg = buildSolanaKaminoRepayMessageBytes({
    versionedV0: true,
    mpcSolanaPayerPubkey: mpcPayer,
    userObligationPubkey: obligation,
    repayReservePubkey: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    repayAmountUsdcMicro: amount,
    includeComputeBudget: true,
    includeRefreshInstructions: false,
  });
  const checkRogueReserve = verifySolanaKaminoRepayMessageBytes({
    rawMessageHex: rogueRepayReserveMsg.rawMessageHex,
    expectedMpcSolanaPayerPubkey: mpcPayer,
    expectedUserObligationPubkey: obligation,
    minRepayAmountUsdcMicro: amount,
    maxRepayAmountUsdcMicro: amount,
  });
  assert.equal(checkRogueReserve.ok, false);
  assert.equal(checkRogueReserve.errorCode, "REPAY_RESERVE_MISMATCH");

  // 2. Sneak `withdraw_obligation_collateral_v2` in a refresh slot -> must be rejected
  const sneakWithdrawInRefresh = buildSolanaKaminoRepayMessageBytes({
    versionedV0: true,
    mpcSolanaPayerPubkey: mpcPayer,
    userObligationPubkey: obligation,
    repayAmountUsdcMicro: amount,
    includeComputeBudget: true,
    includeRefreshInstructions: true,
    customRefreshDiscriminator: WITHDRAW_OBLIGATION_COLLATERAL_V2_DISCRIMINATOR,
  });
  const checkSneak = verifySolanaKaminoRepayMessageBytes({
    rawMessageHex: sneakWithdrawInRefresh.rawMessageHex,
    expectedMpcSolanaPayerPubkey: mpcPayer,
    expectedUserObligationPubkey: obligation,
    minRepayAmountUsdcMicro: amount,
    maxRepayAmountUsdcMicro: amount,
  });
  assert.equal(checkSneak.ok, false);
  assert.equal(checkSneak.errorCode, "FORBIDDEN_KAMINO_WITHDRAW");

  // 3. Reject 32-byte SHA-256 pre-hash passed instead of raw Solana Message bytes
  const checkPrehash = verifySolanaKaminoRepayMessageBytes({
    rawMessageHex: "ab".repeat(32),
    expectedMpcSolanaPayerPubkey: mpcPayer,
    expectedUserObligationPubkey: obligation,
    minRepayAmountUsdcMicro: amount,
    maxRepayAmountUsdcMicro: amount,
  });
  assert.equal(checkPrehash.ok, false);
  assert.equal(checkPrehash.errorCode, "PREHASH_FORBIDDEN");

  // 4. Verify signed EIP-1559 and signed Solana VersionedTransaction reconstruction
  const calldata = buildErc20TransferCalldata(
    "0x9999999999999999999999999999999999999999",
    amount
  );
  const unsignedEvm = buildUnsignedEip1559TxBytes({ nonce: 5, calldata });
  const signedEvm = assembleSignedEip1559Transaction({
    rawUnsignedTxHex: unsignedEvm.rawUnsignedTxHex,
    bigRAffineHex: "02" + "11".repeat(32),
    sScalarHex: "22".repeat(32),
    recoveryId: 1,
  });
  assert.ok(signedEvm.signedTxHex.startsWith("0x02"));
  assert.equal(signedEvm.yParity, 1);

  const signedSol = assembleSignedSolanaVersionedTransaction({
    rawMessageHex: validFullMsg.rawMessageHex,
    ed25519SignatureHex: "33".repeat(64),
  });
  assert.equal(
    signedSol.signedTransactionBytes.length,
    1 + 64 + validFullMsg.rawMessageBytes.length
  );

  // 5. Verify MPC address derivation from v1.signer
  const derived = await deriveMpcAddressesFromNearSigner({
    predecessorContractId: "guardrail.intercept-defi.near",
    baseDerivationPath: "intercept-base-vault-1",
    solanaDerivationPath: "intercept-solana-payer-1",
  });
  assert.ok(/^0x[0-9a-f]{40}$/.test(derived.mpcBaseVaultAddress));
  assert.equal(
    derived.mpcBaseVaultAddress,
    secp256k1DerivedKeyToEvmAddress(derived.rawSecp256k1DerivedKey)
  );
  assert.ok(derived.mpcSolanaPayerPubkey.length >= 32);

  // 6. Verify Kamino 3,344-byte zero-copy Obligation account deserializer at exact struct offsets (96 & 1208)
  const rawObligationBuf = Buffer.alloc(3344, 0);
  Buffer.from(KAMINO_OBLIGATION_ACCOUNT_DISCRIMINATOR).copy(rawObligationBuf, 0);
  rawObligationBuf.writeBigUInt64LE(320_111_222n, 16); // last_update.slot
  base58Decode(KAMINO_MAIN_MARKET_PUBKEY).copy(rawObligationBuf, 32);
  base58Decode("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU").copy(
    rawObligationBuf,
    64
  );
  // deposits[0] (ObligationCollateral) at offset 96
  base58Decode(KAMINO_SOL_RESERVE_PUBKEY).copy(rawObligationBuf, 96);
  rawObligationBuf.writeBigUInt64LE(115_000_000n, 96 + 32); // 0.115 SOL
  // borrows[0] (ObligationLiquidity) at offset 1208
  base58Decode(KAMINO_USDC_RESERVE_PUBKEY).copy(rawObligationBuf, 1208);
  const borrowedSf = 6_200_000n * (1n << 60n); // 6.20 USDC scaled by 2^60
  rawObligationBuf.writeBigUInt64LE(
    borrowedSf & 0xffffffffffffffffn,
    1208 + 88
  );
  rawObligationBuf.writeBigUInt64LE(borrowedSf >> 64n, 1208 + 96);

  const parsedObligation = deserializeKaminoObligationAccount(rawObligationBuf);
  assert.ok(parsedObligation !== null);
  assert.equal(
    parsedObligation.lendingMarketPubkey,
    KAMINO_MAIN_MARKET_PUBKEY
  );
  assert.equal(
    parsedObligation.ownerSolanaEoa,
    "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
  );
  assert.equal(parsedObligation.depositedSolLamports, 115_000_000n);
  assert.equal(parsedObligation.borrowedUsdcMicro, 6_200_000n);
  assert.equal(
    DEMO_CALIBRATED_OBLIGATION_SOURCE,
    "DEMO_CALIBRATED_OBLIGATION_SNAPSHOT (Live Pyth Oracle + Real Kamino Mainnet Reserve Parameters)"
  );

  // 7. Verify NEAR AI Cloud (`cloud-api.near.ai/v1`) attestation bundle & tamper rejection
  const stressReport = await executeInterceptRescuePipeline({
    mode: "STRESS_TEST_MAINNET_MODE",
    stressShockPct: -25,
  });
  const enclave = createTeeEnclaveKeypairFromSeed();
  assert.equal(
    stressReport.nearAiCloudAttestation.verifiedChainOfTrust,
    true
  );
  const validBundleCheck = verifyNearAiCloudAttestationBundle(
    stressReport.nearAiCloudAttestation,
    enclave.publicKeyObject
  );
  assert.equal(validBundleCheck.valid, true);

  // Tamper with NVIDIA NRAS eat_nonce -> must fail GPU-CPU binding check
  const tamperedNonceCheck = verifyNearAiCloudAttestationBundle(
    {
      ...stressReport.nearAiCloudAttestation,
      hardwareAttestation: {
        ...stressReport.nearAiCloudAttestation.hardwareAttestation,
        nvidiaNrasEatNonceHex: "00".repeat(32),
      },
    },
    enclave.publicKeyObject
  );
  assert.equal(tamperedNonceCheck.valid, false);

  // 8. Verify 1-Click safety abort when dryRun=false and API fails (never synthesize a fake depositAddress for live broadcasts)
  await assert.rejects(
    async () => {
      await fetchOneClickRescueQuote({
        amountInMicroUsdc: 10_000_000n,
        mpcBaseVaultAddress: derived.mpcBaseVaultAddress,
        mpcSolanaPayerAddress: derived.mpcSolanaPayerPubkey,
        dryRun: false,
        apiBaseUrl: "http://127.0.0.1:1",
        timeoutMs: 250,
      });
    },
    /CRITICAL SAFETY ABORT/
  );

  // 9. Verify idempotent Solana Associated Token Account creation instruction builder
  const createAtaIx = buildSolanaCreateIdempotentUsdcAtaInstruction({
    payerPubkey: mpcPayer,
    ownerPubkey: mpcPayer,
  });
  assert.equal(
    createAtaIx.programId,
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
  );
  assert.equal(createAtaIx.instructionDataHex, "01");
  assert.equal(createAtaIx.ataPubkey, derivedAta.ataPubkeyBase58);
});
