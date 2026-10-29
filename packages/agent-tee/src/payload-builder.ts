import crypto from "node:crypto";

export const BASE_MAINNET_CHAIN_ID = 8453;
export const BASE_USDC_ADDRESS_HEX =
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
export const ERC20_TRANSFER_SELECTOR_HEX = "a9059cbb";
export const ERC20_APPROVE_SELECTOR_HEX = "095ea7b3";

export const COMPUTE_BUDGET_PROGRAM_ID =
  "ComputeBudget111111111111111111111111111111";
export const KAMINO_LEND_PROGRAM_ID =
  "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD";
export const KAMINO_MAIN_MARKET_PUBKEY =
  "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
export const KAMINO_MAINNET_SOL_RESERVE_PUBKEY =
  "d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q";
export const KAMINO_MAINNET_USDC_RESERVE_PUBKEY =
  "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59";
export const SPL_TOKEN_PROGRAM_ID =
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const ASSOCIATED_TOKEN_PROGRAM_ID =
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export const SOLANA_MAINNET_USDC_MINT_PUBKEY =
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const SYSVAR_INSTRUCTIONS_PUBKEY =
  "Sysvar1nstructions1111111111111111111111111";

// --- Canonical Ethereum / Base Keccak-256 (0x01 padding, Keccak-f[1600]) ---

const KECCAK_ROUNDS = 24;
const KECCAK_RC: bigint[] = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
const KECCAK_ROTC: number[] = [
  1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44,
];
const KECCAK_PILN: number[] = [
  10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1,
];
const MASK_64 = 0xffffffffffffffffn;

function rotl64(x: bigint, n: number): bigint {
  if (n === 0) return x & MASK_64;
  return ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK_64;
}

function keccakF1600(state: bigint[]): void {
  const bc = new Array<bigint>(5);
  for (let round = 0; round < KECCAK_ROUNDS; round++) {
    for (let i = 0; i < 5; i++) {
      bc[i] =
        state[i] ^
        state[i + 5] ^
        state[i + 10] ^
        state[i + 15] ^
        state[i + 20];
    }
    for (let i = 0; i < 5; i++) {
      const t = bc[(i + 4) % 5] ^ rotl64(bc[(i + 1) % 5], 1);
      for (let j = 0; j < 25; j += 5) {
        state[j + i] = (state[j + i] ^ t) & MASK_64;
      }
    }
    let t = state[1];
    for (let i = 0; i < 24; i++) {
      const j = KECCAK_PILN[i];
      const tmp = state[j];
      state[j] = rotl64(t, KECCAK_ROTC[i]);
      t = tmp;
    }
    for (let j = 0; j < 25; j += 5) {
      for (let i = 0; i < 5; i++) {
        bc[i] = state[j + i];
      }
      for (let i = 0; i < 5; i++) {
        state[j + i] =
          (bc[i] ^ (~bc[(i + 1) % 5] & bc[(i + 2) % 5])) & MASK_64;
      }
    }
    state[0] = (state[0] ^ KECCAK_RC[round]) & MASK_64;
  }
}

/**
 * Computes canonical Ethereum / EVM Keccak-256 (0x01 padding byte, rate = 136 bytes),
 * matching `tiny_keccak::Keccak::v256()` in `evm_parser.rs` byte-for-byte.
 */
export function keccak256(input: Uint8Array): Buffer {
  const rate = 136;
  const state = new Array<bigint>(25).fill(0n);
  const paddedLen = Math.ceil((input.length + 1) / rate) * rate;
  const buf = Buffer.alloc(paddedLen, 0);
  Buffer.from(input).copy(buf, 0);
  buf[input.length] = 0x01;
  buf[paddedLen - 1] |= 0x80;

  for (let offset = 0; offset < paddedLen; offset += rate) {
    for (let i = 0; i < rate / 8; i++) {
      state[i] = (state[i] ^ buf.readBigUInt64LE(offset + i * 8)) & MASK_64;
    }
    keccakF1600(state);
  }

  const out = Buffer.alloc(32);
  for (let i = 0; i < 4; i++) {
    out.writeBigUInt64LE(state[i], i * 8);
  }
  return out;
}

export function keccak256Hex(input: Uint8Array): string {
  return "0x" + keccak256(input).toString("hex");
}

/**
 * Computes 8-byte Anchor instruction discriminator: `sha256("global:<name>")[0..8]`
 */
export function computeAnchorDiscriminator(globalIxName: string): Buffer {
  return crypto
    .createHash("sha256")
    .update(globalIxName, "utf8")
    .digest()
    .subarray(0, 8);
}

/** `[116, 174, 213, 76, 180, 53, 210, 144]` (`0x74aed54cb435d290`) */
export const REPAY_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR =
  computeAnchorDiscriminator("global:repay_obligation_liquidity_v2");

/** `[145, 178, 13, 225, 76, 240, 147, 72]` (`0x91b20de14cf09348`) */
export const REPAY_OBLIGATION_LIQUIDITY_V1_DISCRIMINATOR =
  computeAnchorDiscriminator("global:repay_obligation_liquidity");

/** `[2, 218, 138, 235, 79, 201, 25, 102]` (`0x02da8aeb4fc91966`) */
export const REFRESH_RESERVE_DISCRIMINATOR =
  computeAnchorDiscriminator("global:refresh_reserve");

/** `[144, 110, 26, 103, 162, 204, 252, 147]` (`0x906e1a67a2ccfc93`) */
export const REFRESH_RESERVES_BATCH_DISCRIMINATOR =
  computeAnchorDiscriminator("global:refresh_reserves_batch");

/** `[33, 132, 147, 228, 151, 192, 72, 89]` (`0x218493e497c04859`) */
export const REFRESH_OBLIGATION_DISCRIMINATOR =
  computeAnchorDiscriminator("global:refresh_obligation");

/** `[140, 144, 253, 21, 10, 74, 248, 3]` (`0x8c90fd150a4af803`) */
export const REFRESH_OBLIGATION_FARMS_FOR_RESERVE_DISCRIMINATOR =
  computeAnchorDiscriminator("global:refresh_obligation_farms_for_reserve");

/** `[202, 249, 117, 114, 231, 192, 47, 138]` (Explicitly forbidden by guardrail) */
export const WITHDRAW_OBLIGATION_COLLATERAL_V2_DISCRIMINATOR =
  computeAnchorDiscriminator("global:withdraw_obligation_collateral_v2");

/** `[161, 128, 143, 245, 171, 199, 194, 6]` (Explicitly forbidden by guardrail) */
export const BORROW_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR =
  computeAnchorDiscriminator("global:borrow_obligation_liquidity_v2");

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Decode(str: string): Buffer {
  let num = 0n;
  for (let i = 0; i < str.length; i++) {
    const idx = BASE58_ALPHABET.indexOf(str[i]);
    if (idx === -1) {
      throw new Error(`Invalid Base58 character '${str[i]}'`);
    }
    num = num * 58n + BigInt(idx);
  }
  const hex = num === 0n ? "" : num.toString(16);
  const paddedHex = hex.length % 2 === 1 ? "0" + hex : hex;
  const rawBytes = paddedHex ? Buffer.from(paddedHex, "hex") : Buffer.alloc(0);

  let leadingZeros = 0;
  for (let i = 0; i < str.length && str[i] === "1"; i++) {
    leadingZeros++;
  }
  return Buffer.concat([Buffer.alloc(leadingZeros, 0), rawBytes]);
}

export function base58Encode(bytes: Uint8Array): string {
  let num = 0n;
  for (const b of bytes) {
    num = (num << 8n) + BigInt(b);
  }
  let encoded = "";
  while (num > 0n) {
    const rem = Number(num % 58n);
    num = num / 58n;
    encoded = BASE58_ALPHABET[rem] + encoded;
  }
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    encoded = "1" + encoded;
  }
  return encoded || "1";
}

// --- Canonical Solana PDA & Associated Token Account (ATA) Derivation ---

const ED25519_P = (1n << 255n) - 19n;
const ED25519_D =
  37095705934669439343138083508754565189542113879843219016388785533085940283555n;

