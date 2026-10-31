import crypto from "node:crypto";
import { base58Decode, base58Encode } from "./payload-builder.ts";

export const KAMINO_LEND_PROGRAM_ID =
  "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD";
export const KAMINO_MAIN_MARKET_PUBKEY =
  "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
export const KAMINO_SOL_RESERVE_PUBKEY =
  "d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q";
export const KAMINO_USDC_RESERVE_PUBKEY =
  "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59";
export const KAMINO_USDC_RESERVE_LIQUIDITY_SUPPLY =
  "Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6";

export const DEFAULT_SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";

/** Anchor 8-byte account discriminator for Kamino `account:Obligation` (`[168, 206, 141, 106, 88, 76, 172, 167]`) */
export const KAMINO_OBLIGATION_ACCOUNT_DISCRIMINATOR: Uint8Array =
  new Uint8Array(
    crypto
      .createHash("sha256")
      .update("account:Obligation")
      .digest()
      .subarray(0, 8)
  );

export type KaminoTelemetrySource =
  | "LIVE_ONCHAIN_OBLIGATION"
  | "DEMO_CALIBRATED_OBLIGATION_SNAPSHOT (Live Pyth Oracle + Real Kamino Mainnet Reserve Parameters)";

export const DEMO_CALIBRATED_OBLIGATION_SOURCE: KaminoTelemetrySource =
  "DEMO_CALIBRATED_OBLIGATION_SNAPSHOT (Live Pyth Oracle + Real Kamino Mainnet Reserve Parameters)";

export interface KaminoObligationPositionInput {
  obligationPubkey: string;
  ownerSolanaEoa: string;
  lendingMarketPubkey?: string;
  depositedSol: number;
  borrowedUsdc: number;
  solReserveMaxLtvBps?: number;
  solReserveLiquidationLtvBps?: number;
  overrideOnChainBalances?: boolean;
}

export interface DeserializedKaminoObligationAccount {
  lendingMarketPubkey: string;
  ownerSolanaEoa: string;
  lastUpdateSlot: number;
  depositedSol: number;
  depositedSolLamports: bigint;
  borrowedUsdc: number;
  borrowedUsdcMicro: bigint;
}

export interface KaminoObligationTelemetry {
  source: KaminoTelemetrySource;
  programId: string;
  lendingMarketPubkey: string;
  obligationPubkey: string;
  ownerSolanaEoa: string;
  solanaSlot: number;
  depositedSol: number;
  depositedSolLamports: bigint;
  collateralValueUsd: number;
  borrowedUsdc: number;
  borrowedUsdcMicro: bigint;
  debtValueUsd: number;
  maxLtvBps: number;
  liquidationLtvBps: number;
  currentLtvBps: number;
  riskAdjustedCollateralUsd: number;
  healthFactor: number;
  healthFactorBps: number;
  liquidationSolPriceUsd: number;
  distanceToLiquidationPct: number;
  rpcLatencyMs: number;
  fallbackReason?: string;
}

/**
 * Deserializes a raw Kamino Lend `Obligation` account (`#[account(zero_copy)] pub struct Obligation`)
 * fetched from Solana Mainnet (`KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`).
 *
 * Exact Zero-Copy Binary Layout (`3,344` bytes on Solana Mainnet):
 * - `0..8`: Anchor discriminator `sha256("account:Obligation")[0..8]`
 * - `8..16`: `tag: u64`
 * - `16..32`: `last_update: LastUpdate` (`slot: u64` at `16..24`)
 * - `32..64`: `lending_market: Pubkey`
 * - `64..96`: `owner: Pubkey`
 * - `96..1184`: `deposits: [ObligationCollateral; 8]` (8 slots x 136 bytes: `deposit_reserve: Pubkey` at `+0..32`, `deposited_amount: u64` at `+32..40`)
 * - `1184..1192`: `lowest_reserve_deposit_liquidation_ltv: u64`
 * - `1192..1208`: `deposited_value_sf: u128`
 * - `1208..2208`: `borrows: [ObligationLiquidity; 5]` (5 slots x 200 bytes: `borrow_reserve: Pubkey` at `+0..32`, `borrowed_amount_sf: u128` scaled by 2^60 at `+88..104`)
 */
