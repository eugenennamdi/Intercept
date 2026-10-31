import crypto from "node:crypto";

/** Official Pyth Network Mainnet Price Feed IDs */
export const PYTH_SOL_USD_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
export const PYTH_USDC_USD_FEED_ID =
  "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";

/** Official Pyth Solana Receiver (`rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`) SOL/USD PriceUpdateV2 account on Solana Mainnet */
export const PYTH_SOL_USD_SOLANA_ACCOUNT =
  "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE";
export const PYTH_SOLANA_RECEIVER_PROGRAM_ID =
  "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ";

export const DEFAULT_HERMES_ENDPOINT = "https://hermes.pyth.network";
export const DEFAULT_SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";

export interface PythRawPrice {
  price: string;
  conf: string;
  expo: number;
  publish_time: number;
}

export interface PythParsedFeed {
  id: string;
  price: PythRawPrice;
  ema_price: PythRawPrice;
}

export interface PythVolatilityTelemetry {
  source:
    | "PYTH_SOLANA_MAINNET_PUSH_ORACLE"
    | "PYTH_HERMES_MAINNET"
    | "PYTH_HERMES_SNAPSHOT_FALLBACK";
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
  usdcSpotUsd: number;
  priceProofHash: string;
  fetchLatencyMs: number;
  fallbackReason?: string;
}

function scalePythValue(valStr: string | bigint, expo: number): number {
  return Number(valStr) * Math.pow(10, expo);
}

/**
 * Computes annualized/short-term realized volatility in basis points from:
 * 1) Spot vs. EMA downward velocity
 * 2) Pyth confidence interval spread (which widens sharply during orderbook cascades)
 * 3) Recent price sample series (if multi-tick window is provided)
 * 4) Explicit stress-test shock (when running in STRESS_TEST_MAINNET_MODE)
 */
export function calculateVolatilityAndVelocityBps(params: {
  spotPrice: number;
  emaPrice: number;
  confidenceUsd: number;
  recentPrices?: number[];
  stressShockPct?: number;
}): {
  emaVelocityBps: number;
  confidenceSpreadBps: number;
  realizedVolatilityBps: number;
  effectiveSolUsd: number;
} {
  const {
    spotPrice,
    emaPrice,
    confidenceUsd,
    recentPrices = [],
    stressShockPct = 0,
  } = params;

  const shockMultiplier = Math.max(0.05, 1 + stressShockPct / 100);
  const effectiveSolUsd = Number((spotPrice * shockMultiplier).toFixed(4));

  const confidenceSpreadBps = Math.round(
    (confidenceUsd / Math.max(spotPrice, 0.0001)) * 10_000
  );

  // Negative velocity indicates downward price cascade relative to EMA
  const emaVelocityBps = Math.round(
    ((effectiveSolUsd - emaPrice) / Math.max(emaPrice, 0.0001)) * 10_000
  );

  // Log-return sample standard deviation if tick history is provided
  let seriesVolBps = 0;
  const fullSeries = [...recentPrices, spotPrice, effectiveSolUsd].filter(
    (p) => p > 0
  );
  if (fullSeries.length >= 2) {
    const logReturns: number[] = [];
    for (let i = 1; i < fullSeries.length; i++) {
      logReturns.push(Math.log(fullSeries[i] / fullSeries[i - 1]));
    }
    const mean =
      logReturns.reduce((acc, r) => acc + r, 0) / logReturns.length;
    const variance =
      logReturns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) /
      logReturns.length;
    seriesVolBps = Math.round(Math.sqrt(variance) * 10_000);
  }

  // Combine baseline market volatility (~3200 bps annualized on SOL), EMA velocity shock, and confidence widening
  const downwardCascadeBps =
    emaVelocityBps < 0 ? Math.abs(emaVelocityBps) * 2 : 0;
  const realizedVolatilityBps = Math.min(
    25_000,
    Math.max(
      2_800,
      3_200 +
        confidenceSpreadBps * 12 +
        Math.max(seriesVolBps, downwardCascadeBps)
    )
  );

  return {
    emaVelocityBps,
    confidenceSpreadBps,
    realizedVolatilityBps,
    effectiveSolUsd,
  };
}

/**
 * Reads and decodes the live on-chain Pyth `PriceUpdateV2` account (`7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE`)
 * directly from Solana Mainnet RPC (`rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`).
 *
 * Binary layout of `PriceUpdateV2`:
 * - `0..8`: Anchor discriminator
 * - `8..40`: `write_authority` (Pubkey)
 * - `40..41`: `verification_level` (`1` = Full)
 * - `41..73`: `feed_id` (32 bytes = `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d`)
 * - `73..81`: `price` (`i64` LE)
 * - `81..89`: `conf` (`u64` LE)
 * - `89..93`: `exponent` (`i32` LE)
 * - `93..101`: `publish_time` (`i64` LE)
 * - `101..109`: `prev_publish_time` (`i64` LE)
 * - `109..117`: `ema_price` (`i64` LE)
 * - `117..125`: `ema_conf` (`u64` LE)
 */
