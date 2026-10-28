use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::env;
use near_sdk::serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Canonical domain separator prefix for TEE Decision Receipts signed by the NEAR AI Cloud enclave
pub const TEE_RECEIPT_DOMAIN_PREFIX: &str = "INTERCEPT_TEE_RECEIPT_V1";

/// Supported quantitative risk regimes emitted by the Intercept TEE Risk Engine
#[derive(
    Debug,
    Clone,
    PartialEq,
    Eq,
    BorshDeserialize,
    BorshSerialize,
    Serialize,
    Deserialize,
)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub enum RiskRegime {
    /// Safe Health Factor and low downward price velocity -> No action permitted
    #[serde(rename = "HOLD")]
    Hold,
    /// Mild HF breach (e.g. 1.10 <= HF < 1.15) with low volatility -> Repay to restore HF = 1.20
    #[serde(rename = "MICRO_BUFFER_RESCUE")]
    MicroBufferRescue,
    /// HF breach or imminent danger accompanied by high volatility spike -> Repay to restore HF = 1.45
    #[serde(rename = "CASCADE_DEEP_RESCUE")]
    CascadeDeepRescue,
}

impl RiskRegime {
    pub fn as_str(&self) -> &'static str {
        match self {
            RiskRegime::Hold => "HOLD",
            RiskRegime::MicroBufferRescue => "MICRO_BUFFER_RESCUE",
            RiskRegime::CascadeDeepRescue => "CASCADE_DEEP_RESCUE",
        }
    }

    pub fn is_rescue_actionable(&self) -> bool {
        matches!(
            self,
            RiskRegime::MicroBufferRescue | RiskRegime::CascadeDeepRescue
        )
    }
}

/// Deterministic decision receipt produced and Ed25519-signed by the NEAR AI Cloud TEE agent
#[derive(
    Debug,
    Clone,
    PartialEq,
    Eq,
    BorshDeserialize,
    BorshSerialize,
    Serialize,
    Deserialize,
)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct TeeDecisionReceipt {
    /// Unix timestamp in seconds when the telemetry & quote were evaluated inside the TEE
    pub timestamp: u64,
    /// Base58-encoded Solana Kamino Obligation PDA public key
    pub obligation_pubkey: String,
    /// Observed Kamino Health Factor in basis points (e.g., 10850 = 1.0850 HF)
    pub observed_hf_bps: u32,
    /// Short-term annualized/realized SOL volatility in basis points from Pyth Hermes feed
    pub volatility_bps: u32,
    /// Selected dynamic de-risking regime (`HOLD`, `MICRO_BUFFER_RESCUE`, `CASCADE_DEEP_RESCUE`)
    pub regime: RiskRegime,
    /// Exact Base USDC repayment amount in 6-decimal micro-USDC (e.g., 2_500_000 = 2.50 USDC)
    pub repay_amount_usdc: u128,
    /// Hex-encoded 20-byte NEAR Intents 1-Click deposit address on Base (`0x...`)
    pub oneclick_deposit_address: String,
    /// Guaranteed minimum output on Solana in 6-decimal micro-USDC from 1-Click quote
    pub min_amount_out: u128,
    /// Hex-encoded 32-byte SHA-256 hash of the full quantitative reasoning trace & Pyth price proof
    pub reasoning_hash: String,
    /// Hex-encoded 64-byte Ed25519 signature over `canonical_signing_payload()`
    pub enclave_signature_hex: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TeeReceiptError {
    NonActionableRegime,
    InvalidTimestamp {
        receipt_ts: u64,
        current_ts: u64,
        max_age_sec: u64,
    },
    InvalidObligationBase58,
    ObligationMismatch {
        expected_b58: String,
        actual_b58: String,
    },
    ZeroRepayAmount,
    InvalidDepositAddressHex,
    SlippageExceeded {
        repay_amount_usdc: u128,
        min_amount_out: u128,
        required_min_out: u128,
        max_slippage_bps: u16,
    },
    InvalidReasoningHashHex,
    InvalidSignatureHex,
    Ed25519VerificationFailed,
}

impl core::fmt::Display for TeeReceiptError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            TeeReceiptError::NonActionableRegime => {
                write!(f, "TEE Decision Receipt regime is HOLD; rescue execution is forbidden")
            }
            TeeReceiptError::InvalidTimestamp {
                receipt_ts,
                current_ts,
                max_age_sec,
            } => {
                write!(
                    f,
                    "TEE Decision Receipt timestamp {} expired or invalid relative to current block timestamp {} (max_age={}s)",
                    receipt_ts, current_ts, max_age_sec
                )
            }
            TeeReceiptError::InvalidObligationBase58 => {
                write!(f, "Invalid Base58 obligation_pubkey in TEE receipt")
            }
            TeeReceiptError::ObligationMismatch {
                expected_b58,
                actual_b58,
            } => {
                write!(
                    f,
                    "TEE receipt obligation_pubkey {} does not match policy obligation {}",
                    actual_b58, expected_b58
                )
            }
            TeeReceiptError::ZeroRepayAmount => {
                write!(f, "TEE receipt repay_amount_usdc must be > 0")
            }
            TeeReceiptError::InvalidDepositAddressHex => {
                write!(
                    f,
                    "TEE receipt oneclick_deposit_address must be a valid 20-byte hex address"
                )
            }
            TeeReceiptError::SlippageExceeded {
                repay_amount_usdc,
                min_amount_out,
                required_min_out,
                max_slippage_bps,
            } => {
                write!(
                    f,
                    "1-Click quote min_amount_out ({}) violates policy max_slippage_bps ({} bps) for repay_amount_usdc ({}); required >= {}",
                    min_amount_out, max_slippage_bps, repay_amount_usdc, required_min_out
                )
            }
            TeeReceiptError::InvalidReasoningHashHex => {
                write!(f, "TEE receipt reasoning_hash must be a valid 32-byte hex string")
            }
            TeeReceiptError::InvalidSignatureHex => {
                write!(
                    f,
                    "TEE receipt enclave_signature_hex must be a valid 64-byte hex string"
                )
            }
            TeeReceiptError::Ed25519VerificationFailed => {
                write!(
                    f,
                    "CRITICAL SECURITY BLOCK: Ed25519 signature verification failed against registered TEE enclave public key"
                )
            }
        }
    }
}

