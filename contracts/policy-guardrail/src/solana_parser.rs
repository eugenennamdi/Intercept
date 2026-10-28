use near_sdk::serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Solana ComputeBudget Program ID: `ComputeBudget111111111111111111111111111111`
pub const COMPUTE_BUDGET_PROGRAM_ID_STR: &str = "ComputeBudget111111111111111111111111111111";
pub const COMPUTE_BUDGET_PUBKEY: [u8; 32] = [
    3, 6, 70, 111, 229, 33, 23, 50, 255, 236, 173, 186, 114, 195, 155, 231, 188, 140, 229, 187,
    197, 247, 18, 107, 44, 67, 155, 58, 64, 0, 0, 0,
];

/// Kamino Lend Program ID: `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`
pub const KAMINO_LEND_PROGRAM_ID_STR: &str = "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD";
pub const KAMINO_LEND_PUBKEY: [u8; 32] = [
    4, 178, 172, 177, 18, 88, 204, 227, 104, 44, 65, 139, 168, 114, 255, 61, 249, 17, 2, 113, 47,
    21, 175, 18, 182, 190, 105, 179, 67, 91, 0, 8,
];

/// Kamino Main Lending Market Pubkey: `7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF`
pub const KAMINO_MAIN_MARKET_ID_STR: &str = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
pub const KAMINO_MAIN_MARKET_PUBKEY: [u8; 32] = [
    102, 122, 232, 212, 88, 85, 169, 117, 80, 83, 73, 44, 128, 74, 30, 112, 209, 0, 88, 25, 168,
    58, 43, 226, 118, 155, 25, 13, 13, 45, 225, 18,
];

/// Kamino Mainnet SOL Collateral Reserve Pubkey: `d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q`
pub const KAMINO_MAINNET_SOL_RESERVE_ID_STR: &str = "d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q";
pub const KAMINO_MAINNET_SOL_RESERVE_PUBKEY: [u8; 32] = [
    9, 60, 122, 48, 168, 144, 5, 27, 56, 231, 8, 241, 252, 116, 54, 156, 174, 161, 155, 139, 90,
    10, 223, 59, 199, 157, 235, 137, 205, 11, 45, 145,
];

/// Kamino Mainnet USDC Debt/Repay Reserve Pubkey: `D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59`
pub const KAMINO_MAINNET_USDC_RESERVE_ID_STR: &str = "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59";
pub const KAMINO_MAINNET_USDC_RESERVE_PUBKEY: [u8; 32] = [
    179, 202, 137, 111, 221, 158, 115, 25, 162, 110, 6, 205, 249, 173, 95, 238, 78, 35, 242, 73,
    187, 64, 103, 200, 157, 91, 96, 42, 205, 34, 224, 108,
];

/// Anchor 8-byte discriminator for `global:repay_obligation_liquidity_v2`
/// Verified via `sha256("global:repay_obligation_liquidity_v2")[0..8]` -> `[116, 174, 213, 76, 180, 53, 210, 144]` (`0x74aed54cb435d290`)
pub const REPAY_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR: [u8; 8] =
    [116, 174, 213, 76, 180, 53, 210, 144];

/// Anchor 8-byte discriminator for `global:repay_obligation_liquidity` (v1)
/// Verified via `sha256("global:repay_obligation_liquidity")[0..8]` -> `[145, 178, 13, 225, 76, 240, 147, 72]` (`0x91b20de14cf09348`)
pub const REPAY_OBLIGATION_LIQUIDITY_V1_DISCRIMINATOR: [u8; 8] =
    [145, 178, 13, 225, 76, 240, 147, 72];

/// Same-slot Kamino Refresh Instruction Discriminators (required on Solana Mainnet to prevent `ReserveStale (6009)` / `ObligationStale (6010)`):
/// 1. `sha256("global:refresh_reserve")[0..8]` -> `[2, 218, 138, 235, 79, 201, 25, 102]` (`0x02da8aeb4fc91966`)
pub const REFRESH_RESERVE_DISCRIMINATOR: [u8; 8] = [2, 218, 138, 235, 79, 201, 25, 102];

/// 2. `sha256("global:refresh_reserves_batch")[0..8]` -> `[144, 110, 26, 103, 162, 204, 252, 147]` (`0x906e1a67a2ccfc93`)
pub const REFRESH_RESERVES_BATCH_DISCRIMINATOR: [u8; 8] =
    [144, 110, 26, 103, 162, 204, 252, 147];

/// 3. `sha256("global:refresh_obligation")[0..8]` -> `[33, 132, 147, 228, 151, 192, 72, 89]` (`0x218493e497c04859`)
pub const REFRESH_OBLIGATION_DISCRIMINATOR: [u8; 8] = [33, 132, 147, 228, 151, 192, 72, 89];

/// 4. `sha256("global:refresh_obligation_farms_for_reserve")[0..8]` -> `[140, 144, 253, 21, 10, 74, 248, 3]` (`0x8c90fd150a4af803`)
pub const REFRESH_OBLIGATION_FARMS_FOR_RESERVE_DISCRIMINATOR: [u8; 8] =
    [140, 144, 253, 21, 10, 74, 248, 3];

