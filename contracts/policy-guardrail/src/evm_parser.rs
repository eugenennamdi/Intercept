use near_sdk::serde::{Deserialize, Serialize};
use sha3::{Digest, Keccak256};

/// Base Mainnet EIP-155 chain ID (8453)
pub const BASE_MAINNET_CHAIN_ID: u64 = 8453;

/// Base Mainnet Native USDC contract address: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
pub const BASE_USDC_ADDRESS: [u8; 20] = [
    0x83, 0x35, 0x89, 0xfc, 0xd6, 0xed, 0xb6, 0xe0, 0x8f, 0x4c, 0x7c, 0x32, 0xd4, 0xf7, 0x1b, 0x54,
    0xbd, 0xa0, 0x29, 0x13,
];

/// EIP-2718 Transaction Type 2 (EIP-1559 Dynamic Fee Transaction)
pub const EIP1559_TX_TYPE: u8 = 0x02;

/// ERC-20 `transfer(address,uint256)` 4-byte function selector: `keccak256("transfer(address,uint256)")[0..4]`
pub const ERC20_TRANSFER_SELECTOR: [u8; 4] = [0xa9, 0x05, 0x9c, 0xbb];

/// ERC-20 `approve(address,uint256)` selector (explicitly forbidden)
pub const ERC20_APPROVE_SELECTOR: [u8; 4] = [0x09, 0x5e, 0xa7, 0xb3];

/// Minimum and maximum allowed EIP-1559 `gas_limit` for a Base Native USDC `transfer(address,uint256)`
/// (Standard Base USDC transfer uses ~55k-65k gas; capping at 250,000 blocks gas-limit griefing)
pub const MIN_ERC20_TRANSFER_GAS_LIMIT: u64 = 21_000;
pub const MAX_ERC20_TRANSFER_GAS_LIMIT: u64 = 250_000;

/// Maximum allowed EIP-1559 `max_fee_per_gas` on Base Mainnet (50 gwei = 50,000,000,000 wei).
/// Prevents a compromised AI agent from draining the MPC Base Vault's ETH gas reserve via MEV builder bribes.
pub const MAX_ALLOWED_BASE_FEE_PER_GAS_WEI: u128 = 50_000_000_000;

/// Decoded and verified fields of an unsigned EIP-1559 Base USDC transfer transaction
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct VerifiedEvmTransfer {
    pub chain_id: u64,
    pub nonce: u64,
    pub max_priority_fee_per_gas: u128,
    pub max_fee_per_gas: u128,
    pub gas_limit: u64,
    pub token_contract: [u8; 20],
    pub eth_value: u128,
    pub recipient_deposit_address: [u8; 20],
    pub transfer_amount_usdc: u128,
    pub signing_hash_keccak256: [u8; 32],
}

