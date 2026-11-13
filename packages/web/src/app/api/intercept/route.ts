import { NextResponse } from "next/server";
import {
  executeInterceptRescuePipeline,
  runAdversarialAttackSuite,
  runMainnetPreflightCheck,
  runQuantitativeBacktestSuite,
  type AdversarialAttackVectorResult,
  type ExecutionMode,
  type FullBacktestSuiteReport,
  type MainnetPreflightReport,
} from "@intercept/agent-tee";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export type PositionScalePreset = "LIVE_MICRO" | "INSTITUTIONAL";

// ponytail: Cache deterministic backtest/adversarial suites once per warm serverless isolate
// and cache preflight RPC readiness for 25s so slider interactions respond in ~1s instead of ~8s.
const PREFLIGHT_CACHE_TTL_MS = 25_000;
let cachedPreflight: { report: MainnetPreflightReport; expiresAtMs: number } | null = null;
let cachedBacktest: FullBacktestSuiteReport | null = null;
let cachedAdversarialSuite: AdversarialAttackVectorResult[] | null = null;

async function getCachedMainnetPreflight(): Promise<MainnetPreflightReport> {
  const now = Date.now();
  if (cachedPreflight && now < cachedPreflight.expiresAtMs) {
    return cachedPreflight.report;
  }
  const report = await runMainnetPreflightCheck();
  cachedPreflight = { report, expiresAtMs: now + PREFLIGHT_CACHE_TTL_MS };
  return report;
}

function getCachedDeterministicSuites() {
  if (!cachedAdversarialSuite) {
    cachedAdversarialSuite = runAdversarialAttackSuite();
  }
  if (!cachedBacktest) {
    cachedBacktest = runQuantitativeBacktestSuite();
  }
  return {
    adversarialSuite: cachedAdversarialSuite,
    backtest: cachedBacktest,
  };
}

function serializeBigInt<T>(obj: T): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

const VALID_MODES = new Set<ExecutionMode>([
  "LIVE_MAINNET_MODE",
  "STRESS_TEST_MAINNET_MODE",
]);
const BASE58_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DECIMAL_USDC_RE = /^\d{1,9}(\.\d{1,6})?$/;

function clampFinite(
  val: unknown,
  min: number,
  max: number
): number | undefined {
  if (typeof val !== "number" || !Number.isFinite(val)) return undefined;
  return Math.min(max, Math.max(min, val));
}

