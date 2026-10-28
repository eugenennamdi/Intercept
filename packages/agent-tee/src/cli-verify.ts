import { runMainnetPreflightCheck } from "./mainnet-broadcaster.ts";
import {
  executeInterceptRescuePipeline,
  runAdversarialAttackSuite,
} from "./orchestrator.ts";
import {
  REFRESH_OBLIGATION_DISCRIMINATOR,
  REFRESH_OBLIGATION_FARMS_FOR_RESERVE_DISCRIMINATOR,
  REFRESH_RESERVES_BATCH_DISCRIMINATOR,
  REFRESH_RESERVE_DISCRIMINATOR,
  REPAY_OBLIGATION_LIQUIDITY_V1_DISCRIMINATOR,
  REPAY_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR,
} from "./payload-builder.ts";

function divider(title: string): void {
  console.log(`\n${"=".repeat(82)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(82)}`);
}

async function printPreflightSection(): Promise<void> {
  divider(
    "LIVE MAINNET PRE-FLIGHT CHECK (v1.signer::derived_public_key + BASE 8453 + SOLANA)"
  );
  const preflight = await runMainnetPreflightCheck();
  console.log(
    `  NEAR v1.signer Source        : ${preflight.derivedMpc.source} (${preflight.derivedMpc.nearRpcUrl})`
  );
  console.log(
    `  Predecessor Policy Contract  : ${preflight.derivedMpc.predecessorContractId}`
  );
  console.log(
    `  domain_id: 0 (Base Path)     : "${preflight.derivedMpc.baseDerivationPath}"`
  );
  console.log(
    `    ↳ Raw Secp256k1 Key        : ${preflight.derivedMpc.rawSecp256k1DerivedKey}`
  );
  console.log(
    `    ↳ Derived MPC_Base_Vault   : ${preflight.derivedMpc.mpcBaseVaultAddress}`
  );
  console.log(
    `  domain_id: 1 (Solana Path)   : "${preflight.derivedMpc.solanaDerivationPath}"`
  );
  console.log(
    `    ↳ Raw Ed25519 Key          : ${preflight.derivedMpc.rawEd25519DerivedKey}`
  );
  console.log(
    `    ↳ Derived MPC_Solana_Payer : ${preflight.derivedMpc.mpcSolanaPayerPubkey}`
  );
  console.log(
    `    ↳ MPC_Solana_Payer_USDC_ATA: ${preflight.solanaState.usdcAtaPubkey} (bump=${preflight.solanaState.usdcAtaBump}, existsOnChain=${preflight.solanaState.usdcAtaExistsOnChain})`
  );
  console.log(
    `  Base Mainnet RPC State       : ${preflight.baseState.source} | Chain ID ${preflight.baseState.chainId} | Nonce ${preflight.baseState.nonce} | ETH ${preflight.baseState.ethBalanceFormatted} | USDC ${preflight.baseState.usdcBalanceFormatted}`
  );
  console.log(
    `  Solana Mainnet RPC State     : ${preflight.solanaState.source} | Blockhash ${preflight.solanaState.recentBlockhashBase58} | SOL ${preflight.solanaState.solBalanceFormatted} | USDC ${preflight.solanaState.usdcBalanceFormatted}`
  );
  console.log("\n  Live $10 Mainnet Rescue Readiness Checklist:");
  for (const item of preflight.checklist) {
    const badge = item.passed ? "READY" : "INFO ";
    console.log(`    [${badge}] ${item.item}`);
    console.log(`            ↳ ${item.detail}`);
  }
}