/// Detailed error variants for zero-trust EVM Leg 1 transaction inspection
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EvmParseError {
    EmptyPayload,
    InvalidTransactionType(u8),
    MalformedRlp(&'static str),
    UnexpectedItemCount(usize),
    InvalidChainId { expected: u64, actual: u64 },
    GasLimitOutOfBounds { min: u64, max: u64, actual: u64 },
    MaxFeePerGasExceeded { max_allowed_wei: u128, actual_wei: u128 },
    PriorityFeeExceedsMaxFee { priority_fee_wei: u128, max_fee_wei: u128 },
    InvalidTargetContract { expected: [u8; 20], actual: Vec<u8> },
    NonZeroNativeValue(u128),
    InvalidCalldataLength(usize),
    ForbiddenFunctionSelector([u8; 4]),
    NonZeroAddressPadding,
    DepositAddressMismatch { expected: [u8; 20], actual: [u8; 20] },
    AmountOverflowU128,
    TransferAmountMismatch { expected: u128, actual: u128 },
    NonEmptyAccessList,
}

impl core::fmt::Display for EvmParseError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            EvmParseError::EmptyPayload => write!(f, "EVM payload cannot be empty"),
            EvmParseError::InvalidTransactionType(t) => {
                write!(f, "Expected EIP-1559 type 0x02, got 0x{:02x}", t)
            }
            EvmParseError::MalformedRlp(reason) => write!(f, "Malformed RLP encoding: {}", reason),
            EvmParseError::UnexpectedItemCount(n) => {
                write!(f, "Unsigned EIP-1559 RLP list must have 9 items, got {}", n)
            }
            EvmParseError::InvalidChainId { expected, actual } => {
                write!(f, "Invalid chain_id: expected {} (Base Mainnet), got {}", expected, actual)
            }
            EvmParseError::GasLimitOutOfBounds { min, max, actual } => {
                write!(
                    f,
                    "EIP-1559 gas_limit {} outside allowed guardrail bounds [{}..={}]",
                    actual, min, max
                )
            }
            EvmParseError::MaxFeePerGasExceeded {
                max_allowed_wei,
                actual_wei,
            } => {
                write!(
                    f,
                    "CRITICAL GAS-GRIEFING BLOCK: EIP-1559 max_fee_per_gas ({} wei) exceeds guardrail cap ({} wei)",
                    actual_wei, max_allowed_wei
                )
            }
            EvmParseError::PriorityFeeExceedsMaxFee {
                priority_fee_wei,
                max_fee_wei,
            } => {
                write!(
                    f,
                    "Invalid EIP-1559 fee bounds: max_priority_fee_per_gas ({} wei) > max_fee_per_gas ({} wei)",
                    priority_fee_wei, max_fee_wei
                )
            }
            EvmParseError::InvalidTargetContract { expected, actual } => {
                write!(
                    f,
                    "Invalid target contract: expected Base USDC 0x{}, got 0x{}",
                    hex::encode(expected),
                    hex::encode(actual)
                )
            }
            EvmParseError::NonZeroNativeValue(val) => {
                write!(f, "Native ETH value must be 0, got {} wei", val)
            }
            EvmParseError::InvalidCalldataLength(len) => {
                write!(f, "ERC-20 transfer calldata must be exactly 68 bytes, got {}", len)
            }
            EvmParseError::ForbiddenFunctionSelector(sel) => {
                if *sel == ERC20_APPROVE_SELECTOR {
                    write!(f, "ERC-20 approve (0x095ea7b3) is strictly forbidden; only direct transfer (0xa9059cbb) is permitted")
                } else {
                    write!(
                        f,
                        "Invalid ERC-20 selector 0x{}; expected transfer 0xa9059cbb",
                        hex::encode(sel)
                    )
                }
            }
            EvmParseError::NonZeroAddressPadding => {
                write!(f, "ABI address parameter has non-zero top 12 padding bytes")
            }
            EvmParseError::DepositAddressMismatch { expected, actual } => {
                write!(
                    f,
                    "ERC-20 transfer recipient 0x{} does not match approved 1-Click depositAddress 0x{}",
                    hex::encode(actual),
                    hex::encode(expected)
                )
            }
            EvmParseError::AmountOverflowU128 => {
                write!(f, "ERC-20 transfer amount overflows u128")
            }
            EvmParseError::TransferAmountMismatch { expected, actual } => {
                write!(
                    f,
                    "ERC-20 transfer amount {} does not match approved repay_amount_usdc {}",
                    actual, expected
                )
            }
            EvmParseError::NonEmptyAccessList => {
                write!(f, "Unsigned EIP-1559 transaction accessList must be empty")
            }
        }
    }
}