impl TeeDecisionReceipt {
    /// Normalizes a hex string by stripping an optional `0x` or `0X` prefix and lowercasing
    pub fn normalize_hex(s: &str) -> String {
        let stripped = s
            .strip_prefix("0x")
            .or_else(|| s.strip_prefix("0X"))
            .unwrap_or(s);
        stripped.to_ascii_lowercase()
    }

    /// Constructs the deterministic ASCII signing payload signed by the TEE enclave's Ed25519 key:
    /// `INTERCEPT_TEE_RECEIPT_V1|{timestamp}|{obligation_pubkey}|{observed_hf_bps}|{volatility_bps}|{regime}|{repay_amount_usdc}|{oneclick_deposit_address_lower}|{min_amount_out}|{reasoning_hash_lower}`
    pub fn canonical_signing_payload(&self) -> String {
        let deposit_norm = Self::normalize_hex(&self.oneclick_deposit_address);
        let reasoning_norm = Self::normalize_hex(&self.reasoning_hash);
        format!(
            "{}|{}|{}|{}|{}|{}|{}|0x{}|{}|0x{}",
            TEE_RECEIPT_DOMAIN_PREFIX,
            self.timestamp,
            self.obligation_pubkey,
            self.observed_hf_bps,
            self.volatility_bps,
            self.regime.as_str(),
            self.repay_amount_usdc,
            deposit_norm,
            self.min_amount_out,
            reasoning_norm
        )
    }

    /// Computes the 32-byte SHA-256 digest of the canonical receipt payload (used for replay protection)
    pub fn receipt_hash(&self) -> [u8; 32] {
        let payload = self.canonical_signing_payload();
        let mut hasher = Sha256::new();
        hasher.update(payload.as_bytes());
        let digest = hasher.finalize();
        let mut out = [0u8; 32];
        out.copy_from_slice(&digest);
        out
    }

