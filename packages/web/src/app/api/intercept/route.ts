import { NextResponse } from "next/server";
import {
  executeInterceptRescuePipeline,
  runAdversarialAttackSuite,
  runMainnetPreflightCheck,
  runQuantitativeBacktestSuite,
  type ExecutionMode,
} from "@intercept/agent-tee";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawMode = url.searchParams.get("mode") as ExecutionMode | null;
  const modeParam: ExecutionMode =
    rawMode && VALID_MODES.has(rawMode) ? rawMode : "LIVE_MAINNET_MODE";
  const dropParam =
    url.searchParams.get("stressShockPct") ?? url.searchParams.get("priceDropPct");
  const parsedDrop = dropParam !== null ? Number(dropParam) : undefined;
  const clampedDrop = clampFinite(
    parsedDrop !== undefined ? Math.abs(parsedDrop) : undefined,
    0,
    95
  );
  const stressShockPct =
    clampedDrop !== undefined ? -clampedDrop : undefined;

  const [report, preflight] = await Promise.all([
    executeInterceptRescuePipeline({
      mode: modeParam,
      stressShockPct,
    }),
    runMainnetPreflightCheck(),
  ]);
  const adversarialSuite = runAdversarialAttackSuite();
  const backtest = runQuantitativeBacktestSuite();
  return NextResponse.json(
    serializeBigInt({
      report,
      preflight,
      adversarialSuite,
      backtest,
    })
  );
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
  const body = (await request.json().catch(() => ({}))) as {
    mode?: ExecutionMode;
    stressShockPct?: number;
    minTriggerHfBpsOverride?: number;
    userObligationOverride?: string;
    maxPerActionUsdcOverride?: number;
    maxDailyUsdcOverride?: number;
    maxPerActionUsdcFormattedOverride?: string;
    maxDailyUsdcFormattedOverride?: string;
    maxSlippageBpsOverride?: number;
  };

  const safeMode: ExecutionMode =
    body.mode && VALID_MODES.has(body.mode)
      ? body.mode
      : "STRESS_TEST_MAINNET_MODE";
  const clampedShockAbs = clampFinite(
    typeof body.stressShockPct === "number"
      ? Math.abs(body.stressShockPct)
      : undefined,
    0,
    95
  );
  const safeMinTriggerHfBps = clampFinite(
    body.minTriggerHfBpsOverride,
    10_100,
    25_000
  );
  const safeSlippageBps = clampFinite(body.maxSlippageBpsOverride, 1, 1_000);

  const safeObligation =
    typeof body.userObligationOverride === "string" &&
    BASE58_PUBKEY_RE.test(body.userObligationOverride.trim())
      ? body.userObligationOverride.trim()
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

  const [report, preflight] = await Promise.all([
    executeInterceptRescuePipeline({
      mode: safeMode,
      stressShockPct:
        clampedShockAbs !== undefined ? -clampedShockAbs : undefined,
      minTriggerHfBpsOverride:
        safeMinTriggerHfBps !== undefined
          ? Math.round(safeMinTriggerHfBps)
          : undefined,
      customPosition: safeObligation
        ? { obligationPubkey: safeObligation }
        : undefined,
      customPolicy: {
        ...(safeObligation
          ? { userKaminoObligationPubkey: safeObligation }
          : {}),
        ...(maxPerActionMicro !== undefined
          ? { maxPerActionUsdcMicro: maxPerActionMicro }
          : {}),
        ...(maxDailyMicro !== undefined
          ? {
              maxDailyUsdcMicro:
                maxPerActionMicro !== undefined &&
                maxDailyMicro < maxPerActionMicro
                  ? maxPerActionMicro
                  : maxDailyMicro,
            }
          : {}),
        ...(safeSlippageBps !== undefined
          ? { maxSlippageBps: Math.round(safeSlippageBps) }
          : {}),
      },
    }),
    runMainnetPreflightCheck(),
  ]);

  const adversarialSuite = runAdversarialAttackSuite();
  const backtest = runQuantitativeBacktestSuite();

  return NextResponse.json(
    serializeBigInt({
      report,
      preflight,
      adversarialSuite,
      backtest,
    })
  );
}
