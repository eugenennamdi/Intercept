pub mod evm_parser;
pub mod solana_parser;
pub mod tee_receipt;

#[cfg(test)]
mod tests;

use evm_parser::{verify_eip1559_base_usdc_transfer, VerifiedEvmTransfer};
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, log, near, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseError};
use solana_parser::{
    verify_solana_kamino_repay_message, VerifiedSolanaRepayMessage,
    KAMINO_MAINNET_SOL_RESERVE_ID_STR, KAMINO_MAINNET_USDC_RESERVE_ID_STR,
};
use std::collections::{BTreeMap, BTreeSet};
use tee_receipt::TeeDecisionReceipt;

/// Default gas attached to `v1.signer::sign` cross-contract call (250 TGas required by NEAR MPC threshold signing)
pub const MPC_SIGN_GAS: Gas = Gas::from_tgas(250);

/// Gas reserved for the local `on_origin_leg_signed` / `on_destination_leg_signed` callback (30 TGas)
pub const MPC_CALLBACK_GAS: Gas = Gas::from_tgas(30);

/// Seconds in a 24-hour rolling spending limit window
pub const ROLLING_WINDOW_SECONDS: u64 = 86_400;

/// NEAR Chain Signatures (`v1.signer`) domain IDs:
/// `0` = Secp256k1 (EVM / Base Mainnet)
/// `1` = Ed25519 (Solana Mainnet)
pub const DOMAIN_ID_SECP256K1: u32 = 0;
pub const DOMAIN_ID_ED25519: u32 = 1;

fn default_sol_collateral_reserve_pubkey() -> String {
    KAMINO_MAINNET_SOL_RESERVE_ID_STR.to_string()
}

fn default_usdc_repay_reserve_pubkey() -> String {
    KAMINO_MAINNET_USDC_RESERVE_ID_STR.to_string()
}

/// Strict 4-state asynchronous cross-contract TOCTOU lifecycle per `receipt_hash`
#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    BorshDeserialize,
    BorshSerialize,
    Serialize,
    Deserialize,
)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub enum RescueLifecycleState {
    /// Leg 1 `v1.signer::sign` promise dispatched; 24h spending cap already deducted
    InFlightLeg1,
    /// Leg 1 `on_origin_leg_signed` succeeded; awaiting Leg 2 Solana Kamino repayment
    ReadyForLeg2,
    /// Leg 2 `v1.signer::sign` promise dispatched; concurrent Leg 2 calls blocked
    InFlightLeg2,
    /// Leg 2 `on_destination_leg_signed` succeeded; cross-chain rescue finalized
    Completed,
}

/// User-configured security policy and deterministic cross-chain vault configuration
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
pub struct PolicyConfig {
    /// Human owner account on NEAR with full key control to update policy parameters
    pub owner_id: AccountId,
    /// Scoped AI agent account permitted ONLY to invoke `request_rescue_origin_leg` and `request_rescue_destination_leg`
    pub authorized_agent_id: AccountId,
    /// NEAR Chain Signatures MPC contract account (`v1.signer` on mainnet)
    pub mpc_signer_contract: AccountId,
    /// Hex-encoded 32-byte Ed25519 public key of the registered NEAR AI Cloud TEE enclave
    pub tee_enclave_pubkey_hex: String,
    /// Hex-encoded 20-byte MPC-derived Base Vault address (`0x...`, `domain_id: 0`)
    pub mpc_base_vault_address_hex: String,
    /// Base58-encoded 32-byte MPC-derived Solana Payer public key (`domain_id: 1`)
    pub mpc_solana_payer_pubkey: String,
    /// Base58-encoded 32-byte Kamino Obligation PDA owned by the user's personal Solana EOA
    pub user_kamino_obligation_pubkey: String,
    /// Base58-encoded 32-byte Kamino Lending Market public key (`7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF`)
    pub kamino_lending_market_pubkey: String,
    /// Base58-encoded 32-byte Kamino Mainnet SOL Collateral Reserve (`d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q`)
    #[serde(default = "default_sol_collateral_reserve_pubkey")]
    pub sol_collateral_reserve_pubkey: String,
    /// Base58-encoded 32-byte Kamino Mainnet USDC Debt Reserve (`D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59`)
    #[serde(default = "default_usdc_repay_reserve_pubkey")]
    pub usdc_repay_reserve_pubkey: String,
    /// Derivation path used with `v1.signer` for Base EVM (`domain_id: 0`)
    pub base_derivation_path: String,
    /// Derivation path used with `v1.signer` for Solana (`domain_id: 1`)
    pub solana_derivation_path: String,
    /// Maximum USDC allowed per individual rescue execution (6 decimals, e.g., 500_000_000 = 500 USDC)
    pub max_per_action_usdc: u128,
    /// Maximum cumulative USDC allowed across any rolling 24-hour window (6 decimals)
    pub max_daily_usdc: u128,
    /// Maximum tolerated cross-chain swap slippage in basis points (e.g., 100 = 1.00%)
    pub max_slippage_bps: u16,
    /// Minimum Health Factor threshold in basis points below which rescues are triggered (e.g., 11500 = 1.15)
    pub min_trigger_hf_bps: u32,
    /// Maximum age of a signed TEE Decision Receipt in seconds (e.g., 300 = 5 minutes)
    pub max_receipt_age_sec: u64,
}

/// State linking an authorized Leg 1 (Base -> 1-Click) rescue to its corresponding Leg 2 (Solana Kamino repay)
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
pub struct PendingLeg2Authorization {
    pub receipt_hash_hex: String,
    pub state: RescueLifecycleState,
    pub min_repay_amount_usdc: u64,
    pub max_repay_amount_usdc: u64,
    pub oneclick_deposit_address_hex: String,
    pub base_signing_hash_hex: String,
    pub authorized_at_sec: u64,
    pub leg2_completed: bool,
    pub leg1_signature: Option<OriginLegSignedOutput>,
    pub leg2_signature_hex: Option<String>,
}