function modPos(a: bigint, m: bigint): bigint {
  const r = a % m;
  return r < 0n ? r + m : r;
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = modPos(base, mod);
  let e = exp;
  while (e > 0n) {
    if ((e & 1n) === 1n) {
      result = (result * b) % mod;
    }
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

/**
 * Checks whether a 32-byte compressed Edwards25519 y-coordinate lies on the Ed25519 curve
 * (`-x^2 + y^2 = 1 + d*x^2*y^2 mod 2^255-19`), matching `curve25519-dalek` / `@solana/web3.js`
 * `PublicKey.isOnCurve`. A valid Solana Program-Derived Address (PDA) MUST return `false`.
 */
export function isOnEd25519Curve(bytes32: Uint8Array): boolean {
  if (bytes32.length !== 32) {
    return false;
  }
  let y = 0n;
  for (let i = 0; i < 32; i++) {
    const byteVal = i === 31 ? bytes32[31] & 0x7f : bytes32[i];
    y |= BigInt(byteVal) << BigInt(8 * i);
  }
  y = modPos(y, ED25519_P);
  const y2 = (y * y) % ED25519_P;
  const u = modPos(y2 - 1n, ED25519_P);
  const v = modPos(ED25519_D * y2 + 1n, ED25519_P);
  if (v === 0n) {
    return false;
  }
  if (u === 0n) {
    return true;
  }
  const vInv = modPow(v, ED25519_P - 2n, ED25519_P);
  const x2 = (u * vInv) % ED25519_P;
  const euler = modPow(x2, (ED25519_P - 1n) / 2n, ED25519_P);
  return euler === 1n;
}

/**
 * Deterministic Solana `PublicKey.findProgramAddressSync(seeds, programId)` implementation.
 * Iterates `bump` from `255` down to `0` and returns the first off-curve SHA-256 PDA.
 */
export function findSolanaProgramAddress(
  seeds: Buffer[],
  programIdBase58: string
): { pubkeyBytes: Buffer; pubkeyBase58: string; bump: number } {
  const programIdBytes = base58Decode(programIdBase58);
  if (programIdBytes.length !== 32) {
    throw new Error(
      `Invalid Solana programId ${programIdBase58}: decoded ${programIdBytes.length} bytes`
    );
  }
  const pdaMarker = Buffer.from("ProgramDerivedAddress", "utf8");
  for (let bump = 255; bump >= 0; bump--) {
    const hasher = crypto.createHash("sha256");
    for (const seed of seeds) {
      hasher.update(seed);
    }
    hasher.update(Buffer.from([bump]));
    hasher.update(programIdBytes);
    hasher.update(pdaMarker);
    const digest = hasher.digest();
    if (!isOnEd25519Curve(digest)) {
      return {
        pubkeyBytes: digest,
        pubkeyBase58: base58Encode(digest),
        bump,
      };
    }
  }
  throw new Error("Unable to find a valid off-curve Solana PDA bump seed");
}

/**
 * Deterministically derives the canonical Solana Associated Token Account (ATA) PDA
 * using seeds `[walletPubkey, SPL_TOKEN_PROGRAM_ID, mintPubkey]` against
 * `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`.
 */
export function deriveSolanaAssociatedTokenAddress(
  walletPubkeyBase58: string,
  mintPubkeyBase58: string = SOLANA_MAINNET_USDC_MINT_PUBKEY,
  tokenProgramIdBase58: string = SPL_TOKEN_PROGRAM_ID,
  associatedTokenProgramIdBase58: string = ASSOCIATED_TOKEN_PROGRAM_ID
): { ataPubkeyBase58: string; ataPubkeyBytes: Buffer; bump: number } {
  const walletBytes = base58Decode(walletPubkeyBase58);
  const tokenProgramBytes = base58Decode(tokenProgramIdBase58);
  const mintBytes = base58Decode(mintPubkeyBase58);
  const res = findSolanaProgramAddress(
    [walletBytes, tokenProgramBytes, mintBytes],
    associatedTokenProgramIdBase58
  );
  return {
    ataPubkeyBase58: res.pubkeyBase58,
    ataPubkeyBytes: res.pubkeyBytes,
    bump: res.bump,
  };
}

// --- RLP Encoding / Decoding for EIP-1559 ---

export function rlpEncodeBytes(bytes: Uint8Array): Buffer {
  if (bytes.length === 1 && bytes[0] < 0x80) {
    return Buffer.from([bytes[0]]);
  }
  if (bytes.length <= 55) {
    return Buffer.concat([Buffer.from([0x80 + bytes.length]), bytes]);
  }
  const lenHex = bytes.length.toString(16);
  const lenBytes = Buffer.from(
    lenHex.length % 2 === 1 ? "0" + lenHex : lenHex,
    "hex"
  );
  return Buffer.concat([
    Buffer.from([0xb7 + lenBytes.length]),
    lenBytes,
    bytes,
  ]);
}

export function rlpEncodeBigInt(val: bigint): Buffer {
  if (val === 0n) {
    return Buffer.from([0x80]);
  }
  const hex = val.toString(16);
  const bytes = Buffer.from(hex.length % 2 === 1 ? "0" + hex : hex, "hex");
  return rlpEncodeBytes(bytes);
}

export function rlpEncodeList(items: Buffer[]): Buffer {
  const payload = Buffer.concat(items);
  if (payload.length <= 55) {
    return Buffer.concat([Buffer.from([0xc0 + payload.length]), payload]);
  }
  const lenHex = payload.length.toString(16);
  const lenBytes = Buffer.from(
    lenHex.length % 2 === 1 ? "0" + lenHex : lenHex,
    "hex"
  );
  return Buffer.concat([
    Buffer.from([0xf7 + lenBytes.length]),
    lenBytes,
    payload,
  ]);
}

export function buildErc20TransferCalldata(
  recipientAddressHex: string,
  amountMicroUsdc: bigint,
  selectorHex: string = ERC20_TRANSFER_SELECTOR_HEX
): Buffer {
  const selector = Buffer.from(selectorHex.replace(/^0x/i, ""), "hex");
  const recipient = Buffer.from(recipientAddressHex.replace(/^0x/i, ""), "hex");
  if (recipient.length !== 20) {
    throw new Error("Recipient EVM address must be 20 bytes");
  }
  const addrWord = Buffer.alloc(32, 0);
  recipient.copy(addrWord, 12);

  const amtWord = Buffer.alloc(32, 0);
  const amtHex = amountMicroUsdc.toString(16).padStart(32, "0");
  Buffer.from(amtHex, "hex").copy(amtWord, 16);

  return Buffer.concat([selector, addrWord, amtWord]);
}

/**
 * Builds a canonical unsigned EIP-1559 transaction payload (`0x02 || rlp(...)`)
 * identical to `contracts/policy-guardrail/src/evm_parser.rs`.
 */
export function buildUnsignedEip1559TxBytes(params: {
  chainId?: number;
  nonce: number;
  maxPriorityFeePerGasWei?: bigint;
  maxFeePerGasWei?: bigint;
  gasLimit?: number;
  toAddressHex?: string;
  ethValueWei?: bigint;
  calldata: Buffer;
}): {
  rawUnsignedTxHex: string;
  rawUnsignedTxBytes: Buffer;
  signingHashHex: string;
} {
  const {
    chainId = BASE_MAINNET_CHAIN_ID,
    nonce,
    maxPriorityFeePerGasWei = 1_500_000n,
    maxFeePerGasWei = 30_000_000n,
    gasLimit = 65_000,
    toAddressHex = BASE_USDC_ADDRESS_HEX,
    ethValueWei = 0n,
    calldata,
  } = params;

  const toBytes = Buffer.from(toAddressHex.replace(/^0x/i, ""), "hex");
  const rlpList = rlpEncodeList([
    rlpEncodeBigInt(BigInt(chainId)),
    rlpEncodeBigInt(BigInt(nonce)),
    rlpEncodeBigInt(maxPriorityFeePerGasWei),
    rlpEncodeBigInt(maxFeePerGasWei),
    rlpEncodeBigInt(BigInt(gasLimit)),
    rlpEncodeBytes(toBytes),
    rlpEncodeBigInt(ethValueWei),
    rlpEncodeBytes(calldata),
    Buffer.from([0xc0]), // empty accessList
  ]);

  const rawUnsignedTxBytes = Buffer.concat([Buffer.from([0x02]), rlpList]);
  const signingHashHex = keccak256Hex(rawUnsignedTxBytes);

  return {
    rawUnsignedTxHex: "0x" + rawUnsignedTxBytes.toString("hex"),
    rawUnsignedTxBytes,
    signingHashHex,
  };
}

/**
 * Reconstructs a signed 12-item EIP-1559 transaction (`0x02 || rlp([..., v, r, s])`)
 * from the unsigned EIP-1559 payload and the NEAR `v1.signer` (`domain_id: 0`) Secp256k1 signature.
 */
export function assembleSignedEip1559Transaction(params: {
  rawUnsignedTxHex: string;
  bigRAffineHex: string;
  sScalarHex: string;
  recoveryId: number;
}): {
  signedTxHex: string;
  signedTxBytes: Buffer;
  txHashHex: string;
  rHex: string;
  sHex: string;
  yParity: number;
} {
  const raw = Buffer.from(
    params.rawUnsignedTxHex.replace(/^0x/i, ""),
    "hex"
  );
  if (raw.length === 0 || raw[0] !== 0x02) {
    throw new Error("Unsigned EIP-1559 transaction must start with 0x02");
  }
  const { item, nextOffset } = decodeRlpItem(raw, 1);
  if (nextOffset !== raw.length || !Array.isArray(item) || item.length !== 9) {
    throw new Error("Unsigned EIP-1559 RLP payload must be a 9-element list");
  }

  // Extract 32-byte x-coordinate r from compressed (33-byte 02/03 || x) or uncompressed (65-byte 04 || x || y) affine_point
  const cleanBigR = params.bigRAffineHex.replace(/^0x/i, "");
  const rHex =
    cleanBigR.length === 66
      ? cleanBigR.slice(2, 66)
      : cleanBigR.length === 130
        ? cleanBigR.slice(2, 66)
        : cleanBigR.padStart(64, "0").slice(-64);
  const sHex = params.sScalarHex
    .replace(/^0x/i, "")
    .padStart(64, "0")
    .slice(-64);
  const yParity = params.recoveryId & 1;

  const rBigInt = BigInt("0x" + rHex);
  const sBigInt = BigInt("0x" + sHex);

  const reencodedUnsignedItems: Buffer[] = [
    rlpEncodeBigInt(rlpBufferToBigInt(item[0])),
    rlpEncodeBigInt(rlpBufferToBigInt(item[1])),
    rlpEncodeBigInt(rlpBufferToBigInt(item[2])),
    rlpEncodeBigInt(rlpBufferToBigInt(item[3])),
    rlpEncodeBigInt(rlpBufferToBigInt(item[4])),
    rlpEncodeBytes(item[5] as Buffer),
    rlpEncodeBigInt(rlpBufferToBigInt(item[6])),
    rlpEncodeBytes(item[7] as Buffer),
    Buffer.from([0xc0]), // empty accessList
    rlpEncodeBigInt(BigInt(yParity)),
    rlpEncodeBigInt(rBigInt),
    rlpEncodeBigInt(sBigInt),
  ];

  const rlpSigned = rlpEncodeList(reencodedUnsignedItems);
  const signedTxBytes = Buffer.concat([Buffer.from([0x02]), rlpSigned]);
  const signedTxHex = "0x" + signedTxBytes.toString("hex");
  const txHashHex = keccak256Hex(signedTxBytes);

  return {
    signedTxHex,
    signedTxBytes,
    txHashHex,
    rHex: "0x" + rHex,
    sHex: "0x" + sHex,
    yParity,
  };
}

type RlpDecodedItem = Buffer | RlpDecodedItem[];

function decodeRlpItem(
  input: Buffer,
  offset: number = 0
): { item: RlpDecodedItem; nextOffset: number } {
  if (offset >= input.length) {
    throw new Error("Malformed RLP: unexpected EOF");
  }
  const prefix = input[offset];
  if (prefix <= 0x7f) {
    return {
      item: input.subarray(offset, offset + 1),
      nextOffset: offset + 1,
    };
  }
  if (prefix <= 0xb7) {
    const len = prefix - 0x80;
    const end = offset + 1 + len;
    if (end > input.length) throw new Error("Malformed RLP: short string EOF");
    const slice = input.subarray(offset + 1, end);
    if (len === 1 && slice[0] < 0x80) {
      throw new Error("Malformed RLP: non-canonical single byte prefix");
    }
    return { item: slice, nextOffset: end };
  }
  if (prefix <= 0xbf) {
    const lenOfLen = prefix - 0xb7;
    if (offset + 1 + lenOfLen > input.length) {
      throw new Error("Malformed RLP: long string length EOF");
    }
    const lenBytes = input.subarray(offset + 1, offset + 1 + lenOfLen);
    if (lenBytes[0] === 0) {
      throw new Error("Malformed RLP: leading zero in length");
    }
    const len = Number(BigInt("0x" + lenBytes.toString("hex")));
    const end = offset + 1 + lenOfLen + len;
    if (end > input.length) throw new Error("Malformed RLP: long string EOF");
    return {
      item: input.subarray(offset + 1 + lenOfLen, end),
      nextOffset: end,
    };
  }
  if (prefix <= 0xf7) {
    const totalLen = prefix - 0xc0;
    const end = offset + 1 + totalLen;
    if (end > input.length) throw new Error("Malformed RLP: short list EOF");
    const items: RlpDecodedItem[] = [];
    let cur = offset + 1;
    while (cur < end) {
      const { item, nextOffset } = decodeRlpItem(input, cur);
      items.push(item);
      cur = nextOffset;
    }
    return { item: items, nextOffset: end };
  }
  const lenOfLen = prefix - 0xf7;
  if (offset + 1 + lenOfLen > input.length) {
    throw new Error("Malformed RLP: long list length EOF");
  }
  const lenBytes = input.subarray(offset + 1, offset + 1 + lenOfLen);
  if (lenBytes[0] === 0) {
    throw new Error("Malformed RLP: leading zero in list length");
  }
  const totalLen = Number(BigInt("0x" + lenBytes.toString("hex")));
  const end = offset + 1 + lenOfLen + totalLen;
  if (end > input.length) throw new Error("Malformed RLP: long list EOF");
  const items: RlpDecodedItem[] = [];
  let cur = offset + 1 + lenOfLen;
  while (cur < end) {
    const { item, nextOffset } = decodeRlpItem(input, cur);
    items.push(item);
    cur = nextOffset;
  }
  return { item: items, nextOffset: end };
}

function rlpBufferToBigInt(item: RlpDecodedItem): bigint {
  if (!Buffer.isBuffer(item)) {
    throw new Error("Expected RLP bytes, got list");
  }
  if (item.length === 0) return 0n;
  if (item[0] === 0) {
    throw new Error("Non-canonical RLP integer with leading zero");
  }
  return BigInt("0x" + item.toString("hex"));
}

export interface EvmGuardrailVerificationResult {
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
  decoded?: {
    chainId: number;
    nonce: number;
    toAddressHex: string;
    ethValueWei: bigint;
    selectorHex: string;
    recipientDepositAddressHex: string;
    transferAmountUsdcMicro: bigint;
  };
}

/**
 * Byte-level verifier for Leg 1 unsigned EIP-1559 transaction matching `evm_parser.rs`
 */
export function verifyEip1559BaseUsdcTransferBytes(params: {
  rawUnsignedTxHex: string;
  expectedDepositAddressHex: string;
  expectedRepayAmountUsdcMicro: bigint;
}): EvmGuardrailVerificationResult {
  try {
    const raw = Buffer.from(
      params.rawUnsignedTxHex.replace(/^0x/i, ""),
      "hex"
    );
    if (raw.length === 0) {
      return {
        ok: false,
        errorCode: "EMPTY_PAYLOAD",
        errorMessage: "EVM payload cannot be empty",
      };
    }
    if (raw[0] !== 0x02) {
      return {
        ok: false,
        errorCode: "INVALID_TX_TYPE",
        errorMessage: `Expected EIP-1559 type 0x02, got 0x${raw[0].toString(16).padStart(2, "0")}`,
      };
    }

    const { item, nextOffset } = decodeRlpItem(raw, 1);
    if (nextOffset !== raw.length || !Array.isArray(item)) {
      return {
        ok: false,
        errorCode: "MALFORMED_RLP",
        errorMessage: "Malformed RLP list or trailing bytes",
      };
    }
    if (item.length !== 9) {
      return {
        ok: false,
        errorCode: "UNEXPECTED_ITEM_COUNT",
        errorMessage: `Unsigned EIP-1559 RLP list must have 9 items, got ${item.length}`,
      };
    }

    const chainId = Number(rlpBufferToBigInt(item[0]));
    if (chainId !== BASE_MAINNET_CHAIN_ID) {
      return {
        ok: false,
        errorCode: "INVALID_CHAIN_ID",
        errorMessage: `GUARDRAIL REVERT: Invalid chain_id ${chainId}; expected ${BASE_MAINNET_CHAIN_ID} (Base Mainnet)`,
      };
    }

    const nonce = Number(rlpBufferToBigInt(item[1]));
    const maxPriorityFeePerGasWei = rlpBufferToBigInt(item[2]);
    const maxFeePerGasWei = rlpBufferToBigInt(item[3]);
    const gasLimit = Number(rlpBufferToBigInt(item[4]));

    if (gasLimit < 21_000 || gasLimit > 250_000) {
      return {
        ok: false,
        errorCode: "GAS_LIMIT_OUT_OF_BOUNDS",
        errorMessage: `GUARDRAIL REVERT: EIP-1559 gas_limit ${gasLimit} outside allowed guardrail bounds [21000..=250000]`,
      };
    }
    if (maxFeePerGasWei === 0n || maxFeePerGasWei > 50_000_000_000n) {
      return {
        ok: false,
        errorCode: "MAX_FEE_PER_GAS_EXCEEDED",
        errorMessage: `CRITICAL GAS-GRIEFING BLOCK: EIP-1559 max_fee_per_gas (${maxFeePerGasWei.toString()} wei) exceeds guardrail cap (50000000000 wei / 50 gwei)`,
      };
    }
    if (maxPriorityFeePerGasWei > maxFeePerGasWei) {
      return {
        ok: false,
        errorCode: "PRIORITY_FEE_EXCEEDS_MAX_FEE",
        errorMessage: `GUARDRAIL REVERT: EIP-1559 max_priority_fee_per_gas (${maxPriorityFeePerGasWei.toString()}) > max_fee_per_gas (${maxFeePerGasWei.toString()})`,
      };
    }

    const toBuf = item[5];
    if (!Buffer.isBuffer(toBuf)) {
      return {
        ok: false,
        errorCode: "MALFORMED_TO",
        errorMessage: "`to` field must be bytes",
      };
    }
    const toAddressHex = "0x" + toBuf.toString("hex").toLowerCase();
    if (toAddressHex !== BASE_USDC_ADDRESS_HEX) {
      return {
        ok: false,
        errorCode: "INVALID_TARGET_CONTRACT",
        errorMessage: `GUARDRAIL REVERT: Target contract ${toAddressHex} is not Base Native USDC (${BASE_USDC_ADDRESS_HEX})`,
      };
    }

    const ethValueWei = rlpBufferToBigInt(item[6]);
    if (ethValueWei !== 0n) {
      return {
        ok: false,
        errorCode: "NONZERO_NATIVE_VALUE",
        errorMessage: `GUARDRAIL REVERT: Native ETH value must be 0, got ${ethValueWei.toString()} wei`,
      };
    }

    const dataBuf = item[7];
    if (!Buffer.isBuffer(dataBuf) || dataBuf.length !== 68) {
      return {
        ok: false,
        errorCode: "INVALID_CALLDATA_LENGTH",
        errorMessage: `GUARDRAIL REVERT: ERC-20 transfer calldata must be 68 bytes, got ${Buffer.isBuffer(dataBuf) ? dataBuf.length : 0}`,
      };
    }

    const selectorHex = dataBuf.subarray(0, 4).toString("hex").toLowerCase();
    if (selectorHex !== ERC20_TRANSFER_SELECTOR_HEX) {
      return {
        ok: false,
        errorCode: "FORBIDDEN_SELECTOR",
        errorMessage:
          selectorHex === ERC20_APPROVE_SELECTOR_HEX
            ? "GUARDRAIL REVERT: ERC-20 approve(0x095ea7b3) is strictly forbidden; only direct transfer(0xa9059cbb) is permitted"
            : `GUARDRAIL REVERT: Invalid ERC-20 selector 0x${selectorHex}; expected 0xa9059cbb`,
      };
    }

    if (!dataBuf.subarray(4, 16).equals(Buffer.alloc(12, 0))) {
      return {
        ok: false,
        errorCode: "NONZERO_ADDRESS_PADDING",
        errorMessage:
          "GUARDRAIL REVERT: Non-zero top 12 padding bytes in ABI address parameter",
      };
    }

    const recipientDepositAddressHex =
      "0x" + dataBuf.subarray(16, 36).toString("hex").toLowerCase();
    const expectedDepositNorm =
      "0x" + params.expectedDepositAddressHex.replace(/^0x/i, "").toLowerCase();
    if (recipientDepositAddressHex !== expectedDepositNorm) {
      return {
        ok: false,
        errorCode: "DEPOSIT_ADDRESS_MISMATCH",
        errorMessage: `GUARDRAIL REVERT: ERC-20 recipient ${recipientDepositAddressHex} does not match approved 1-Click depositAddress ${expectedDepositNorm}`,
      };
    }

    const transferAmountUsdcMicro = BigInt(
      "0x" + dataBuf.subarray(36, 68).toString("hex")
    );
    if (transferAmountUsdcMicro !== params.expectedRepayAmountUsdcMicro) {
      return {
        ok: false,
        errorCode: "TRANSFER_AMOUNT_MISMATCH",
        errorMessage: `GUARDRAIL REVERT: Encoded transfer amount ${transferAmountUsdcMicro.toString()} does not match approved repay_amount_usdc ${params.expectedRepayAmountUsdcMicro.toString()}`,
      };
    }

    return {
      ok: true,
      decoded: {
        chainId,
        nonce,
        toAddressHex,
        ethValueWei,
        selectorHex: "0x" + selectorHex,
        recipientDepositAddressHex,
        transferAmountUsdcMicro,
      },
    };
  } catch (err) {
    return {
      ok: false,
      errorCode: "MALFORMED_RLP",
      errorMessage: (err as Error).message,
    };
  }
}

// --- Solana V0 / Legacy Message Builder & Byte-Level Verifier ---

export function encodeCompactU16(val: number): Buffer {
  const bytes: number[] = [];
  let rem = val;
  while (true) {
    let elem = rem & 0x7f;
    rem >>= 7;
    if (rem === 0) {
      bytes.push(elem);
      break;
    } else {
      elem |= 0x80;
      bytes.push(elem);
    }
  }
  return Buffer.from(bytes);
}

export function decodeCompactU16(
  buf: Buffer,
  offset: number
): { value: number; nextOffset: number } {
  if (offset >= buf.length) throw new Error("EOF reading compact-u16");
  const b0 = buf[offset];
  if ((b0 & 0x80) === 0) {
    return { value: b0, nextOffset: offset + 1 };
  }
  if (offset + 1 >= buf.length) throw new Error("EOF reading compact-u16 b1");
  const b1 = buf[offset + 1];
  if ((b1 & 0x80) === 0) {
    return { value: (b0 & 0x7f) | (b1 << 7), nextOffset: offset + 2 };
  }
  if (offset + 2 >= buf.length) throw new Error("EOF reading compact-u16 b2");
  const b2 = buf[offset + 2];
  return {
    value: (b0 & 0x7f) | ((b1 & 0x7f) << 7) | (b2 << 14),
    nextOffset: offset + 3,
  };
}

/**
 * Builds a raw serialized Solana `Message` (V0 or Legacy) executing:
 * `[ComputeBudget, refresh_reserve (SOL), refresh_reserve (USDC), refresh_obligation, repay_obligation_liquidity_v2]`
 * (or `[ComputeBudget, repay_obligation_liquidity_v2]` if `includeRefreshInstructions: false`).
 * Matches `solana_parser.rs` byte-for-byte so Kamino Lend on Solana Mainnet never reverts with
 * `ReserveStale (6009)` or `ObligationStale (6010)`.
 */
export function buildSolanaKaminoRepayMessageBytes(params: {
  versionedV0?: boolean;
  mpcSolanaPayerPubkey: string;
  userObligationPubkey: string;
  lendingMarketPubkey?: string;
  solCollateralReservePubkey?: string;
  repayReservePubkey?: string;
  reserveDestinationLiquidityPubkey?: string;
  userSourceLiquidityPubkey?: string;
  pythSolOraclePubkey?: string;
  pythUsdcOraclePubkey?: string;
  recentBlockhashBase58?: string;
  repayAmountUsdcMicro: bigint;
  customDiscriminator?: Buffer;
  customRefreshDiscriminator?: Buffer;
  customProgramIdPubkey?: string;
  customComputeBudgetPriceMicroLamports?: bigint;
  includeComputeBudget?: boolean;
  includeRefreshInstructions?: boolean;
  addressLookupTableCount?: number;
}): {
  rawMessageHex: string;
  rawMessageBytes: Buffer;
  userSourceLiquidityAtaPubkey: string;
  repayReservePubkey: string;
} {
  const {
    versionedV0 = true,
    mpcSolanaPayerPubkey,
    userObligationPubkey,
    lendingMarketPubkey = KAMINO_MAIN_MARKET_PUBKEY,
    solCollateralReservePubkey = KAMINO_MAINNET_SOL_RESERVE_PUBKEY,
    repayReservePubkey = KAMINO_MAINNET_USDC_RESERVE_PUBKEY,
    reserveDestinationLiquidityPubkey = "Bgq7trRgVMeq33yt235zM2onQ4bRDBsY5EWiTetF4qw6",
    userSourceLiquidityPubkey = deriveSolanaAssociatedTokenAddress(
      mpcSolanaPayerPubkey,
      SOLANA_MAINNET_USDC_MINT_PUBKEY
    ).ataPubkeyBase58,
    pythSolOraclePubkey = "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE",
    pythUsdcOraclePubkey = "Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX",
    recentBlockhashBase58 = "4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi",
    repayAmountUsdcMicro,
    customDiscriminator = REPAY_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR,
    customRefreshDiscriminator,
    customProgramIdPubkey = KAMINO_LEND_PROGRAM_ID,
    customComputeBudgetPriceMicroLamports,
    includeComputeBudget = true,
    includeRefreshInstructions = true,
    addressLookupTableCount = 0,
  } = params;

  const chunks: Buffer[] = [];
  if (versionedV0) {
    chunks.push(Buffer.from([0x80]));
  }

  if (includeRefreshInstructions) {
    // Full 5-instruction Solana Mainnet message:
    // [ComputeBudget, refresh_reserve(SOL), refresh_reserve(USDC), refresh_obligation, repay_obligation_liquidity_v2]
    const readonlyUnsigned = includeComputeBudget ? 7 : 6;
    chunks.push(Buffer.from([1, 0, readonlyUnsigned]));

    // Static account keys:
    // [0] mpcSolanaPayer (writable, signer)
    // [1] userObligation (writable)
    // [2] solCollateralReserve (writable)
    // [3] repayReserve (USDC, writable)
    // [4] reserveDestinationLiquidity (writable)
    // [5] userSourceLiquidity (writable)
    // [6] lendingMarket (readonly)
    // [7] pythSolOracle (readonly)
    // [8] pythUsdcOracle (readonly)
    // [9] SPL_TOKEN_PROGRAM_ID (readonly)
    // [10] SYSVAR_INSTRUCTIONS_PUBKEY (readonly)
    // [11] KAMINO_LEND_PROGRAM_ID (readonly)
    // [12] COMPUTE_BUDGET_PROGRAM_ID (readonly)
    const staticKeys: Buffer[] = [
      base58Decode(mpcSolanaPayerPubkey),
      base58Decode(userObligationPubkey),
      base58Decode(solCollateralReservePubkey),
      base58Decode(repayReservePubkey),
      base58Decode(reserveDestinationLiquidityPubkey),
      base58Decode(userSourceLiquidityPubkey),
      base58Decode(lendingMarketPubkey),
      base58Decode(pythSolOraclePubkey),
      base58Decode(pythUsdcOraclePubkey),
      base58Decode(SPL_TOKEN_PROGRAM_ID),
      base58Decode(SYSVAR_INSTRUCTIONS_PUBKEY),
      base58Decode(customProgramIdPubkey),
    ];
    if (includeComputeBudget) {
      staticKeys.push(base58Decode(COMPUTE_BUDGET_PROGRAM_ID));
    }

    chunks.push(encodeCompactU16(staticKeys.length));
    for (const k of staticKeys) {
      if (k.length !== 32) {
        const padded = Buffer.alloc(32, 0);
        k.copy(padded, 32 - Math.min(32, k.length));
        chunks.push(padded);
      } else {
        chunks.push(k);
      }
    }

    const bh = base58Decode(recentBlockhashBase58);
    const bh32 = Buffer.alloc(32, 0xaa);
    bh.copy(bh32, 0, 0, Math.min(32, bh.length));
    chunks.push(bh32);

    const ixCount = includeComputeBudget ? 5 : 4;
    chunks.push(encodeCompactU16(ixCount));

    if (includeComputeBudget) {
      let cbData: Buffer;
      if (customComputeBudgetPriceMicroLamports !== undefined) {
        cbData = Buffer.alloc(9);
        cbData[0] = 0x03;
        cbData.writeBigUInt64LE(customComputeBudgetPriceMicroLamports, 1);
      } else {
        // Ix 1: ComputeBudget::SetComputeUnitLimit(400_000) at program_id_index = 12
        cbData = Buffer.alloc(5);
        cbData[0] = 0x02;
        cbData.writeUInt32LE(400_000, 1);
      }
      chunks.push(
        Buffer.from([12]),
        encodeCompactU16(0),
        encodeCompactU16(cbData.length),
        cbData
      );
    }

    const refreshReserveDisc =
      customRefreshDiscriminator ?? REFRESH_RESERVE_DISCRIMINATOR;

    // Ix 2: KLend::refresh_reserve (SOL reserve) at program_id_index = 11
    // accounts: [reserve=2, lending_market=6, pyth_oracle=7, switchboard_price=11, switchboard_twap=11, scope_prices=11]
    const refreshSolAccts = Buffer.from([2, 6, 7, 11, 11, 11]);
    chunks.push(
      Buffer.from([11]),
      encodeCompactU16(refreshSolAccts.length),
      refreshSolAccts,
      encodeCompactU16(refreshReserveDisc.length),
      refreshReserveDisc
    );

    // Ix 3: KLend::refresh_reserve (USDC reserve) at program_id_index = 11
    // accounts: [reserve=3, lending_market=6, pyth_oracle=8, switchboard_price=11, switchboard_twap=11, scope_prices=11]
    const refreshUsdcAccts = Buffer.from([3, 6, 8, 11, 11, 11]);
    chunks.push(
      Buffer.from([11]),
      encodeCompactU16(refreshUsdcAccts.length),
      refreshUsdcAccts,
      encodeCompactU16(REFRESH_RESERVE_DISCRIMINATOR.length),
      REFRESH_RESERVE_DISCRIMINATOR
    );

    // Ix 4: KLend::refresh_obligation at program_id_index = 11
    // accounts: [lending_market=6, obligation=1, sol_reserve=2, usdc_reserve=3]
    const refreshObligationAccts = Buffer.from([6, 1, 2, 3]);
    chunks.push(
      Buffer.from([11]),
      encodeCompactU16(refreshObligationAccts.length),
      refreshObligationAccts,
      encodeCompactU16(REFRESH_OBLIGATION_DISCRIMINATOR.length),
      REFRESH_OBLIGATION_DISCRIMINATOR
    );

    // Ix 5: KLend::repay_obligation_liquidity_v2 at program_id_index = 11
    // accounts: [owner=0, obligation=1, lending_market=6, repay_reserve=3, reserve_dest=4, user_source=5, token_program=9, sysvar=10]
    const kaminoRepayAccounts = Buffer.from([0, 1, 6, 3, 4, 5, 9, 10]);
    const kaminoData = Buffer.alloc(16);
    customDiscriminator.copy(kaminoData, 0, 0, 8);
    kaminoData.writeBigUInt64LE(repayAmountUsdcMicro, 8);

    chunks.push(
      Buffer.from([11]),
      encodeCompactU16(kaminoRepayAccounts.length),
      kaminoRepayAccounts,
      encodeCompactU16(kaminoData.length),
      kaminoData
    );

    if (versionedV0) {
      chunks.push(encodeCompactU16(addressLookupTableCount));
    }

    const rawMessageBytes = Buffer.concat(chunks);
    return {
      rawMessageHex: rawMessageBytes.toString("hex"),
      rawMessageBytes,
      userSourceLiquidityAtaPubkey: userSourceLiquidityPubkey,
      repayReservePubkey,
    };
  }

  const readonlyUnsigned = includeComputeBudget ? 5 : 4;
  // MessageHeader: [1 required sig, 0 readonly signed, readonlyUnsigned]
  chunks.push(Buffer.from([1, 0, readonlyUnsigned]));

  const staticKeys: Buffer[] = [
    base58Decode(mpcSolanaPayerPubkey),
    base58Decode(userObligationPubkey),
    base58Decode(repayReservePubkey),
    base58Decode(reserveDestinationLiquidityPubkey),
    base58Decode(userSourceLiquidityPubkey),
    base58Decode(lendingMarketPubkey),
    base58Decode(SPL_TOKEN_PROGRAM_ID),
    base58Decode(SYSVAR_INSTRUCTIONS_PUBKEY),
    base58Decode(customProgramIdPubkey),
  ];
  if (includeComputeBudget) {
    staticKeys.push(base58Decode(COMPUTE_BUDGET_PROGRAM_ID));
  }

  chunks.push(encodeCompactU16(staticKeys.length));
  for (const k of staticKeys) {
    if (k.length !== 32) {
      const padded = Buffer.alloc(32, 0);
      k.copy(padded, 32 - Math.min(32, k.length));
      chunks.push(padded);
    } else {
      chunks.push(k);
    }
  }

  const bh = base58Decode(recentBlockhashBase58);
  const bh32 = Buffer.alloc(32, 0xaa);
  bh.copy(bh32, 0, 0, Math.min(32, bh.length));
  chunks.push(bh32);

  const ixCount = includeComputeBudget ? 2 : 1;
  chunks.push(encodeCompactU16(ixCount));

  if (includeComputeBudget) {
    // ComputeBudget instruction at program_id_index = 9
    const cbData = Buffer.alloc(5);
    cbData[0] = 0x02;
    cbData.writeUInt32LE(400_000, 1);
    chunks.push(
      Buffer.from([9]),
      encodeCompactU16(0),
      encodeCompactU16(cbData.length),
      cbData
    );
  }

  // Kamino instruction at program_id_index = 8
  // Account index mapping: [owner=0, obligation=1, lending_market=5, repay_reserve=2, reserve_dest=3, user_source=4, token_program=6, sysvar=7]
  const kaminoAccounts = Buffer.from([0, 1, 5, 2, 3, 4, 6, 7]);
  const kaminoData = Buffer.alloc(16);
  customDiscriminator.copy(kaminoData, 0, 0, 8);
  kaminoData.writeBigUInt64LE(repayAmountUsdcMicro, 8);

  chunks.push(
    Buffer.from([8]),
    encodeCompactU16(kaminoAccounts.length),
    kaminoAccounts,
    encodeCompactU16(kaminoData.length),
    kaminoData
  );

  if (versionedV0) {
    chunks.push(encodeCompactU16(addressLookupTableCount));
  }

  const rawMessageBytes = Buffer.concat(chunks);
  return {
    rawMessageHex: rawMessageBytes.toString("hex"),
    rawMessageBytes,
    userSourceLiquidityAtaPubkey: userSourceLiquidityPubkey,
    repayReservePubkey,
  };
}

/**
 * Reconstructs a signed Solana `VersionedTransaction` (`[0x01, ...64_byte_ed25519_sig, ...raw_message_bytes]`)
 * from the raw serialized Solana `Message` bytes and the 64-byte Ed25519 signature returned by `v1.signer` (`domain_id: 1`).
 */
export function assembleSignedSolanaVersionedTransaction(params: {
  rawMessageHex: string;
  ed25519SignatureHex: string;
}): {
  signedTransactionBytes: Buffer;
  signedTransactionBase64: string;
  signedTransactionHex: string;
  signatureBase58: string;
} {
  const rawMessage = Buffer.from(
    params.rawMessageHex.replace(/^0x/i, ""),
    "hex"
  );
  if (rawMessage.length < 64 || rawMessage.length > 1232) {
    throw new Error(
      `Solana raw Message must be between 64 and 1232 bytes, got ${rawMessage.length}`
    );
  }
  const sigBytes = Buffer.from(
    params.ed25519SignatureHex.replace(/^0x/i, ""),
    "hex"
  );
  if (sigBytes.length !== 64) {
    throw new Error(
      `Ed25519 signature must be exactly 64 bytes, got ${sigBytes.length}`
    );
  }

  // Wire format of a 1-signer Solana VersionedTransaction:
  // compact-u16(1) = 0x01 || 64-byte Ed25519 signature || raw serialized Message bytes
  const signedTransactionBytes = Buffer.concat([
    Buffer.from([0x01]),
    sigBytes,
    rawMessage,
  ]);

  return {
    signedTransactionBytes,
    signedTransactionBase64: signedTransactionBytes.toString("base64"),
    signedTransactionHex: signedTransactionBytes.toString("hex"),
    signatureBase58: base58Encode(sigBytes),
  };
}

export interface SolanaGuardrailVerificationResult {
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
  decoded?: {
    isVersionedV0: boolean;
    feePayerPubkey: string;
    obligationPubkey: string;
    lendingMarketPubkey: string;
    repayReservePubkey: string;
    userSourceLiquidityPubkey: string;
    repayAmountUsdcMicro: bigint;
    discriminatorHex: string;
    isV2Discriminator: boolean;
    computeBudgetIxCount: number;
    kaminoRefreshIxCount: number;
  };
}

/**
 * Byte-level verifier for Leg 2 Solana `Message` bytes matching `solana_parser.rs`
 */
export function verifySolanaKaminoRepayMessageBytes(params: {
  rawMessageHex: string;
  expectedMpcSolanaPayerPubkey: string;
  expectedUserObligationPubkey: string;
  expectedLendingMarketPubkey?: string;
  expectedSolCollateralReservePubkey?: string;
  expectedUsdcRepayReservePubkey?: string;
  minRepayAmountUsdcMicro: bigint;
  maxRepayAmountUsdcMicro: bigint;
}): SolanaGuardrailVerificationResult {
  try {
    const raw = Buffer.from(params.rawMessageHex.replace(/^0x/i, ""), "hex");
    if (raw.length === 0) {
      return {
        ok: false,
        errorCode: "EMPTY_MESSAGE",
        errorMessage: "Solana message bytes cannot be empty",
      };
    }
    if (raw.length < 64 || raw.length > 1232) {
      return {
        ok: false,
        errorCode: "PREHASH_FORBIDDEN",
        errorMessage: `GUARDRAIL REVERT (LEG 2 SOLANA): Solana Ed25519 requires raw serialized Message bytes (64..=1232 bytes), got ${raw.length} bytes (32-byte pre-hash is forbidden)`,
      };
    }

    let offset = 0;
    let isVersionedV0 = false;
    if ((raw[0] & 0x80) !== 0) {
      const version = raw[0] & 0x7f;
      if (version !== 0) {
        return {
          ok: false,
          errorCode: "UNSUPPORTED_VERSION",
          errorMessage: `Unsupported Solana message version ${version}`,
        };
      }
      isVersionedV0 = true;
      offset += 1;
    }

    const numRequiredSignatures = raw[offset];
    const numReadonlySignedAccounts = raw[offset + 1];
    offset += 3;
    if (numRequiredSignatures !== 1) {
      return {
        ok: false,
        errorCode: "INVALID_SIGNATURE_COUNT",
        errorMessage: `GUARDRAIL REVERT: Solana message must require 1 signer, got ${numRequiredSignatures}`,
      };
    }
    if (numReadonlySignedAccounts !== 0) {
      return {
        ok: false,
        errorCode: "READONLY_SIGNED_FORBIDDEN",
        errorMessage: `GUARDRAIL REVERT: Solana MessageHeader num_readonly_signed_accounts must be 0, got ${numReadonlySignedAccounts}`,
      };
    }

    const keysLenRes = decodeCompactU16(raw, offset);
    offset = keysLenRes.nextOffset;
    const accountKeys: string[] = [];
    for (let i = 0; i < keysLenRes.value; i++) {
      const pkBytes = raw.subarray(offset, offset + 32);
      const pkBase58 = base58Encode(pkBytes);
      if (accountKeys.includes(pkBase58)) {
        return {
          ok: false,
          errorCode: "DUPLICATE_STATIC_ACCOUNT_KEY",
          errorMessage: `GUARDRAIL REVERT: Duplicate static account key (${pkBase58}) in Solana message`,
        };
      }
      accountKeys.push(pkBase58);
      offset += 32;
    }

    if (accountKeys[0] !== params.expectedMpcSolanaPayerPubkey) {
      return {
        ok: false,
        errorCode: "FEE_PAYER_MISMATCH",
        errorMessage: `GUARDRAIL REVERT: Fee payer ${accountKeys[0]} does not match MPC_Solana_Payer ${params.expectedMpcSolanaPayerPubkey}`,
      };
    }

    // Skip 32-byte recent_blockhash
    offset += 32;

    const ixLenRes = decodeCompactU16(raw, offset);
    offset = ixLenRes.nextOffset;

    let computeBudgetIxCount = 0;
    let kaminoRefreshIxCount = 0;
    let verifiedKamino: {
      obligationPubkey: string;
      lendingMarketPubkey: string;
      repayReservePubkey: string;
      userSourceLiquidityPubkey: string;
      repayAmountUsdcMicro: bigint;
      discriminatorHex: string;
      isV2Discriminator: boolean;
    } | null = null;

    const expectedMarket =
      params.expectedLendingMarketPubkey ?? KAMINO_MAIN_MARKET_PUBKEY;
    const expectedSolReserve =
      params.expectedSolCollateralReservePubkey ??
      KAMINO_MAINNET_SOL_RESERVE_PUBKEY;
    const expectedUsdcReserve =
      params.expectedUsdcRepayReservePubkey ??
      KAMINO_MAINNET_USDC_RESERVE_PUBKEY;

    for (let i = 0; i < ixLenRes.value; i++) {
      const programIdIndex = raw[offset++];
      const programId = accountKeys[programIdIndex];

      const acctLenRes = decodeCompactU16(raw, offset);
      offset = acctLenRes.nextOffset;
      const ixAccounts = raw.subarray(offset, offset + acctLenRes.value);
      offset += acctLenRes.value;

      const dataLenRes = decodeCompactU16(raw, offset);
      offset = dataLenRes.nextOffset;
      const ixData = raw.subarray(offset, offset + dataLenRes.value);
      offset += dataLenRes.value;

      if (programId === COMPUTE_BUDGET_PROGRAM_ID) {
        if (ixAccounts.length > 0 || ixData.length === 0) {
          return {
            ok: false,
            errorCode: "INVALID_COMPUTE_BUDGET_IX",
            errorMessage:
              "GUARDRAIL REVERT: Invalid ComputeBudget instruction accounts or empty data",
          };
        }
        const cbTag = ixData[0];
        if (cbTag === 0x02) {
          if (ixData.length !== 5) {
            return {
              ok: false,
              errorCode: "INVALID_COMPUTE_BUDGET_IX",
              errorMessage:
                "GUARDRAIL REVERT: ComputeBudget::SetComputeUnitLimit must be 5 bytes",
            };
          }
          const cuLimit = ixData.readUInt32LE(1);
          if (cuLimit === 0 || cuLimit > 1_400_000) {
            return {
              ok: false,
              errorCode: "COMPUTE_UNIT_LIMIT_EXCEEDED",
              errorMessage: `GUARDRAIL REVERT: ComputeBudget::SetComputeUnitLimit (${cuLimit}) outside [1..=1400000]`,
            };
          }
        } else if (cbTag === 0x03) {
          if (ixData.length !== 9) {
            return {
              ok: false,
              errorCode: "INVALID_COMPUTE_BUDGET_IX",
              errorMessage:
                "GUARDRAIL REVERT: ComputeBudget::SetComputeUnitPrice must be 9 bytes",
            };
          }
          const microLamports = ixData.readBigUInt64LE(1);
          if (microLamports > 5_000_000n) {
            return {
              ok: false,
              errorCode: "COMPUTE_BUDGET_FEE_LIMIT_EXCEEDED",
              errorMessage: `CRITICAL SOL FEE-GRIEFING BLOCK: ComputeBudget SetComputeUnitPrice (${microLamports.toString()} micro-lamports/CU) exceeds guardrail cap (5000000 micro-lamports/CU)`,
            };
          }
        } else if (cbTag !== 0x01 || ixData.length !== 5) {
          return {
            ok: false,
            errorCode: "INVALID_COMPUTE_BUDGET_IX",
            errorMessage: `GUARDRAIL REVERT: Unsupported ComputeBudget instruction tag 0x${cbTag.toString(16)}`,
          };
        }
        computeBudgetIxCount++;
      } else if (programId === KAMINO_LEND_PROGRAM_ID) {
        if (ixData.length < 8) {
          return {
            ok: false,
            errorCode: "INVALID_KAMINO_DATA_LEN",
            errorMessage: `GUARDRAIL REVERT: Kamino instruction data must be at least 8 bytes, got ${ixData.length}`,
          };
        }
        const disc = ixData.subarray(0, 8);
        const isRefreshReserve = disc.equals(REFRESH_RESERVE_DISCRIMINATOR);
        const isRefreshReservesBatch = disc.equals(
          REFRESH_RESERVES_BATCH_DISCRIMINATOR
        );
        const isRefreshObligation = disc.equals(
          REFRESH_OBLIGATION_DISCRIMINATOR
        );
        const isRefreshFarms = disc.equals(
          REFRESH_OBLIGATION_FARMS_FOR_RESERVE_DISCRIMINATOR
        );

        if (
          isRefreshReserve ||
          isRefreshReservesBatch ||
          isRefreshObligation ||
          isRefreshFarms
        ) {
          if (verifiedKamino) {
            return {
              ok: false,
              errorCode: "REFRESH_AFTER_REPAY",
              errorMessage:
                "GUARDRAIL REVERT: Kamino refresh instructions must precede repayment",
            };
          }
          if (isRefreshReserve) {
            if (ixData.length !== 8 || ixAccounts.length < 2) {
              return {
                ok: false,
                errorCode: "INVALID_REFRESH_RESERVE",
                errorMessage:
                  "GUARDRAIL REVERT: Invalid refresh_reserve instruction layout",
              };
            }
            const reserveKey = accountKeys[ixAccounts[0]];
            const marketKey = accountKeys[ixAccounts[1]];
            if (
              reserveKey !== expectedSolReserve &&
              reserveKey !== expectedUsdcReserve
            ) {
              return {
                ok: false,
                errorCode: "UNAUTHORIZED_RESERVE_ACCOUNT",
                errorMessage: `GUARDRAIL REVERT: refresh_reserve account (${reserveKey}) is not in allowed obligation reserves`,
              };
            }
            if (marketKey !== expectedMarket) {
              return {
                ok: false,
                errorCode: "LENDING_MARKET_MISMATCH",
                errorMessage: `GUARDRAIL REVERT: refresh_reserve lending_market (${marketKey}) does not match ${expectedMarket}`,
              };
            }
          } else if (isRefreshObligation) {
            if (ixData.length !== 8 || ixAccounts.length < 2) {
              return {
                ok: false,
                errorCode: "INVALID_REFRESH_OBLIGATION",
                errorMessage:
                  "GUARDRAIL REVERT: Invalid refresh_obligation instruction layout",
              };
            }
            const marketKey = accountKeys[ixAccounts[0]];
            const obligationKey = accountKeys[ixAccounts[1]];
            if (marketKey !== expectedMarket) {
              return {
                ok: false,
                errorCode: "LENDING_MARKET_MISMATCH",
                errorMessage: `GUARDRAIL REVERT: refresh_obligation lending_market (${marketKey}) does not match ${expectedMarket}`,
              };
            }
            if (obligationKey !== params.expectedUserObligationPubkey) {
              return {
                ok: false,
                errorCode: "OBLIGATION_MISMATCH",
                errorMessage: `GUARDRAIL REVERT: refresh_obligation obligation (${obligationKey}) does not match ${params.expectedUserObligationPubkey}`,
              };
            }
            for (let r = 2; r < ixAccounts.length; r++) {
              const remKey = accountKeys[ixAccounts[r]];
              if (
                remKey !== expectedSolReserve &&
                remKey !== expectedUsdcReserve
              ) {
                return {
                  ok: false,
                  errorCode: "UNAUTHORIZED_RESERVE_ACCOUNT",
                  errorMessage: `GUARDRAIL REVERT: refresh_obligation remaining_account (${remKey}) is not in allowed obligation reserves`,
                };
              }
            }
          }
          kaminoRefreshIxCount++;
          continue;
        }

        if (verifiedKamino) {
          return {
            ok: false,
            errorCode: "MULTIPLE_KAMINO_IX",
            errorMessage:
              "GUARDRAIL REVERT: Multiple Kamino repayment instructions forbidden",
          };
        }

        const isV2 = disc.equals(REPAY_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR);
        const isV1 = disc.equals(REPAY_OBLIGATION_LIQUIDITY_V1_DISCRIMINATOR);

        if (!isV2 && !isV1) {
          if (disc.equals(WITHDRAW_OBLIGATION_COLLATERAL_V2_DISCRIMINATOR)) {
            return {
              ok: false,
              errorCode: "FORBIDDEN_KAMINO_WITHDRAW",
              errorMessage:
                "CRITICAL SECURITY BLOCK: Kamino withdraw_obligation_collateral_v2 ([202, 249, 117, 114, 231, 192, 47, 138]) rejected by NEAR Policy Guardrail",
            };
          }
          if (disc.equals(BORROW_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR)) {
            return {
              ok: false,
              errorCode: "FORBIDDEN_KAMINO_BORROW",
              errorMessage:
                "CRITICAL SECURITY BLOCK: Kamino borrow_obligation_liquidity_v2 ([161, 128, 143, 245, 171, 199, 194, 6]) rejected by NEAR Policy Guardrail",
            };
          }
          return {
            ok: false,
            errorCode: "FORBIDDEN_KAMINO_DISCRIMINATOR",
            errorMessage: `GUARDRAIL REVERT: Forbidden Kamino discriminator 0x${disc.toString("hex")}`,
          };
        }

        if (ixData.length !== 16) {
          return {
            ok: false,
            errorCode: "INVALID_KAMINO_DATA_LEN",
            errorMessage: `GUARDRAIL REVERT: Kamino repay data must be 16 bytes, got ${ixData.length}`,
          };
        }

        if (ixAccounts.length < 8) {
          return {
            ok: false,
            errorCode: "INSUFFICIENT_KAMINO_ACCOUNTS",
            errorMessage: `GUARDRAIL REVERT: Kamino repay instruction requires at least 8 accounts, got ${ixAccounts.length}`,
          };
        }

        const repayAmountUsdcMicro = ixData.readBigUInt64LE(8);
        if (
          repayAmountUsdcMicro < params.minRepayAmountUsdcMicro ||
          repayAmountUsdcMicro > params.maxRepayAmountUsdcMicro
        ) {
          return {
            ok: false,
            errorCode: "REPAY_AMOUNT_OUT_OF_BOUNDS",
            errorMessage: `GUARDRAIL REVERT: Kamino repay amount ${repayAmountUsdcMicro.toString()} outside [${params.minRepayAmountUsdcMicro.toString()}..=${params.maxRepayAmountUsdcMicro.toString()}]`,
          };
        }

        const obligationPubkey = accountKeys[ixAccounts[1]];
        if (obligationPubkey !== params.expectedUserObligationPubkey) {
          return {
            ok: false,
            errorCode: "OBLIGATION_MISMATCH",
            errorMessage: `GUARDRAIL REVERT: Kamino obligation account (${obligationPubkey}) does not match user's registered obligation (${params.expectedUserObligationPubkey})`,
          };
        }

        const lendingMarketPubkey = accountKeys[ixAccounts[2]];
        if (lendingMarketPubkey !== expectedMarket) {
          return {
            ok: false,
            errorCode: "LENDING_MARKET_MISMATCH",
            errorMessage: `GUARDRAIL REVERT: Kamino lending_market (${lendingMarketPubkey}) does not match official Kamino Main Market (${expectedMarket})`,
          };
        }

        const repayReservePubkey = accountKeys[ixAccounts[3]];
        if (repayReservePubkey !== expectedUsdcReserve) {
          return {
            ok: false,
            errorCode: "REPAY_RESERVE_MISMATCH",
            errorMessage: `GUARDRAIL REVERT: Kamino repay_reserve (${repayReservePubkey}) does not match Kamino Mainnet USDC Reserve (${expectedUsdcReserve})`,
          };
        }

        const userSourceLiquidityPubkey = accountKeys[ixAccounts[5]];

        verifiedKamino = {
          obligationPubkey,
          lendingMarketPubkey,
          repayReservePubkey,
          userSourceLiquidityPubkey,
          repayAmountUsdcMicro,
          discriminatorHex: "0x" + disc.toString("hex"),
          isV2Discriminator: isV2,
        };
      } else {
        return {
          ok: false,
          errorCode: "UNAUTHORIZED_PROGRAM",
          errorMessage: `GUARDRAIL REVERT: Unauthorized Solana program ${programId}; only ComputeBudget and Kamino Lend are permitted`,
        };
      }
    }

    if (isVersionedV0) {
      const altRes = decodeCompactU16(raw, offset);
      offset = altRes.nextOffset;
      if (altRes.value !== 0) {
        return {
          ok: false,
          errorCode: "ALT_FORBIDDEN",
          errorMessage: `GUARDRAIL REVERT: V0 Address Lookup Tables forbidden (found ${altRes.value})`,
        };
      }
    }

    if (!verifiedKamino) {
      return {
        ok: false,
        errorCode: "MISSING_KAMINO_IX",
        errorMessage:
          "GUARDRAIL REVERT: Missing Kamino repayment instruction",
      };
    }

    return {
      ok: true,
      decoded: {
        isVersionedV0,
        feePayerPubkey: accountKeys[0],
        ...verifiedKamino,
        computeBudgetIxCount,
        kaminoRefreshIxCount,
      },
    };
  } catch (err) {
    return {
      ok: false,
      errorCode: "PARSE_ERROR",
      errorMessage: (err as Error).message,
    };
  }
}