    /// Decodes the 20-byte Base deposit address from `oneclick_deposit_address`
    pub fn decode_deposit_address(&self) -> Result<[u8; 20], TeeReceiptError> {
        let norm = Self::normalize_hex(&self.oneclick_deposit_address);
        let bytes = hex::decode(norm).map_err(|_| TeeReceiptError::InvalidDepositAddressHex)?;
        if bytes.len() != 20 {
            return Err(TeeReceiptError::InvalidDepositAddressHex);
        }
        let mut arr = [0u8; 20];
        arr.copy_from_slice(&bytes);
        Ok(arr)
    }

    /// Verifies all cryptographic, temporal, slippage, and obligation invariants of the TEE receipt
    pub fn verify(
        &self,
        expected_enclave_pubkey: &[u8; 32],
        expected_obligation_pubkey: &[u8; 32],
        max_slippage_bps: u16,
        current_timestamp_sec: u64,
        max_receipt_age_sec: u64,
    ) -> Result<[u8; 20], TeeReceiptError> {
        // 1. Regime must be actionable
        if !self.regime.is_rescue_actionable() {
            return Err(TeeReceiptError::NonActionableRegime);
        }

        // 2. Timestamp freshness check
        if self.timestamp + max_receipt_age_sec < current_timestamp_sec
            || self.timestamp > current_timestamp_sec + 60
        {
            return Err(TeeReceiptError::InvalidTimestamp {
                receipt_ts: self.timestamp,
                current_ts: current_timestamp_sec,
                max_age_sec: max_receipt_age_sec,
            });
        }

        // 3. Obligation pubkey check
        let ob_bytes = bs58::decode(&self.obligation_pubkey)
            .into_vec()
            .map_err(|_| TeeReceiptError::InvalidObligationBase58)?;
        if ob_bytes.len() != 32 || ob_bytes.as_slice() != expected_obligation_pubkey {
            return Err(TeeReceiptError::ObligationMismatch {
                expected_b58: bs58::encode(expected_obligation_pubkey).into_string(),
                actual_b58: self.obligation_pubkey.clone(),
            });
        }

        // 4. Repay amount & slippage check
        if self.repay_amount_usdc == 0 {
            return Err(TeeReceiptError::ZeroRepayAmount);
        }
        let required_min_out =
            (self.repay_amount_usdc * (10_000u128 - (max_slippage_bps as u128))) / 10_000u128;
        if self.min_amount_out < required_min_out {
            return Err(TeeReceiptError::SlippageExceeded {
                repay_amount_usdc: self.repay_amount_usdc,
                min_amount_out: self.min_amount_out,
                required_min_out,
                max_slippage_bps,
            });
        }

        // 5. Validate reasoning_hash is 32-byte hex
        let reasoning_bytes = hex::decode(Self::normalize_hex(&self.reasoning_hash))
            .map_err(|_| TeeReceiptError::InvalidReasoningHashHex)?;
        if reasoning_bytes.len() != 32 {
            return Err(TeeReceiptError::InvalidReasoningHashHex);
        }

        // 6. Decode 20-byte deposit address
        let deposit_address = self.decode_deposit_address()?;

        // 7. Decode 64-byte Ed25519 signature and verify against registered TEE enclave pubkey
        let sig_bytes = hex::decode(Self::normalize_hex(&self.enclave_signature_hex))
            .map_err(|_| TeeReceiptError::InvalidSignatureHex)?;
        if sig_bytes.len() != 64 {
            return Err(TeeReceiptError::InvalidSignatureHex);
        }
        let mut sig_arr = [0u8; 64];
        sig_arr.copy_from_slice(&sig_bytes);

        let canonical_msg = self.canonical_signing_payload();
        let valid = env::ed25519_verify(&sig_arr, canonical_msg.as_bytes(), expected_enclave_pubkey);
        if !valid {
            return Err(TeeReceiptError::Ed25519VerificationFailed);
        }

        Ok(deposit_address)
    }
}