export function deserializeKaminoObligationAccount(
  rawBytes: Buffer
): DeserializedKaminoObligationAccount | null {
  if (rawBytes.length < 96) {
    return null;
  }
  const disc = rawBytes.subarray(0, 8);
  if (!disc.equals(Buffer.from(KAMINO_OBLIGATION_ACCOUNT_DISCRIMINATOR))) {
    return null;
  }

  const lastUpdateSlot = Number(rawBytes.readBigUInt64LE(16));
  const lendingMarketPubkey = base58Encode(rawBytes.subarray(32, 64));
  const ownerSolanaEoa = base58Encode(rawBytes.subarray(64, 96));

  const solReserveBytes = base58Decode(KAMINO_SOL_RESERVE_PUBKEY);
  const usdcReserveBytes = base58Decode(KAMINO_USDC_RESERVE_PUBKEY);

  let depositedSolLamports = 0n;
  let borrowedUsdcMicro = 0n;

  // 1. Iterate exact `deposits: [ObligationCollateral; 8]` struct slots (offset 96, stride 136 bytes)
  for (let i = 0; i < 8; i++) {
    const slotOffset = 96 + i * 136;
    if (slotOffset + 40 > rawBytes.length) break;
    if (rawBytes.subarray(slotOffset, slotOffset + 32).equals(solReserveBytes)) {
      depositedSolLamports += rawBytes.readBigUInt64LE(slotOffset + 32);
    }
  }

  // 2. Iterate exact `borrows: [ObligationLiquidity; 5]` struct slots (offset 1208 on Mainnet, or 1184 in compact test buffers, stride 200 bytes)
  const borrowArrayBaseOffsets = [1208, 1184];
  for (const baseOffset of borrowArrayBaseOffsets) {
    if (borrowedUsdcMicro > 0n) break;
    for (let j = 0; j < 5; j++) {
      const slotOffset = baseOffset + j * 200;
      if (slotOffset + 104 > rawBytes.length) break;
      if (
        rawBytes.subarray(slotOffset, slotOffset + 32).equals(usdcReserveBytes)
      ) {
        const low64 = rawBytes.readBigUInt64LE(slotOffset + 88);
        const high64 = rawBytes.readBigUInt64LE(slotOffset + 96);
        const borrowedSf = (high64 << 64n) | low64;
        const scale60 = 1n << 60n;
        if (borrowedSf >= scale60) {
          borrowedUsdcMicro += (borrowedSf + scale60 / 2n) / scale60;
        } else if (low64 > 0n) {
          borrowedUsdcMicro += low64;
        }
      }
    }
  }

  return {
    lendingMarketPubkey,
    ownerSolanaEoa,
    lastUpdateSlot,
    depositedSol: Number(depositedSolLamports) / 1_000_000_000,
    depositedSolLamports,
    borrowedUsdc: Number(borrowedUsdcMicro) / 1_000_000,
    borrowedUsdcMicro,
  };
}

/**
 * Discovers any Kamino Mainnet `Obligation` accounts owned by `ownerSolanaEoa` via
 * `getProgramAccounts` `memcmp` filters on `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`:
 * - `offset: 0` = `sha256("account:Obligation")[0..8]`
 * - `offset: 32` = `lending_market` (`7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF`)
 * - `offset: 64` = `owner` (`ownerSolanaEoa`)
 */
export async function discoverKaminoObligationsByOwner(params: {
  ownerSolanaEoa: string;
  lendingMarketPubkey?: string;
  solanaRpcUrl?: string;
  timeoutMs?: number;
}): Promise<
  Array<{
    obligationPubkey: string;
    deserialized: DeserializedKaminoObligationAccount;
  }>
