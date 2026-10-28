use crate::evm_parser::{
    build_erc20_transfer_calldata, build_unsigned_eip1559_tx, verify_eip1559_base_usdc_transfer,
    BASE_MAINNET_CHAIN_ID, BASE_USDC_ADDRESS, ERC20_APPROVE_SELECTOR, EvmParseError,
};
use crate::solana_parser::{
    build_solana_kamino_full_refresh_and_repay_message, build_solana_kamino_repay_message,
    compute_anchor_discriminator, encode_compact_u16, verify_solana_kamino_repay_message,
    BORROW_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR, COMPUTE_BUDGET_PROGRAM_ID_STR,
    COMPUTE_BUDGET_PUBKEY, KAMINO_LEND_PROGRAM_ID_STR, KAMINO_LEND_PUBKEY,
    KAMINO_MAINNET_SOL_RESERVE_ID_STR, KAMINO_MAINNET_SOL_RESERVE_PUBKEY,
    KAMINO_MAINNET_USDC_RESERVE_ID_STR, KAMINO_MAINNET_USDC_RESERVE_PUBKEY,
    KAMINO_MAIN_MARKET_ID_STR, KAMINO_MAIN_MARKET_PUBKEY,
    REFRESH_OBLIGATION_DISCRIMINATOR, REFRESH_OBLIGATION_FARMS_FOR_RESERVE_DISCRIMINATOR,
    REFRESH_RESERVES_BATCH_DISCRIMINATOR, REFRESH_RESERVE_DISCRIMINATOR,
    REPAY_OBLIGATION_LIQUIDITY_V1_DISCRIMINATOR, REPAY_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR,
    SolanaParseError, WITHDRAW_OBLIGATION_COLLATERAL_V2_DISCRIMINATOR,
};
use crate::tee_receipt::{RiskRegime, TeeDecisionReceipt};
use crate::{
    InterceptPolicyContract, PolicyConfig, RescueLifecycleState, SignPayloadV2, DOMAIN_ID_ED25519,
    DOMAIN_ID_SECP256K1,
};
use ed25519_dalek::{Signer, SigningKey};
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, AccountId, NearToken, PromiseError};

const TEST_TIMESTAMP_SEC: u64 = 1_793_550_000;

fn deterministic_signing_key(seed_byte: u8) -> SigningKey {
    SigningKey::from_bytes(&[seed_byte; 32])
}

fn setup_context(predecessor: &str, timestamp_sec: u64) {
    let mut builder = VMContextBuilder::new();
    builder
        .predecessor_account_id(predecessor.parse::<AccountId>().unwrap())
        .block_timestamp(timestamp_sec * 1_000_000_000)
        .attached_deposit(NearToken::from_millinear(50));
    testing_env!(builder.build());
}

fn sample_policy_and_keys() -> (
    PolicyConfig,
    SigningKey,
    [u8; 20],
    [u8; 32],
    [u8; 32],
    [u8; 32],
) {
    let tee_sk = deterministic_signing_key(0x42);
    let tee_pk_bytes = tee_sk.verifying_key().to_bytes();

    let mpc_base_vault: [u8; 20] = [0x11; 20];
    let mpc_solana_payer: [u8; 32] = [0x22; 32];
    let user_obligation: [u8; 32] = [0x33; 32];
    let lending_market: [u8; 32] = KAMINO_MAIN_MARKET_PUBKEY;

    let policy = PolicyConfig {
        owner_id: "alice.near".parse().unwrap(),
        authorized_agent_id: "agent.intercept.near".parse().unwrap(),
        mpc_signer_contract: "v1.signer".parse().unwrap(),
        tee_enclave_pubkey_hex: hex::encode(tee_pk_bytes),
        mpc_base_vault_address_hex: format!("0x{}", hex::encode(mpc_base_vault)),
        mpc_solana_payer_pubkey: bs58::encode(mpc_solana_payer).into_string(),
        user_kamino_obligation_pubkey: bs58::encode(user_obligation).into_string(),
        kamino_lending_market_pubkey: bs58::encode(lending_market).into_string(),
        sol_collateral_reserve_pubkey: KAMINO_MAINNET_SOL_RESERVE_ID_STR.to_string(),
        usdc_repay_reserve_pubkey: KAMINO_MAINNET_USDC_RESERVE_ID_STR.to_string(),
        base_derivation_path: "intercept-base-vault-1".to_string(),
        solana_derivation_path: "intercept-solana-payer-1".to_string(),
        max_per_action_usdc: 500_000_000, // 500 USDC
        max_daily_usdc: 1_000_000_000,    // 1,000 USDC
        max_slippage_bps: 100,            // 1.00%
        min_trigger_hf_bps: 11_500,       // 1.1500
        max_receipt_age_sec: 300,
    };

    (
        policy,
        tee_sk,
        mpc_base_vault,
        mpc_solana_payer,
        user_obligation,
        lending_market,
    )
}

fn sign_test_receipt(
    tee_sk: &SigningKey,
    obligation_b58: &str,
    regime: RiskRegime,
    repay_amount_usdc: u128,
    min_amount_out: u128,
    deposit_address: &[u8; 20],
    timestamp: u64,
) -> TeeDecisionReceipt {
    let mut receipt = TeeDecisionReceipt {
        timestamp,
        obligation_pubkey: obligation_b58.to_string(),
        observed_hf_bps: 10_850,
        volatility_bps: 6_400,
        regime,
        repay_amount_usdc,
        oneclick_deposit_address: format!("0x{}", hex::encode(deposit_address)),
        min_amount_out,
        reasoning_hash: format!("0x{}", hex::encode([0xab; 32])),
        enclave_signature_hex: String::new(),
    };
    let payload = receipt.canonical_signing_payload();
    let sig = tee_sk.sign(payload.as_bytes());
    receipt.enclave_signature_hex = hex::encode(sig.to_bytes());
    receipt
}

