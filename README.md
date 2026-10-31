# INTERCEPT

**Zero-Trust Cross-Chain Kamino Liquidation Defense Powered by NEAR AI Cloud (TEE), NEAR Policy Guardrail Contracts, NEAR Chain Signatures (`v1.signer`), and NEAR Intents (`1-Click Swap API`).**

- **Hackathon:** NEAR HACKATHON (November 1–14, 2026)
- **Tracks (`HACKATHON.md` IDs):** `defi` (Unstoppable DeFi), `security` (AI Security & Defense), `privacy` (Privacy & Private AI), `agents` (Agent Economy)
- **NEAR Ecosystem Technologies Used:** NEAR Intents (`1-Click Swap API` `/v0/tokens`, `/v0/quote`, `/v0/deposit/submit`, `/v0/status`), NEAR Chain Signatures (`v1.signer` `domain_id: 0` Secp256k1 & `domain_id: 1` Ed25519), NEAR AI Cloud (`https://cloud-api.near.ai/v1` Intel TDX + NVIDIA NRAS Hardware Attestation & Signed Chat Verification), Scoped NEAR Function Call Keys (`AccessKeyPermission::FunctionCall`), `near-sdk-rs` v5.x Byte-Level Policy Guardrails with NEP-297 Structured Events.

---

## 1. The Problem & What Intercept Solves

DeFi borrowers on **Solana Kamino Lend** (`KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`) frequently hold idle stablecoin liquidity on EVM L2s like **Base**, while their Solana SOL/USDC lending positions face sudden liquidation cascades during high-volatility drawdowns (incurring `300 bps` to `1000 bps` liquidation penalties).

Existing automated protection bots force an unacceptable security trade-off:
1. **Custodial Key Risk:** Handing a bot private keys or moving collateral into a shared vault means a compromised or hallucinating AI agent can drain the user's collateral.
2. **Blind Threshold Scripts:** Naive `if hf < 1.15` scripts either over-repay during calm markets (destroying Base yield) or under-repay during violent volatility cascades (getting liquidated 2 minutes later).

**How Intercept Solves This:**
1. **Strict Collateral Isolation (Third-Party Kamino Repayment):** Your Kamino collateral stays in your personal Solana wallet (`User_Solana_EOA`) and can **never** be withdrawn by Intercept. In Kamino Lend, `withdraw_obligation_collateral_v2` and `borrow_obligation_liquidity_v2` require `obligation.owner` to sign, whereas `repay_obligation_liquidity_v2` allows *any* third-party signer to repay debt on behalf of an obligation. Your idle Base rescue reserve is governed by decentralized NEAR MPC (`v1.signer`) and byte-level smart contract guardrails—no single custodian and no raw private keys.
2. **On-Chain Byte-Level Policy Guardrails (`near-sdk-rs`):** The AI agent holds only a scoped NEAR Function Call Key permitted to call `request_rescue_origin_leg` and `request_rescue_destination_leg`. Before calling `v1.signer::sign`, the NEAR contract parses the raw unsigned EIP-1559 RLP bytes (`0x02 || rlp(...)`) on Leg 1 and the raw serialized Solana `V0`/`Legacy` `Message` bytes on Leg 2. Any attempt to call `approve()`, transfer to an unauthorized address, include an unauthorized Solana program, use opaque V0 Address Lookup Tables, or invoke `withdraw_obligation_collateral_v2` reverts deterministically on-chain.
3. **Quantitative TEE Risk Engine:** Runs inside a NEAR AI Cloud TEE enclave, ingesting live on-chain **Pyth Network** SOL/USD price, confidence intervals, and EMA velocity from Solana Mainnet alongside live **NEAR Intents 1-Click API** quotes to dynamically select between `HOLD`, `MICRO_BUFFER_RESCUE` (`HF -> 1.20`), and `CASCADE_DEEP_RESCUE` (`HF -> 1.45`), signing an Ed25519 `TeeDecisionReceipt` verified on-chain.

---

## 2. Do X — See Y (Deterministic Verification Steps for Judges)

Every claim in this repository is verifiable locally in under 60 seconds with zero secret keys required.

### Step A: Verify the Rust Smart Contract & Adversarial Unit Tests (`contracts/policy-guardrail`)

**Do X:**
```bash
cargo test --manifest-path contracts/policy-guardrail/Cargo.toml
```