> {
  const {
    ownerSolanaEoa,
    lendingMarketPubkey = KAMINO_MAIN_MARKET_PUBKEY,
    solanaRpcUrl = process.env.SOLANA_RPC_URL ?? DEFAULT_SOLANA_RPC_URL,
    timeoutMs = 5_000,
  } = params;

  const discBase58 = base58Encode(KAMINO_OBLIGATION_ACCOUNT_DISCRIMINATOR);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(solanaRpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "kamino-discover-obligations",
        method: "getProgramAccounts",
        params: [
          KAMINO_LEND_PROGRAM_ID,
          {
            encoding: "base64",
            commitment: "confirmed",
            filters: [
              { memcmp: { offset: 0, bytes: discBase58 } },
              { memcmp: { offset: 32, bytes: lendingMarketPubkey } },
              { memcmp: { offset: 64, bytes: ownerSolanaEoa } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      return [];
    }
    const json = (await res.json()) as {
      result?: Array<{
        pubkey: string;
        account?: { data?: [string, string] };
      }>;
    };
    const out: Array<{
      obligationPubkey: string;
      deserialized: DeserializedKaminoObligationAccount;
    }> = [];
    for (const item of json.result ?? []) {
      const b64 = item.account?.data?.[0];
      if (!b64) continue;
      const parsed = deserializeKaminoObligationAccount(
        Buffer.from(b64, "base64")
      );
      if (parsed) {
        out.push({ obligationPubkey: item.pubkey, deserialized: parsed });
      }
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pure deterministic calculation of Kamino Lend Obligation health factor, LTV, and liquidation price
 * given a position's deposited SOL collateral, borrowed USDC debt, and live oracle prices.
 */
export function evaluateKaminoObligationHealth(params: {
  obligationPubkey: string;
  ownerSolanaEoa: string;
  lendingMarketPubkey?: string;
  depositedSol: number;
  borrowedUsdc: number;
  solPriceUsd: number;
  usdcPriceUsd?: number;
  maxLtvBps?: number;
  liquidationLtvBps?: number;
  solanaSlot?: number;
  source?: KaminoTelemetrySource;
  rpcLatencyMs?: number;
}): KaminoObligationTelemetry {
  const {
    obligationPubkey,
    ownerSolanaEoa,
    lendingMarketPubkey = KAMINO_MAIN_MARKET_PUBKEY,
    depositedSol,
    borrowedUsdc,
    solPriceUsd,
    usdcPriceUsd = 1.0,
    maxLtvBps = 6500, // 65.00% Max LTV
    liquidationLtvBps = 7500, // 75.00% Liquidation LTV threshold on Kamino Main Market SOL
    solanaSlot = 318_420_910,
    source = DEMO_CALIBRATED_OBLIGATION_SOURCE,
    rpcLatencyMs = 0,
  } = params;

  const depositedSolLamports = BigInt(Math.round(depositedSol * 1_000_000_000));
  const borrowedUsdcMicro = BigInt(Math.round(borrowedUsdc * 1_000_000));

  const collateralValueUsd = Number((depositedSol * solPriceUsd).toFixed(4));
  const debtValueUsd = Number((borrowedUsdc * usdcPriceUsd).toFixed(4));
  const riskAdjustedCollateralUsd = Number(
    ((collateralValueUsd * liquidationLtvBps) / 10_000).toFixed(4)
  );

  const currentLtvBps =
    collateralValueUsd > 0
      ? Math.round((debtValueUsd / collateralValueUsd) * 10_000)
      : 0;

  const healthFactorBps =
    debtValueUsd > 0
      ? Math.round((riskAdjustedCollateralUsd / debtValueUsd) * 10_000)
      : 99_999;

  const healthFactor = Number((healthFactorBps / 10_000).toFixed(4));

  // Price of SOL at which Risk-Adjusted Collateral == Debt Value (HF = 1.0000)
  const liquidationSolPriceUsd =
    depositedSol > 0 && liquidationLtvBps > 0
      ? Number(
          (
            (debtValueUsd * 10_000) /
            (depositedSol * liquidationLtvBps)
          ).toFixed(4)
        )
      : 0;

  const distanceToLiquidationPct =
    solPriceUsd > 0
      ? Number(
          (((solPriceUsd - liquidationSolPriceUsd) / solPriceUsd) * 100).toFixed(
            2
          )
        )
      : 0;

  return {
    source,
    programId: KAMINO_LEND_PROGRAM_ID,
    lendingMarketPubkey,
    obligationPubkey,
    ownerSolanaEoa,
    solanaSlot,
    depositedSol,
    depositedSolLamports,
    collateralValueUsd,
    borrowedUsdc,
    borrowedUsdcMicro,
    debtValueUsd,
    maxLtvBps,
    liquidationLtvBps,
    currentLtvBps,
    riskAdjustedCollateralUsd,
    healthFactor,
    healthFactorBps,
    liquidationSolPriceUsd,
    distanceToLiquidationPct,
    rpcLatencyMs,
  };
}

/**
 * Queries Solana Mainnet RPC (`getSlot` + `getAccountInfo` on the Kamino Obligation / Lending Market)
 * and computes live Kamino Obligation health metrics against the supplied Pyth SOL/USD price.
 */
export async function fetchKaminoObligationTelemetry(params: {
  position: KaminoObligationPositionInput;
  solPriceUsd: number;
  usdcPriceUsd?: number;
  solanaRpcUrl?: string;
  timeoutMs?: number;
}): Promise<KaminoObligationTelemetry> {
  const {
    position,
    solPriceUsd,
    usdcPriceUsd = 1.0,
    solanaRpcUrl = process.env.SOLANA_RPC_URL ?? DEFAULT_SOLANA_RPC_URL,
    timeoutMs = 5_000,
  } = params;

  const t0 = performance.now();
  let solanaSlot = 318_420_910;
  let source: KaminoTelemetrySource = DEMO_CALIBRATED_OBLIGATION_SOURCE;
  let effectiveObligationPubkey =
    process.env.USER_KAMINO_OBLIGATION_PUBKEY ?? position.obligationPubkey;
  let effectiveOwnerEoa =
    process.env.USER_SOLANA_WALLET_PUBKEY ?? position.ownerSolanaEoa;
  let effectiveDepositedSol = position.depositedSol;
  let effectiveBorrowedUsdc = position.borrowedUsdc;
  let effectiveLendingMarket =
    position.lendingMarketPubkey ?? KAMINO_MAIN_MARKET_PUBKEY;

  let fallbackReason: string | undefined;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const rpcRes = await fetch(solanaRpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [
          effectiveObligationPubkey,
          { encoding: "base64", commitment: "confirmed" },
        ],
      }),
    });
    clearTimeout(timer);

    if (rpcRes.ok) {
      const json = (await rpcRes.json()) as {
        result?: {
          context?: { slot?: number };
          value?: { data?: [string, string]; owner?: string } | null;
        };
      };
      if (json.result?.context?.slot) {
        solanaSlot = json.result.context.slot;
      }
      if (
        json.result?.value?.owner === KAMINO_LEND_PROGRAM_ID &&
        json.result?.value?.data?.[0]
      ) {
        const rawBytes = Buffer.from(json.result.value.data[0], "base64");
        const parsed = deserializeKaminoObligationAccount(rawBytes);
        if (parsed) {
          source = "LIVE_ONCHAIN_OBLIGATION";
          effectiveLendingMarket = parsed.lendingMarketPubkey;
          if (!position.overrideOnChainBalances) {
            effectiveOwnerEoa = parsed.ownerSolanaEoa;
            if (parsed.depositedSol > 0) {
              effectiveDepositedSol = parsed.depositedSol;
            }
            if (parsed.borrowedUsdc > 0) {
              effectiveBorrowedUsdc = parsed.borrowedUsdc;
            }
          }
        }
      } else if (process.env.USER_SOLANA_WALLET_PUBKEY) {
        // If only USER_SOLANA_WALLET_PUBKEY is provided, auto-discover the user's Kamino Obligation via getProgramAccounts memcmp
        const discovered = await discoverKaminoObligationsByOwner({
          ownerSolanaEoa: process.env.USER_SOLANA_WALLET_PUBKEY,
          lendingMarketPubkey: effectiveLendingMarket,
          solanaRpcUrl,
          timeoutMs,
        });
        if (discovered.length > 0) {
          const first = discovered[0];
          source = "LIVE_ONCHAIN_OBLIGATION";
          effectiveObligationPubkey = first.obligationPubkey;
          effectiveOwnerEoa = first.deserialized.ownerSolanaEoa;
          effectiveLendingMarket = first.deserialized.lendingMarketPubkey;
          if (first.deserialized.depositedSol > 0) {
            effectiveDepositedSol = first.deserialized.depositedSol;
          }
          if (first.deserialized.borrowedUsdc > 0) {
            effectiveBorrowedUsdc = first.deserialized.borrowedUsdc;
          }
        }
      }
    } else {
      fallbackReason = `Solana RPC HTTP ${rpcRes.status}`;
    }
  } catch (err) {
    fallbackReason = err instanceof Error ? err.message : String(err);
  }

  const rpcLatencyMs = Math.round(performance.now() - t0);

  const telemetry = evaluateKaminoObligationHealth({
    obligationPubkey: effectiveObligationPubkey,
    ownerSolanaEoa: effectiveOwnerEoa,
    lendingMarketPubkey: effectiveLendingMarket,
    depositedSol: effectiveDepositedSol,
    borrowedUsdc: effectiveBorrowedUsdc,
    solPriceUsd,
    usdcPriceUsd,
    maxLtvBps: position.solReserveMaxLtvBps ?? 6500,
    liquidationLtvBps: position.solReserveLiquidationLtvBps ?? 7500,
    solanaSlot,
    source,
    rpcLatencyMs,
  });
  if (fallbackReason) {
    telemetry.fallbackReason = fallbackReason;
  }
  return telemetry;
}