#[test]
fn test_verify_kamino_anchor_discriminators_and_program_pubkeys() {
    // 1. Verify exact SHA-256 preimages for Kamino Anchor instruction discriminators
    let repay_v2 = compute_anchor_discriminator("global:repay_obligation_liquidity_v2");
    assert_eq!(
        repay_v2,
        [116, 174, 213, 76, 180, 53, 210, 144],
        "sha256('global:repay_obligation_liquidity_v2')[0..8] must equal [116, 174, 213, 76, 180, 53, 210, 144]"
    );
    assert_eq!(repay_v2, REPAY_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR);

    let repay_v1 = compute_anchor_discriminator("global:repay_obligation_liquidity");
    assert_eq!(
        repay_v1,
        [145, 178, 13, 225, 76, 240, 147, 72],
        "sha256('global:repay_obligation_liquidity')[0..8] must equal [145, 178, 13, 225, 76, 240, 147, 72]"
    );
    assert_eq!(repay_v1, REPAY_OBLIGATION_LIQUIDITY_V1_DISCRIMINATOR);

    let withdraw_v2 = compute_anchor_discriminator("global:withdraw_obligation_collateral_v2");
    assert_eq!(withdraw_v2, WITHDRAW_OBLIGATION_COLLATERAL_V2_DISCRIMINATOR);

    let borrow_v2 = compute_anchor_discriminator("global:borrow_obligation_liquidity_v2");
    assert_eq!(borrow_v2, BORROW_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR);

    let refresh_reserve = compute_anchor_discriminator("global:refresh_reserve");
    assert_eq!(
        refresh_reserve,
        [2, 218, 138, 235, 79, 201, 25, 102],
        "sha256('global:refresh_reserve')[0..8] must equal [2, 218, 138, 235, 79, 201, 25, 102]"
    );
    assert_eq!(refresh_reserve, REFRESH_RESERVE_DISCRIMINATOR);

    let refresh_reserves_batch = compute_anchor_discriminator("global:refresh_reserves_batch");
    assert_eq!(
        refresh_reserves_batch,
        [144, 110, 26, 103, 162, 204, 252, 147],
        "sha256('global:refresh_reserves_batch')[0..8] must equal [144, 110, 26, 103, 162, 204, 252, 147]"
    );
    assert_eq!(refresh_reserves_batch, REFRESH_RESERVES_BATCH_DISCRIMINATOR);

    let refresh_obligation = compute_anchor_discriminator("global:refresh_obligation");
    assert_eq!(
        refresh_obligation,
        [33, 132, 147, 228, 151, 192, 72, 89],
        "sha256('global:refresh_obligation')[0..8] must equal [33, 132, 147, 228, 151, 192, 72, 89]"
    );
    assert_eq!(refresh_obligation, REFRESH_OBLIGATION_DISCRIMINATOR);

    let refresh_farms =
        compute_anchor_discriminator("global:refresh_obligation_farms_for_reserve");
    assert_eq!(
        refresh_farms,
        [140, 144, 253, 21, 10, 74, 248, 3],
        "sha256('global:refresh_obligation_farms_for_reserve')[0..8] must equal [140, 144, 253, 21, 10, 74, 248, 3]"
    );
    assert_eq!(
        refresh_farms,
        REFRESH_OBLIGATION_FARMS_FOR_RESERVE_DISCRIMINATOR
    );

    // 2. Verify Base58 decoding of Solana program and market public keys
    assert_eq!(
        bs58::decode(COMPUTE_BUDGET_PROGRAM_ID_STR)
            .into_vec()
            .unwrap()
            .as_slice(),
        &COMPUTE_BUDGET_PUBKEY
    );
    assert_eq!(
        bs58::decode(KAMINO_LEND_PROGRAM_ID_STR)
            .into_vec()
            .unwrap()
            .as_slice(),
        &KAMINO_LEND_PUBKEY
    );
    assert_eq!(
        bs58::decode(KAMINO_MAIN_MARKET_ID_STR)
            .into_vec()
            .unwrap()
            .as_slice(),
        &KAMINO_MAIN_MARKET_PUBKEY
    );
    assert_eq!(
        bs58::decode(KAMINO_MAINNET_SOL_RESERVE_ID_STR)
            .into_vec()
            .unwrap()
            .as_slice(),
        &KAMINO_MAINNET_SOL_RESERVE_PUBKEY
    );
    assert_eq!(
        bs58::decode(KAMINO_MAINNET_USDC_RESERVE_ID_STR)
            .into_vec()
            .unwrap()
            .as_slice(),
        &KAMINO_MAINNET_USDC_RESERVE_PUBKEY
    );
}

#[test]
fn test_valid_leg1_and_leg2_end_to_end() {
    let (policy, tee_sk, _base_vault, mpc_solana_payer, user_obligation, lending_market) =
        sample_policy_and_keys();
    setup_context("alice.near", TEST_TIMESTAMP_SEC);
    let mut contract = InterceptPolicyContract::new(policy.clone());

    // Switch caller to the scoped AI agent account
    setup_context("agent.intercept.near", TEST_TIMESTAMP_SEC);

    let deposit_addr: [u8; 20] = [0x99; 20];
    let repay_amount_usdc: u128 = 50_000_000; // 50.00 USDC
    let min_amount_out: u128 = 49_750_000; // 49.75 USDC (0.50% slippage <= 1.00% max)

    let receipt = sign_test_receipt(
        &tee_sk,
        &policy.user_kamino_obligation_pubkey,
        RiskRegime::CascadeDeepRescue,
        repay_amount_usdc,
        min_amount_out,
        &deposit_addr,
        TEST_TIMESTAMP_SEC,
    );

    let calldata = build_erc20_transfer_calldata(&deposit_addr, repay_amount_usdc);
    let unsigned_eip1559 = build_unsigned_eip1559_tx(
        BASE_MAINNET_CHAIN_ID,
        7,
        1_500_000,
        30_000_000,
        65_000,
        &BASE_USDC_ADDRESS,
        0,
        &calldata,
    );
    let unsigned_eip1559_hex = format!("0x{}", hex::encode(&unsigned_eip1559));

    // Verify dry-run view method first
    let verified_leg1 = contract.verify_rescue_origin_leg(
        receipt.clone(),
        policy.mpc_solana_payer_pubkey.clone(),
        unsigned_eip1559_hex.clone(),
    );
    assert_eq!(verified_leg1.chain_id, BASE_MAINNET_CHAIN_ID);
    assert_eq!(verified_leg1.transfer_amount_usdc, repay_amount_usdc);
    assert_eq!(verified_leg1.recipient_deposit_address, deposit_addr);

    // Execute Leg 1 state transition + v1.signer cross-contract call -> state becomes InFlightLeg1
    let _promise_leg1 = contract.request_rescue_origin_leg(
        receipt.clone(),
        policy.mpc_solana_payer_pubkey.clone(),
        unsigned_eip1559_hex,
    );

    let telemetry = contract.get_telemetry();
    assert_eq!(telemetry.rolling_24h_spent_usdc, repay_amount_usdc);
    assert_eq!(telemetry.total_rescues_authorized, 1);
    assert_eq!(telemetry.pending_leg2_authorizations.len(), 1);
    assert_eq!(
        telemetry.pending_leg2_authorizations[0].state,
        RescueLifecycleState::InFlightLeg1
    );
    let receipt_hash_hex = telemetry.pending_leg2_authorizations[0]
        .receipt_hash_hex
        .clone();

    // Simulate successful v1.signer callback for Leg 1 -> state transitions InFlightLeg1 -> ReadyForLeg2
    let mock_secp256k1_json = near_sdk::serde_json::json!({
        "scheme": "Secp256k1",
        "big_r": { "affine_point": "02aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899" },
        "s": { "scalar": "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff" },
        "recovery_id": 0
    });
    let leg1_out = contract.on_origin_leg_signed(
        receipt_hash_hex.clone(),
        hex::encode(verified_leg1.signing_hash_keccak256),
        repay_amount_usdc,
        Ok(mock_secp256k1_json),
    );
    assert!(leg1_out.is_some());
    assert_eq!(
        contract.get_telemetry().pending_leg2_authorizations[0].state,
        RescueLifecycleState::ReadyForLeg2
    );

    // Now build Leg 2 Solana V0 message for Kamino `repay_obligation_liquidity_v2`
    let solana_v0_msg = build_solana_kamino_repay_message(
        true,
        &mpc_solana_payer,
        &user_obligation,
        &lending_market,
        &KAMINO_MAINNET_USDC_RESERVE_PUBKEY,
        &[0x55; 32],
        &[0x66; 32],
        &[0x77; 32],
        &[0x88; 32],
        &[0xaa; 32],
        49_850_000, // actual settled USDC on Solana within [min_amount_out..=repay_amount_usdc]
        true,       // v2 discriminator [116, 174, 213, 76, 180, 53, 210, 144]
        true,
    );

    let _promise_leg2 = contract.request_rescue_destination_leg(
        receipt_hash_hex.clone(),
        hex::encode(&solana_v0_msg),
    );

    let telemetry_mid = contract.get_telemetry();
    assert_eq!(
        telemetry_mid.pending_leg2_authorizations[0].state,
        RescueLifecycleState::InFlightLeg2
    );
    assert!(!telemetry_mid.pending_leg2_authorizations[0].leg2_completed);

    // Simulate successful v1.signer callback for Leg 2 -> state transitions InFlightLeg2 -> Completed
    let mock_ed25519_json = near_sdk::serde_json::json!({
        "scheme": "Ed25519",
        "signature": vec![0x55u8; 64]
    });
    let leg2_out = contract.on_destination_leg_signed(
        receipt_hash_hex,
        solana_v0_msg.len(),
        Ok(mock_ed25519_json),
    );
    assert!(leg2_out.is_some());

    let telemetry_after = contract.get_telemetry();
    assert_eq!(
        telemetry_after.pending_leg2_authorizations[0].state,
        RescueLifecycleState::Completed
    );
    assert!(telemetry_after.pending_leg2_authorizations[0].leg2_completed);

    // Also verify v1 discriminator [145, 178, 13, 225, 76, 240, 147, 72] works in view verifier
    let solana_legacy_v1_msg = build_solana_kamino_repay_message(
        false,
        &mpc_solana_payer,
        &user_obligation,
        &lending_market,
        &KAMINO_MAINNET_USDC_RESERVE_PUBKEY,
        &[0x55; 32],
        &[0x66; 32],
        &[0x77; 32],
        &[0x88; 32],
        &[0xbb; 32],
        49_850_000,
        false, // v1 discriminator [145, 178, 13, 225, 76, 240, 147, 72]
        true,
    );
    let verified_v1 = contract.verify_rescue_destination_leg(
        hex::encode(&solana_legacy_v1_msg),
        49_750_000,
        50_000_000,
    );
    assert!(!verified_v1.is_v2_instruction);
    assert_eq!(verified_v1.repay_amount_usdc, 49_850_000);
    assert_eq!(
        verified_v1.repay_reserve_pubkey,
        KAMINO_MAINNET_USDC_RESERVE_PUBKEY
    );
}