/// Explicitly forbidden Kamino instruction discriminators (used for clear adversarial diagnostics)
pub const WITHDRAW_OBLIGATION_COLLATERAL_V2_DISCRIMINATOR: [u8; 8] =
    [202, 249, 117, 114, 231, 192, 47, 138];
pub const BORROW_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR: [u8; 8] =
    [161, 128, 143, 245, 171, 199, 194, 6];

/// Computes the 8-byte Anchor instruction discriminator `sha256("global:<ix_name>")[0..8]`
pub fn compute_anchor_discriminator(global_ix_name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(global_ix_name.as_bytes());
    let digest = hasher.finalize();
    let mut disc = [0u8; 8];
    disc.copy_from_slice(&digest[0..8]);
    disc
}

/// Decoded Solana CompiledInstruction
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ParsedSolanaInstruction {
    pub program_id_index: u8,
    pub accounts: Vec<u8>,
    pub data: Vec<u8>,
}

/// Verified summary of a Solana Kamino repayment transaction message
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct VerifiedSolanaRepayMessage {
    pub is_versioned_v0: bool,
    pub num_required_signatures: u8,
    pub static_account_count: usize,
    pub fee_payer_pubkey: [u8; 32],
    pub recent_blockhash: [u8; 32],
    pub obligation_pubkey: [u8; 32],
    pub lending_market_pubkey: [u8; 32],
    pub repay_reserve_pubkey: [u8; 32],
    pub repay_amount_usdc: u64,
    pub is_v2_instruction: bool,
    pub compute_budget_ix_count: usize,
    pub kamino_refresh_ix_count: usize,
}