/// Internal RLP item representation
#[derive(Debug, Clone, PartialEq, Eq)]
enum RlpItem<'a> {
    Bytes(&'a [u8]),
    List(Vec<RlpItem<'a>>),
}

/// Canonical RLP decoder that rejects non-canonical length prefixes, leading zeroes, and trailing bytes.
fn decode_rlp_item(input: &[u8]) -> Result<(RlpItem<'_>, &[u8]), EvmParseError> {
    if input.is_empty() {
        return Err(EvmParseError::MalformedRlp("unexpected end of RLP input"));
    }
    let prefix = input[0];
    match prefix {
        0x00..=0x7f => Ok((RlpItem::Bytes(&input[0..1]), &input[1..])),
        0x80..=0xb7 => {
            let len = (prefix - 0x80) as usize;
            if input.len() < 1 + len {
                return Err(EvmParseError::MalformedRlp("short string exceeds input length"));
            }
            let data = &input[1..1 + len];
            if len == 1 && data[0] < 0x80 {
                return Err(EvmParseError::MalformedRlp(
                    "non-canonical single byte < 0x80 encoded with 0x81 prefix",
                ));
            }
            Ok((RlpItem::Bytes(data), &input[1 + len..]))
        }
        0xb8..=0xbf => {
            let len_of_len = (prefix - 0xb7) as usize;
            if input.len() < 1 + len_of_len {
                return Err(EvmParseError::MalformedRlp("long string length prefix truncated"));
            }
            let len_bytes = &input[1..1 + len_of_len];
            if len_bytes[0] == 0 {
                return Err(EvmParseError::MalformedRlp(
                    "non-canonical leading zero in long string length",
                ));
            }
            let len = parse_be_usize(len_bytes)?;
            if len < 56 {
                return Err(EvmParseError::MalformedRlp(
                    "non-canonical long string prefix for payload < 56 bytes",
                ));
            }
            if input.len() < 1 + len_of_len + len {
                return Err(EvmParseError::MalformedRlp("long string payload truncated"));
            }
            let data = &input[1 + len_of_len..1 + len_of_len + len];
            Ok((RlpItem::Bytes(data), &input[1 + len_of_len + len..]))
        }
        0xc0..=0xf7 => {
            let total_len = (prefix - 0xc0) as usize;
            if input.len() < 1 + total_len {
                return Err(EvmParseError::MalformedRlp("short list exceeds input length"));
            }
            let mut list_slice = &input[1..1 + total_len];
            let mut items = Vec::new();
            while !list_slice.is_empty() {
                let (item, rest) = decode_rlp_item(list_slice)?;
                items.push(item);
                list_slice = rest;
            }
            Ok((RlpItem::List(items), &input[1 + total_len..]))
        }
        0xf8..=0xff => {
            let len_of_len = (prefix - 0xf7) as usize;
            if input.len() < 1 + len_of_len {
                return Err(EvmParseError::MalformedRlp("long list length prefix truncated"));
            }
            let len_bytes = &input[1..1 + len_of_len];
            if len_bytes[0] == 0 {
                return Err(EvmParseError::MalformedRlp(
                    "non-canonical leading zero in long list length",
                ));
            }
            let total_len = parse_be_usize(len_bytes)?;
            if total_len < 56 {
                return Err(EvmParseError::MalformedRlp(
                    "non-canonical long list prefix for payload < 56 bytes",
                ));
            }
            if input.len() < 1 + len_of_len + total_len {
                return Err(EvmParseError::MalformedRlp("long list payload truncated"));
            }
            let mut list_slice = &input[1 + len_of_len..1 + len_of_len + total_len];
            let mut items = Vec::new();
            while !list_slice.is_empty() {
                let (item, rest) = decode_rlp_item(list_slice)?;
                items.push(item);
                list_slice = rest;
            }
            Ok((RlpItem::List(items), &input[1 + len_of_len + total_len..]))
        }
    }
}

fn parse_be_usize(bytes: &[u8]) -> Result<usize, EvmParseError> {
    if bytes.len() > core::mem::size_of::<usize>() {
        return Err(EvmParseError::MalformedRlp("length integer overflow"));
    }
    let mut val: usize = 0;
    for &b in bytes {
        val = (val << 8) | (b as usize);
    }
    Ok(val)
}

fn decode_canonical_u64(item: &RlpItem<'_>) -> Result<u64, EvmParseError> {
    match item {
        RlpItem::Bytes(bytes) => {
            if bytes.is_empty() {
                return Ok(0);
            }
            if bytes[0] == 0 {
                return Err(EvmParseError::MalformedRlp(
                    "non-canonical RLP integer with leading zero byte",
                ));
            }
            if bytes.len() > 8 {
                return Err(EvmParseError::MalformedRlp("RLP integer overflows u64"));
            }
            let mut acc: u64 = 0;
            for &b in *bytes {
                acc = (acc << 8) | (b as u64);
            }
            Ok(acc)
        }
        RlpItem::List(_) => Err(EvmParseError::MalformedRlp("expected integer bytes, got list")),
    }
}

fn decode_canonical_u128(item: &RlpItem<'_>) -> Result<u128, EvmParseError> {
    match item {
        RlpItem::Bytes(bytes) => {
            if bytes.is_empty() {
                return Ok(0);
            }
            if bytes[0] == 0 {
                return Err(EvmParseError::MalformedRlp(
                    "non-canonical RLP integer with leading zero byte",
                ));
            }
            if bytes.len() > 16 {
                return Err(EvmParseError::MalformedRlp("RLP integer overflows u128"));
            }
            let mut acc: u128 = 0;
            for &b in *bytes {
                acc = (acc << 8) | (b as u128);
            }
            Ok(acc)
        }
        RlpItem::List(_) => Err(EvmParseError::MalformedRlp("expected integer bytes, got list")),
    }
}

/// Parses and strictly verifies a raw unsigned EIP-1559 transaction payload (`0x02 || rlp(...)`)
/// against Intercept's Leg 1 Base USDC Guardrail invariants.
pub fn verify_eip1559_base_usdc_transfer(
    raw_unsigned_tx: &[u8],
    expected_deposit_address: &[u8; 20],
    expected_repay_amount_usdc: u128,
) -> Result<VerifiedEvmTransfer, EvmParseError> {
    if raw_unsigned_tx.is_empty() {
        return Err(EvmParseError::EmptyPayload);
    }

    // 1. Assert EIP-2718 Type 2 (EIP-1559) transaction envelope byte
    if raw_unsigned_tx[0] != EIP1559_TX_TYPE {
        return Err(EvmParseError::InvalidTransactionType(raw_unsigned_tx[0]));
    }

    // 2. Decode canonical RLP payload and ensure zero trailing bytes
    let (root, trailing) = decode_rlp_item(&raw_unsigned_tx[1..])?;
    if !trailing.is_empty() {
        return Err(EvmParseError::MalformedRlp("trailing bytes after EIP-1559 RLP list"));
    }

    let items = match root {
        RlpItem::List(list) => list,
        RlpItem::Bytes(_) => {
            return Err(EvmParseError::MalformedRlp("EIP-1559 payload must be an RLP list"))
        }
    };

    // Unsigned EIP-1559 payload has exactly 9 items:
    // [chain_id, nonce, max_priority_fee_per_gas, max_fee_per_gas, gas_limit, to, value, data, access_list]
    if items.len() != 9 {
        return Err(EvmParseError::UnexpectedItemCount(items.len()));
    }

    // 3. Assert chain_id == 8453 (Base Mainnet)
    let chain_id = decode_canonical_u64(&items[0])?;
    if chain_id != BASE_MAINNET_CHAIN_ID {
        return Err(EvmParseError::InvalidChainId {
            expected: BASE_MAINNET_CHAIN_ID,
            actual: chain_id,
        });
    }

    let nonce = decode_canonical_u64(&items[1])?;
    let max_priority_fee_per_gas = decode_canonical_u128(&items[2])?;
    let max_fee_per_gas = decode_canonical_u128(&items[3])?;
    let gas_limit = decode_canonical_u64(&items[4])?;

    // 3b. Enforce EIP-1559 gas-limit and priority/base fee bounds to block ETH gas-griefing drains
    if gas_limit < MIN_ERC20_TRANSFER_GAS_LIMIT || gas_limit > MAX_ERC20_TRANSFER_GAS_LIMIT {
        return Err(EvmParseError::GasLimitOutOfBounds {
            min: MIN_ERC20_TRANSFER_GAS_LIMIT,
            max: MAX_ERC20_TRANSFER_GAS_LIMIT,
            actual: gas_limit,
        });
    }
    if max_fee_per_gas == 0 || max_fee_per_gas > MAX_ALLOWED_BASE_FEE_PER_GAS_WEI {
        return Err(EvmParseError::MaxFeePerGasExceeded {
            max_allowed_wei: MAX_ALLOWED_BASE_FEE_PER_GAS_WEI,
            actual_wei: max_fee_per_gas,
        });
    }
    if max_priority_fee_per_gas > max_fee_per_gas {
        return Err(EvmParseError::PriorityFeeExceedsMaxFee {
            priority_fee_wei: max_priority_fee_per_gas,
            max_fee_wei: max_fee_per_gas,
        });
    }

    // 4. Assert `to` == Base Native USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
    let to_bytes = match &items[5] {
        RlpItem::Bytes(b) => *b,
        RlpItem::List(_) => return Err(EvmParseError::MalformedRlp("`to` field must be bytes")),
    };
    if to_bytes != BASE_USDC_ADDRESS {
        return Err(EvmParseError::InvalidTargetContract {
            expected: BASE_USDC_ADDRESS,
            actual: to_bytes.to_vec(),
        });
    }

    // 5. Assert `value` == 0 (never allow native ETH transfer)
    let eth_value = decode_canonical_u128(&items[6])?;
    if eth_value != 0 {
        return Err(EvmParseError::NonZeroNativeValue(eth_value));
    }

    // 6. Assert `data` is 68 bytes starting with `0xa9059cbb` (`transfer(address,uint256)`)
    let data = match &items[7] {
        RlpItem::Bytes(b) => *b,
        RlpItem::List(_) => return Err(EvmParseError::MalformedRlp("`data` field must be bytes")),
    };
    if data.len() != 68 {
        return Err(EvmParseError::InvalidCalldataLength(data.len()));
    }

    let mut selector = [0u8; 4];
    selector.copy_from_slice(&data[0..4]);
    if selector != ERC20_TRANSFER_SELECTOR {
        return Err(EvmParseError::ForbiddenFunctionSelector(selector));
    }

    // Assert top 12 bytes of ABI-encoded address word data[4..36] are all zero
    if data[4..16] != [0u8; 12] {
        return Err(EvmParseError::NonZeroAddressPadding);
    }

    let mut recipient_deposit_address = [0u8; 20];
    recipient_deposit_address.copy_from_slice(&data[16..36]);
    if &recipient_deposit_address != expected_deposit_address {
        return Err(EvmParseError::DepositAddressMismatch {
            expected: *expected_deposit_address,
            actual: recipient_deposit_address,
        });
    }

    // Assert top 16 bytes of uint256 amount word data[36..68] are all zero
    if data[36..52] != [0u8; 16] {
        return Err(EvmParseError::AmountOverflowU128);
    }

    let mut amount_bytes = [0u8; 16];
    amount_bytes.copy_from_slice(&data[52..68]);
    let transfer_amount_usdc = u128::from_be_bytes(amount_bytes);

    if transfer_amount_usdc != expected_repay_amount_usdc {
        return Err(EvmParseError::TransferAmountMismatch {
            expected: expected_repay_amount_usdc,
            actual: transfer_amount_usdc,
        });
    }

    // 7. Assert access_list is empty
    match &items[8] {
        RlpItem::List(access_list) => {
            if !access_list.is_empty() {
                return Err(EvmParseError::NonEmptyAccessList);
            }
        }
        RlpItem::Bytes(_) => {
            return Err(EvmParseError::MalformedRlp("access_list must be an RLP list"))
        }
    }

    // 8. Compute keccak256 digest of the unsigned EIP-1559 transaction payload
    let signing_hash_keccak256 = keccak256_bytes(raw_unsigned_tx);

    Ok(VerifiedEvmTransfer {
        chain_id,
        nonce,
        max_priority_fee_per_gas,
        max_fee_per_gas,
        gas_limit,
        token_contract: BASE_USDC_ADDRESS,
        eth_value,
        recipient_deposit_address,
        transfer_amount_usdc,
        signing_hash_keccak256,
    })
}

/// Computes the 32-byte Keccak-256 digest of a byte slice
pub fn keccak256_bytes(data: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    hasher.update(data);
    let digest = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&digest);
    out
}

