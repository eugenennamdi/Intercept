import { NextResponse } from "next/server";
import {
  executeInterceptRescuePipeline,
  runAdversarialAttackSuite,
  runMainnetPreflightCheck,
  runQuantitativeBacktestSuite,
  type ExecutionMode,
} from "@intercept/agent-tee";

function serializeBigInt<T>(obj: T): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

export async function GET() {
  const [report, preflight] = await Promise.all([
    executeInterceptRescuePipeline({
      mode: "LIVE_MAINNET_MODE",
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
      stressShockPct: body.stressShockPct,
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