/// Detailed error variants for zero-trust Solana Leg 2 Message inspection
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SolanaParseError {
    EmptyMessage,
    UnsupportedMessageVersion(u8),
    UnexpectedEof(&'static str),
    NonCanonicalCompactU16,
    InvalidSignatureCount(u8),
    FeePayerMismatch { expected: [u8; 32], actual: [u8; 32] },
    ZeroRecentBlockhash,
    AccountIndexOutOfBounds { index: u8, max: usize },
    UnauthorizedProgram { program_id: [u8; 32] },
    MissingKaminoRepayInstruction,
    MultipleKaminoInstructions,
    RefreshInstructionAfterRepay,
    InvalidKaminoInstructionDataLength(usize),
    ForbiddenKaminoInstructionDiscriminator([u8; 8]),
    ZeroRepayAmount,
    RepayAmountOutOfBounds { min: u64, max: u64, actual: u64 },
    InsufficientKaminoAccounts(usize),
    RepayerAuthorityMismatch { expected: [u8; 32], actual: [u8; 32] },
    ObligationPubkeyMismatch { expected: [u8; 32], actual: [u8; 32] },
    LendingMarketMismatch { expected: [u8; 32], actual: [u8; 32] },
    RepayReserveMismatch { expected: [u8; 32], actual: [u8; 32] },
    UnauthorizedReserveAccount { actual: [u8; 32] },
    OpaqueAddressTableLookupsForbidden(usize),
    TrailingBytes(usize),
}

impl core::fmt::Display for SolanaParseError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            SolanaParseError::EmptyMessage => write!(f, "Solana message bytes cannot be empty"),
            SolanaParseError::UnsupportedMessageVersion(v) => {
                write!(f, "Unsupported Solana versioned message version: {}", v)
            }
            SolanaParseError::UnexpectedEof(ctx) => {
                write!(f, "Unexpected EOF while reading Solana message: {}", ctx)
            }
            SolanaParseError::NonCanonicalCompactU16 => {
                write!(f, "Non-canonical or overflowing compact-u16 length encoding")
            }
            SolanaParseError::InvalidSignatureCount(n) => {
                write!(
                    f,
                    "Solana message must require exactly 1 signer (MPC_Solana_Payer), got {}",
                    n
                )
            }
            SolanaParseError::FeePayerMismatch { expected, actual } => {
                write!(
                    f,
                    "Fee payer account[0] ({}) does not match MPC_Solana_Payer ({})",
                    bs58::encode(actual).into_string(),
                    bs58::encode(expected).into_string()
                )
            }
            SolanaParseError::ZeroRecentBlockhash => {
                write!(f, "Solana message recent_blockhash cannot be all zeroes")
            }
            SolanaParseError::AccountIndexOutOfBounds { index, max } => {
                write!(
                    f,
                    "Instruction account index {} out of bounds for {} static account keys (ALT indirection forbidden)",
                    index, max
                )
            }
            SolanaParseError::UnauthorizedProgram { program_id } => {
                write!(
                    f,
                    "Unauthorized Solana program {} in transaction; only ComputeBudget and Kamino Lend are permitted",
                    bs58::encode(program_id).into_string()
                )
            }
            SolanaParseError::MissingKaminoRepayInstruction => {
                write!(f, "Transaction contains no Kamino Lend repayment instruction")
            }
            SolanaParseError::MultipleKaminoInstructions => {
                write!(
                    f,
                    "Transaction contains multiple Kamino repayment instructions; exactly 1 repayment is permitted"
                )
            }
            SolanaParseError::RefreshInstructionAfterRepay => {
                write!(
                    f,
                    "Kamino reserve/obligation refresh instructions must precede the repayment instruction"
                )
            }
            SolanaParseError::InvalidKaminoInstructionDataLength(len) => {
                write!(
                    f,
                    "Invalid Kamino instruction data length: {} bytes",
                    len
                )
            }
            SolanaParseError::ForbiddenKaminoInstructionDiscriminator(disc) => {
                if *disc == WITHDRAW_OBLIGATION_COLLATERAL_V2_DISCRIMINATOR {
                    write!(
                        f,
                        "CRITICAL SECURITY BLOCK: Kamino withdraw_obligation_collateral_v2 ({:?}) rejected by guardrail",
                        disc
                    )
                } else if *disc == BORROW_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR {
                    write!(
                        f,
                        "CRITICAL SECURITY BLOCK: Kamino borrow_obligation_liquidity_v2 ({:?}) rejected by guardrail",
                        disc
                    )
                } else {
                    write!(
                        f,
                        "Forbidden Kamino instruction discriminator {:?}; only refresh_* and repay_obligation_liquidity(_v2) are permitted",
                        disc
                    )
                }
            }
            SolanaParseError::ZeroRepayAmount => {
                write!(f, "Kamino repayment liquidity_amount must be > 0")
            }
            SolanaParseError::RepayAmountOutOfBounds { min, max, actual } => {
                write!(
                    f,
                    "Kamino repayment amount {} outside approved range [{}..={}]",
                    actual, min, max
                )
            }
            SolanaParseError::InsufficientKaminoAccounts(len) => {
                write!(
                    f,
                    "Kamino instruction has insufficient accounts (got {})",
                    len
                )
            }
            SolanaParseError::RepayerAuthorityMismatch { expected, actual } => {
                write!(
                    f,
                    "Kamino instruction owner/repayer account ({}) does not match MPC_Solana_Payer ({})",
                    bs58::encode(actual).into_string(),
                    bs58::encode(expected).into_string()
                )
            }
            SolanaParseError::ObligationPubkeyMismatch { expected, actual } => {
                write!(
                    f,
                    "Kamino obligation account ({}) does not match policy user_kamino_obligation_pubkey ({})",
                    bs58::encode(actual).into_string(),
                    bs58::encode(expected).into_string()
                )
            }
            SolanaParseError::LendingMarketMismatch { expected, actual } => {
                write!(
                    f,
                    "Kamino lending_market account ({}) does not match policy kamino_lending_market_pubkey ({})",
                    bs58::encode(actual).into_string(),
                    bs58::encode(expected).into_string()
                )
            }
            SolanaParseError::RepayReserveMismatch { expected, actual } => {
                write!(
                    f,
                    "Kamino repay_reserve account[3] ({}) does not match policy usdc_repay_reserve_pubkey ({})",
                    bs58::encode(actual).into_string(),
                    bs58::encode(expected).into_string()
                )
            }
            SolanaParseError::UnauthorizedReserveAccount { actual } => {
                write!(
                    f,
                    "Kamino refresh instruction references unauthorized reserve account ({})",
                    bs58::encode(actual).into_string()
                )
            }
            SolanaParseError::OpaqueAddressTableLookupsForbidden(count) => {
                write!(
                    f,
                    "V0 Address Lookup Tables are forbidden by guardrail (found {} table lookups); all accounts must be static",
                    count
                )
            }
            SolanaParseError::TrailingBytes(rem) => {
                write!(f, "Solana message has {} unexpected trailing bytes", rem)
            }
        }
    }
}

/// Decodes a canonical Solana `compact-u16` length prefix from `bytes[offset..]`.
pub fn read_compact_u16(bytes: &[u8], offset: &mut usize) -> Result<usize, SolanaParseError> {
    if *offset >= bytes.len() {
        return Err(SolanaParseError::UnexpectedEof("compact-u16 byte 0"));
    }
    let b0 = bytes[*offset] as usize;
    *offset += 1;
    if (b0 & 0x80) == 0 {
        return Ok(b0);
    }

    if *offset >= bytes.len() {
        return Err(SolanaParseError::UnexpectedEof("compact-u16 byte 1"));
    }
    let b1 = bytes[*offset] as usize;
    *offset += 1;
    if (b1 & 0x80) == 0 {
        if b1 == 0 {
            return Err(SolanaParseError::NonCanonicalCompactU16);
        }
        return Ok((b0 & 0x7f) | (b1 << 7));
    }

    if *offset >= bytes.len() {
        return Err(SolanaParseError::UnexpectedEof("compact-u16 byte 2"));
    }
    let b2 = bytes[*offset] as usize;
    *offset += 1;
    // Third byte in compact-u16 can only have 2 bits (max u16 = 65535) and cannot have continuation bit
    if (b2 & 0xfc) != 0 || b2 == 0 {
        return Err(SolanaParseError::NonCanonicalCompactU16);
    }
    let val = (b0 & 0x7f) | ((b1 & 0x7f) << 7) | (b2 << 14);
    Ok(val)
}

