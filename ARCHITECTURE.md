# INTERCEPT — Deep Technical Architecture & Byte-Level Security Specification

## 1. System Overview & Non-Custodial Custody Model

Intercept is a zero-trust, cross-chain liquidation defense engine for **Solana Kamino Lend** positions, powered by **NEAR AI Cloud (TEE)**, **NEAR Policy Guardrail Smart Contracts (`near-sdk-rs`)**, **NEAR Chain Signatures (`v1.signer`)**, and **NEAR Intents (`1-Click Swap API`)**.

> **Custody & Isolation Guarantee:**
> *"Your Kamino collateral stays in your personal Solana wallet and can never be withdrawn by Intercept. Your idle Base rescue reserve is governed by decentralized NEAR MPC (`v1.signer`) and byte-level smart contract guardrails—no single custodian and no raw private keys."*

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                       1. TELEMETRY & QUANTITATIVE TEE RISK ENGINE                      │
│  Solana Mainnet RPC (Pyth PriceUpdateV2 `7UVimff...` + Kamino Obligation `KLend2g...`) │
│               │                                                                        │
│               ▼                                                                        │
│  NEAR AI Cloud (TEE Enclave)                                                           │
│   • Computes Realized Volatility (σ_bps) & EMA Downward Velocity                       │
│   • Weighs Kamino Liquidation Penalty (300–1000 bps) vs. Base Opportunity Cost         │
│   • Selects Regime: `HOLD` | `MICRO_BUFFER_RESCUE` (1.20) | `CASCADE_DEEP_RESCUE` (1.45)│
│   • Requests Live Quote from NEAR Intents 1-Click API (`1click.chaindefuser.com`)      │
│   • Signs Deterministic Ed25519 `TeeDecisionReceipt` (`INTERCEPT_TEE_RECEIPT_V1|...`)  │
└───────────────────────────────────────────────┬────────────────────────────────────────┘
                                                │ Scoped NEAR Function Call Key
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                 2. NEAR POLICY GUARDRAIL CONTRACT (`near-sdk-rs`)                      │
│                                                                                        │
│  ┌─────────────────────────────────────────┐ ┌──────────────────────────────────────┐  │
│  │ LEG 1: `request_rescue_origin_leg`      │ │ LEG 2: `request_rescue_destination_leg`│
│  │ • Verifies Ed25519 `TeeDecisionReceipt` │ │ • Binds to Consumed Leg 1 Receipt    │  │
│  │ • Checks 24h Rolling & Per-Tx Caps      │ │ • Parses Raw Solana V0/Legacy Message│  │
│  │ • Checks 1-Click Quote Slippage & Dest  │ │ • Rejects V0 Address Lookup Tables   │  │
│  │ • Decodes Raw EIP-1559 (`0x02 || rlp`)  │ │ • Whitelists ONLY `ComputeBudget` &  │  │
│  │   - `chain_id == 8453` (Base Mainnet)   │ │   `KLend2g3cP87fffoy8q1mQqGKjrxjC8...`│  │
│  │   - `to == 0x8335...2913` (Base USDC)   │ │ • Verifies 8-Byte Repay Discriminator│  │
│  │   - `value == 0`                        │ │ • Verifies `ix.accounts[1]` ==       │  │
│  │   - `data[0..4] == 0xa9059cbb`          │ │   `user_kamino_obligation_pubkey`    │  │
│  │   - `data[16..36] == depositAddress`    │ │ • Verifies `ix.accounts[2]` ==       │  │
│  │   - `data[52..68] == repay_amount_usdc` │ │   `kamino_lending_market_pubkey`     │  │
│  └────────────────────┬────────────────────┘ └───────────────────┬──────────────────┘  │
└───────────────────────┼──────────────────────────────────────────┼─────────────────────┘
                        │ `v1.signer::sign` (`domain_id: 0`)       │ `v1.signer::sign` (`domain_id: 1`)
                        ▼                                          ▼
        ┌───────────────────────────────┐          ┌───────────────────────────────┐
        │ Base Mainnet (`MPC_Base_Vault`)│         │ Solana (`MPC_Solana_Payer`)   │
        │ Transfers USDC to 1-Click     ├─────────►│ Executes Kamino Lend          │
        │ `depositAddress`              │  1-Click │ `repay_obligation_liquidity_v2`│
        └───────────────────────────────┘  Solver  └───────────────────────────────┘