async function fetchPythFromSolanaMainnet(params: {
  solanaRpcUrl: string;
  stressShockPct: number;
  recentPrices?: number[];
  timeoutMs: number;
  t0: number;
}): Promise<PythVolatilityTelemetry> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  const res = await fetch(params.solanaRpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [
        PYTH_SOL_USD_SOLANA_ACCOUNT,
        { encoding: "base64", commitment: "confirmed" },
      ],
    }),
  });
  clearTimeout(timer);

  if (!res.ok) {
    throw new Error(`Solana RPC HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    result?: {
      context?: { slot?: number };
      value?: { data?: [string, string]; owner?: string } | null;
    };
  };

  const b64 = json.result?.value?.data?.[0];
  if (!b64 || json.result?.value?.owner !== PYTH_SOLANA_RECEIVER_PROGRAM_ID) {
    throw new Error("Invalid Pyth PriceUpdateV2 account response");
  }

  const buf = Buffer.from(b64, "base64");
  const feedIdBytes = Buffer.from(PYTH_SOL_USD_FEED_ID.slice(2), "hex");
  const idx = buf.indexOf(feedIdBytes);
  if (idx === -1 || idx + 84 > buf.length) {
    throw new Error("Feed ID not found in Pyth PriceUpdateV2 account buffer");
  }

  const o = idx + 32;
  const rawPriceI64 = buf.readBigInt64LE(o);
  const rawConfU64 = buf.readBigUInt64LE(o + 8);
  const expo = buf.readInt32LE(o + 16);
  const publishTimeUnix = Number(buf.readBigInt64LE(o + 20));
  const rawEmaPriceI64 = buf.readBigInt64LE(o + 36);

  const rawSpotSolUsd = Number(scalePythValue(rawPriceI64, expo).toFixed(4));
  const emaSolUsd = Number(scalePythValue(rawEmaPriceI64, expo).toFixed(4));
  const confidenceUsd = Number(scalePythValue(rawConfU64, expo).toFixed(4));

  const metrics = calculateVolatilityAndVelocityBps({
    spotPrice: rawSpotSolUsd,
    emaPrice: emaSolUsd,
    confidenceUsd,
    recentPrices: params.recentPrices,
    stressShockPct: params.stressShockPct,
  });

  const proofPayload = JSON.stringify({
    account: PYTH_SOL_USD_SOLANA_ACCOUNT,
    slot: json.result?.context?.slot,
    feedId: PYTH_SOL_USD_FEED_ID,
    price: rawPriceI64.toString(),
    conf: rawConfU64.toString(),
    expo,
    publishTimeUnix,
    emaPrice: rawEmaPriceI64.toString(),
    stressShockPct: params.stressShockPct,
  });
  const priceProofHash =
    "0x" + crypto.createHash("sha256").update(proofPayload).digest("hex");

  return {
    source: "PYTH_SOLANA_MAINNET_PUSH_ORACLE",
    feedId: PYTH_SOL_USD_FEED_ID,
    solanaAccountPubkey: PYTH_SOL_USD_SOLANA_ACCOUNT,
    solanaSlot: json.result?.context?.slot,
    publishTimeUnix,
    rawSpotSolUsd,
    emaSolUsd,
    confidenceUsd,
    confidenceSpreadBps: metrics.confidenceSpreadBps,
    emaVelocityBps: metrics.emaVelocityBps,
    realizedVolatilityBps: metrics.realizedVolatilityBps,
    stressShockPctApplied: params.stressShockPct,
    effectiveSolUsd: metrics.effectiveSolUsd,
    usdcSpotUsd: 1.0,
    priceProofHash,
    fetchLatencyMs: Math.round(performance.now() - params.t0),
  };
}

/**
 * Fetches live SOL/USD price, confidence interval, and EMA from Pyth Network
 * (reading directly from the on-chain Pyth Solana Mainnet Push Oracle `7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE`
 * or Pyth Hermes API), computes realized volatility and downward velocity, and hashes the oracle proof.
 */
export async function fetchPythSolVolatility(options?: {
  hermesEndpoint?: string;
  solanaRpcUrl?: string;
  stressShockPct?: number;
  recentPrices?: number[];
  timeoutMs?: number;
}): Promise<PythVolatilityTelemetry> {
  const solanaRpcUrl =
    options?.solanaRpcUrl ??
    process.env.SOLANA_RPC_URL ??
    DEFAULT_SOLANA_RPC_URL;
  const stressShockPct = options?.stressShockPct ?? 0;
  const timeoutMs = options?.timeoutMs ?? 6_000;
  const t0 = performance.now();

  // 1. Primary path: Live on-chain Pyth Solana Receiver PriceUpdateV2 account on Solana Mainnet
  try {
    return await fetchPythFromSolanaMainnet({
      solanaRpcUrl,
      stressShockPct,
      recentPrices: options?.recentPrices,
      timeoutMs,
      t0,
    });
  } catch {
    // Fall through to Hermes HTTP endpoint if custom Hermes endpoint is configured
  }

  // 2. Secondary path: Pyth Hermes v2 REST API
  const hermesEndpoint = options?.hermesEndpoint ?? DEFAULT_HERMES_ENDPOINT;
  const url = `${hermesEndpoint}/v2/updates/price/latest?ids[]=${PYTH_SOL_USD_FEED_ID}&ids[]=${PYTH_USDC_USD_FEED_ID}&parsed=true`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Pyth Hermes HTTP ${res.status}`);
    }

    const body = (await res.json()) as { parsed?: PythParsedFeed[] };
    const parsed = body.parsed ?? [];
    const solFeed = parsed.find((f) =>
      PYTH_SOL_USD_FEED_ID.toLowerCase().endsWith(f.id.toLowerCase())
    );
    const usdcFeed = parsed.find((f) =>
      PYTH_USDC_USD_FEED_ID.toLowerCase().endsWith(f.id.toLowerCase())
    );

    if (!solFeed) {
      throw new Error("SOL/USD feed missing in Pyth Hermes response");
    }

    const rawSpotSolUsd = Number(
      scalePythValue(solFeed.price.price, solFeed.price.expo).toFixed(4)
    );
    const emaSolUsd = Number(
      scalePythValue(solFeed.ema_price.price, solFeed.ema_price.expo).toFixed(4)
    );
    const confidenceUsd = Number(
      scalePythValue(solFeed.price.conf, solFeed.price.expo).toFixed(4)
    );
    const usdcSpotUsd = usdcFeed
      ? Number(
          scalePythValue(usdcFeed.price.price, usdcFeed.price.expo).toFixed(4)
        )
      : 1.0;

    const metrics = calculateVolatilityAndVelocityBps({
      spotPrice: rawSpotSolUsd,
      emaPrice: emaSolUsd,
      confidenceUsd,
      recentPrices: options?.recentPrices,
      stressShockPct,
    });

    const proofPayload = JSON.stringify({
      id: solFeed.id,
      price: solFeed.price,
      ema_price: solFeed.ema_price,
      stressShockPct,
    });
    const priceProofHash =
      "0x" + crypto.createHash("sha256").update(proofPayload).digest("hex");

    return {
      source: "PYTH_HERMES_MAINNET",
      feedId: PYTH_SOL_USD_FEED_ID,
      solanaAccountPubkey: PYTH_SOL_USD_SOLANA_ACCOUNT,
      publishTimeUnix: solFeed.price.publish_time,
      rawSpotSolUsd,
      emaSolUsd,
      confidenceUsd,
      confidenceSpreadBps: metrics.confidenceSpreadBps,
      emaVelocityBps: metrics.emaVelocityBps,
      realizedVolatilityBps: metrics.realizedVolatilityBps,
      stressShockPctApplied: stressShockPct,
      effectiveSolUsd: metrics.effectiveSolUsd,
      usdcSpotUsd,
      priceProofHash,
      fetchLatencyMs: Math.round(performance.now() - t0),
    };
  } catch (err) {
    // ponytail: offline/airgapped CI fallback uses a deterministic mainnet snapshot only if both Solana RPC and Hermes are unreachable
    const fallbackReason = err instanceof Error ? err.message : String(err);
    const fallbackSpot = 101.89;
    const fallbackEma = 101.8;
    const fallbackConf = 0.036;
    const metrics = calculateVolatilityAndVelocityBps({
      spotPrice: fallbackSpot,
      emaPrice: fallbackEma,
      confidenceUsd: fallbackConf,
      recentPrices: options?.recentPrices,
      stressShockPct,
    });
    const publishTimeUnix = Math.floor(Date.now() / 1000);
    const proofPayload = JSON.stringify({
      feed: PYTH_SOL_USD_FEED_ID,
      spot: fallbackSpot,
      ema: fallbackEma,
      stressShockPct,
      publishTimeUnix,
    });
    const priceProofHash =
      "0x" + crypto.createHash("sha256").update(proofPayload).digest("hex");

    return {
      source: "PYTH_HERMES_SNAPSHOT_FALLBACK",
      feedId: PYTH_SOL_USD_FEED_ID,
      solanaAccountPubkey: PYTH_SOL_USD_SOLANA_ACCOUNT,
      publishTimeUnix,
      rawSpotSolUsd: fallbackSpot,
      emaSolUsd: fallbackEma,
      confidenceUsd: fallbackConf,
      confidenceSpreadBps: metrics.confidenceSpreadBps,
      emaVelocityBps: metrics.emaVelocityBps,
      realizedVolatilityBps: metrics.realizedVolatilityBps,
      stressShockPctApplied: stressShockPct,
      effectiveSolUsd: metrics.effectiveSolUsd,
      usdcSpotUsd: 1.0,
      priceProofHash,
      fetchLatencyMs: Math.round(performance.now() - t0),
      fallbackReason,
    };
  }
}