/// Encodes a `usize` (`<= u16::MAX`) as a canonical Solana `compact-u16`.
pub fn encode_compact_u16(mut val: u16, out: &mut Vec<u8>) {
    loop {
        let mut elem = (val & 0x7f) as u8;
        val >>= 7;
        if val == 0 {
            out.push(elem);
            break;
        } else {
            elem |= 0x80;
            out.push(elem);
        }
    }
}

/// Parses and strictly verifies a raw serialized Solana `Message` (Legacy or Versioned `V0`)
/// against Intercept's Leg 2 Kamino Repayment Guardrail invariants.
///
/// Permits preceding Kamino same-slot refresh instructions (`refresh_reserve`, `refresh_reserves_batch`,
/// `refresh_obligation`, `refresh_obligation_farms_for_reserve`) and requires **exactly one**
/// repayment instruction (`repay_obligation_liquidity_v2` or `repay_obligation_liquidity`).
pub fn verify_solana_kamino_repay_message(
    raw_message: &[u8],
    expected_mpc_solana_payer: &[u8; 32],
    expected_user_obligation_pubkey: &[u8; 32],
    expected_lending_market_pubkey: &[u8; 32],
    expected_sol_collateral_reserve_pubkey: &[u8; 32],
    expected_usdc_repay_reserve_pubkey: &[u8; 32],
    min_repay_amount_usdc: u64,
    max_repay_amount_usdc: u64,
) -> Result<VerifiedSolanaRepayMessage, SolanaParseError> {
    if raw_message.is_empty() {
        return Err(SolanaParseError::EmptyMessage);
    }

    let mut offset = 0usize;
    let is_versioned_v0 = if (raw_message[0] & 0x80) != 0 {
        let version = raw_message[0] & 0x7f;
        if version != 0 {
            return Err(SolanaParseError::UnsupportedMessageVersion(version));
        }
        offset += 1;
        true
    } else {
        false
    };

    // 1. Read 3-byte MessageHeader
    if offset + 3 > raw_message.len() {
        return Err(SolanaParseError::UnexpectedEof("MessageHeader"));
    }
    let num_required_signatures = raw_message[offset];
    let _num_readonly_signed_accounts = raw_message[offset + 1];
    let _num_readonly_unsigned_accounts = raw_message[offset + 2];
    offset += 3;

    if num_required_signatures != 1 {
        return Err(SolanaParseError::InvalidSignatureCount(num_required_signatures));
    }

    // 2. Read static account keys array
    let account_keys_len = read_compact_u16(raw_message, &mut offset)?;
    if account_keys_len == 0 {
        return Err(SolanaParseError::InvalidSignatureCount(0));
    }
    let keys_byte_len = account_keys_len
        .checked_mul(32)
        .ok_or(SolanaParseError::UnexpectedEof("account_keys overflow"))?;
    if offset + keys_byte_len > raw_message.len() {
        return Err(SolanaParseError::UnexpectedEof("static account_keys"));
    }

    let mut account_keys: Vec<[u8; 32]> = Vec::with_capacity(account_keys_len);
    for i in 0..account_keys_len {
        let start = offset + i * 32;
        let mut pk = [0u8; 32];
        pk.copy_from_slice(&raw_message[start..start + 32]);
        account_keys.push(pk);
    }
    offset += keys_byte_len;

    // Fee payer and sole signer (account_keys[0]) MUST be MPC_Solana_Payer
    if &account_keys[0] != expected_mpc_solana_payer {
        return Err(SolanaParseError::FeePayerMismatch {
            expected: *expected_mpc_solana_payer,
            actual: account_keys[0],
        });
    }

    // 3. Read 32-byte recent_blockhash
    if offset + 32 > raw_message.len() {
        return Err(SolanaParseError::UnexpectedEof("recent_blockhash"));
    }
    let mut recent_blockhash = [0u8; 32];
    recent_blockhash.copy_from_slice(&raw_message[offset..offset + 32]);
    offset += 32;

    if recent_blockhash == [0u8; 32] {
        return Err(SolanaParseError::ZeroRecentBlockhash);
    }

    // 4. Read compiled instructions array
    let instructions_len = read_compact_u16(raw_message, &mut offset)?;
    if instructions_len == 0 {
        return Err(SolanaParseError::MissingKaminoRepayInstruction);
    }

    let mut compute_budget_ix_count = 0usize;
    let mut kamino_refresh_ix_count = 0usize;
    let mut verified_repay: Option<(u64, bool)> = None;

    for _ in 0..instructions_len {
        if offset >= raw_message.len() {
            return Err(SolanaParseError::UnexpectedEof("instruction program_id_index"));
        }
        let program_id_index = raw_message[offset];
        offset += 1;

        if (program_id_index as usize) >= account_keys.len() {
            return Err(SolanaParseError::AccountIndexOutOfBounds {
                index: program_id_index,
                max: account_keys.len(),
            });
        }
        let program_id = account_keys[program_id_index as usize];

        let acct_indices_len = read_compact_u16(raw_message, &mut offset)?;
        if offset + acct_indices_len > raw_message.len() {
            return Err(SolanaParseError::UnexpectedEof("instruction account indices"));
        }
        let ix_accounts = &raw_message[offset..offset + acct_indices_len];
        offset += acct_indices_len;

        // Verify every referenced account index is within the static account_keys array
        for &acct_idx in ix_accounts {
            if (acct_idx as usize) >= account_keys.len() {
                return Err(SolanaParseError::AccountIndexOutOfBounds {
                    index: acct_idx,
                    max: account_keys.len(),
                });
            }
        }

        let data_len = read_compact_u16(raw_message, &mut offset)?;
        if offset + data_len > raw_message.len() {
            return Err(SolanaParseError::UnexpectedEof("instruction data"));
        }
        let ix_data = &raw_message[offset..offset + data_len];
        offset += data_len;

        // Whitelist check: ONLY ComputeBudget OR Kamino Lend allowed
        if program_id == COMPUTE_BUDGET_PUBKEY {
            compute_budget_ix_count += 1;
        } else if program_id == KAMINO_LEND_PUBKEY {
            if ix_data.len() < 8 {
                return Err(SolanaParseError::InvalidKaminoInstructionDataLength(ix_data.len()));
            }
            let mut disc = [0u8; 8];
            disc.copy_from_slice(&ix_data[0..8]);

            if disc == REFRESH_RESERVE_DISCRIMINATOR {
                if verified_repay.is_some() {
                    return Err(SolanaParseError::RefreshInstructionAfterRepay);
                }
                if ix_data.len() != 8 {
                    return Err(SolanaParseError::InvalidKaminoInstructionDataLength(ix_data.len()));
                }
                // refresh_reserve accounts: [0: reserve, 1: lending_market, ...]
                if ix_accounts.len() < 2 {
                    return Err(SolanaParseError::InsufficientKaminoAccounts(ix_accounts.len()));
                }
                let reserve_pk = &account_keys[ix_accounts[0] as usize];
                if reserve_pk != expected_sol_collateral_reserve_pubkey
                    && reserve_pk != expected_usdc_repay_reserve_pubkey
                {
                    return Err(SolanaParseError::UnauthorizedReserveAccount {
                        actual: *reserve_pk,
                    });
                }
                let market_pk = &account_keys[ix_accounts[1] as usize];
                if market_pk != expected_lending_market_pubkey {
                    return Err(SolanaParseError::LendingMarketMismatch {
                        expected: *expected_lending_market_pubkey,
                        actual: *market_pk,
                    });
                }
                kamino_refresh_ix_count += 1;
            } else if disc == REFRESH_RESERVES_BATCH_DISCRIMINATOR {
                if verified_repay.is_some() {
                    return Err(SolanaParseError::RefreshInstructionAfterRepay);
                }
                // refresh_reserves_batch data: 8-byte discriminator + optional 1-byte skip_price_updates bool
                if ix_data.len() != 8 && ix_data.len() != 9 {
                    return Err(SolanaParseError::InvalidKaminoInstructionDataLength(ix_data.len()));
                }
                if ix_accounts.is_empty() {
                    return Err(SolanaParseError::InsufficientKaminoAccounts(0));
                }
                kamino_refresh_ix_count += 1;
            } else if disc == REFRESH_OBLIGATION_DISCRIMINATOR {
                if verified_repay.is_some() {
                    return Err(SolanaParseError::RefreshInstructionAfterRepay);
                }
                if ix_data.len() != 8 {
                    return Err(SolanaParseError::InvalidKaminoInstructionDataLength(ix_data.len()));
                }
                // refresh_obligation accounts on Kamino Mainnet:
                // [0: lending_market, 1: obligation, ...remaining_accounts (sol_collateral_reserve, usdc_repay_reserve)]
                if ix_accounts.len() < 2 {
                    return Err(SolanaParseError::InsufficientKaminoAccounts(ix_accounts.len()));
                }
                let market_candidate = &account_keys[ix_accounts[0] as usize];
                let obligation_candidate = &account_keys[ix_accounts[1] as usize];

                if market_candidate != expected_lending_market_pubkey {
                    return Err(SolanaParseError::LendingMarketMismatch {
                        expected: *expected_lending_market_pubkey,
                        actual: *market_candidate,
                    });
                }
                if obligation_candidate != expected_user_obligation_pubkey {
                    return Err(SolanaParseError::ObligationPubkeyMismatch {
                        expected: *expected_user_obligation_pubkey,
                        actual: *obligation_candidate,
                    });
                }

                // Verify all remaining_accounts (ix_accounts[2..]) belong to the obligation's allowed reserves
                for &rem_idx in &ix_accounts[2..] {
                    let rem_pk = &account_keys[rem_idx as usize];
                    if rem_pk != expected_sol_collateral_reserve_pubkey
                        && rem_pk != expected_usdc_repay_reserve_pubkey
                        && rem_pk != &KAMINO_LEND_PUBKEY
                    {
                        return Err(SolanaParseError::UnauthorizedReserveAccount {
                            actual: *rem_pk,
                        });
                    }
                }
                kamino_refresh_ix_count += 1;
            } else if disc == REFRESH_OBLIGATION_FARMS_FOR_RESERVE_DISCRIMINATOR {
                if verified_repay.is_some() {
                    return Err(SolanaParseError::RefreshInstructionAfterRepay);
                }
                // refresh_obligation_farms_for_reserve data: 8-byte discriminator + optional 1-byte mode u8
                if ix_data.len() != 8 && ix_data.len() != 9 {
                    return Err(SolanaParseError::InvalidKaminoInstructionDataLength(ix_data.len()));
                }
                if ix_accounts.len() < 4 {
                    return Err(SolanaParseError::InsufficientKaminoAccounts(ix_accounts.len()));
                }
                kamino_refresh_ix_count += 1;
            } else if disc == REPAY_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR
                || disc == REPAY_OBLIGATION_LIQUIDITY_V1_DISCRIMINATOR
            {
                if verified_repay.is_some() {
                    return Err(SolanaParseError::MultipleKaminoInstructions);
                }
                if ix_data.len() != 16 {
                    return Err(SolanaParseError::InvalidKaminoInstructionDataLength(ix_data.len()));
                }
                let is_v2 = disc == REPAY_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR;

                let mut amt_bytes = [0u8; 8];
                amt_bytes.copy_from_slice(&ix_data[8..16]);
                let repay_amount_usdc = u64::from_le_bytes(amt_bytes);
                if repay_amount_usdc == 0 {
                    return Err(SolanaParseError::ZeroRepayAmount);
                }
                if repay_amount_usdc < min_repay_amount_usdc
                    || repay_amount_usdc > max_repay_amount_usdc
                {
                    return Err(SolanaParseError::RepayAmountOutOfBounds {
                        min: min_repay_amount_usdc,
                        max: max_repay_amount_usdc,
                        actual: repay_amount_usdc,
                    });
                }

                // Kamino repay_obligation_liquidity(_v2) requires at least 8 accounts (up to 13 when v2 farm accounts are included):
                // [0] owner (repayer liquidity authority = MPC_Solana_Payer)
                // [1] obligation (user's Kamino Obligation PDA)
                // [2] lending_market (Kamino Main Lending Market)
                // [3] repay_reserve (pinned to policy's usdc_repay_reserve_pubkey)
                // [4] reserve_destination_liquidity
                // [5] user_source_liquidity (MPC_Solana_Payer USDC ATA)
                // [6] token_program
                // [7] instruction_sysvar_account (or remaining farm accounts in v2)
                if ix_accounts.len() < 8 {
                    return Err(SolanaParseError::InsufficientKaminoAccounts(ix_accounts.len()));
                }

                let owner_pk = &account_keys[ix_accounts[0] as usize];
                if owner_pk != expected_mpc_solana_payer {
                    return Err(SolanaParseError::RepayerAuthorityMismatch {
                        expected: *expected_mpc_solana_payer,
                        actual: *owner_pk,
                    });
                }

                let obligation_pk = &account_keys[ix_accounts[1] as usize];
                if obligation_pk != expected_user_obligation_pubkey {
                    return Err(SolanaParseError::ObligationPubkeyMismatch {
                        expected: *expected_user_obligation_pubkey,
                        actual: *obligation_pk,
                    });
                }

                let lending_market_pk = &account_keys[ix_accounts[2] as usize];
                if lending_market_pk != expected_lending_market_pubkey {
                    return Err(SolanaParseError::LendingMarketMismatch {
                        expected: *expected_lending_market_pubkey,
                        actual: *lending_market_pk,
                    });
                }

                let repay_reserve_pk = &account_keys[ix_accounts[3] as usize];
                if repay_reserve_pk != expected_usdc_repay_reserve_pubkey {
                    return Err(SolanaParseError::RepayReserveMismatch {
                        expected: *expected_usdc_repay_reserve_pubkey,
                        actual: *repay_reserve_pk,
                    });
                }

                verified_repay = Some((repay_amount_usdc, is_v2));
            } else {
                return Err(SolanaParseError::ForbiddenKaminoInstructionDiscriminator(disc));
            }
        } else {
            return Err(SolanaParseError::UnauthorizedProgram { program_id });
        }
    }

    // 5. If Versioned V0 message, verify address_table_lookups count == 0
    if is_versioned_v0 {
        let alt_count = read_compact_u16(raw_message, &mut offset)?;
        if alt_count != 0 {
            return Err(SolanaParseError::OpaqueAddressTableLookupsForbidden(alt_count));
        }
    }

    // 6. Ensure no trailing unparsed bytes exist
    if offset != raw_message.len() {
        return Err(SolanaParseError::TrailingBytes(raw_message.len() - offset));
    }

    let (repay_amount_usdc, is_v2_instruction) =
        verified_repay.ok_or(SolanaParseError::MissingKaminoRepayInstruction)?;

    Ok(VerifiedSolanaRepayMessage {
        is_versioned_v0,
        num_required_signatures,
        static_account_count: account_keys.len(),
        fee_payer_pubkey: *expected_mpc_solana_payer,
        recent_blockhash,
        obligation_pubkey: *expected_user_obligation_pubkey,
        lending_market_pubkey: *expected_lending_market_pubkey,
        repay_reserve_pubkey: *expected_usdc_repay_reserve_pubkey,
        repay_amount_usdc,
        is_v2_instruction,
        compute_budget_ix_count,
        kamino_refresh_ix_count,
    })
}