```

---

## 2. Pillar 1: Third-Party Kamino Repayment & Collateral Isolation

In Kamino Lend (`KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD` on Solana Mainnet):
1. The user opens and holds their SOL collateral / USDC borrow position inside their own personal Solana wallet (`User_Solana_EOA`). The resulting Kamino `Obligation` PDA stores `obligation.owner = User_Solana_EOA`.
2. Kamino's `withdraw_obligation_collateral_v2` and `borrow_obligation_liquidity_v2` instructions require `obligation.owner` (`User_Solana_EOA`) to sign the transaction.
3. By contrast, Kamino's `repay_obligation_liquidity_v2` (and `repay_obligation_liquidity`) instruction allows **any third-party liquidity provider** (`user_source_liquidity` authority) to repay debt on behalf of any `obligation` PDA.
4. Therefore, Intercept **never** holds authority over `User_Solana_EOA` and **never** asks the user to migrate their Kamino position into an MPC wallet:
   - **Origin Reserve (`MPC_Base_Vault`):** Deterministic Base EVM address derived from `v1.signer` (`domain_id: 0`, `secp256k1`, path `"intercept-base-vault-1"`). Holds only the user's idle Base USDC rescue reserve.
   - **Destination Payer (`MPC_Solana_Payer`):** Deterministic Solana address derived from `v1.signer` (`domain_id: 1`, `ed25519`, path `"intercept-solana-payer-1"`). Receives the swapped USDC from NEAR Intents 1-Click and immediately executes `repay_obligation_liquidity_v2` on `user_kamino_obligation_pubkey`.

---

## 3. Pillar 2: Byte-Level Pre-Image Verification in `contracts/policy-guardrail`

### 3.1 Canonical `TeeDecisionReceipt` (`src/tee_receipt.rs`)

Before any rescue is authorized, the NEAR AI Cloud TEE enclave signs a deterministic ASCII payload using its registered Ed25519 private key:

```text
INTERCEPT_TEE_RECEIPT_V1|{timestamp}|{obligation_pubkey}|{observed_hf_bps}|{volatility_bps}|{regime}|{repay_amount_usdc}|0x{oneclick_deposit_address_lower}|{min_amount_out}|0x{reasoning_hash_lower}
```

The NEAR Policy Guardrail Contract verifies:
1. `near_sdk::env::ed25519_verify(&signature, canonical_payload.as_bytes(), &self.tee_enclave_pubkey)` passes.
2. Replay protection: `sha256(canonical_payload)` is not present in `consumed_receipt_hashes`.
3. `regime` is `"MICRO_BUFFER_RESCUE"` or `"CASCADE_DEEP_RESCUE"` (rejects `"HOLD"`).
4. Timestamp freshness: `receipt.timestamp + policy.max_receipt_age_sec >= block_timestamp_sec`.
5. `bs58::decode(receipt.obligation_pubkey) == self.user_kamino_obligation_pubkey`.
6. Slippage bound: `receipt.min_amount_out * 10_000 >= receipt.repay_amount_usdc * (10_000 - policy.max_slippage_bps)`.

### 3.2 Leg 1 Byte-Level EIP-1559 RLP Verifier (`src/evm_parser.rs`)

The contract decodes the raw unsigned EIP-1559 payload (`0x02 || rlp([chain_id, nonce, max_priority_fee_per_gas, max_fee_per_gas, gas_limit, to, value, data, access_list])`) using a strict canonical RLP parser that rejects leading-zero integer encodings, non-canonical length prefixes, and trailing bytes:

| Field | RLP Index | Enforced On-Chain Invariant |
| :--- | :--- | :--- |
| Transaction Type | Byte `0` | Must equal `0x02` (EIP-1559) |
| `chain_id` | Item `0` | Must equal `8453` (Base Mainnet) |
| `to` | Item `5` | Must equal `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Base Native USDC) |
| `value` | Item `6` | Must equal `0` (zero native ETH transfer) |
| `data` length | Item `7` | Must equal `68` bytes |
| `data[0..4]` | Selector | Must equal `0xa9059cbb` (`transfer(address,uint256)`); explicitly blocks `0x095ea7b3` (`approve`) |
| `data[4..16]` | Address Pad | Must equal `[0u8; 12]` |
| `data[16..36]` | Recipient | Must equal `receipt.oneclick_deposit_address` (20 bytes) |
| `data[36..52]` | Amount Pad | Must equal `[0u8; 16]` |
| `data[52..68]` | Amount | `u128::from_be_bytes` must equal `receipt.repay_amount_usdc` |
| `access_list` | Item `8` | Must be empty RLP list (`0xc0`) |