#[test]
fn test_adversarial_evm_attacks_rejected() {
    let deposit_addr: [u8; 20] = [0x99; 20];
    let repay_amount: u128 = 25_000_000;
    let valid_calldata = build_erc20_transfer_calldata(&deposit_addr, repay_amount);

    // 1. Attack: Wrong chain_id (Ethereum Mainnet 1 instead of Base 8453)
    let wrong_chain_tx = build_unsigned_eip1559_tx(
        1,
        0,
        1_000_000,
        20_000_000,
        60_000,
        &BASE_USDC_ADDRESS,
        0,
        &valid_calldata,
    );
    assert_eq!(
        verify_eip1559_base_usdc_transfer(&wrong_chain_tx, &deposit_addr, repay_amount),
        Err(EvmParseError::InvalidChainId {
            expected: BASE_MAINNET_CHAIN_ID,
            actual: 1
        })
    );

    // 2. Attack: Wrong target contract (attacker contract instead of Base USDC)
    let rogue_token = [0xde; 20];
    let wrong_token_tx = build_unsigned_eip1559_tx(
        BASE_MAINNET_CHAIN_ID,
        0,
        1_000_000,
        20_000_000,
        60_000,
        &rogue_token,
        0,
        &valid_calldata,
    );
    assert_eq!(
        verify_eip1559_base_usdc_transfer(&wrong_token_tx, &deposit_addr, repay_amount),
        Err(EvmParseError::InvalidTargetContract {
            expected: BASE_USDC_ADDRESS,
            actual: rogue_token.to_vec()
        })
    );

    // 3. Attack: Non-zero native ETH value attached
    let eth_drain_tx = build_unsigned_eip1559_tx(
        BASE_MAINNET_CHAIN_ID,
        0,
        1_000_000,
        20_000_000,
        60_000,
        &BASE_USDC_ADDRESS,
        1_000_000_000_000_000, // 0.001 ETH
        &valid_calldata,
    );
    assert_eq!(
        verify_eip1559_base_usdc_transfer(&eth_drain_tx, &deposit_addr, repay_amount),
        Err(EvmParseError::NonZeroNativeValue(1_000_000_000_000_000))
    );

    // 4. Attack: ERC-20 `approve(attacker, amount)` instead of `transfer(depositAddress, amount)`
    let mut approve_calldata = valid_calldata;
    approve_calldata[0..4].copy_from_slice(&ERC20_APPROVE_SELECTOR);
    let approve_tx = build_unsigned_eip1559_tx(
        BASE_MAINNET_CHAIN_ID,
        0,
        1_000_000,
        20_000_000,
        60_000,
        &BASE_USDC_ADDRESS,
        0,
        &approve_calldata,
    );
    assert_eq!(
        verify_eip1559_base_usdc_transfer(&approve_tx, &deposit_addr, repay_amount),
        Err(EvmParseError::ForbiddenFunctionSelector(
            ERC20_APPROVE_SELECTOR
        ))
    );

    // 5. Attack: Recipient hijack (sending Base USDC to attacker wallet instead of 1-Click depositAddress)
    let attacker_wallet = [0xfe; 20];
    let hijack_calldata = build_erc20_transfer_calldata(&attacker_wallet, repay_amount);
    let hijack_tx = build_unsigned_eip1559_tx(
        BASE_MAINNET_CHAIN_ID,
        0,
        1_000_000,
        20_000_000,
        60_000,
        &BASE_USDC_ADDRESS,
        0,
        &hijack_calldata,
    );
    assert_eq!(
        verify_eip1559_base_usdc_transfer(&hijack_tx, &deposit_addr, repay_amount),
        Err(EvmParseError::DepositAddressMismatch {
            expected: deposit_addr,
            actual: attacker_wallet
        })
    );

    // 6. Attack: Inflated transfer amount in calldata vs TEE receipt
    let inflated_calldata = build_erc20_transfer_calldata(&deposit_addr, repay_amount + 1);
    let inflated_tx = build_unsigned_eip1559_tx(
        BASE_MAINNET_CHAIN_ID,
        0,
        1_000_000,
        20_000_000,
        60_000,
        &BASE_USDC_ADDRESS,
        0,
        &inflated_calldata,
    );
    assert_eq!(
        verify_eip1559_base_usdc_transfer(&inflated_tx, &deposit_addr, repay_amount),
        Err(EvmParseError::TransferAmountMismatch {
            expected: repay_amount,
            actual: repay_amount + 1
        })
    );
}