/// Multi-domain payload discriminator for NEAR Chain Signatures `v1.signer::sign`:
/// - `Ecdsa`: 32-byte Keccak256 digest hex (64 hex chars) for `domain_id: 0` (Secp256k1 / Base EVM)
/// - `Eddsa`: Raw serialized Solana `Message` hex (`64..=1232` bytes) for `domain_id: 1` (Ed25519 / Solana).
///   CRITICAL: Solana validators verify Ed25519 signatures over the raw `Message` bytes directly, NEVER a 32-byte pre-hash.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub enum SignPayloadV2 {
    Ecdsa(String),
    Eddsa(String),
}

/// Payload format for NEAR Chain Signatures `v1.signer::sign`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ChainSignatureSignRequest {
    pub payload: Vec<u8>,
    pub payload_v2: SignPayloadV2,
    pub path: String,
    pub domain_id: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ChainSignatureArgs {
    pub request: ChainSignatureSignRequest,
}

/// Structured Secp256k1 signature returned by `on_origin_leg_signed` so the orchestrator can
/// reconstruct the signed 12-item EIP-1559 transaction `0x02 || rlp([..., v, r, s])`.
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
pub struct OriginLegSignedOutput {
    pub receipt_hash_hex: String,
    pub domain_id: u32,
    pub signing_hash_keccak256_hex: String,
    pub big_r_affine_hex: String,
    pub s_scalar_hex: String,
    pub recovery_id: u8,
}

/// Structured Ed25519 signature returned by `on_destination_leg_signed` so the orchestrator can
/// reconstruct the signed Solana `VersionedTransaction` (`[0x01, ...64_byte_sig, ...raw_message_bytes]`).
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
pub struct DestinationLegSignedOutput {
    pub receipt_hash_hex: String,
    pub domain_id: u32,
    pub raw_message_byte_len: usize,
    pub ed25519_signature_hex: String,
}

/// Protocol-level NEAR Function-Call Access Key specification (`AccessKeyPermission::FunctionCall`)
/// restricting `authorized_agent_id` strictly to non-admin rescue methods on this contract.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct AgentFunctionCallKeySpec {
    pub agent_account_id: AccountId,
    pub receiver_contract_id: AccountId,
    pub allowed_method_names: Vec<String>,
    pub forbidden_admin_methods: Vec<String>,
    pub recommended_allowance_near: String,
}

