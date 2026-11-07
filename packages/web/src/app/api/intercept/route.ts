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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const modeParam = url.searchParams.get("mode") as ExecutionMode | null;
  const dropParam =
    url.searchParams.get("stressShockPct") ?? url.searchParams.get("priceDropPct");
  const parsedDrop = dropParam !== null ? Number(dropParam) : undefined;
  const stressShockPct =
    parsedDrop !== undefined && !Number.isNaN(parsedDrop)
      ? -Math.abs(parsedDrop)
      : undefined;

  const [report, preflight] = await Promise.all([
    executeInterceptRescuePipeline({
      mode: modeParam ?? "LIVE_MAINNET_MODE",
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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    mode?: ExecutionMode;
    stressShockPct?: number;
    minTriggerHfBpsOverride?: number;
  };

  const [report, preflight] = await Promise.all([
    executeInterceptRescuePipeline({
      mode: body.mode ?? "STRESS_TEST_MAINNET_MODE",
      stressShockPct:
        body.stressShockPct !== undefined ? -Math.abs(body.stressShockPct) : undefined,
      minTriggerHfBpsOverride: body.minTriggerHfBpsOverride,
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