#[test]
fn test_adversarial_solana_kamino_attacks_rejected() {
    let mpc_solana_payer = [0x22; 32];
    let user_obligation = [0x33; 32];
    let lending_market = KAMINO_MAIN_MARKET_PUBKEY;
    let sol_reserve = KAMINO_MAINNET_SOL_RESERVE_PUBKEY;
    let usdc_reserve = KAMINO_MAINNET_USDC_RESERVE_PUBKEY;

    // 1. Attack: Rogue AI constructs Kamino `withdraw_obligation_collateral_v2` instead of repay
    let mut withdraw_msg = build_solana_kamino_repay_message(
        true,
        &mpc_solana_payer,
        &user_obligation,
        &lending_market,
        &usdc_reserve,
        &[0x55; 32],
        &[0x66; 32],
        &[0x77; 32],
        &[0x88; 32],
        &[0xaa; 32],
        10_000_000,
        true,
        false,
    );
    // Locate the 8-byte discriminator in the serialized message and swap it to withdraw_obligation_collateral_v2
    let disc_pos = withdraw_msg
        .windows(8)
        .position(|w| w == REPAY_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR)
        .unwrap();
    withdraw_msg[disc_pos..disc_pos + 8]
        .copy_from_slice(&WITHDRAW_OBLIGATION_COLLATERAL_V2_DISCRIMINATOR);

    assert_eq!(
        verify_solana_kamino_repay_message(
            &withdraw_msg,
            &mpc_solana_payer,
            &user_obligation,
            &lending_market,
            &sol_reserve,
            &usdc_reserve,
            10_000_000,
            10_000_000
        ),
        Err(SolanaParseError::ForbiddenKaminoInstructionDiscriminator(
            WITHDRAW_OBLIGATION_COLLATERAL_V2_DISCRIMINATOR
        ))
    );

    // 2. Attack: Rogue AI constructs Kamino `borrow_obligation_liquidity_v2`
    let mut borrow_msg = withdraw_msg.clone();
    borrow_msg[disc_pos..disc_pos + 8]
        .copy_from_slice(&BORROW_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR);
    assert_eq!(
        verify_solana_kamino_repay_message(
            &borrow_msg,
            &mpc_solana_payer,
            &user_obligation,
            &lending_market,
            &sol_reserve,
            &usdc_reserve,
            10_000_000,
            10_000_000
        ),
        Err(SolanaParseError::ForbiddenKaminoInstructionDiscriminator(
            BORROW_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR
        ))
    );

    // 3. Attack: Rogue AI tries to repay an attacker's Kamino Obligation instead of the user's Obligation
    let attacker_obligation = [0xee; 32];
    let wrong_obligation_msg = build_solana_kamino_repay_message(
        true,
        &mpc_solana_payer,
        &attacker_obligation,
        &lending_market,
        &usdc_reserve,
        &[0x55; 32],
        &[0x66; 32],
        &[0x77; 32],
        &[0x88; 32],
        &[0xaa; 32],
        10_000_000,
        true,
        true,
    );
    assert_eq!(
        verify_solana_kamino_repay_message(
            &wrong_obligation_msg,
            &mpc_solana_payer,
            &user_obligation,
            &lending_market,
            &sol_reserve,
            &usdc_reserve,
            10_000_000,
            10_000_000
        ),
        Err(SolanaParseError::ObligationPubkeyMismatch {
            expected: user_obligation,
            actual: attacker_obligation
        })
    );

    // 4. Attack: Rogue AI includes an unauthorized program (e.g. SystemProgram = [0u8; 32])
    let mut unauthorized_prog_msg = build_solana_kamino_repay_message(
        false,
        &mpc_solana_payer,
        &user_obligation,
        &lending_market,
        &usdc_reserve,
        &[0x55; 32],
        &[0x66; 32],
        &[0x77; 32],
        &[0x88; 32],
        &[0xaa; 32],
        10_000_000,
        true,
        true,
    );
    // Replace COMPUTE_BUDGET_PUBKEY in static keys with SystemProgram ([0u8; 32])
    let cb_pos = unauthorized_prog_msg
        .windows(32)
        .position(|w| w == COMPUTE_BUDGET_PUBKEY)
        .unwrap();
    unauthorized_prog_msg[cb_pos..cb_pos + 32].copy_from_slice(&[0u8; 32]);
    assert_eq!(
        verify_solana_kamino_repay_message(
            &unauthorized_prog_msg,
            &mpc_solana_payer,
            &user_obligation,
            &lending_market,
            &sol_reserve,
            &usdc_reserve,
            10_000_000,
            10_000_000
        ),
        Err(SolanaParseError::UnauthorizedProgram {
            program_id: [0u8; 32]
        })
    );

    // 5. Attack: V0 message with non-empty Address Lookup Table indirection
    let mut v0_alt_msg = build_solana_kamino_repay_message(
        true,
        &mpc_solana_payer,
        &user_obligation,
        &lending_market,
        &usdc_reserve,
        &[0x55; 32],
        &[0x66; 32],
        &[0x77; 32],
        &[0x88; 32],
        &[0xaa; 32],
        10_000_000,
        true,
        false,
    );
    // Replace trailing 0x00 (0 ALTs) with 1 ALT lookup
    v0_alt_msg.pop();
    encode_compact_u16(1, &mut v0_alt_msg);
    assert_eq!(
        verify_solana_kamino_repay_message(
            &v0_alt_msg,
            &mpc_solana_payer,
            &user_obligation,
            &lending_market,
            &sol_reserve,
            &usdc_reserve,
            10_000_000,
            10_000_000
        ),
        Err(SolanaParseError::OpaqueAddressTableLookupsForbidden(1))
    );
}

#[test]
#[should_panic(expected = "CRITICAL SECURITY BLOCK: Ed25519 signature verification failed")]
fn test_adversarial_forged_tee_signature_reverts() {
    let (policy, _tee_sk, _base_vault, _mpc_solana_payer, _user_obligation, _lending_market) =
        sample_policy_and_keys();
    setup_context("alice.near", TEST_TIMESTAMP_SEC);
    let mut contract = InterceptPolicyContract::new(policy.clone());

    setup_context("agent.intercept.near", TEST_TIMESTAMP_SEC);
    let rogue_sk = deterministic_signing_key(0x99); // untrusted keypair
    let deposit_addr = [0x99; 20];
    let repay_amount = 10_000_000u128;

    let forged_receipt = sign_test_receipt(
        &rogue_sk,
        &policy.user_kamino_obligation_pubkey,
        RiskRegime::MicroBufferRescue,
        repay_amount,
        9_950_000,
        &deposit_addr,
        TEST_TIMESTAMP_SEC,
    );
    let calldata = build_erc20_transfer_calldata(&deposit_addr, repay_amount);
    let tx = build_unsigned_eip1559_tx(
        BASE_MAINNET_CHAIN_ID,
        1,
        1_000_000,
        20_000_000,
        60_000,
        &BASE_USDC_ADDRESS,
        0,
        &calldata,
    );

    let _ = contract.request_rescue_origin_leg(
        forged_receipt,
        policy.mpc_solana_payer_pubkey,
        hex::encode(tx),
    );
}

#[test]
#[should_panic(expected = "TeeDecisionReceipt replay detected")]
fn test_adversarial_tee_receipt_replay_reverts() {
    let (policy, tee_sk, _base_vault, _mpc_solana_payer, _user_obligation, _lending_market) =
        sample_policy_and_keys();
    setup_context("alice.near", TEST_TIMESTAMP_SEC);
    let mut contract = InterceptPolicyContract::new(policy.clone());

    setup_context("agent.intercept.near", TEST_TIMESTAMP_SEC);
    let deposit_addr = [0x99; 20];
    let repay_amount = 10_000_000u128;

    let receipt = sign_test_receipt(
        &tee_sk,
        &policy.user_kamino_obligation_pubkey,
        RiskRegime::MicroBufferRescue,
        repay_amount,
        9_950_000,
        &deposit_addr,
        TEST_TIMESTAMP_SEC,
    );
    let calldata = build_erc20_transfer_calldata(&deposit_addr, repay_amount);
    let tx = build_unsigned_eip1559_tx(
        BASE_MAINNET_CHAIN_ID,
        1,
        1_000_000,
        20_000_000,
        60_000,
        &BASE_USDC_ADDRESS,
        0,
        &calldata,
    );
    let tx_hex = hex::encode(tx);

    let _ = contract.request_rescue_origin_leg(
        receipt.clone(),
        policy.mpc_solana_payer_pubkey.clone(),
        tx_hex.clone(),
    );
    // Replaying the exact same signed receipt must panic
    let _ = contract.request_rescue_origin_leg(receipt, policy.mpc_solana_payer_pubkey, tx_hex);
}

#[test]
#[should_panic(expected = "TEE Decision Receipt regime is HOLD; rescue execution is forbidden")]
fn test_adversarial_tee_hold_regime_reverts() {
    let (policy, tee_sk, _base_vault, _mpc_solana_payer, _user_obligation, _lending_market) =
        sample_policy_and_keys();
    setup_context("alice.near", TEST_TIMESTAMP_SEC);
    let mut contract = InterceptPolicyContract::new(policy.clone());

    setup_context("agent.intercept.near", TEST_TIMESTAMP_SEC);
    let deposit_addr = [0x99; 20];
    let repay_amount = 10_000_000u128;

    let hold_receipt = sign_test_receipt(
        &tee_sk,
        &policy.user_kamino_obligation_pubkey,
        RiskRegime::Hold,
        repay_amount,
        9_950_000,
        &deposit_addr,
        TEST_TIMESTAMP_SEC,
    );
    let calldata = build_erc20_transfer_calldata(&deposit_addr, repay_amount);
    let tx = build_unsigned_eip1559_tx(
        BASE_MAINNET_CHAIN_ID,
        1,
        1_000_000,
        20_000_000,
        60_000,
        &BASE_USDC_ADDRESS,
        0,
        &calldata,
    );
    let _ = contract.request_rescue_origin_leg(
        hold_receipt,
        policy.mpc_solana_payer_pubkey,
        hex::encode(tx),
    );
}