/// Deterministic builder for a serialized Solana `Message` (Legacy or V0) executing
/// ComputeBudget + Kamino Lend `repay_obligation_liquidity_v2`.
#[allow(clippy::too_many_arguments)]
pub fn build_solana_kamino_repay_message(
    versioned_v0: bool,
    mpc_solana_payer: &[u8; 32],
    user_obligation: &[u8; 32],
    lending_market: &[u8; 32],
    repay_reserve: &[u8; 32],
    reserve_destination_liquidity: &[u8; 32],
    user_source_liquidity: &[u8; 32],
    token_program: &[u8; 32],
    instruction_sysvar: &[u8; 32],
    recent_blockhash: &[u8; 32],
    repay_amount_usdc: u64,
    use_v2_discriminator: bool,
    include_compute_budget: bool,
) -> Vec<u8> {
    let mut msg = Vec::with_capacity(512);
    if versioned_v0 {
        msg.push(0x80); // V0 prefix
    }

    let readonly_unsigned_count = if include_compute_budget { 5u8 } else { 4u8 };
    msg.push(1);
    msg.push(0);
    msg.push(readonly_unsigned_count);

    let mut keys: Vec<[u8; 32]> = vec![
        *mpc_solana_payer,
        *user_obligation,
        *repay_reserve,
        *reserve_destination_liquidity,
        *user_source_liquidity,
        *lending_market,
        *token_program,
        *instruction_sysvar,
        KAMINO_LEND_PUBKEY,
    ];
    if include_compute_budget {
        keys.push(COMPUTE_BUDGET_PUBKEY);
    }

    encode_compact_u16(keys.len() as u16, &mut msg);
    for k in &keys {
        msg.extend_from_slice(k);
    }

    msg.extend_from_slice(recent_blockhash);

    let ix_count = if include_compute_budget { 2u16 } else { 1u16 };
    encode_compact_u16(ix_count, &mut msg);

    if include_compute_budget {
        msg.push(9); // program_id_index = 9 (COMPUTE_BUDGET_PUBKEY)
        encode_compact_u16(0, &mut msg);
        let mut cb_data = vec![0x02];
        cb_data.extend_from_slice(&400_000u32.to_le_bytes());
        encode_compact_u16(cb_data.len() as u16, &mut msg);
        msg.extend_from_slice(&cb_data);
    }

    msg.push(8); // program_id_index = 8 (KAMINO_LEND_PUBKEY)
    let kamino_acct_indices: [u8; 8] = [0, 1, 5, 2, 3, 4, 6, 7];
    encode_compact_u16(kamino_acct_indices.len() as u16, &mut msg);
    msg.extend_from_slice(&kamino_acct_indices);

    let mut ix_data = Vec::with_capacity(16);
    if use_v2_discriminator {
        ix_data.extend_from_slice(&REPAY_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR);
    } else {
        ix_data.extend_from_slice(&REPAY_OBLIGATION_LIQUIDITY_V1_DISCRIMINATOR);
    }
    ix_data.extend_from_slice(&repay_amount_usdc.to_le_bytes());
    encode_compact_u16(ix_data.len() as u16, &mut msg);
    msg.extend_from_slice(&ix_data);

    if versioned_v0 {
        encode_compact_u16(0, &mut msg);
    }

    msg
}