**See Y:**
- All **22 Rust unit and adversarial tests** compile and pass:
  - `test_verify_kamino_anchor_discriminators_and_program_pubkeys`: Verifies exact SHA-256 preimages for `global:repay_obligation_liquidity_v2` (`[116, 174, 213, 76, 180, 53, 210, 144]`), `global:repay_obligation_liquidity` (`[145, 178, 13, 225, 76, 240, 147, 72]`), and the 4 permissionless Kamino same-slot refresh instructions (`global:refresh_reserve` `[2, 218, 138, 235, 79, 201, 25, 102]`, `global:refresh_reserves_batch` `[144, 110, 26, 103, 162, 204, 252, 147]`, `global:refresh_obligation` `[33, 132, 147, 228, 151, 192, 72, 89]`, `global:refresh_obligation_farms_for_reserve` `[140, 144, 253, 21, 10, 74, 248, 3]`), plus Base58 decoding of `ComputeBudget111111111111111111111111111111`, `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD`, Kamino Mainnet SOL Reserve (`d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q`), and Kamino Mainnet USDC Reserve (`D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59`).
  - `test_bounded_receipt_storage_pruning_and_mpc_gas_constants` & `test_adversarial_zero_receipt_age_policy_update_rejected`: Verifies `MPC_SIGN_GAS = 250 TGas` (`MPC_CALLBACK_GAS = 30 TGas`), enforces `max_receipt_age_sec in 30..=3600`, and proves automatic bounded storage pruning of expired completed receipts.
  - `test_adversarial_evm_and_solana_gas_griefing_and_header_attacks_rejected`: Proves that EIP-1559 gas-griefing (`gas_limit > 250,000`), Base MEV priority/base fee drains (`max_fee_per_gas > 50 gwei`), invalid EIP-1559 fee ordering (`max_priority_fee_per_gas > max_fee_per_gas`), and Solana `ComputeBudget::SetComputeUnitPrice` priority-fee drains (`micro_lamports > 5,000,000`) are deterministically rejected before `v1.signer` is ever called.
  - `test_nep297_structured_events_and_function_call_key_spec`: Verifies NEP-297 structured JSON event logs (`EVENT_JSON:{"standard":"intercept-guardrail",...}`) and the scoped NEAR Function-Call Access Key specification (`get_agent_function_call_key_spec`).
  - `test_full_kamino_same_slot_refresh_and_repay_sequence_passes`: Verifies the full 5-instruction Solana `V0` repayment sequence `[ComputeBudget, refresh_reserve (SOL), refresh_reserve (USDC), refresh_obligation (remaining_accounts=[SOL, USDC]), repay_obligation_liquidity_v2]` required on Solana Mainnet to avoid `ReserveStale (6009)` / `ObligationStale (6010)`.
  - `test_adversarial_repay_reserve_and_refresh_remaining_accounts_pinning`: Proves that substituting a rogue reserve at `repay_obligation_liquidity_v2` `ix.accounts[3]` (`repay_reserve`) or passing an unauthorized reserve in `refresh_obligation` `ix.accounts[2..]` is rejected with `RepayReserveMismatch` / `UnauthorizedReserveAccount`.
  - `test_adversarial_leg2_while_leg1_inflight_reverts` & `test_adversarial_concurrent_leg2_while_inflight_reverts`: Prove the 4-state async cross-contract TOCTOU state machine (`InFlightLeg1 -> ReadyForLeg2 -> InFlightLeg2 -> Completed`) blocks any premature or concurrent Leg 2 calls across `v1.signer::sign` promises.
  - `test_leg1_and_leg2_mpc_failure_rollbacks_preserve_funds`: Proves that if Leg 1's `v1.signer::sign` fails, `on_origin_leg_signed` refunds `rolling_24h_spent_usdc` and removes the receipt without panicking, whereas if Leg 2's `v1.signer::sign` fails, `on_destination_leg_signed` rolls the state back to `ReadyForLeg2` (preserving the Leg 1 authorization record so bridged Solana USDC is never stranded and Leg 2 can be safely retried).
  - `test_adversarial_sneak_withdraw_after_refresh_reverts`: Proves that attempting to sneak `withdraw_obligation_collateral_v2` after `refresh_reserve` / `refresh_obligation` (or inside a refresh slot) is deterministically blocked.
  - `test_v1_signer_payload_v2_ecdsa_vs_eddsa_raw_message_and_callbacks`: Verifies that Leg 1 (`domain_id: 0`, Secp256k1) passes the 32-byte Keccak256 digest via `SignPayloadV2::Ecdsa`, whereas Leg 2 (`domain_id: 1`, Ed25519) passes the raw serialized Solana `Message` bytes via `SignPayloadV2::Eddsa` (never a 32-byte pre-hash), and verifies `on_origin_leg_signed` / `on_destination_leg_signed` callback parsing.
  - `test_adversarial_solana_32_byte_prehash_rejected`: Proves that passing a 32-byte pre-hash to `domain_id: 1` reverts immediately on-chain.
  - `test_valid_leg1_and_leg2_end_to_end`, `test_adversarial_evm_attacks_rejected`, `test_adversarial_solana_kamino_attacks_rejected`, `test_adversarial_forged_tee_signature_reverts`, `test_adversarial_tee_receipt_replay_reverts`, `test_adversarial_tee_hold_regime_reverts`, `test_adversarial_tee_slippage_breach_reverts`, `test_adversarial_daily_spending_limit_exceeded_reverts`, and `test_adversarial_agent_cannot_update_policy`: Prove contract-level panics on every policy violation.