#[test]
#[should_panic(expected = "violates policy max_slippage_bps")]
fn test_adversarial_tee_slippage_breach_reverts() {
    let (policy, tee_sk, _base_vault, _mpc_solana_payer, _user_obligation, _lending_market) =
        sample_policy_and_keys();
    setup_context("alice.near", TEST_TIMESTAMP_SEC);
    let mut contract = InterceptPolicyContract::new(policy.clone());

    setup_context("agent.intercept.near", TEST_TIMESTAMP_SEC);
    let deposit_addr = [0x99; 20];
    let repay_amount = 100_000_000u128; // 100 USDC
    // Max slippage is 100 bps (1%), so min_amount_out must be >= 99_000_000. Pass 95_000_000 (5% slippage).
    let bad_slippage_receipt = sign_test_receipt(
        &tee_sk,
        &policy.user_kamino_obligation_pubkey,
        RiskRegime::CascadeDeepRescue,
        repay_amount,
        95_000_000,
        &deposit_addr,
        TEST_TIMESTAMP_SEC,
    );
    let calldata = build_erc20_transfer_calldata(&deposit_addr, repay_amount);
    let tx = build_unsigned_eip1559_tx(
        BASE_MAINNET_CHAIN_ID,
        1,
        1_000_000,
        20_000_000,
        60_000,
        &BASE_USDC_ADDRESS,
        0,
        &calldata,
    );
    let _ = contract.request_rescue_origin_leg(
        bad_slippage_receipt,
        policy.mpc_solana_payer_pubkey,
        hex::encode(tx),
    );
}

#[test]
#[should_panic(expected = "GUARDRAIL REVERT (DAILY LIMIT)")]
fn test_adversarial_daily_spending_limit_exceeded_reverts() {
    let (policy, tee_sk, _base_vault, _mpc_solana_payer, _user_obligation, _lending_market) =
        sample_policy_and_keys();
    setup_context("alice.near", TEST_TIMESTAMP_SEC);
    let mut contract = InterceptPolicyContract::new(policy.clone());

    setup_context("agent.intercept.near", TEST_TIMESTAMP_SEC);
    let deposit_addr = [0x99; 20];
    // Policy allows 500 USDC per action, 1000 USDC daily. Execute two 500 USDC rescues, then a 3rd in same 24h window.
    for i in 0..3u64 {
        let ts = TEST_TIMESTAMP_SEC + i * 10;
        setup_context("agent.intercept.near", ts);
        let receipt = sign_test_receipt(
            &tee_sk,
            &policy.user_kamino_obligation_pubkey,
            RiskRegime::CascadeDeepRescue,
            500_000_000,
            498_000_000,
            &deposit_addr,
            ts,
        );
        let calldata = build_erc20_transfer_calldata(&deposit_addr, 500_000_000);
        let tx = build_unsigned_eip1559_tx(
            BASE_MAINNET_CHAIN_ID,
            i,
            1_000_000,
            20_000_000,
            60_000,
            &BASE_USDC_ADDRESS,
            0,
            &calldata,
        );
        let _ = contract.request_rescue_origin_leg(
            receipt,
            policy.mpc_solana_payer_pubkey.clone(),
            hex::encode(tx),
        );
    }
}

#[test]
#[should_panic(expected = "UNAUTHORIZED: Only policy owner")]
fn test_adversarial_agent_cannot_update_policy() {
    let (policy, _tee_sk, _base_vault, _mpc_solana_payer, _user_obligation, _lending_market) =
        sample_policy_and_keys();
    setup_context("alice.near", TEST_TIMESTAMP_SEC);
    let mut contract = InterceptPolicyContract::new(policy.clone());

    // Scoped AI agent attempts to raise its own spending limit
    setup_context("agent.intercept.near", TEST_TIMESTAMP_SEC);
    let mut hijacked_policy = policy;
    hijacked_policy.max_per_action_usdc = 1_000_000_000_000;
    contract.update_policy(hijacked_policy);
}

#[test]
fn test_full_kamino_same_slot_refresh_and_repay_sequence_passes() {
    let (policy, _tee_sk, _base_vault, mpc_solana_payer, user_obligation, lending_market) =
        sample_policy_and_keys();
    setup_context("alice.near", TEST_TIMESTAMP_SEC);
    let contract = InterceptPolicyContract::new(policy);

    // Construct the realistic 5-instruction Solana Mainnet V0 transaction:
    // [ComputeBudget, refresh_reserve (SOL), refresh_reserve (USDC), refresh_obligation, repay_obligation_liquidity_v2]
    let full_refresh_repay_msg = build_solana_kamino_full_refresh_and_repay_message(
        true,
        &mpc_solana_payer,
        &user_obligation,
        &lending_market,
        &KAMINO_MAINNET_SOL_RESERVE_PUBKEY,
        &KAMINO_MAINNET_USDC_RESERVE_PUBKEY,
        &[0x55; 32], // reserve destination liquidity
        &[0x66; 32], // user source liquidity (MPC Solana USDC ATA)
        &[0x77; 32], // Pyth SOL oracle
        &[0x88; 32], // Pyth USDC oracle
        &[0x91; 32], // Token Program
        &[0x92; 32], // Instruction Sysvar
        &[0xaa; 32], // recent blockhash
        10_000_000,  // 10.00 USDC
    );

    let verified = contract.verify_rescue_destination_leg(
        hex::encode(&full_refresh_repay_msg),
        9_900_000,
        10_000_000,
    );
    assert!(verified.is_versioned_v0);
    assert!(verified.is_v2_instruction);
    assert_eq!(verified.compute_budget_ix_count, 1);
    assert_eq!(verified.kamino_refresh_ix_count, 3);
    assert_eq!(verified.repay_amount_usdc, 10_000_000);
    assert_eq!(verified.obligation_pubkey, user_obligation);
    assert_eq!(verified.lending_market_pubkey, lending_market);
    assert_eq!(
        verified.repay_reserve_pubkey,
        KAMINO_MAINNET_USDC_RESERVE_PUBKEY
    );
}

#[test]
fn test_adversarial_sneak_withdraw_after_refresh_reverts() {
    let mpc_solana_payer = [0x22; 32];
    let user_obligation = [0x33; 32];
    let lending_market = KAMINO_MAIN_MARKET_PUBKEY;
    let sol_reserve = KAMINO_MAINNET_SOL_RESERVE_PUBKEY;
    let usdc_reserve = KAMINO_MAINNET_USDC_RESERVE_PUBKEY;

    // Start with a valid 5-instruction [ComputeBudget, refresh_reserve(SOL), refresh_reserve(USDC), refresh_obligation, repay_obligation_liquidity_v2]
    let valid_full_msg = build_solana_kamino_full_refresh_and_repay_message(
        true,
        &mpc_solana_payer,
        &user_obligation,
        &lending_market,
        &sol_reserve,
        &usdc_reserve,
        &[0x55; 32],
        &[0x66; 32],
        &[0x77; 32],
        &[0x88; 32],
        &[0x91; 32],
        &[0x92; 32],
        &[0xaa; 32],
        10_000_000,
    );

    // 1. Attack: Swap the final instruction discriminator from `repay_obligation_liquidity_v2` to `withdraw_obligation_collateral_v2`
    let mut sneak_withdraw_msg = valid_full_msg.clone();
    let repay_pos = sneak_withdraw_msg
        .windows(8)
        .position(|w| w == REPAY_OBLIGATION_LIQUIDITY_V2_DISCRIMINATOR)
        .unwrap();
    sneak_withdraw_msg[repay_pos..repay_pos + 8]
        .copy_from_slice(&WITHDRAW_OBLIGATION_COLLATERAL_V2_DISCRIMINATOR);

    assert_eq!(
        verify_solana_kamino_repay_message(
            &sneak_withdraw_msg,
            &mpc_solana_payer,
            &user_obligation,
            &lending_market,
            &sol_reserve,
            &usdc_reserve,
            9_900_000,
            10_000_000,
        ),
        Err(SolanaParseError::ForbiddenKaminoInstructionDiscriminator(
            WITHDRAW_OBLIGATION_COLLATERAL_V2_DISCRIMINATOR
        ))
    );

    // 2. Attack: Swap one of the preceding `refresh_reserve` instructions to `withdraw_obligation_collateral_v2`
    let mut sneak_withdraw_in_refresh_slot = valid_full_msg.clone();
    let refresh_pos = sneak_withdraw_in_refresh_slot
        .windows(8)
        .position(|w| w == REFRESH_RESERVE_DISCRIMINATOR)
        .unwrap();
    sneak_withdraw_in_refresh_slot[refresh_pos..refresh_pos + 8]
        .copy_from_slice(&WITHDRAW_OBLIGATION_COLLATERAL_V2_DISCRIMINATOR);

    assert_eq!(
        verify_solana_kamino_repay_message(
            &sneak_withdraw_in_refresh_slot,
            &mpc_solana_payer,
            &user_obligation,
            &lending_market,
            &sol_reserve,
            &usdc_reserve,
            9_900_000,
            10_000_000,
        ),
        Err(SolanaParseError::ForbiddenKaminoInstructionDiscriminator(
            WITHDRAW_OBLIGATION_COLLATERAL_V2_DISCRIMINATOR
        ))
    );

    // 3. Attack: Transaction contains ONLY refresh instructions and zero repay instructions
    let mut only_refreshes_msg = valid_full_msg;
    only_refreshes_msg[repay_pos..repay_pos + 8].copy_from_slice(&REFRESH_OBLIGATION_DISCRIMINATOR);
    assert_eq!(
        verify_solana_kamino_repay_message(
            &only_refreshes_msg,
            &mpc_solana_payer,
            &user_obligation,
            &lending_market,
            &sol_reserve,
            &usdc_reserve,
            9_900_000,
            10_000_000,
        ),
        Err(SolanaParseError::InvalidKaminoInstructionDataLength(16))
    );
}

