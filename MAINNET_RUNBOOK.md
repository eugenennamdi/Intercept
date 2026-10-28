# INTERCEPT — Live $10 Mainnet Cross-Chain Rescue Runbook (`MAINNET_RUNBOOK.md`)

This runbook provides the exact step-by-step commands to deploy the NEAR Policy Guardrail Contract, fund the deterministic MPC addresses (`MPC_Base_Vault` and `MPC_Solana_Payer`), and execute + record a **real, explorer-verifiable $10 Mainnet rescue** in under 15 minutes.

---

## Step 1: Run the Keyless Pre-Flight Check (`npm run preflight`)

Verify live connectivity to NEAR Mainnet `v1.signer`, Base Mainnet (`8453`), and Solana Mainnet (`KLend`) and inspect the derived MPC addresses:

```bash
npm run preflight
```

Expected output for default `POLICY_CONTRACT_ID="guardrail.intercept-defi.near"` (or your own deployed NEAR contract ID):
- **`MPC_Base_Vault` (`domain_id: 0`, Secp256k1, path `"intercept-base-vault-1"`):**
  `0x72faa1abaf92e0c4b791f15acedb496c8979746c`
- **`MPC_Solana_Payer` (`domain_id: 1`, Ed25519, path `"intercept-solana-payer-1"`):**
  `GZMAbwapG99YKCsA2CDVc4bXeBzd7nvKMQgtm9K8aKas`
- **`MPC_Solana_Payer_USDC_ATA` (Canonical Solana Native USDC Associated Token Account, `bump=255`):**
  `2eLUYLvdceHQTbRHQcU26x4sRj6ZAZ27otxMQS8qpskq`

---

## Step 2: Open a Micro-Position on Solana Kamino Lend (User Phantom Wallet)

1. Open [app.kamino.finance](https://app.kamino.finance) with your personal Solana wallet (`User_Solana_EOA`).
2. In the **Main Market** (`7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF`):
   - Deposit **`~0.115 SOL`** (~$11.70–$20.00 depending on spot SOL/USD) into the SOL Reserve (`d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q`).
   - Borrow **`~6.20 USDC`** from the USDC Reserve (`D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59`).
3. Copy your wallet's Kamino `Obligation` PDA address from Solscan (or set `USER_SOLANA_WALLET_PUBKEY=<your_phantom_pubkey>` and Intercept's `discoverKaminoObligationsByOwner` will automatically discover your `Obligation` PDA via `getProgramAccounts` `memcmp`).

---

## Step 3: Build & Deploy `contracts/policy-guardrail` to NEAR Mainnet

```bash
# 1. Build the release WASM binary
cargo build --manifest-path contracts/policy-guardrail/Cargo.toml --target wasm32-unknown-unknown --release

# 2. Deploy to your NEAR Mainnet subaccount (e.g. guardrail.<your-account>.near)
near contract deploy guardrail.<your-account>.near \
  use-file contracts/policy-guardrail/target/wasm32-unknown-unknown/release/intercept_policy_guardrail.wasm \
  without-init-call \
  network-config mainnet \
  sign-with-keychain send

# 3. Query v1.signer::derived_public_key for your deployed contract ID
POLICY_CONTRACT_ID="guardrail.<your-account>.near" npm run preflight

# 4. Initialize the Policy Guardrail Contract
near contract call-function as-transaction guardrail.<your-account>.near new json-args '{
  "policy": {
    "owner_id": "<your-account>.near",
    "authorized_agent_id": "agent.<your-account>.near",
    "mpc_signer_contract": "v1.signer",
    "tee_enclave_pubkey_hex": "197f6b23e16c8532c6abc838facd3ea789be0c76b2920334039bfa8b3d368d61",
    "mpc_base_vault_address_hex": "<MPC_Base_Vault_0x_from_step_3>",
    "mpc_solana_payer_pubkey": "<MPC_Solana_Payer_base58_from_step_3>",
    "user_kamino_obligation_pubkey": "<User_Kamino_Obligation_PDA_from_step_2>",
    "kamino_lending_market_pubkey": "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
    "sol_collateral_reserve_pubkey": "d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q",
    "usdc_repay_reserve_pubkey": "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59",
    "base_derivation_path": "intercept-base-vault-1",
    "solana_derivation_path": "intercept-solana-payer-1",
    "max_per_action_usdc": 50000000,
    "max_daily_usdc": 250000000,
    "max_slippage_bps": 100,
    "min_trigger_hf_bps": 11500,
    "max_receipt_age_sec": 300
  }
}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as <your-account>.near network-config mainnet sign-with-keychain send
```