/// Canonical RLP helper to encode unsigned integers
pub fn rlp_encode_u128(val: u128) -> Vec<u8> {
    if val == 0 {
        return vec![0x80];
    }
    let be = val.to_be_bytes();
    let first_non_zero = be.iter().position(|&b| b != 0).unwrap_or(16);
    let significant = &be[first_non_zero..];
    rlp_encode_bytes(significant)
}

/// Canonical RLP helper to encode a byte slice
pub fn rlp_encode_bytes(bytes: &[u8]) -> Vec<u8> {
    if bytes.len() == 1 && bytes[0] < 0x80 {
        return vec![bytes[0]];
    }
    if bytes.len() <= 55 {
        let mut out = Vec::with_capacity(1 + bytes.len());
        out.push(0x80 + (bytes.len() as u8));
        out.extend_from_slice(bytes);
        out
    } else {
        let len_be = (bytes.len() as u64).to_be_bytes();
        let first_nz = len_be.iter().position(|&b| b != 0).unwrap_or(7);
        let len_bytes = &len_be[first_nz..];
        let mut out = Vec::with_capacity(1 + len_bytes.len() + bytes.len());
        out.push(0xb7 + (len_bytes.len() as u8));
        out.extend_from_slice(len_bytes);
        out.extend_from_slice(bytes);
        out
    }
}