#[test]
fn test_v1_signer_payload_v2_ecdsa_vs_eddsa_raw_message_and_callbacks() {
    let (policy, tee_sk, _base_vault, mpc_solana_payer, user_obligation, lending_market) =
        sample_policy_and_keys();
    setup_context("alice.near", TEST_TIMESTAMP_SEC);
    let mut contract = InterceptPolicyContract::new(policy.clone());

    setup_context("agent.intercept.near", TEST_TIMESTAMP_SEC);
    let deposit_addr = [0x99; 20];
    let repay_amount = 10_000_000u128; // $10.00 USDC
    let min_amount_out = 9_950_000u128;

    let receipt = sign_test_receipt(
        &tee_sk,
        &policy.user_kamino_obligation_pubkey,
        RiskRegime::MicroBufferRescue,
        repay_amount,
        min_amount_out,
        &deposit_addr,
        TEST_TIMESTAMP_SEC,
    );
    let calldata = build_erc20_transfer_calldata(&deposit_addr, repay_amount);
    let unsigned_eip1559 = build_unsigned_eip1559_tx(
        BASE_MAINNET_CHAIN_ID,
        12,
        1_500_000,
        25_000_000,
        65_000,
        &BASE_USDC_ADDRESS,
        0,
        &calldata,
    );

    // Verify Leg 1 `v1.signer::sign` payload uses `domain_id: 0` and `SignPayloadV2::Ecdsa` (32-byte Keccak256 digest)
    let verified_evm = contract.verify_rescue_origin_leg(
        receipt.clone(),
        policy.mpc_solana_payer_pubkey.clone(),
        hex::encode(&unsigned_eip1559),
    );
    let leg1_sign_args = contract.build_origin_leg_sign_args(&verified_evm.signing_hash_keccak256);
    assert_eq!(leg1_sign_args.request.domain_id, DOMAIN_ID_SECP256K1);
    assert_eq!(leg1_sign_args.request.payload.len(), 32);
    assert_eq!(
        leg1_sign_args.request.payload_v2,
        SignPayloadV2::Ecdsa(hex::encode(verified_evm.signing_hash_keccak256))
    );

    // Execute Leg 1 and test `on_origin_leg_signed` callback parsing
    let _ = contract.request_rescue_origin_leg(
        receipt.clone(),
        policy.mpc_solana_payer_pubkey.clone(),
        hex::encode(&unsigned_eip1559),
    );
    let receipt_hash_hex = hex::encode(receipt.receipt_hash());
    let keccak_hex = hex::encode(verified_evm.signing_hash_keccak256);

    let mock_secp256k1_json = near_sdk::serde_json::json!({
        "scheme": "Secp256k1",
        "big_r": { "affine_point": "02aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899" },
        "s": { "scalar": "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff" },
        "recovery_id": 1
    });
    let leg1_out = contract
        .on_origin_leg_signed(
            receipt_hash_hex.clone(),
            keccak_hex.clone(),
            repay_amount,
            Ok(mock_secp256k1_json),
        )
        .expect("on_origin_leg_signed should succeed");
    assert_eq!(leg1_out.domain_id, DOMAIN_ID_SECP256K1);
    assert_eq!(leg1_out.recovery_id, 1);
    assert_eq!(
        contract
            .get_telemetry()
            .pending_leg2_authorizations[0]
            .leg1_signature,
        Some(leg1_out)
    );

    // Build full 5-instruction Solana message and verify Leg 2 `v1.signer::sign` payload uses
    // `domain_id: 1` and `SignPayloadV2::Eddsa` over the RAW serialized Solana Message bytes (NEVER a 32-byte hash)
    let solana_full_msg = build_solana_kamino_full_refresh_and_repay_message(
        true,
        &mpc_solana_payer,
        &user_obligation,
        &lending_market,
        &KAMINO_MAINNET_SOL_RESERVE_PUBKEY,
        &KAMINO_MAINNET_USDC_RESERVE_PUBKEY,
        &[0x55; 32],
        &[0x66; 32],
        &[0x77; 32],
        &[0x88; 32],
        &[0x91; 32],
        &[0x92; 32],
        &[0xaa; 32],
        9_980_000,
    );
    assert!(solana_full_msg.len() > 300 && solana_full_msg.len() <= 1232);

    let leg2_sign_args = contract.build_destination_leg_sign_args(&solana_full_msg);
    assert_eq!(leg2_sign_args.request.domain_id, DOMAIN_ID_ED25519);
    assert_eq!(leg2_sign_args.request.payload, solana_full_msg);
    assert_eq!(
        leg2_sign_args.request.payload_v2,
        SignPayloadV2::Eddsa(hex::encode(&solana_full_msg))
    );

    let _ = contract.request_rescue_destination_leg(
        receipt_hash_hex.clone(),
        hex::encode(&solana_full_msg),
    );

    let mock_ed25519_sig_bytes = vec![0x77u8; 64];
    let mock_ed25519_json = near_sdk::serde_json::json!({
        "scheme": "Ed25519",
        "signature": mock_ed25519_sig_bytes
    });
    let leg2_out = contract
        .on_destination_leg_signed(
            receipt_hash_hex,
            solana_full_msg.len(),
            Ok(mock_ed25519_json),
        )
        .expect("on_destination_leg_signed should succeed");
    assert_eq!(leg2_out.domain_id, DOMAIN_ID_ED25519);
    assert_eq!(leg2_out.raw_message_byte_len, solana_full_msg.len());
    assert_eq!(leg2_out.ed25519_signature_hex, hex::encode([0x77u8; 64]));
}

#[test]
#[should_panic(expected = "Solana Ed25519 requires raw serialized Message bytes (64..=1232 bytes), got 32 bytes (32-byte pre-hash is forbidden)")]
fn test_adversarial_solana_32_byte_prehash_rejected() {
    let (policy, _tee_sk, _base_vault, _mpc_solana_payer, _user_obligation, _lending_market) =
        sample_policy_and_keys();
    setup_context("alice.near", TEST_TIMESTAMP_SEC);
    let contract = InterceptPolicyContract::new(policy);

    // Passing a 32-byte SHA-256 hash instead of the raw Solana Message bytes must revert immediately
    let prehash_32_bytes = hex::encode([0xabu8; 32]);
    let _ = contract.verify_rescue_destination_leg(prehash_32_bytes, 9_900_000, 10_000_000);
}