---

### Step B: Run the Live Mainnet Pre-Flight Check & End-to-End CLI Verifier (`packages/agent-tee`)

**Do X:**
```bash
npm run preflight
npm run backtest
npm run verify
```

**See Y:**
1. **Live Mainnet Pre-Flight Check (`npm run preflight`):** Queries `v1.signer::derived_public_key` on NEAR Mainnet (`https://rpc.mainnet.near.org`) to derive `MPC_Base_Vault` (`0x72faa1abaf92e0c4b791f15acedb496c8979746c`), `MPC_Solana_Payer` (`GZMAbwapG99YKCsA2CDVc4bXeBzd7nvKMQgtm9K8aKas`), and its deterministic Solana Native USDC Associated Token Account `MPC_Solana_Payer_USDC_ATA` (`2eLUYLvdceHQTbRHQcU26x4sRj6ZAZ27otxMQS8qpskq`, `bump=255`), queries live Base Mainnet RPC (`https://mainnet.base.org`) for `nonce` + EIP-1559 gas fees + ETH/USDC balances, and queries live Solana Mainnet RPC (`https://api.mainnet-beta.solana.com`) for `recentBlockhash` + SOL balance + ATA existence & USDC balance.
2. **Step 1 (Kamino Anchor Discriminator Verification):** Prints and verifies `repay_obligation_liquidity_v2` (`0x74aed54cb435d290`), `repay_obligation_liquidity` (`0x91b20de14cf09348`), and all 4 same-slot refresh discriminators.
3. **Step 2 (`LIVE_MAINNET_MODE`):** Reads the live on-chain Pyth Network `PriceUpdateV2` SOL/USD account (`7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE`) and deserializes the live on-chain 3,344-byte Kamino Mainnet `Obligation` account (`C5dZVpvpA39SNLDkojsi98nRePRRy8ELhtxak8m2vMq`, `0.184738038 SOL` collateral at `offset 96` & `9.230855 USDC` debt at `offset 1208`, `source: LIVE_ONCHAIN_OBLIGATION`) on Solana Mainnet, evaluates the position (`HF ~1.436 >= 1.1500`), and outputs `Regime: HOLD`.
4. **Step 3 (`STRESS_TEST_MAINNET_MODE` — `-25%` SOL Flash Crash):**
   - Evaluates the `-25%` SOL shock (`HF 1.0630 < 1.1500`) and triggers `CASCADE_DEEP_RESCUE` (`Target HF 1.45`).
   - Queries a cross-chain swap quote from **NEAR Intents 1-Click API** (`https://1click.chaindefuser.com/v0/quote`) for Base USDC -> Solana USDC.
   - Signs the canonical `TeeDecisionReceipt` with Ed25519, builds the unsigned EIP-1559 Base USDC transaction (`domain_id: 0`) and the 5-instruction Solana `V0` Kamino refresh+repay message (`domain_id: 1`, pinning `repay_reserve` to `D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59` and `user_source_liquidity` to `2eLUYLvdceHQTbRHQcU26x4sRj6ZAZ27otxMQS8qpskq`), reconstructs the signed transactions, and prints the 5-stage millisecond stopwatch telemetry + clickable explorer URLs.
5. **Step 4 (Adversarial Red-Team Suite):** Fires **11 rogue AI attack vectors** (`ADV_01` through `ADV_11`, including collateral withdrawal, V0 ALT indirection, 32-byte Solana pre-hash, ERC-20 `approve()`, recipient hijack, concurrent TOCTOU race, Base 500 gwei gas-griefing drain, and Solana `ComputeBudget` priority-fee drain) and confirms all 11 are `BLOCKED (PASS)` with exact revert diagnostics.
6. **Step 5 (Quantitative Multi-Regime Historical Backtest — `npm run backtest`):** Replays 3 historical SOL volatility regimes (`-34%` Flash Cascade, `-12%` Mean-Reverting Dip, and `-7.5%` Choppy Noise) on a `100 SOL / $6,000 USDC` Kamino position, proving **100% liquidation survival** (vs. `66.7%` for a Naive `HF -> 1.20` Static Bot, which gets liquidated on a `-21.4%` cascade wick exceeding its `16.67%` buffer), **`$555.57` in prevented liquidation penalties**, and **`73.9%` Base capital efficiency savings** compared to an Over-Conservative Static Bot.