async function main(): Promise<void> {
  const preflightOnly = process.argv.includes("--preflight");
  const rescueLive = process.argv.includes("--rescue-live");
  console.log(
    "INTERCEPT — ZERO-TRUST CROSS-CHAIN KAMINO LIQUIDATION DEFENSE VERIFIER"
  );
  console.log(
    "Architecture: NEAR AI Cloud (TEE) + NEAR Policy Guardrail + v1.signer MPC + NEAR Intents 1-Click"
  );

  await printPreflightSection();
  if (preflightOnly) {
    return;
  }

  if (rescueLive) {
    divider("LIVE $10 MAINNET CROSS-CHAIN RESCUE EXECUTION (rescue:live)");
    const triggerHfOverride = Number(
      process.env.MIN_TRIGGER_HF_BPS_OVERRIDE ?? "14800"
    );
    const liveRescueReport = await executeInterceptRescuePipeline({
      mode: "STRESS_TEST_MAINNET_MODE",
      stressShockPct: Number(process.env.STRESS_SHOCK_PCT ?? "0"),
      minTriggerHfBpsOverride: triggerHfOverride,
    });
    console.log(
      `  Kamino Telemetry     : ${liveRescueReport.kaminoBefore.source}`
    );
    console.log(
      `  Observed Health      : HF ${liveRescueReport.kaminoBefore.healthFactor.toFixed(4)} -> Post-Rescue HF ${liveRescueReport.kaminoAfter.healthFactor.toFixed(4)}`
    );
    console.log(
      `  Repayment Executed   : ${liveRescueReport.riskEvaluation.repayAmountUsdcFormatted} USDC (${liveRescueReport.riskEvaluation.regime})`
    );
    console.log("\n  Verifiable Explorer Links:");
    for (const stage of liveRescueReport.stages) {
      console.log(
        `    [${stage.stageIndex}/5] ${stage.label}: ${stage.explorerUrl}`
      );
    }
    return;
  }

  // 1. Verify Anchor SHA-256 Instruction Discriminators
  divider("STEP 1: KAMINO LEND ANCHOR SHA-256 DISCRIMINATOR VERIFICATION");
  console.log(
    `  sha256("global:repay_obligation_liquidity_v2")[0..8]          : [${Array.from(REPAY_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR).join(", ")}] (0x${REPAY_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR.toString("hex")})`
  );
  console.log(
    `  sha256("global:repay_obligation_liquidity")[0..8]             : [${Array.from(REPAY_OBLIGATION_LIQUIDITY_V1_DISCRIMINATOR).join(", ")}] (0x${REPAY_OBLIGATION_LIQUIDITY_V1_DISCRIMINATOR.toString("hex")})`
  );
  console.log(
    `  sha256("global:refresh_reserve")[0..8]                        : [${Array.from(REFRESH_RESERVE_DISCRIMINATOR).join(", ")}] (0x${REFRESH_RESERVE_DISCRIMINATOR.toString("hex")})`
  );
  console.log(
    `  sha256("global:refresh_reserves_batch")[0..8]                 : [${Array.from(REFRESH_RESERVES_BATCH_DISCRIMINATOR).join(", ")}] (0x${REFRESH_RESERVES_BATCH_DISCRIMINATOR.toString("hex")})`
  );
  console.log(
    `  sha256("global:refresh_obligation")[0..8]                     : [${Array.from(REFRESH_OBLIGATION_DISCRIMINATOR).join(", ")}] (0x${REFRESH_OBLIGATION_DISCRIMINATOR.toString("hex")})`
  );
  console.log(
    `  sha256("global:refresh_obligation_farms_for_reserve")[0..8]   : [${Array.from(REFRESH_OBLIGATION_FARMS_FOR_RESERVE_DISCRIMINATOR).join(", ")}] (0x${REFRESH_OBLIGATION_FARMS_FOR_RESERVE_DISCRIMINATOR.toString("hex")})`
  );

  // 2. Run Mode 1: LIVE_MAINNET_MODE
  divider("STEP 2: LIVE_MAINNET_MODE (UNMODIFIED PYTH HERMES SOL/USD FEED)");
  const liveReport = await executeInterceptRescuePipeline({
    mode: "LIVE_MAINNET_MODE",
  });
  console.log(`  Oracle Source        : ${liveReport.pythTelemetry.source}`);
  console.log(`  Kamino Source        : ${liveReport.kaminoBefore.source}`);
  console.log(
    `  Live Pyth SOL/USD    : $${liveReport.pythTelemetry.rawSpotSolUsd.toFixed(4)} ± $${liveReport.pythTelemetry.confidenceUsd.toFixed(4)} (EMA: $${liveReport.pythTelemetry.emaSolUsd.toFixed(4)})`
  );
  console.log(
    `  Realized Volatility  : ${liveReport.pythTelemetry.realizedVolatilityBps} bps | Velocity: ${liveReport.pythTelemetry.emaVelocityBps} bps`
  );
  console.log(
    `  Kamino Position      : ${liveReport.kaminoBefore.depositedSol} SOL ($${liveReport.kaminoBefore.collateralValueUsd.toFixed(2)}) collateral | ${liveReport.kaminoBefore.borrowedUsdc.toFixed(2)} USDC debt`
  );
  console.log(
    `  Observed Health      : HF ${liveReport.kaminoBefore.healthFactor.toFixed(4)} (${liveReport.kaminoBefore.healthFactorBps} bps) | Trigger Threshold: ${(liveReport.policy.minTriggerHfBps / 10_000).toFixed(4)}`
  );
  console.log(
    `  Selected TEE Regime  : ${liveReport.riskEvaluation.regime} (${liveReport.riskEvaluation.reasoningSummary})`
  );

  // 3. Run Mode 2: STRESS_TEST_MAINNET_MODE (-25% SOL Crash)
  divider(
    "STEP 3: STRESS_TEST_MAINNET_MODE (-25% SOL FLASH CRASH → 2-LEG CROSS-CHAIN RESCUE)"
  );
  const stressReport = await executeInterceptRescuePipeline({
    mode: "STRESS_TEST_MAINNET_MODE",
    stressShockPct: -25,
  });

  console.log(
    `  Shocked SOL/USD      : $${stressReport.pythTelemetry.effectiveSolUsd.toFixed(4)} (${stressReport.pythTelemetry.stressShockPctApplied}% shock from live $${stressReport.pythTelemetry.rawSpotSolUsd.toFixed(4)})`
  );
  console.log(
    `  Pre-Rescue Kamino HF : ${stressReport.kaminoBefore.healthFactor.toFixed(4)} (${stressReport.kaminoBefore.healthFactorBps} bps) < Threshold ${(stressReport.policy.minTriggerHfBps / 10_000).toFixed(4)}`
  );
  console.log(
    `  TEE Risk Regime      : ${stressReport.riskEvaluation.regime} (Target HF ${(stressReport.riskEvaluation.targetHfBps / 10_000).toFixed(2)})`
  );
  console.log(
    `  Optimal Repayment    : ${stressReport.riskEvaluation.repayAmountUsdcFormatted} USDC (${stressReport.riskEvaluation.repayAmountUsdcMicro.toString()} micro-USDC)`
  );
  console.log(
    `  Post-Rescue Kamino HF: ${stressReport.kaminoAfter.healthFactor.toFixed(4)} (${stressReport.kaminoAfter.healthFactorBps} bps) [RESTORED]`
  );

  if (stressReport.teeReceipt) {
    console.log(
      `  NEAR AI Cloud TEE    : ${stressReport.nearAiCloudAttestation.source} | Model: ${stressReport.nearAiCloudAttestation.model}`
    );
    console.log(
      `  Hardware Attestation : ${stressReport.nearAiCloudAttestation.hardwareAttestation.gpuArchitecture} | Nonce: 0x${stressReport.nearAiCloudAttestation.attestationNonceHex.slice(0, 24)}... (ChainOfTrust=${stressReport.nearAiCloudAttestation.verifiedChainOfTrust})`
    );
    console.log(
      `  Chat Sig Binding     : ${stressReport.nearAiCloudAttestation.signedText.slice(0, 62)}...`
    );
    console.log(
      `  FunctionCall Key Spec: receiver=${stressReport.policy.agentFunctionCallKeySpec.receiverContractId} | allowed=[${stressReport.policy.agentFunctionCallKeySpec.allowedMethodNames.join(", ")}] | forbidden=[${stressReport.policy.agentFunctionCallKeySpec.forbiddenAdminMethods.join(", ")}]`
    );
    console.log(
      `  TEE Receipt Payload  : ${stressReport.teeReceipt.canonicalPayload}`
    );
    console.log(
      `  TEE Ed25519 Sig (64B): 0x${stressReport.teeReceipt.receipt.enclave_signature_hex.slice(0, 48)}... (Verified=${stressReport.teeReceipt.signatureVerified})`
    );
  }
  if (stressReport.leg1BaseVerification) {
    console.log(
      `  Leg 1 EIP-1559 Hash  : ${stressReport.leg1BaseVerification.signingHashKeccak256Hex} (domain_id: ${stressReport.leg1BaseVerification.mpcDomainId}, Guardrail=${stressReport.leg1BaseVerification.guardrailVerified})`
    );
  }
  if (stressReport.leg2SolanaVerification) {
    console.log(
      `  Leg 2 Solana V0 Msg  : ${stressReport.leg2SolanaVerification.rawMessageHex.length / 2} bytes | Discriminator: ${stressReport.leg2SolanaVerification.discriminatorHex} | Refresh Ixs: ${stressReport.leg2SolanaVerification.kaminoRefreshIxCount} (domain_id: ${stressReport.leg2SolanaVerification.mpcDomainId}, Guardrail=${stressReport.leg2SolanaVerification.guardrailVerified})`
    );
    console.log(
      `  Leg 2 Repay Accounts : repay_reserve=${stressReport.leg2SolanaVerification.repayReservePubkey} | user_source_liquidity_ata=${stressReport.leg2SolanaVerification.userSourceLiquidityAtaPubkey}`
    );
  }

  console.log("\n  5-Stage Measured Stopwatch Telemetry:");
  for (const stage of stressReport.stages) {
    console.log(
      `    [${stage.stageIndex}/5] ${stage.label.padEnd(55)} | ${String(stage.measuredLatencyMs).padStart(4)} ms | ${stage.status}`
    );
    console.log(`          ↳ ${stage.detail}`);
    console.log(`          ↳ Explorer: ${stage.explorerUrl}`);
  }
  console.log(
    `  Total Measured End-to-End Pipeline Time: ${stressReport.totalMeasuredLatencyMs} ms`
  );

  // 4. Run Adversarial Security Suite
  divider(
    "STEP 4: ADVERSARIAL RED-TEAM SUITE (ROGUE AI / COMPROMISED KEY SIMULATION)"
  );
  const attacks = runAdversarialAttackSuite();
  let allBlocked = true;
  for (const atk of attacks) {
    const badge = atk.guardrailBlocked ? "BLOCKED (PASS)" : "UNBLOCKED (FAIL)";
    if (!atk.guardrailBlocked) allBlocked = false;
    console.log(
      `  [${badge}] ${atk.attackId} (${atk.targetLeg}) — ${atk.title} [${atk.verificationTimeUs} µs]`
    );
    console.log(`    ↳ Payload : ${atk.injectedPayloadSummary}`);
    console.log(`    ↳ Revert  : ${atk.contractRevertMessage}`);
  }

  if (!allBlocked) {
    console.error("\nCRITICAL FAILURE: An adversarial attack vector was not blocked!");
    process.exit(1);
  }

  divider("ALL DETERMINISTIC & ADVERSARIAL VERIFICATIONS PASSED (0 ERRORS)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