#[test]
#[should_panic(expected = "Leg 1 is still InFlightLeg1")]
fn test_adversarial_leg2_while_leg1_inflight_reverts() {
    let (policy, tee_sk, _base_vault, mpc_solana_payer, user_obligation, lending_market) =
        sample_policy_and_keys();
    setup_context("alice.near", TEST_TIMESTAMP_SEC);
    let mut contract = InterceptPolicyContract::new(policy.clone());

    setup_context("agent.intercept.near", TEST_TIMESTAMP_SEC);
    let deposit_addr = [0x99; 20];
    let repay_amount = 10_000_000u128;
    let receipt = sign_test_receipt(
        &tee_sk,
        &policy.user_kamino_obligation_pubkey,
        RiskRegime::MicroBufferRescue,
        repay_amount,
        9_950_000,
        &deposit_addr,
        TEST_TIMESTAMP_SEC,
    );
    let calldata = build_erc20_transfer_calldata(&deposit_addr, repay_amount);
    let tx = build_unsigned_eip1559_tx(
        BASE_MAINNET_CHAIN_ID,
        1,
        1_000_000,
        20_000_000,
        60_000,
        &BASE_USDC_ADDRESS,
        0,
        &calldata,
    );

    let _ = contract.request_rescue_origin_leg(
        receipt.clone(),
        policy.mpc_solana_payer_pubkey.clone(),
        hex::encode(tx),
    );
    let receipt_hash_hex = hex::encode(receipt.receipt_hash());

    let solana_full_msg = build_solana_kamino_full_refresh_and_repay_message(
        true,
        &mpc_solana_payer,
        &user_obligation,
        &lending_market,
        &KAMINO_MAINNET_SOL_RESERVE_PUBKEY,
        &KAMINO_MAINNET_USDC_RESERVE_PUBKEY,
        &[0x55; 32],
        &[0x66; 32],
        &[0x77; 32],
        &[0x88; 32],
        &[0x91; 32],
        &[0x92; 32],
        &[0xaa; 32],
        9_980_000,
    );

    // Attempting to call `request_rescue_destination_leg` BEFORE `on_origin_leg_signed` callback transitions state to ReadyForLeg2 must revert!
    let _ = contract.request_rescue_destination_leg(receipt_hash_hex, hex::encode(solana_full_msg));
}

#[test]
#[should_panic(expected = "Leg 2 is already InFlightLeg2")]
fn test_adversarial_concurrent_leg2_while_inflight_reverts() {
    let (policy, tee_sk, _base_vault, mpc_solana_payer, user_obligation, lending_market) =
        sample_policy_and_keys();
    setup_context("alice.near", TEST_TIMESTAMP_SEC);
    let mut contract = InterceptPolicyContract::new(policy.clone());

    setup_context("agent.intercept.near", TEST_TIMESTAMP_SEC);
    let deposit_addr = [0x99; 20];
    let repay_amount = 10_000_000u128;
    let receipt = sign_test_receipt(
        &tee_sk,
        &policy.user_kamino_obligation_pubkey,
        RiskRegime::MicroBufferRescue,
        repay_amount,
        9_950_000,
        &deposit_addr,
        TEST_TIMESTAMP_SEC,
    );
    let calldata = build_erc20_transfer_calldata(&deposit_addr, repay_amount);
    let tx = build_unsigned_eip1559_tx(
        BASE_MAINNET_CHAIN_ID,
        1,
        1_000_000,
        20_000_000,
        60_000,
        &BASE_USDC_ADDRESS,
        0,
        &calldata,
    );

    let _ = contract.request_rescue_origin_leg(
        receipt.clone(),
        policy.mpc_solana_payer_pubkey.clone(),
        hex::encode(tx),
    );
    let receipt_hash_hex = hex::encode(receipt.receipt_hash());

    let mock_secp256k1_json = near_sdk::serde_json::json!({
        "scheme": "Secp256k1",
        "big_r": { "affine_point": "02aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899" },
        "s": { "scalar": "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff" },
        "recovery_id": 0
    });
    let _ = contract.on_origin_leg_signed(
        receipt_hash_hex.clone(),
        hex::encode([0x11u8; 32]),
        repay_amount,
        Ok(mock_secp256k1_json),
    );

    let solana_full_msg = build_solana_kamino_full_refresh_and_repay_message(
        true,
        &mpc_solana_payer,
        &user_obligation,
        &lending_market,
        &KAMINO_MAINNET_SOL_RESERVE_PUBKEY,
        &KAMINO_MAINNET_USDC_RESERVE_PUBKEY,
        &[0x55; 32],
        &[0x66; 32],
        &[0x77; 32],
        &[0x88; 32],
        &[0x91; 32],
        &[0x92; 32],
        &[0xaa; 32],
        9_980_000,
    );
    let solana_hex = hex::encode(solana_full_msg);

    // First Leg 2 call transitions state to InFlightLeg2
    let _ = contract.request_rescue_destination_leg(receipt_hash_hex.clone(), solana_hex.clone());
    // Concurrent second Leg 2 call while still InFlightLeg2 must revert!
    let _ = contract.request_rescue_destination_leg(receipt_hash_hex, solana_hex);
}