/// Deterministic builder for a realistic Solana Mainnet Kamino repayment transaction message containing:
/// `[ComputeBudget, refresh_reserve(SOL), refresh_reserve(USDC), refresh_obligation, repay_obligation_liquidity_v2]`
#[allow(clippy::too_many_arguments)]
pub fn build_solana_kamino_full_refresh_and_repay_message(
    versioned_v0: bool,
    mpc_solana_payer: &[u8; 32],
    user_obligation: &[u8; 32],
    lending_market: &[u8; 32],
    sol_reserve: &[u8; 32],
    usdc_repay_reserve: &[u8; 32],
    reserve_destination_liquidity: &[u8; 32],
    user_source_liquidity: &[u8; 32],
    pyth_sol_oracle: &[u8; 32],
    pyth_usdc_oracle: &[u8; 32],
    token_program: &[u8; 32],
    instruction_sysvar: &[u8; 32],
    recent_blockhash: &[u8; 32],
    repay_amount_usdc: u64,
) -> Vec<u8> {
    let mut msg = Vec::with_capacity(768);
    if versioned_v0 {
        msg.push(0x80);
    }

    // Header: 1 signer, 0 readonly signed, 7 readonly unsigned
    msg.push(1);
    msg.push(0);
    msg.push(7);

    // Static account keys:
    // [0] mpc_solana_payer (writable, signer)
    // [1] user_obligation (writable)
    // [2] sol_reserve (writable)
    // [3] usdc_repay_reserve (writable)
    // [4] reserve_destination_liquidity (writable)
    // [5] user_source_liquidity (writable)
    // [6] lending_market (readonly)
    // [7] pyth_sol_oracle (readonly)
    // [8] pyth_usdc_oracle (readonly)
    // [9] token_program (readonly)
    // [10] instruction_sysvar (readonly)
    // [11] kamino_lend_program (readonly)
    // [12] compute_budget_program (readonly)
    let keys: Vec<[u8; 32]> = vec![
        *mpc_solana_payer,
        *user_obligation,
        *sol_reserve,
        *usdc_repay_reserve,
        *reserve_destination_liquidity,
        *user_source_liquidity,
        *lending_market,
        *pyth_sol_oracle,
        *pyth_usdc_oracle,
        *token_program,
        *instruction_sysvar,
        KAMINO_LEND_PUBKEY,
        COMPUTE_BUDGET_PUBKEY,
    ];

    encode_compact_u16(keys.len() as u16, &mut msg);
    for k in &keys {
        msg.extend_from_slice(k);
    }

    msg.extend_from_slice(recent_blockhash);

    // 5 instructions:
    // 1. ComputeBudget::SetComputeUnitLimit(400_000)
    // 2. KLend::refresh_reserve (SOL reserve)
    // 3. KLend::refresh_reserve (USDC reserve)
    // 4. KLend::refresh_obligation (lending_market, user_obligation, sol_reserve, usdc_repay_reserve)
    // 5. KLend::repay_obligation_liquidity_v2
    encode_compact_u16(5, &mut msg);

    // Ix 1: ComputeBudget
    msg.push(12);
    encode_compact_u16(0, &mut msg);
    let mut cb_data = vec![0x02];
    cb_data.extend_from_slice(&400_000u32.to_le_bytes());
    encode_compact_u16(cb_data.len() as u16, &mut msg);
    msg.extend_from_slice(&cb_data);

    // Ix 2: refresh_reserve (SOL) -> accounts [sol_reserve=2, lending_market=6, pyth_sol_oracle=7]
    msg.push(11);
    let ref_sol_accts: [u8; 3] = [2, 6, 7];
    encode_compact_u16(ref_sol_accts.len() as u16, &mut msg);
    msg.extend_from_slice(&ref_sol_accts);
    encode_compact_u16(8, &mut msg);
    msg.extend_from_slice(&REFRESH_RESERVE_DISCRIMINATOR);

    // Ix 3: refresh_reserve (USDC) -> accounts [usdc_repay_reserve=3, lending_market=6, pyth_usdc_oracle=8]
    msg.push(11);
    let ref_usdc_accts: [u8; 3] = [3, 6, 8];
    encode_compact_u16(ref_usdc_accts.len() as u16, &mut msg);
    msg.extend_from_slice(&ref_usdc_accts);
    encode_compact_u16(8, &mut msg);
    msg.extend_from_slice(&REFRESH_RESERVE_DISCRIMINATOR);

    // Ix 4: refresh_obligation -> accounts [lending_market=6, user_obligation=1, sol_reserve=2, usdc_repay_reserve=3]
    msg.push(11);
    let ref_ob_accts: [u8; 4] = [6, 1, 2, 3];
    encode_compact_u16(ref_ob_accts.len() as u16, &mut msg);
    msg.extend_from_slice(&ref_ob_accts);
    encode_compact_u16(8, &mut msg);
    msg.extend_from_slice(&REFRESH_OBLIGATION_DISCRIMINATOR);

    // Ix 5: repay_obligation_liquidity_v2 -> accounts [owner=0, obligation=1, lending_market=6, repay_reserve=3, reserve_dest=4, user_source=5, token_program=9, sysvar=10]
    msg.push(11);
    let repay_accts: [u8; 8] = [0, 1, 6, 3, 4, 5, 9, 10];
    encode_compact_u16(repay_accts.len() as u16, &mut msg);
    msg.extend_from_slice(&repay_accts);
    let mut repay_data = Vec::with_capacity(16);
    repay_data.extend_from_slice(&REPAY_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR);
    repay_data.extend_from_slice(&repay_amount_usdc.to_le_bytes());
    encode_compact_u16(repay_data.len() as u16, &mut msg);
    msg.extend_from_slice(&repay_data);

    if versioned_v0 {
        encode_compact_u16(0, &mut msg);
    }

    msg
}