/// Canonical RLP helper to wrap encoded items in a list
pub fn rlp_encode_list(encoded_items: &[Vec<u8>]) -> Vec<u8> {
    let payload_len: usize = encoded_items.iter().map(|v| v.len()).sum();
    let mut out = Vec::new();
    if payload_len <= 55 {
        out.push(0xc0 + (payload_len as u8));
    } else {
        let len_be = (payload_len as u64).to_be_bytes();
        let first_nz = len_be.iter().position(|&b| b != 0).unwrap_or(7);
        let len_bytes = &len_be[first_nz..];
        out.push(0xf7 + (len_bytes.len() as u8));
        out.extend_from_slice(len_bytes);
    }
    for item in encoded_items {
        out.extend_from_slice(item);
    }
    out
}

/// Deterministic builder for an unsigned EIP-1559 transaction payload (`0x02 || rlp(...)`)
pub fn build_unsigned_eip1559_tx(
    chain_id: u64,
    nonce: u64,
    max_priority_fee_per_gas: u128,
    max_fee_per_gas: u128,
    gas_limit: u64,
    to: &[u8; 20],
    value: u128,
    data: &[u8],
) -> Vec<u8> {
    let items = vec![
        rlp_encode_u128(chain_id as u128),
        rlp_encode_u128(nonce as u128),
        rlp_encode_u128(max_priority_fee_per_gas),
        rlp_encode_u128(max_fee_per_gas),
        rlp_encode_u128(gas_limit as u128),
        rlp_encode_bytes(to),
        rlp_encode_u128(value),
        rlp_encode_bytes(data),
        vec![0xc0], // empty access_list
    ];
    let rlp_list = rlp_encode_list(&items);
    let mut payload = Vec::with_capacity(1 + rlp_list.len());
    payload.push(EIP1559_TX_TYPE);
    payload.extend_from_slice(&rlp_list);
    payload
}

/// Builds 68-byte ERC-20 `transfer(address,uint256)` calldata
pub fn build_erc20_transfer_calldata(recipient: &[u8; 20], amount: u128) -> [u8; 68] {
    let mut data = [0u8; 68];
    data[0..4].copy_from_slice(&ERC20_TRANSFER_SELECTOR);
    // bytes 4..16 are zero padding
    data[16..36].copy_from_slice(recipient);
    // bytes 36..52 are zero padding
    data[52..68].copy_from_slice(&amount.to_be_bytes());
    data
}