#[test]
fn test_leg1_and_leg2_mpc_failure_rollbacks_preserve_funds() {
    let (policy, tee_sk, _base_vault, mpc_solana_payer, user_obligation, lending_market) =
        sample_policy_and_keys();
    setup_context("alice.near", TEST_TIMESTAMP_SEC);
    let mut contract = InterceptPolicyContract::new(policy.clone());

    setup_context("agent.intercept.near", TEST_TIMESTAMP_SEC);
    let deposit_addr = [0x99; 20];
    let repay_amount = 10_000_000u128;
    let receipt = sign_test_receipt(
        &tee_sk,
        &policy.user_kamino_obligation_pubkey,
        RiskRegime::MicroBufferRescue,
        repay_amount,
        9_950_000,
        &deposit_addr,
        TEST_TIMESTAMP_SEC,
    );
    let calldata = build_erc20_transfer_calldata(&deposit_addr, repay_amount);
    let tx = build_unsigned_eip1559_tx(
        BASE_MAINNET_CHAIN_ID,
        1,
        1_000_000,
        20_000_000,
        60_000,
        &BASE_USDC_ADDRESS,
        0,
        &calldata,
    );
    let tx_hex = hex::encode(tx);
    let receipt_hash_hex = hex::encode(receipt.receipt_hash());

    // 1. Dispatch Leg 1 -> deducts rolling_24h_spent_usdc and sets InFlightLeg1
    let _ = contract.request_rescue_origin_leg(
        receipt.clone(),
        policy.mpc_solana_payer_pubkey.clone(),
        tx_hex.clone(),
    );
    assert_eq!(contract.get_telemetry().rolling_24h_spent_usdc, repay_amount);

    // Simulate `v1.signer` failure on Leg 1 -> removes receipt and refunds 24h cap without panicking
    let failed_leg1 = contract.on_origin_leg_signed(
        receipt_hash_hex.clone(),
        hex::encode([0x11u8; 32]),
        repay_amount,
        Err(PromiseError::Failed),
    );
    assert!(failed_leg1.is_none());
    let telemetry_rolled_back = contract.get_telemetry();
    assert_eq!(telemetry_rolled_back.rolling_24h_spent_usdc, 0);
    assert_eq!(telemetry_rolled_back.consumed_receipt_count, 0);
    assert!(telemetry_rolled_back.pending_leg2_authorizations.is_empty());

    // 2. Retry Leg 1 with the same receipt (since it was rolled back) and let `v1.signer` succeed
    let _ = contract.request_rescue_origin_leg(
        receipt,
        policy.mpc_solana_payer_pubkey.clone(),
        tx_hex,
    );
    let mock_secp256k1_json = near_sdk::serde_json::json!({
        "scheme": "Secp256k1",
        "big_r": { "affine_point": "02aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899" },
        "s": { "scalar": "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff" },
        "recovery_id": 0
    });
    let _ = contract.on_origin_leg_signed(
        receipt_hash_hex.clone(),
        hex::encode([0x11u8; 32]),
        repay_amount,
        Ok(mock_secp256k1_json),
    );
    assert_eq!(
        contract.get_telemetry().pending_leg2_authorizations[0].state,
        RescueLifecycleState::ReadyForLeg2
    );

    // 3. Dispatch Leg 2 -> sets InFlightLeg2
    let solana_full_msg = build_solana_kamino_full_refresh_and_repay_message(
        true,
        &mpc_solana_payer,
        &user_obligation,
        &lending_market,
        &KAMINO_MAINNET_SOL_RESERVE_PUBKEY,
        &KAMINO_MAINNET_USDC_RESERVE_PUBKEY,
        &[0x55; 32],
        &[0x66; 32],
        &[0x77; 32],
        &[0x88; 32],
        &[0x91; 32],
        &[0x92; 32],
        &[0xaa; 32],
        9_980_000,
    );
    let solana_hex = hex::encode(&solana_full_msg);

    let _ = contract.request_rescue_destination_leg(receipt_hash_hex.clone(), solana_hex.clone());
    assert_eq!(
        contract.get_telemetry().pending_leg2_authorizations[0].state,
        RescueLifecycleState::InFlightLeg2
    );

    // 4. Simulate `v1.signer` failure on Leg 2 -> rolls back state from InFlightLeg2 to ReadyForLeg2
    // WITHOUT deleting the Leg 1 authorization record, so bridged USDC on Solana is not stranded!
    let failed_leg2 = contract.on_destination_leg_signed(
        receipt_hash_hex.clone(),
        solana_full_msg.len(),
        Err(PromiseError::Failed),
    );
    assert!(failed_leg2.is_none());
    let telemetry_leg2_retryable = contract.get_telemetry();
    assert_eq!(telemetry_leg2_retryable.pending_leg2_authorizations.len(), 1);
    assert_eq!(
        telemetry_leg2_retryable.pending_leg2_authorizations[0].state,
        RescueLifecycleState::ReadyForLeg2
    );
    assert!(!telemetry_leg2_retryable.pending_leg2_authorizations[0].leg2_completed);

    // 5. Retry `request_rescue_destination_leg` and complete successfully!
    let _ = contract.request_rescue_destination_leg(receipt_hash_hex.clone(), solana_hex);
    let mock_ed25519_json = near_sdk::serde_json::json!({
        "scheme": "Ed25519",
        "signature": vec![0x88u8; 64]
    });
    let retry_out = contract.on_destination_leg_signed(
        receipt_hash_hex,
        solana_full_msg.len(),
        Ok(mock_ed25519_json),
    );
    assert!(retry_out.is_some());
    assert_eq!(
        contract.get_telemetry().pending_leg2_authorizations[0].state,
        RescueLifecycleState::Completed
    );
}

#[test]
fn test_adversarial_repay_reserve_and_refresh_remaining_accounts_pinning() {
    let mpc_solana_payer = [0x22; 32];
    let user_obligation = [0x33; 32];
    let lending_market = KAMINO_MAIN_MARKET_PUBKEY;
    let sol_reserve = KAMINO_MAINNET_SOL_RESERVE_PUBKEY;
    let usdc_reserve = KAMINO_MAINNET_USDC_RESERVE_PUBKEY;
    let rogue_reserve = [0xfe; 32];

    // 1. Attack: Pass a rogue reserve in `repay_obligation_liquidity_v2` `ix.accounts[3]` (`repay_reserve`)
    let rogue_repay_reserve_msg = build_solana_kamino_repay_message(
        true,
        &mpc_solana_payer,
        &user_obligation,
        &lending_market,
        &rogue_reserve,
        &[0x55; 32],
        &[0x66; 32],
        &[0x77; 32],
        &[0x88; 32],
        &[0xaa; 32],
        10_000_000,
        true,
        true,
    );
    assert_eq!(
        verify_solana_kamino_repay_message(
            &rogue_repay_reserve_msg,
            &mpc_solana_payer,
            &user_obligation,
            &lending_market,
            &sol_reserve,
            &usdc_reserve,
            9_900_000,
            10_000_000,
        ),
        Err(SolanaParseError::RepayReserveMismatch {
            expected: usdc_reserve,
            actual: rogue_reserve,
        })
    );

    // 2. Attack: Pass an unauthorized reserve in `refresh_reserve` / `refresh_obligation` remaining accounts
    let rogue_refresh_reserve_msg = build_solana_kamino_full_refresh_and_repay_message(
        true,
        &mpc_solana_payer,
        &user_obligation,
        &lending_market,
        &rogue_reserve, // unauthorized reserve in refresh_reserve and refresh_obligation remaining_accounts
        &usdc_reserve,
        &[0x55; 32],
        &[0x66; 32],
        &[0x77; 32],
        &[0x88; 32],
        &[0x91; 32],
        &[0x92; 32],
        &[0xaa; 32],
        10_000_000,
    );
    assert_eq!(
        verify_solana_kamino_repay_message(
            &rogue_refresh_reserve_msg,
            &mpc_solana_payer,
            &user_obligation,
            &lending_market,
            &sol_reserve,
            &usdc_reserve,
            9_900_000,
            10_000_000,
        ),
        Err(SolanaParseError::UnauthorizedReserveAccount {
            actual: rogue_reserve,
        })
    );
}

#[test]
fn test_nep297_structured_events_and_function_call_key_spec() {
    let (policy, tee_sk, _base_vault, _mpc_solana_payer, _user_obligation, _lending_market) =
        sample_policy_and_keys();
    setup_context("alice.near", TEST_TIMESTAMP_SEC);
    let mut contract = InterceptPolicyContract::new(policy.clone());

    let fc_spec = contract.get_agent_function_call_key_spec();
    assert_eq!(fc_spec.agent_account_id.as_str(), "agent.intercept.near");
    assert_eq!(
        fc_spec.allowed_method_names,
        vec![
            "request_rescue_origin_leg".to_string(),
            "request_rescue_destination_leg".to_string()
        ]
    );
    assert!(fc_spec
        .forbidden_admin_methods
        .contains(&"update_policy".to_string()));

    setup_context("agent.intercept.near", TEST_TIMESTAMP_SEC);
    let deposit_addr = [0x99; 20];
    let repay_amount = 10_000_000u128;
    let receipt = sign_test_receipt(
        &tee_sk,
        &policy.user_kamino_obligation_pubkey,
        RiskRegime::MicroBufferRescue,
        repay_amount,
        9_950_000,
        &deposit_addr,
        TEST_TIMESTAMP_SEC,
    );
    let calldata = build_erc20_transfer_calldata(&deposit_addr, repay_amount);
    let tx = build_unsigned_eip1559_tx(
        BASE_MAINNET_CHAIN_ID,
        1,
        1_000_000,
        20_000_000,
        60_000,
        &BASE_USDC_ADDRESS,
        0,
        &calldata,
    );

    let _ = contract.request_rescue_origin_leg(
        receipt,
        policy.mpc_solana_payer_pubkey,
        hex::encode(tx),
    );

    let logs = near_sdk::test_utils::get_logs();
    let event_logs: Vec<&String> = logs
        .iter()
        .filter(|l| l.starts_with("EVENT_JSON:"))
        .collect();
    assert!(!event_logs.is_empty(), "Expected NEP-297 EVENT_JSON logs");
    let last_event_json: near_sdk::serde_json::Value = near_sdk::serde_json::from_str(
        event_logs.last().unwrap().trim_start_matches("EVENT_JSON:"),
    )
    .expect("Valid NEP-297 JSON");
    assert_eq!(last_event_json["standard"], "intercept-guardrail");
    assert_eq!(last_event_json["event"], "rescue_origin_leg_in_flight");
    assert_eq!(last_event_json["data"][0]["state"], "InFlightLeg1");
}