Only after all checks pass does the contract compute `keccak256(raw_unsigned_tx)` and invoke `v1.signer::sign` (`domain_id: 0`).

### 3.3 Leg 2 Byte-Level Solana Message & Kamino Repay Verifier (`src/solana_parser.rs`)

The contract parses the raw serialized Solana `Message` bytes (`64..=1232` bytes, supporting both Legacy and `V0` versioned messages; 32-byte pre-hashes are strictly rejected because Solana Ed25519 verifies signatures over the raw `Message` bytes directly):

1. **Header & Static Account Keys:**
   - Asserts `num_required_signatures == 1`.
   - Reads the `compact-u16` static `account_keys` array and asserts `account_keys[0] == self.mpc_solana_payer_pubkey`.
   - If `V0` (`0x80` prefix), asserts `address_table_lookups_len == 0` (forbidding opaque Address Lookup Table indirection) and asserts zero trailing bytes.
2. **Program Whitelist:**
   - Every compiled instruction's `program_id_index` must resolve to either:
     - `ComputeBudget111111111111111111111111111111` (`[3, 6, 70, 111, 229, 33, 23, 50, 255, 236, 173, 186, 114, 195, 155, 231, 188, 140, 229, 187, 197, 247, 18, 107, 44, 67, 155, 58, 64, 0, 0, 0]`)
     - `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD` (`[4, 178, 172, 177, 18, 88, 204, 227, 104, 44, 65, 139, 168, 114, 255, 61, 249, 17, 2, 113, 47, 21, 175, 18, 182, 190, 105, 179, 67, 91, 0, 8]`)
3. **Kamino Same-Slot Refresh & Repayment Anchor Discriminator Verification:**
   - Preceding Kamino instructions in the transaction are permitted **only if** their 8-byte discriminator matches one of the 4 permissionless refresh instructions:
     - `sha256("global:refresh_reserve")[0..8]` = `[2, 218, 138, 235, 79, 201, 25, 102]` (`0x02da8aeb4fc91966`): asserts `ix.accounts[0]` is in allowed obligation reserves (`sol_collateral_reserve_pubkey` `d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q` or `usdc_repay_reserve_pubkey` `D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59`) and `ix.accounts[1] == self.kamino_lending_market_pubkey`.
     - `sha256("global:refresh_reserves_batch")[0..8]` = `[144, 110, 26, 103, 162, 204, 252, 147]` (`0x906e1a67a2ccfc93`)
     - `sha256("global:refresh_obligation")[0..8]` = `[33, 132, 147, 228, 151, 192, 72, 89]` (`0x218493e497c04859`): asserts `ix.accounts[0] == self.kamino_lending_market_pubkey`, `ix.accounts[1] == self.user_kamino_obligation_pubkey`, and every remaining account `ix.accounts[2..]` belongs to the policy's allowed obligation reserves (`sol_collateral_reserve_pubkey` or `usdc_repay_reserve_pubkey`).
     - `sha256("global:refresh_obligation_farms_for_reserve")[0..8]` = `[140, 144, 253, 21, 10, 74, 248, 3]` (`0x8c90fd150a4af803`)
   - The transaction must contain **exactly one** repayment instruction matching:
     - `sha256("global:repay_obligation_liquidity_v2")[0..8]` = `[116, 174, 213, 76, 180, 53, 210, 144]` (`0x74aed54cb435d290`)
     - `sha256("global:repay_obligation_liquidity")[0..8]` (v1) = `[145, 178, 13, 225, 76, 240, 147, 72]` (`0x91b20de14cf09348`)
   - All other Kamino instructions (`withdraw_obligation_collateral_v2` `[202, 249, 117, 114, 231, 192, 47, 138]`, `borrow_obligation_liquidity_v2` `[161, 128, 143, 245, 171, 199, 194, 6]`, etc.) revert deterministically.