Create a scoped Function Call Access Key for the agent account restricted strictly to `request_rescue_origin_leg` and `request_rescue_destination_leg`:

```bash
near account add-key agent.<your-account>.near grant-function-call-access \
  --allowance '1 NEAR' \
  --contract-account-id guardrail.<your-account>.near \
  --function-names 'request_rescue_origin_leg,request_rescue_destination_leg' \
  autogenerate-new-keypair save-to-keychain network-config mainnet sign-with-keychain send
```

---

## Step 4: Fund the Deterministic MPC Vaults ($10 Micro-Mainnet Budget)

1. **Fund `MPC_Base_Vault` on Base Mainnet (Chain ID `8453`):**
   - Send **`10.00 USDC`** (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) to `MPC_Base_Vault`.
   - Send **`0.0005 ETH`** (~$1.25) to `MPC_Base_Vault` for Base L2 EIP-1559 gas.
2. **Fund `MPC_Solana_Payer` & Initialize its USDC ATA on Solana Mainnet:**
   - Send **`0.01 SOL`** (~$1.80) to `MPC_Solana_Payer` for Solana V0 compute budget + priority fees.
   - Send **`0.01 USDC`** (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`) from Phantom to `MPC_Solana_Payer` (this automatically creates and rent-exempt-funds `MPC_Solana_Payer_USDC_ATA` on Solana Mainnet so the 1-Click solver and `repay_obligation_liquidity_v2` `user_source_liquidity` account `ix.accounts[5]` exist on-chain).
3. Run `npm run preflight` to confirm all 7 readiness checks report `[READY]`.

---

## Step 5: Execute the Live Cross-Chain Rescue (`npm run rescue:live`)

```bash
export NEAR_ACCOUNT_ID="agent.<your-account>.near"
export NEAR_PRIVATE_KEY="ed25519:<scoped_function_call_private_key>"
export POLICY_CONTRACT_ID="guardrail.<your-account>.near"
export USER_KAMINO_OBLIGATION_PUBKEY="<User_Kamino_Obligation_PDA>"
export MIN_TRIGGER_HF_BPS_OVERRIDE="14800"

npm run rescue:live
```

This single command:
1. Reads live Pyth SOL/USD from Solana Mainnet (`PriceUpdateV2`) and deserializes the live Kamino `Obligation` account (`LIVE_ONCHAIN_OBLIGATION`).
2. Requests a live cross-chain swap quote (`dry: false`) from `https://1click.chaindefuser.com/v0/quote` (`recipient = MPC_Solana_Payer`, `refundTo = MPC_Base_Vault`).
3. Signs the Ed25519 `TeeDecisionReceipt` and calls `request_rescue_origin_leg` on NEAR (`InFlightLeg1 -> ReadyForLeg2`), receiving the `v1.signer` (`domain_id: 0`, Secp256k1) signature.
4. Reconstructs the signed EIP-1559 Base USDC transfer (`0x02 || rlp([..., v, r, s])`), broadcasts it to Base Mainnet RPC (`eth_sendRawTransaction`), notifies `/v0/deposit/submit`, and polls `/v0/status` until `SUCCESS`.
5. Builds the 5-instruction Solana `V0` message (`[ComputeBudget, refresh_reserve(SOL), refresh_reserve(USDC), refresh_obligation, repay_obligation_liquidity_v2]`), calls `request_rescue_destination_leg` on NEAR (`ReadyForLeg2 -> InFlightLeg2 -> Completed`), receives the `v1.signer` (`domain_id: 1`, Ed25519) signature over the raw `Message` bytes, broadcasts the `VersionedTransaction` to Solana Mainnet RPC, and prints the 4 live explorer URLs (`NearBlocks`, `BaseScan`, `1-Click Status`, and `Solscan`).