function resolvePositionOverride(
  scale: unknown,
  safeObligation?: string,
  safeSolanaWallet?: string
) {
  const discoverWalletOnly =
    Boolean(safeSolanaWallet) &&
    (!safeObligation ||
      safeObligation === "C5dZVpvpA39SNLDkojsi98nRePRRy8ELhtxak8m2vMq");

  if (scale === "INSTITUTIONAL") {
    // ponytail: 100 SOL / $5,000 USDC mirrors a ~1.20x–1.33x institutional baseline
    // while keeping -25% cascade rescues (~$1,555–$1,996 USDC) inside the $2,500 per-action policy cap.
    return {
      ...(safeObligation ? { obligationPubkey: safeObligation } : {}),
      ...(safeSolanaWallet ? { ownerSolanaEoa: safeSolanaWallet } : {}),
      depositedSol: 100,
      borrowedUsdc: 5_000,
    };
  }
  if (discoverWalletOnly && safeSolanaWallet) {
    return {
      ownerSolanaEoa: safeSolanaWallet,
      discoverByOwner: true,
    };
  }
  if (safeObligation || safeSolanaWallet) {
    return {
      ...(safeObligation ? { obligationPubkey: safeObligation } : {}),
      ...(safeSolanaWallet ? { ownerSolanaEoa: safeSolanaWallet } : {}),
    };
  }
  return undefined;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawMode = url.searchParams.get("mode") as ExecutionMode | null;
    const dropParam =
      url.searchParams.get("stressShockPct") ??
      url.searchParams.get("priceDropPct");
    const parsedDrop = dropParam !== null ? Number(dropParam) : undefined;
    const clampedDrop = clampFinite(
      parsedDrop !== undefined ? Math.abs(parsedDrop) : undefined,
      0,
      95
    );
    const modeParam: ExecutionMode =
      rawMode && VALID_MODES.has(rawMode)
        ? rawMode
        : clampedDrop && clampedDrop > 0
          ? "STRESS_TEST_MAINNET_MODE"
          : "LIVE_MAINNET_MODE";
    const stressShockPct =
      clampedDrop !== undefined ? -clampedDrop : undefined;
    const positionScale = url.searchParams.get("positionScale");

    const [report, preflight] = await Promise.all([
      executeInterceptRescuePipeline({
        mode: modeParam,
        stressShockPct,
        customPosition: resolvePositionOverride(positionScale),
      }),
      getCachedMainnetPreflight(),
    ]);
    const { adversarialSuite, backtest } = getCachedDeterministicSuites();

    return NextResponse.json(
      serializeBigInt({
        report,
        preflight,
        adversarialSuite,
        backtest,
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function parseUsdcOverrideToMicro(
  numericVal: unknown,
  formattedVal: unknown,
  minUsd: number,
  maxUsd: number
): bigint | undefined {
  let usd = typeof numericVal === "number" ? numericVal : undefined;
  if (usd === undefined && typeof formattedVal === "string") {
    const cleaned = formattedVal.replace(/[$,\s]/g, "");
    if (DECIMAL_USDC_RE.test(cleaned)) {
      usd = Number(cleaned);
    }
  }
  const clamped = clampFinite(usd, minUsd, maxUsd);
  return clamped !== undefined ? BigInt(Math.round(clamped * 1_000_000)) : undefined;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      mode?: ExecutionMode;
      stressShockPct?: number;
      priceDropPct?: number;
      minTriggerHfBpsOverride?: number;
      userObligationOverride?: string;
      userSolanaWalletOverride?: string;
      maxPerActionUsdcOverride?: number;
      maxDailyUsdcOverride?: number;
      maxPerActionUsdcFormattedOverride?: string;
      maxDailyUsdcFormattedOverride?: string;
      maxSlippageBpsOverride?: number;
      positionScale?: PositionScalePreset;
    };

    const safeMode: ExecutionMode =
      body.mode && VALID_MODES.has(body.mode)
        ? body.mode
        : "STRESS_TEST_MAINNET_MODE";
    const rawShock =
      typeof body.stressShockPct === "number"
        ? body.stressShockPct
        : body.priceDropPct;
    const clampedShockAbs = clampFinite(
      typeof rawShock === "number" ? Math.abs(rawShock) : undefined,
      0,
      95
    );
    const safeMinTriggerHfBps = clampFinite(
      body.minTriggerHfBpsOverride,
      10_100,
      25_000
    );
    // Floor slippage at 50 bps so keyless 1-Click quotes (20 bps protocol fee + solver spread) stay inside policy bounds
    const safeSlippageBps = clampFinite(body.maxSlippageBpsOverride, 50, 1_000);

    const safeObligation =
      typeof body.userObligationOverride === "string" &&
      BASE58_PUBKEY_RE.test(body.userObligationOverride.trim())
        ? body.userObligationOverride.trim()
        : undefined;
    const safeSolanaWallet =
      typeof body.userSolanaWalletOverride === "string" &&
      BASE58_PUBKEY_RE.test(body.userSolanaWalletOverride.trim())
        ? body.userSolanaWalletOverride.trim()
        : undefined;

    const maxPerActionMicro = parseUsdcOverrideToMicro(
      body.maxPerActionUsdcOverride,
      body.maxPerActionUsdcFormattedOverride,
      0.5,
      1_000_000
    );
    const maxDailyMicro = parseUsdcOverrideToMicro(
      body.maxDailyUsdcOverride,
      body.maxDailyUsdcFormattedOverride,
      1,
      5_000_000
    );

    const effectiveMaxPerActionMicro = maxPerActionMicro ?? 2_500_000_000n;
    const rawDailyMicro = maxDailyMicro ?? 5_000_000_000n;
    const effectiveMaxDailyMicro =
      rawDailyMicro < effectiveMaxPerActionMicro
        ? effectiveMaxPerActionMicro
        : rawDailyMicro;

    const [report, preflight] = await Promise.all([
      executeInterceptRescuePipeline({
        mode: safeMode,
        stressShockPct:
          clampedShockAbs !== undefined ? -clampedShockAbs : undefined,
        minTriggerHfBpsOverride:
          safeMinTriggerHfBps !== undefined
            ? Math.round(safeMinTriggerHfBps)
            : undefined,
        customPosition: resolvePositionOverride(
          body.positionScale,
          safeObligation,
          safeSolanaWallet
        ),
        customPolicy: {
          ...(safeObligation
            ? { userKaminoObligationPubkey: safeObligation }
            : {}),
          ...(maxPerActionMicro !== undefined || maxDailyMicro !== undefined
            ? {
                maxPerActionUsdcMicro: effectiveMaxPerActionMicro,
                maxDailyUsdcMicro: effectiveMaxDailyMicro,
              }
            : {}),
          ...(safeSlippageBps !== undefined
            ? { maxSlippageBps: Math.round(safeSlippageBps) }
            : {}),
        },
      }),
      getCachedMainnetPreflight(),
    ]);

    const { adversarialSuite, backtest } = getCachedDeterministicSuites();

    return NextResponse.json(
      serializeBigInt({
        report,
        preflight,
        adversarialSuite,
        backtest,
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