4. **Kamino Account Array & Repayment Reserve Pinning (`ix.accounts.len() >= 8`):**
   - `account_keys[ix.accounts[0]] == self.mpc_solana_payer_pubkey` (`owner` / repayer authority)
   - `account_keys[ix.accounts[1]] == self.user_kamino_obligation_pubkey` (`obligation` PDA)
   - `account_keys[ix.accounts[2]] == self.kamino_lending_market_pubkey` (`7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF`)
   - `account_keys[ix.accounts[3]] == self.usdc_repay_reserve_pubkey` (`D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59` — Kamino Mainnet USDC Reserve)
   - `ix.accounts[5]` is populated with the deterministic Solana Native USDC Associated Token Account PDA of `MPC_Solana_Payer` (`2eLUYLvdceHQTbRHQcU26x4sRj6ZAZ27otxMQS8qpskq`, `bump=255`).
   - `u64::from_le_bytes(ix.data[8..16])` lies within `[auth.min_repay_amount_usdc..=auth.max_repay_amount_usdc]`.

### 3.4 4-State Async Cross-Contract TOCTOU State Machine (`src/lib.rs`)

Because `v1.signer::sign` executes asynchronously across receipts on NEAR, `InterceptPolicyContract` enforces a strict 4-state lifecycle (`RescueLifecycleState`) per `receipt_hash`:
1. `InFlightLeg1`: Set *immediately* in `request_rescue_origin_leg` (along with deducting `rolling_24h_spent_usdc` and inserting into `consumed_receipt_hashes`) *before* dispatching the `v1.signer::sign` promise so concurrent calls in the same block cannot bypass the 24h cap or replay the receipt.
2. `ReadyForLeg2`: Transitioned inside `#[private] pub fn on_origin_leg_signed` **only** when `v1.signer::sign` succeeds. If `v1.signer::sign` fails, `on_origin_leg_signed` removes the receipt from `consumed_receipt_hashes` + `leg2_authorizations` and refunds `rolling_24h_spent_usdc` without panicking so the NEAR VM commits the state rollback.
3. `InFlightLeg2`: Set *immediately* in `request_rescue_destination_leg` before dispatching the Leg 2 `v1.signer::sign` promise; any call when state is not `ReadyForLeg2` (`InFlightLeg1`, `InFlightLeg2`, or `Completed`) reverts immediately.
4. `Completed`: Transitioned inside `#[private] pub fn on_destination_leg_signed` when `v1.signer::sign` succeeds. If Leg 2's `v1.signer::sign` fails, `on_destination_leg_signed` reverts the state back to `ReadyForLeg2` (preserving the Leg 1 authorization record!) so Leg 2 can be safely retried without stranding the user's bridged USDC on Solana.

---

## 4. Pillar 3: Quantitative Risk & Dynamic De-Risking Model (`packages/agent-tee`)

Given deposited SOL collateral $C_{\text{SOL}}$, effective SOL price $P_{\text{SOL}}$, liquidation LTV threshold $L_{\text{liq}} = 0.75$, and borrowed USDC debt $D_{\text{USDC}}$:

$$\text{HF} = \frac{C_{\text{SOL}} \cdot P_{\text{SOL}} \cdot L_{\text{liq}}}{D_{\text{USDC}}}$$

When $\text{HF} < \text{HF}_{\text{trigger}}$, the TEE Risk Engine computes the required USDC repayment $\Delta D$ to restore $\text{HF}_{\text{target}}$:

$$\Delta D = \max\left(0,\; D_{\text{USDC}} - \frac{C_{\text{SOL}} \cdot P_{\text{SOL}} \cdot L_{\text{liq}}}{\text{HF}_{\text{target}}}\right)$$

- **Regime A (`HOLD`):** $\text{HF} \ge \text{HF}_{\text{trigger}} \implies \Delta D = 0$.
- **Regime B (`MICRO_BUFFER_RESCUE`):** $1.10 \le \text{HF} < \text{HF}_{\text{trigger}}$ and realized volatility $\sigma < 5500\text{ bps} \implies \text{HF}_{\text{target}} = 1.20$.
- **Regime C (`CASCADE_DEEP_RESCUE`):** $\text{HF} < 1.10$ OR ($\text{HF} < \text{HF}_{\text{trigger}}$ with $\sigma \ge 5500\text{ bps}$ or EMA velocity $\le -400\text{ bps}$) $\implies \text{HF}_{\text{target}} = 1.45$.