/// View telemetry returned to the CLI and Web Command Center
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct GuardrailTelemetry {
    pub policy: PolicyConfig,
    pub agent_access_key_spec: AgentFunctionCallKeySpec,
    pub rolling_window_start_sec: u64,
    pub rolling_24h_spent_usdc: u128,
    pub remaining_daily_allowance_usdc: u128,
    pub total_rescues_authorized: u64,
    pub consumed_receipt_count: usize,
    pub pending_leg2_authorizations: Vec<PendingLeg2Authorization>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct InterceptPolicyContract {
    pub policy: PolicyConfig,
    pub tee_enclave_pubkey: [u8; 32],
    pub mpc_base_vault_address: [u8; 20],
    pub mpc_solana_payer_pubkey: [u8; 32],
    pub user_kamino_obligation_pubkey: [u8; 32],
    pub kamino_lending_market_pubkey: [u8; 32],
    pub sol_collateral_reserve_pubkey: [u8; 32],
    pub usdc_repay_reserve_pubkey: [u8; 32],
    pub rolling_window_start_sec: u64,
    pub rolling_24h_spent_usdc: u128,
    pub total_rescues_authorized: u64,
    pub consumed_receipt_hashes: BTreeSet<[u8; 32]>,
    pub leg2_authorizations: BTreeMap<String, PendingLeg2Authorization>,
}

#[near]
impl InterceptPolicyContract {
    #[init]
    pub fn new(policy: PolicyConfig) -> Self {
        let mut policy = policy;
        if policy.sol_collateral_reserve_pubkey.trim().is_empty() {
            policy.sol_collateral_reserve_pubkey = default_sol_collateral_reserve_pubkey();
        }
        if policy.usdc_repay_reserve_pubkey.trim().is_empty() {
            policy.usdc_repay_reserve_pubkey = default_usdc_repay_reserve_pubkey();
        }

        let tee_enclave_pubkey =
            decode_hex_32(&policy.tee_enclave_pubkey_hex, "tee_enclave_pubkey_hex");
        let mpc_base_vault_address =
            decode_hex_20(&policy.mpc_base_vault_address_hex, "mpc_base_vault_address_hex");
        let mpc_solana_payer_pubkey =
            decode_base58_32(&policy.mpc_solana_payer_pubkey, "mpc_solana_payer_pubkey");
        let user_kamino_obligation_pubkey = decode_base58_32(
            &policy.user_kamino_obligation_pubkey,
            "user_kamino_obligation_pubkey",
        );
        let kamino_lending_market_pubkey = decode_base58_32(
            &policy.kamino_lending_market_pubkey,
            "kamino_lending_market_pubkey",
        );
        let sol_collateral_reserve_pubkey = decode_base58_32(
            &policy.sol_collateral_reserve_pubkey,
            "sol_collateral_reserve_pubkey",
        );
        let usdc_repay_reserve_pubkey = decode_base58_32(
            &policy.usdc_repay_reserve_pubkey,
            "usdc_repay_reserve_pubkey",
        );

        validate_policy_invariants(&policy);

        let now_sec = env::block_timestamp() / 1_000_000_000;

        emit_nep297_event(
            "policy_initialized",
            near_sdk::serde_json::json!({
                "owner_id": policy.owner_id,
                "authorized_agent_id": policy.authorized_agent_id,
                "mpc_signer_contract": policy.mpc_signer_contract,
                "user_kamino_obligation_pubkey": policy.user_kamino_obligation_pubkey,
                "max_per_action_usdc": policy.max_per_action_usdc.to_string(),
                "max_daily_usdc": policy.max_daily_usdc.to_string(),
            }),
        );

        Self {
            policy,
            tee_enclave_pubkey,
            mpc_base_vault_address,
            mpc_solana_payer_pubkey,
            user_kamino_obligation_pubkey,
            kamino_lending_market_pubkey,
            sol_collateral_reserve_pubkey,
            usdc_repay_reserve_pubkey,
            rolling_window_start_sec: now_sec,
            rolling_24h_spent_usdc: 0,
            total_rescues_authorized: 0,
            consumed_receipt_hashes: BTreeSet::new(),
            leg2_authorizations: BTreeMap::new(),
        }
    }

    /// Updates policy parameters. Strictly restricted to `policy.owner_id` (cannot be called by the AI agent's Function Call Key).
    pub fn update_policy(&mut self, new_policy: PolicyConfig) {
        let mut new_policy = new_policy;
        assert_eq!(
            env::predecessor_account_id(),
            self.policy.owner_id,
            "UNAUTHORIZED: Only policy owner ({}) can modify guardrail configuration",
            self.policy.owner_id
        );
        if new_policy.sol_collateral_reserve_pubkey.trim().is_empty() {
            new_policy.sol_collateral_reserve_pubkey = default_sol_collateral_reserve_pubkey();
        }
        if new_policy.usdc_repay_reserve_pubkey.trim().is_empty() {
            new_policy.usdc_repay_reserve_pubkey = default_usdc_repay_reserve_pubkey();
        }
        validate_policy_invariants(&new_policy);
        self.tee_enclave_pubkey =
            decode_hex_32(&new_policy.tee_enclave_pubkey_hex, "tee_enclave_pubkey_hex");
        self.mpc_base_vault_address = decode_hex_20(
            &new_policy.mpc_base_vault_address_hex,
            "mpc_base_vault_address_hex",
        );
        self.mpc_solana_payer_pubkey =
            decode_base58_32(&new_policy.mpc_solana_payer_pubkey, "mpc_solana_payer_pubkey");
        self.user_kamino_obligation_pubkey = decode_base58_32(
            &new_policy.user_kamino_obligation_pubkey,
            "user_kamino_obligation_pubkey",
        );
        self.kamino_lending_market_pubkey = decode_base58_32(
            &new_policy.kamino_lending_market_pubkey,
            "kamino_lending_market_pubkey",
        );
        self.sol_collateral_reserve_pubkey = decode_base58_32(
            &new_policy.sol_collateral_reserve_pubkey,
            "sol_collateral_reserve_pubkey",
        );
        self.usdc_repay_reserve_pubkey = decode_base58_32(
            &new_policy.usdc_repay_reserve_pubkey,
            "usdc_repay_reserve_pubkey",
        );
        self.policy = new_policy;
        emit_nep297_event(
            "policy_updated",
            near_sdk::serde_json::json!({
                "owner_id": self.policy.owner_id,
                "authorized_agent_id": self.policy.authorized_agent_id,
                "max_per_action_usdc": self.policy.max_per_action_usdc.to_string(),
                "max_daily_usdc": self.policy.max_daily_usdc.to_string(),
            }),
        );
    }

    /// Pure view method that runs all Leg 1 (Base EVM) byte-level & TEE receipt checks without mutating state.
    pub fn verify_rescue_origin_leg(
        &self,
        receipt: TeeDecisionReceipt,
        quote_recipient_solana_pubkey: String,
        unsigned_eip1559_tx_hex: String,
    ) -> VerifiedEvmTransfer {
        self.internal_verify_origin_leg(
            &receipt,
            &quote_recipient_solana_pubkey,
            &unsigned_eip1559_tx_hex,
        )
    }

    /// Leg 1 Guardrail Entrypoint (`request_rescue_origin_leg` — Base EVM `secp256k1`, `domain_id: 0`).
    /// Verifies the Ed25519 TEE receipt, 24h spending caps, 1-Click quote recipient & slippage,
    /// and raw EIP-1559 RLP bytes, then transitions to `InFlightLeg1` and deducts `rolling_24h_spent_usdc`
    /// BEFORE invoking `v1.signer::sign` (preventing async cross-contract TOCTOU double-spends).
    #[payable]
    pub fn request_rescue_origin_leg(
        &mut self,
        receipt: TeeDecisionReceipt,
        quote_recipient_solana_pubkey: String,
        unsigned_eip1559_tx_hex: String,
    ) -> Promise {
        self.assert_authorized_caller();

        let now_sec = env::block_timestamp() / 1_000_000_000;
        self.prune_expired_receipts(now_sec);

        let receipt_hash = receipt.receipt_hash();
        assert!(
            !self.consumed_receipt_hashes.contains(&receipt_hash),
            "GUARDRAIL REVERT: TeeDecisionReceipt replay detected (receipt hash 0x{} already consumed)",
            hex::encode(receipt_hash)
        );

        if now_sec >= self.rolling_window_start_sec + ROLLING_WINDOW_SECONDS {
            self.rolling_window_start_sec = now_sec;
            self.rolling_24h_spent_usdc = 0;
        }

        let verified_evm = self.internal_verify_origin_leg(
            &receipt,
            &quote_recipient_solana_pubkey,
            &unsigned_eip1559_tx_hex,
        );

        // Immediately record `InFlightLeg1` and deduct `rolling_24h_spent_usdc` prior to dispatching
        // the asynchronous `v1.signer::sign` promise so concurrent calls in the same block cannot
        // bypass the 24h cap or replay the receipt.
        self.consumed_receipt_hashes.insert(receipt_hash);
        self.rolling_24h_spent_usdc += receipt.repay_amount_usdc;
        self.total_rescues_authorized += 1;

        let receipt_hash_hex = hex::encode(receipt_hash);
        let keccak256_hex = hex::encode(verified_evm.signing_hash_keccak256);
        let pending_auth = PendingLeg2Authorization {
            receipt_hash_hex: receipt_hash_hex.clone(),
            state: RescueLifecycleState::InFlightLeg1,
            min_repay_amount_usdc: receipt.min_amount_out as u64,
            max_repay_amount_usdc: receipt.repay_amount_usdc as u64,
            oneclick_deposit_address_hex: format!(
                "0x{}",
                hex::encode(verified_evm.recipient_deposit_address)
            ),
            base_signing_hash_hex: format!("0x{}", keccak256_hex),
            authorized_at_sec: now_sec,
            leg2_completed: false,
            leg1_signature: None,
            leg2_signature_hex: None,
        };
        self.leg2_authorizations
            .insert(receipt_hash_hex.clone(), pending_auth);

        log!(
            "INTERCEPT_LEG1_APPROVED: receipt_hash=0x{}, state=InFlightLeg1, regime={}, repay_usdc={}, deposit_address=0x{}, keccak256=0x{}",
            receipt_hash_hex,
            receipt.regime.as_str(),
            receipt.repay_amount_usdc,
            hex::encode(verified_evm.recipient_deposit_address),
            keccak256_hex
        );
        emit_nep297_event(
            "rescue_origin_leg_in_flight",
            near_sdk::serde_json::json!({
                "receipt_hash_hex": format!("0x{}", receipt_hash_hex),
                "state": "InFlightLeg1",
                "regime": receipt.regime.as_str(),
                "repay_amount_usdc": receipt.repay_amount_usdc.to_string(),
                "oneclick_deposit_address_hex": format!("0x{}", hex::encode(verified_evm.recipient_deposit_address)),
                "signing_hash_keccak256_hex": format!("0x{}", keccak256_hex),
                "domain_id": DOMAIN_ID_SECP256K1,
            }),
        );

        let sign_args = self.build_origin_leg_sign_args(&verified_evm.signing_hash_keccak256);

        Promise::new(self.policy.mpc_signer_contract.clone())
            .function_call(
                "sign".to_string(),
                near_sdk::serde_json::to_vec(&sign_args)
                    .expect("Failed to serialize v1.signer args"),
                env::attached_deposit(),
                MPC_SIGN_GAS,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(MPC_CALLBACK_GAS)
                    .on_origin_leg_signed(
                        receipt_hash_hex,
                        keccak256_hex,
                        receipt.repay_amount_usdc,
                    ),
            )
    }

    /// Callback invoked after `v1.signer::sign` (`domain_id: 0`, Secp256k1 ECDSA) completes for Leg 1.
    /// - On `Ok`: transitions state from `InFlightLeg1` -> `ReadyForLeg2` and stores the MPC `(big_r, s, recovery_id)` signature.
    /// - On `Err`: removes the receipt from `consumed_receipt_hashes` + `leg2_authorizations`, refunds
    ///   `rolling_24h_spent_usdc`, and returns `None` without panicking so the NEAR VM commits the state rollback.
    #[private]
    pub fn on_origin_leg_signed(
        &mut self,
        receipt_hash_hex: String,
        signing_hash_keccak256_hex: String,
        repay_amount_usdc: u128,
        #[callback_result] call_result: Result<near_sdk::serde_json::Value, PromiseError>,
    ) -> Option<OriginLegSignedOutput> {
        match call_result {
            Ok(raw_sig_json) => {
                let output = parse_mpc_secp256k1_response(
                    &receipt_hash_hex,
                    &signing_hash_keccak256_hex,
                    &raw_sig_json,
                )
                .unwrap_or_else(|err| {
                    env::panic_str(&format!("MPC_SECP256K1_CALLBACK_PARSE_ERROR: {}", err))
                });
                if let Some(auth) = self.leg2_authorizations.get_mut(&receipt_hash_hex) {
                    auth.state = RescueLifecycleState::ReadyForLeg2;
                    auth.leg1_signature = Some(output.clone());
                }
                log!(
                    "INTERCEPT_LEG1_MPC_SIGNED: receipt_hash=0x{}, state=ReadyForLeg2, big_r={}, s={}, recovery_id={}",
                    receipt_hash_hex,
                    output.big_r_affine_hex,
                    output.s_scalar_hex,
                    output.recovery_id
                );
                emit_nep297_event(
                    "rescue_origin_leg_ready_for_leg2",
                    near_sdk::serde_json::json!({
                        "receipt_hash_hex": format!("0x{}", receipt_hash_hex),
                        "state": "ReadyForLeg2",
                        "domain_id": DOMAIN_ID_SECP256K1,
                        "recovery_id": output.recovery_id,
                    }),
                );
                Some(output)
            }
            Err(_) => {
                // Rollback state mutations if v1.signer rejected or ran out of gas.
                // Do NOT panic here so NEAR VM commits the rollback to storage.
                let receipt_bytes = decode_hex_32(&receipt_hash_hex, "receipt_hash_hex");
                self.consumed_receipt_hashes.remove(&receipt_bytes);
                self.rolling_24h_spent_usdc = self
                    .rolling_24h_spent_usdc
                    .saturating_sub(repay_amount_usdc);
                self.total_rescues_authorized = self.total_rescues_authorized.saturating_sub(1);
                self.leg2_authorizations.remove(&receipt_hash_hex);
                log!(
                    "MPC_SIGNER_FAILURE (LEG 1 BASE): v1.signer failed for receipt_hash 0x{}; receipt removed and rolling_24h_spent_usdc refunded",
                    receipt_hash_hex
                );
                emit_nep297_event(
                    "rescue_origin_leg_rolled_back",
                    near_sdk::serde_json::json!({
                        "receipt_hash_hex": format!("0x{}", receipt_hash_hex),
                        "refunded_usdc": repay_amount_usdc.to_string(),
                    }),
                );
                None
            }
        }
    }

    /// Pure view method that runs all Leg 2 (Solana Kamino `repay_obligation_liquidity_v2`) byte-level checks.
    pub fn verify_rescue_destination_leg(
        &self,
        unsigned_solana_message_hex: String,
        min_repay_amount_usdc: u64,
        max_repay_amount_usdc: u64,
    ) -> VerifiedSolanaRepayMessage {
        let raw_msg = decode_hex_vec(&unsigned_solana_message_hex, "unsigned_solana_message_hex");
        assert!(
            raw_msg.len() >= 64 && raw_msg.len() <= 1232,
            "GUARDRAIL REVERT (LEG 2 SOLANA): Solana Ed25519 requires raw serialized Message bytes (64..=1232 bytes), got {} bytes (32-byte pre-hash is forbidden)",
            raw_msg.len()
        );
        verify_solana_kamino_repay_message(
            &raw_msg,
            &self.mpc_solana_payer_pubkey,
            &self.user_kamino_obligation_pubkey,
            &self.kamino_lending_market_pubkey,
            &self.sol_collateral_reserve_pubkey,
            &self.usdc_repay_reserve_pubkey,
            min_repay_amount_usdc,
            max_repay_amount_usdc,
        )
        .unwrap_or_else(|err| env::panic_str(&format!("GUARDRAIL REVERT (LEG 2 SOLANA): {}", err)))
    }

    /// Leg 2 Guardrail Entrypoint (`request_rescue_destination_leg` — Solana `ed25519`, `domain_id: 1`).
    /// Requires the receipt lifecycle state to be strictly `ReadyForLeg2`, transitions immediately to `InFlightLeg2`,
    /// parses the raw serialized Solana `Message` bytes, verifies program whitelist (ComputeBudget + Kamino Lend),
    /// verifies permissionless refresh instructions + `repay_obligation_liquidity_v2` discriminator and user's
    /// `obligation` + `lending_market` + `repay_reserve` accounts, then invokes `v1.signer::sign` (`domain_id: 1`)
    /// with the raw Solana `Message` bytes (`Eddsa`), NEVER a 32-byte pre-hash.
    #[payable]
    pub fn request_rescue_destination_leg(
        &mut self,
        receipt_hash_hex: String,
        unsigned_solana_message_hex: String,
    ) -> Promise {
        self.assert_authorized_caller();

        let norm_hash = TeeDecisionReceipt::normalize_hex(&receipt_hash_hex);
        let auth = self
            .leg2_authorizations
            .get(&norm_hash)
            .cloned()
            .unwrap_or_else(|| {
                env::panic_str(&format!(
                    "GUARDRAIL REVERT (LEG 2 SOLANA): Unknown or unauthorized receipt_hash 0x{}",
                    norm_hash
                ))
            });

        match auth.state {
            RescueLifecycleState::ReadyForLeg2 => {}
            RescueLifecycleState::InFlightLeg1 => {
                env::panic_str(&format!(
                    "GUARDRAIL REVERT (LEG 2 SOLANA): Leg 1 is still InFlightLeg1 for receipt_hash 0x{}; await on_origin_leg_signed callback",
                    norm_hash
                ));
            }
            RescueLifecycleState::InFlightLeg2 => {
                env::panic_str(&format!(
                    "GUARDRAIL REVERT (LEG 2 SOLANA): Leg 2 is already InFlightLeg2 for receipt_hash 0x{}; concurrent Leg 2 call blocked",
                    norm_hash
                ));
            }
            RescueLifecycleState::Completed => {
                env::panic_str(&format!(
                    "GUARDRAIL REVERT (LEG 2 SOLANA): Leg 2 already Completed for receipt_hash 0x{}",
                    norm_hash
                ));
            }
        }

        let raw_msg = decode_hex_vec(&unsigned_solana_message_hex, "unsigned_solana_message_hex");
        assert!(
            raw_msg.len() >= 64 && raw_msg.len() <= 1232,
            "GUARDRAIL REVERT (LEG 2 SOLANA): Solana Ed25519 requires raw serialized Message bytes (64..=1232 bytes), got {} bytes (32-byte pre-hash is forbidden)",
            raw_msg.len()
        );

        let verified_solana = verify_solana_kamino_repay_message(
            &raw_msg,
            &self.mpc_solana_payer_pubkey,
            &self.user_kamino_obligation_pubkey,
            &self.kamino_lending_market_pubkey,
            &self.sol_collateral_reserve_pubkey,
            &self.usdc_repay_reserve_pubkey,
            auth.min_repay_amount_usdc,
            auth.max_repay_amount_usdc,
        )
        .unwrap_or_else(|err| env::panic_str(&format!("GUARDRAIL REVERT (LEG 2 SOLANA): {}", err)));

        // Transition state immediately to `InFlightLeg2` before dispatching `v1.signer::sign`
        if let Some(entry) = self.leg2_authorizations.get_mut(&norm_hash) {
            entry.state = RescueLifecycleState::InFlightLeg2;
        }

        log!(
            "INTERCEPT_LEG2_APPROVED: receipt_hash=0x{}, state=InFlightLeg2, obligation={}, repay_reserve={}, repay_amount_usdc={}, refresh_ixs={}, v2_ix={}, raw_msg_bytes={}",
            norm_hash,
            self.policy.user_kamino_obligation_pubkey,
            self.policy.usdc_repay_reserve_pubkey,
            verified_solana.repay_amount_usdc,
            verified_solana.kamino_refresh_ix_count,
            verified_solana.is_v2_instruction,
            raw_msg.len()
        );
        emit_nep297_event(
            "rescue_destination_leg_in_flight",
            near_sdk::serde_json::json!({
                "receipt_hash_hex": format!("0x{}", norm_hash),
                "state": "InFlightLeg2",
                "obligation_pubkey": self.policy.user_kamino_obligation_pubkey,
                "repay_reserve_pubkey": self.policy.usdc_repay_reserve_pubkey,
                "repay_amount_usdc": verified_solana.repay_amount_usdc.to_string(),
                "kamino_refresh_ix_count": verified_solana.kamino_refresh_ix_count,
                "raw_message_byte_len": raw_msg.len(),
                "domain_id": DOMAIN_ID_ED25519,
            }),
        );

        let raw_msg_len = raw_msg.len();
        let sign_args = self.build_destination_leg_sign_args(&raw_msg);

        Promise::new(self.policy.mpc_signer_contract.clone())
            .function_call(
                "sign".to_string(),
                near_sdk::serde_json::to_vec(&sign_args)
                    .expect("Failed to serialize v1.signer args"),
                NearToken::from_yoctonear(env::attached_deposit().as_yoctonear()),
                MPC_SIGN_GAS,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(MPC_CALLBACK_GAS)
                    .on_destination_leg_signed(norm_hash, raw_msg_len),
            )
    }

    /// Callback invoked after `v1.signer::sign` (`domain_id: 1`, Ed25519 EdDSA) completes for Leg 2.
    /// - On `Ok`: transitions state from `InFlightLeg2` -> `Completed`, sets `leg2_completed = true`,
    ///   and records the 64-byte Ed25519 signature over the raw Solana `Message` bytes.
    /// - On `Err`: reverts state from `InFlightLeg2` -> `ReadyForLeg2` (preserving the Leg 1 record!)
    ///   and returns `None` without panicking so the rollback is committed and Leg 2 can be safely retried.
    #[private]
    pub fn on_destination_leg_signed(
        &mut self,
        receipt_hash_hex: String,
        raw_message_byte_len: usize,
        #[callback_result] call_result: Result<near_sdk::serde_json::Value, PromiseError>,
    ) -> Option<DestinationLegSignedOutput> {
        match call_result {
            Ok(raw_sig_json) => {
                let output = parse_mpc_ed25519_response(
                    &receipt_hash_hex,
                    raw_message_byte_len,
                    &raw_sig_json,
                )
                .unwrap_or_else(|err| {
                    env::panic_str(&format!("MPC_ED25519_CALLBACK_PARSE_ERROR: {}", err))
                });
                if let Some(auth) = self.leg2_authorizations.get_mut(&receipt_hash_hex) {
                    auth.state = RescueLifecycleState::Completed;
                    auth.leg2_completed = true;
                    auth.leg2_signature_hex = Some(output.ed25519_signature_hex.clone());
                }
                log!(
                    "INTERCEPT_LEG2_MPC_SIGNED: receipt_hash=0x{}, state=Completed, raw_msg_bytes={}, ed25519_sig=0x{}",
                    receipt_hash_hex,
                    output.raw_message_byte_len,
                    output.ed25519_signature_hex
                );
                emit_nep297_event(
                    "rescue_completed",
                    near_sdk::serde_json::json!({
                        "receipt_hash_hex": format!("0x{}", receipt_hash_hex),
                        "state": "Completed",
                        "domain_id": DOMAIN_ID_ED25519,
                        "raw_message_byte_len": output.raw_message_byte_len,
                    }),
                );
                Some(output)
            }
            Err(_) => {
                if let Some(auth) = self.leg2_authorizations.get_mut(&receipt_hash_hex) {
                    auth.state = RescueLifecycleState::ReadyForLeg2;
                    auth.leg2_completed = false;
                }
                log!(
                    "MPC_SIGNER_FAILURE (LEG 2 SOLANA): v1.signer failed for receipt_hash 0x{}; state rolled back to ReadyForLeg2 so Leg 2 can be safely retried",
                    receipt_hash_hex
                );
                emit_nep297_event(
                    "rescue_destination_leg_retry_ready",
                    near_sdk::serde_json::json!({
                        "receipt_hash_hex": format!("0x{}", receipt_hash_hex),
                        "state": "ReadyForLeg2",
                    }),
                );
                None
            }
        }
    }

    /// Returns the scoped NEAR Function-Call Access Key specification (`AccessKeyPermission::FunctionCall`)
    /// for `authorized_agent_id`, proving the AI agent key is protocol-restricted from calling `update_policy` or transferring NEAR.
    pub fn get_agent_function_call_key_spec(&self) -> AgentFunctionCallKeySpec {
        AgentFunctionCallKeySpec {
            agent_account_id: self.policy.authorized_agent_id.clone(),
            receiver_contract_id: env::current_account_id(),
            allowed_method_names: vec![
                "request_rescue_origin_leg".to_string(),
                "request_rescue_destination_leg".to_string(),
            ],
            forbidden_admin_methods: vec!["new".to_string(), "update_policy".to_string()],
            recommended_allowance_near: "0.25".to_string(),
        }
    }

    /// Returns full guardrail telemetry, active policy limits, and pending Leg 2 authorizations.
    pub fn get_telemetry(&self) -> GuardrailTelemetry {
        let now_sec = env::block_timestamp() / 1_000_000_000;
        let effective_spent = if now_sec >= self.rolling_window_start_sec + ROLLING_WINDOW_SECONDS {
            0
        } else {
            self.rolling_24h_spent_usdc
        };
        let remaining = self.policy.max_daily_usdc.saturating_sub(effective_spent);
        GuardrailTelemetry {
            policy: self.policy.clone(),
            agent_access_key_spec: self.get_agent_function_call_key_spec(),
            rolling_window_start_sec: self.rolling_window_start_sec,
            rolling_24h_spent_usdc: effective_spent,
            remaining_daily_allowance_usdc: remaining,
            total_rescues_authorized: self.total_rescues_authorized,
            consumed_receipt_count: self.consumed_receipt_hashes.len(),
            pending_leg2_authorizations: self.leg2_authorizations.values().cloned().collect(),
        }
    }
}

impl InterceptPolicyContract {
    fn assert_authorized_caller(&self) {
        let caller = env::predecessor_account_id();
        assert!(
            caller == self.policy.authorized_agent_id || caller == self.policy.owner_id,
            "GUARDRAIL REVERT: Caller {} is neither authorized_agent_id ({}) nor owner_id ({})",
            caller,
            self.policy.authorized_agent_id,
            self.policy.owner_id
        );
    }

    /// Prunes expired `Completed` receipt records older than `max_receipt_age_sec * 2`
    /// (and any stale entry older than 24h) from `leg2_authorizations` and `consumed_receipt_hashes`.
    /// Because `TeeDecisionReceipt::verify` already rejects any receipt older than `max_receipt_age_sec`
    /// with `ReceiptExpired`, expired receipts can never be replayed even after storage eviction.
    pub fn prune_expired_receipts(&mut self, now_sec: u64) -> usize {
        let completed_ttl = self.policy.max_receipt_age_sec.saturating_mul(2);
        let stale_keys: Vec<String> = self
            .leg2_authorizations
            .iter()
            .filter_map(|(hash_hex, auth)| {
                let age = now_sec.saturating_sub(auth.authorized_at_sec);
                let is_expired_completed =
                    auth.state == RescueLifecycleState::Completed && age > completed_ttl;
                let is_abandoned_older_than_window = age > ROLLING_WINDOW_SECONDS;
                if is_expired_completed || is_abandoned_older_than_window {
                    Some(hash_hex.clone())
                } else {
                    None
                }
            })
            .collect();

        let pruned_count = stale_keys.len();
        for key in stale_keys {
            self.leg2_authorizations.remove(&key);
            if let Ok(bytes) = hex::decode(&key) {
                if bytes.len() == 32 {
                    let mut arr = [0u8; 32];
                    arr.copy_from_slice(&bytes);
                    self.consumed_receipt_hashes.remove(&arr);
                }
            }
        }
        pruned_count
    }

    fn internal_verify_origin_leg(
        &self,
        receipt: &TeeDecisionReceipt,
        quote_recipient_solana_pubkey: &str,
        unsigned_eip1559_tx_hex: &str,
    ) -> VerifiedEvmTransfer {
        let now_sec = env::block_timestamp() / 1_000_000_000;

        // 1. Verify Ed25519 TeeDecisionReceipt signature, regime, timestamp, obligation, and slippage
        let deposit_address = receipt
            .verify(
                &self.tee_enclave_pubkey,
                &self.user_kamino_obligation_pubkey,
                self.policy.max_slippage_bps,
                now_sec,
                self.policy.max_receipt_age_sec,
            )
            .unwrap_or_else(|err| {
                env::panic_str(&format!("GUARDRAIL REVERT (TEE RECEIPT): {}", err))
            });

        // 2. Verify 1-Click quote commits to recipient == policy.mpc_solana_payer_pubkey
        let recipient_pk =
            decode_base58_32(quote_recipient_solana_pubkey, "quote_recipient_solana_pubkey");
        assert_eq!(
            recipient_pk, self.mpc_solana_payer_pubkey,
            "GUARDRAIL REVERT (QUOTE RECIPIENT): 1-Click quote recipient ({}) does not match MPC_Solana_Payer ({})",
            quote_recipient_solana_pubkey, self.policy.mpc_solana_payer_pubkey
        );

        // 3. Verify per-action and 24-hour rolling spending limits
        assert!(
            receipt.repay_amount_usdc <= self.policy.max_per_action_usdc,
            "GUARDRAIL REVERT (SPENDING CAP): repay_amount_usdc ({}) exceeds max_per_action_usdc ({})",
            receipt.repay_amount_usdc,
            self.policy.max_per_action_usdc
        );

        let effective_spent = if now_sec >= self.rolling_window_start_sec + ROLLING_WINDOW_SECONDS {
            0
        } else {
            self.rolling_24h_spent_usdc
        };
        assert!(
            effective_spent + receipt.repay_amount_usdc <= self.policy.max_daily_usdc,
            "GUARDRAIL REVERT (DAILY LIMIT): rolling_24h_spent ({}) + repay_amount_usdc ({}) exceeds max_daily_usdc ({})",
            effective_spent,
            receipt.repay_amount_usdc,
            self.policy.max_daily_usdc
        );

        // 4. Parse and verify raw unsigned EIP-1559 Base USDC transfer bytes
        let raw_tx = decode_hex_vec(unsigned_eip1559_tx_hex, "unsigned_eip1559_tx_hex");
        verify_eip1559_base_usdc_transfer(&raw_tx, &deposit_address, receipt.repay_amount_usdc)
            .unwrap_or_else(|err| {
                env::panic_str(&format!("GUARDRAIL REVERT (LEG 1 BASE EVM): {}", err))
            })
    }

    /// Constructs the `v1.signer::sign` arguments for Leg 1 (`domain_id: 0`, Secp256k1 ECDSA).
    /// Passes the 32-byte `keccak256(unsigned_eip1559_tx)` digest via both `payload` and `payload_v2::Ecdsa`.
    pub fn build_origin_leg_sign_args(&self, signing_hash_keccak256: &[u8; 32]) -> ChainSignatureArgs {
        let digest_hex = hex::encode(signing_hash_keccak256);
        ChainSignatureArgs {
            request: ChainSignatureSignRequest {
                payload: signing_hash_keccak256.to_vec(),
                payload_v2: SignPayloadV2::Ecdsa(digest_hex),
                path: self.policy.base_derivation_path.clone(),
                domain_id: DOMAIN_ID_SECP256K1,
            },
        }
    }

    /// Constructs the `v1.signer::sign` arguments for Leg 2 (`domain_id: 1`, Ed25519 EdDSA).
    /// CRITICAL: Passes the raw serialized Solana `Message` bytes (`64..=1232` bytes) via both `payload`
    /// and `payload_v2::Eddsa`. Never pre-hashes with SHA-256 because Solana validators verify Ed25519
    /// signatures directly over the raw `Message` bytes.
    pub fn build_destination_leg_sign_args(&self, raw_solana_message: &[u8]) -> ChainSignatureArgs {
        assert!(
            raw_solana_message.len() >= 64 && raw_solana_message.len() <= 1232,
            "Solana Ed25519 sign request requires raw Message bytes (64..=1232), got {}",
            raw_solana_message.len()
        );
        let raw_msg_hex = hex::encode(raw_solana_message);
        ChainSignatureArgs {
            request: ChainSignatureSignRequest {
                payload: raw_solana_message.to_vec(),
                payload_v2: SignPayloadV2::Eddsa(raw_msg_hex),
                path: self.policy.solana_derivation_path.clone(),
                domain_id: DOMAIN_ID_ED25519,
            },
        }
    }
}

/// Parses the `v1.signer::sign` JSON response for `domain_id: 0` (Secp256k1 ECDSA).
/// Supports both tagged (`{"scheme":"Secp256k1","big_r":{"affine_point":"..."},"s":{"scalar":"..."},"recovery_id":0}`)
/// and untagged (`{"big_r":{"affine_point":"..."},"s":{"scalar":"..."},"recovery_id":0}`) formats.
pub fn parse_mpc_secp256k1_response(
    receipt_hash_hex: &str,
    signing_hash_keccak256_hex: &str,
    raw_json: &near_sdk::serde_json::Value,
) -> Result<OriginLegSignedOutput, String> {
    let big_r_affine_hex = raw_json
        .get("big_r")
        .and_then(|v| v.get("affine_point").or(Some(v)))
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing `big_r.affine_point` string in Secp256k1 v1.signer response".to_string())?
        .to_string();

    let s_scalar_hex = raw_json
        .get("s")
        .and_then(|v| v.get("scalar").or(Some(v)))
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing `s.scalar` string in Secp256k1 v1.signer response".to_string())?
        .to_string();

    let recovery_id_u64 = raw_json
        .get("recovery_id")
        .and_then(|v| v.as_u64())
        .ok_or_else(|| "Missing `recovery_id` integer in Secp256k1 v1.signer response".to_string())?;

    if recovery_id_u64 > 3 {
        return Err(format!("Invalid Secp256k1 recovery_id {}", recovery_id_u64));
    }

    Ok(OriginLegSignedOutput {
        receipt_hash_hex: receipt_hash_hex.to_string(),
        domain_id: DOMAIN_ID_SECP256K1,
        signing_hash_keccak256_hex: signing_hash_keccak256_hex.to_string(),
        big_r_affine_hex,
        s_scalar_hex,
        recovery_id: recovery_id_u64 as u8,
    })
}

/// Parses the `v1.signer::sign` JSON response for `domain_id: 1` (Ed25519 EdDSA).
/// Supports byte-array format (`{"scheme":"Ed25519","signature":[u8; 64]}` or `{"signature":[u8; 64]}`)
/// and hex string format (`{"signature":"<128-hex-chars>"}`).
pub fn parse_mpc_ed25519_response(
    receipt_hash_hex: &str,
    raw_message_byte_len: usize,
    raw_json: &near_sdk::serde_json::Value,
) -> Result<DestinationLegSignedOutput, String> {
    let sig_val = raw_json
        .get("signature")
        .ok_or_else(|| "Missing `signature` field in Ed25519 v1.signer response".to_string())?;

    let sig_bytes: Vec<u8> = if let Some(arr) = sig_val.as_array() {
        let mut out = Vec::with_capacity(arr.len());
        for item in arr {
            let b = item
                .as_u64()
                .ok_or_else(|| "Ed25519 `signature` array contains non-integer element".to_string())?;
            if b > 255 {
                return Err(format!("Ed25519 `signature` byte out of range: {}", b));
            }
            out.push(b as u8);
        }
        out
    } else if let Some(hex_str) = sig_val.as_str() {
        let norm = TeeDecisionReceipt::normalize_hex(hex_str);
        hex::decode(norm).map_err(|_| "Invalid hex string in Ed25519 `signature` field".to_string())?
    } else {
        return Err("Unsupported `signature` representation in Ed25519 v1.signer response".to_string());
    };

    if sig_bytes.len() != 64 {
        return Err(format!(
            "Ed25519 signature must be exactly 64 bytes, got {}",
            sig_bytes.len()
        ));
    }

    Ok(DestinationLegSignedOutput {
        receipt_hash_hex: receipt_hash_hex.to_string(),
        domain_id: DOMAIN_ID_ED25519,
        raw_message_byte_len,
        ed25519_signature_hex: hex::encode(sig_bytes),
    })
}

fn decode_hex_vec(s: &str, field_name: &str) -> Vec<u8> {
    let norm = TeeDecisionReceipt::normalize_hex(s);
    hex::decode(norm).unwrap_or_else(|_| {
        env::panic_str(&format!("Invalid hex encoding in field {}", field_name))
    })
}

fn decode_hex_20(s: &str, field_name: &str) -> [u8; 20] {
    let v = decode_hex_vec(s, field_name);
    assert_eq!(
        v.len(),
        20,
        "Field {} must decode to exactly 20 bytes, got {}",
        field_name,
        v.len()
    );
    let mut arr = [0u8; 20];
    arr.copy_from_slice(&v);
    arr
}

fn decode_hex_32(s: &str, field_name: &str) -> [u8; 32] {
    let v = decode_hex_vec(s, field_name);
    assert_eq!(
        v.len(),
        32,
        "Field {} must decode to exactly 32 bytes, got {}",
        field_name,
        v.len()
    );
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&v);
    arr
}