---

### Step C: Run the Agent Unit Test Suite

**Do X:**
```bash
npm run test:agent
```

**See Y:**
- Executes the deterministic `node:test` suite in [`packages/agent-tee/src/test.ts`](file:///Users/apple/Desktop/Intercept/packages/agent-tee/src/test.ts) covering all 3 quantitative risk regimes, Ed25519 receipt tampering rejection, and byte-level EVM/Solana parsers (`4 passed, 0 failed`).

---

### Step D: Launch the Institutional DeFi Command Center Web UI (`packages/web`)

**Do X:**
```bash
npm install
npm run dev
```
Then open `http://localhost:3000`.

**See Y:**
- **Live Kamino HF Gauge & Pyth Solana Mainnet Telemetry:** View live SOL/USD spot, EMA, confidence spread, realized volatility ($\sigma$), and Pre-Rescue vs. Post-Rescue Health Factor.
- **Interactive Mode Controls:** Toggle between `Live Mainnet Mode (0% Shock)`, `Mild Breach (-21% SOL -> Micro Rescue)`, `Cascade Crash (-25% SOL -> Deep Rescue)`, `Policy Threshold Override (Min HF 1.48)`, or any custom shock (`-40%` to `0%`).
- **5-Stage Cross-Chain Execution Telemetry:** Inspect real measured millisecond latency per stage and click directly into `Solscan`, `1-Click Swap Status`, `NearBlocks (v1.signer)`, and `BaseScan`.
- **Byte-Level Guardrail Inspector:** Inspect the full canonical `TeeDecisionReceipt`, Ed25519 signature hex, unsigned EIP-1559 RLP bytes, and raw 394-byte Solana `V0` message hex.
- **Simulate Rogue AI Hack Button:** Click **"Simulate Rogue AI Hack"** in the top banner (or select any of the 6 red-team cards at the bottom) to inject rogue instructions (`withdraw_obligation_collateral_v2`, ERC-20 `approve()`, recipient hijack, obligation spoofing) and inspect the exact NEAR Policy Contract revert error.

---

## 3. Repository Structure

```text
Intercept/
├── .github/workflows/ci.yml      # Automated CI pipeline (cargo test, npm test, verify, build)
├── HACKATHON.md                  # Official NEAR Hackathon instructions
├── README.md                     # Judge verification guide ("Do X, See Y")
├── ARCHITECTURE.md               # Byte-level parser & cryptographic specification
├── scripts/
│   └── deploy-near.sh            # 1-command WASM build & NEAR contract deployment script
├── contracts/
│   └── policy-guardrail/         # Rust smart contract (near-sdk-rs)
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs            # Contract entrypoints, 24h caps, v1.signer calls (250 TGas)
│           ├── evm_parser.rs     # Zero-trust RLP / EIP-1559 Base USDC transfer verifier
│           ├── solana_parser.rs  # Zero-trust Solana V0/Legacy Message & Kamino verifier
│           ├── tee_receipt.rs    # Ed25519 TeeDecisionReceipt verifier
│           └── tests.rs          # 22 unit + adversarial security tests
└── packages/
    ├── agent-tee/                # TypeScript TEE Quantitative Risk & Routing Service
    │   └── src/
    │       ├── index.ts          # Public package exports
    │       ├── kamino-reader.ts  # Solana Mainnet Kamino Obligation reader & health math
    │       ├── pyth-volatility.ts# Live on-chain Pyth Solana Receiver + Hermes reader
    │       ├── risk-engine.ts    # Dynamic de-risking sizing model + Ed25519 receipt signer
    │       ├── near-ai-cloud.ts  # NEAR AI Cloud (Intel TDX + NVIDIA NRAS) TEE attestation client
    │       ├── oneclick-client.ts# Live NEAR Intents 1-Click API client + live safety abort
    │       ├── payload-builder.ts# Unsigned EIP-1559 & Solana V0 Message byte builders
    │       ├── mainnet-broadcaster.ts # Live NEAR v1.signer, Base & Solana RPC broadcaster
    │       ├── orchestrator.ts   # 5-stage rescue state machine & 11-vector adversarial suite
    │       ├── backtest.ts       # Multi-regime historical quantitative backtest engine
    │       ├── cli-verify.ts     # 1-command deterministic judge verifier
    │       └── test.ts           # Unit & adversarial test suite
    └── web/                      # Next.js + Tailwind Institutional DeFi Command Center
        └── src/app/
            ├── api/intercept/    # Server route executing live agent-tee pipeline
            └── page.tsx          # Interactive Command Center UI
```