fn decode_base58_32(s: &str, field_name: &str) -> [u8; 32] {
    let v = bs58::decode(s).into_vec().unwrap_or_else(|_| {
        env::panic_str(&format!("Invalid Base58 encoding in field {}", field_name))
    });
    assert_eq!(
        v.len(),
        32,
        "Field {} must decode to exactly 32 bytes, got {}",
        field_name,
        v.len()
    );
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&v);
    arr
}

/// Validates numeric invariants on `PolicyConfig` during `new` and `update_policy`.
fn validate_policy_invariants(policy: &PolicyConfig) {
    assert!(
        policy.max_per_action_usdc > 0 && policy.max_per_action_usdc <= policy.max_daily_usdc,
        "Policy invariant failed: 0 < max_per_action_usdc <= max_daily_usdc"
    );
    assert!(
        policy.max_slippage_bps <= 1_000,
        "Policy invariant failed: max_slippage_bps cannot exceed 1000 bps (10%)"
    );
    assert!(
        policy.max_receipt_age_sec >= 30 && policy.max_receipt_age_sec <= 3_600,
        "Policy invariant failed: max_receipt_age_sec must be in 30..=3600 seconds"
    );
}

/// Emits a structured NEP-297 event log (`EVENT_JSON:{"standard":"intercept-guardrail","version":"1.0.0","event":"...","data":[...]}`)
/// for indexers (NearBlocks, Goldsky, Pikespeak) and automated audit tools.
fn emit_nep297_event(event: &str, data: near_sdk::serde_json::Value) {
    let payload = near_sdk::serde_json::json!({
        "standard": "intercept-guardrail",
        "version": "1.0.0",
        "event": event,
        "data": [data],
    });
    env::log_str(&format!("EVENT_JSON:{}", payload));
}
