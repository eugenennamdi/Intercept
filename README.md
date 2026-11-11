# Intercept

**Non-custodial cross-chain liquidation defense for DeFi borrowers, built natively on NEAR Intents, Chain Signatures, and Confidential AI.**

[Live Application](https://intercept-inky.vercel.app) · [Technical Documentation](https://intercept-inky.vercel.app/docs) · [Architecture Specification](./ARCHITECTURE.md) · [NEAR Testnet Contract](https://testnet.nearblocks.io/address/intercept-guardrail-373299.testnet) · [MIT License](./LICENSE)

---

## Overview

DeFi capital is structurally fragmented across chains. Borrowers routinely post volatile collateral on high-throughput execution layers such as **Solana Kamino Lend**, while holding standby stablecoin reserves or earning yield on EVM rollups such as **Base**. During sharp market drawdowns, borrowers face steep **5%–10% liquidation penalties** unless they either leave idle buffer capital stranded on every chain or surrender raw private keys to a custodial bot.

**Intercept** eliminates both compromises by using **NEAR Protocol** as a verifiable, non-custodial cross-chain risk control plane:

1. **Self-Custodial Collateral Isolation:** Borrowers keep their SOL collateral and Kamino `Obligation` inside their personal Solana wallet (`User_Solana_EOA`). Because Kamino Lend natively permits third-party debt repayment (`repay_obligation_liquidity_v2`) without granting withdrawal or borrowing authority, Intercept never holds keys to the borrower's collateral.
2. **Confidential Volatility-Aware Sizing (`NEAR AI Cloud`):** An Intel TDX + NVIDIA Hopper confidential enclave evaluates live **Pyth Network** spot prices, orderbook confidence spreads, and EMA downward velocity alongside live **Kamino** zero-copy `Obligation` state (`3,344` bytes), signing a deterministic Ed25519 `TeeDecisionReceipt` only when intervention is economically optimal.
3. **Byte-Level Smart Contract Policy Enforcement (`near-sdk-rs`):** Before any signature is issued, an on-chain Rust guardrail contract decodes the raw unsigned **Base EIP-1559** RLP payload (`Leg 1`) and the raw serialized **Solana `V0` Message** bytes (`Leg 2`). Any deviation from the borrower's spending limits, approved **NEAR Intents** deposit address, or pinned Kamino `Obligation` reverts deterministically.
4. **Keyless Cross-Chain Settlement (`Chain Signatures` + `NEAR Intents`):** Verified payloads are signed via decentralized threshold MPC (`v1.signer`) across both `Secp256k1` (`domain_id: 0`, Base) and `Ed25519` (`domain_id: 1`, Solana), while **NEAR Intents (`1-Click API`)** settles Base Native USDC into Solana Native USDC in seconds.

---

## Built on the NEAR Stack

| NEAR Layer | Production Component | Role in Intercept |
| :--- | :--- | :--- |
| **Confidential Compute** | [NEAR AI Cloud](https://cloud.near.ai) (`deepseek-ai/DeepSeek-V4.1-Flash-1017`) | Fetches live Intel TDX DCAP + NVIDIA Hopper `/v1/attestation/report` quotes bound to fresh 32-byte nonces and signs canonical `TeeDecisionReceipt` payloads. |
| **On-Chain Policy Engine** | `near-sdk-rs` (`5.7.0` WASM) | Enforces 4-state async cross-contract execution (`InFlightLeg1 -> ReadyForLeg2 -> InFlightLeg2 -> Completed`) and byte-parses EVM & Solana transactions prior to signing. |
| **Multi-Curve MPC** | NEAR Chain Signatures (`v1.signer`) | Derives keyless deterministic accounts on Base (`domain_id: 0`, Secp256k1) and Solana (`domain_id: 1`, Ed25519) governed exclusively by the guardrail contract. |
| **Cross-Chain Liquidity** | NEAR Intents (`1click.chaindefuser.com`) | Routes standby Base USDC (`0x8335...2913`) to Solana USDC (`EPjFW...Dt1v`) with slippage bounds verified on-chain. |

---

## System Architecture

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                     1. CONFIDENTIAL TELEMETRY & RISK ENGINE (NEAR AI CLOUD)              │
│   Solana Mainnet RPC: Pyth PriceUpdateV2 (`7UVimff...`) + Kamino Obligation (`KLend2g`)  │
│                                            │                                             │
│                                            ▼                                             │
│   • Evaluates realized volatility (σ_bps), confidence spread, and EMA downward velocity  │
│   • Selects regime: HOLD | MICRO_BUFFER_RESCUE (1.20x) | CASCADE_DEEP_RESCUE (1.45x)     │
│   • Requests Base USDC -> Solana USDC quote from NEAR Intents 1-Click API                │
│   • Signs deterministic Ed25519 `TeeDecisionReceipt` inside Intel TDX enclave            │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │ Scoped NEAR FunctionCall Key (0 NEAR deposit)
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                   2. ON-CHAIN POLICY GUARDRAIL (`contracts/policy-guardrail`)            │
│                                                                                          │
│   ┌──────────────────────────────────────────┐ ┌───────────────────────────────────────┐ │
│   │ LEG 1 · `request_rescue_origin_leg`      │ │ LEG 2 · `request_rescue_destination`  │ │
│   │ • Verifies Ed25519 `TeeDecisionReceipt`  │ │ • Requires `ReadyForLeg2` state       │ │
│   │ • Enforces HF < trigger & 24h/tx caps    │ │ • Parses raw Solana V0 Message bytes  │ │
│   │ • Byte-parses EIP-1559 (`chain_id=8453`) │ │ • Rejects V0 Address Lookup Tables    │ │
│   │ • Pins Base USDC `transfer` (`0xa9059cbb`)│ │ • Whitelists ComputeBudget + KLend    │ │
│   │ • Pins recipient == 1-Click deposit addr │ │ • Pins user Obligation & USDC Reserve │ │
│   └────────────────────┬─────────────────────┘ └───────────────────┬───────────────────┘ │
└────────────────────────┼───────────────────────────────────────────┼─────────────────────┘
                         │ `v1.signer::sign` (`domain_id: 0`)        │ `v1.signer::sign` (`domain_id: 1`)
                         ▼                                           ▼
         ┌───────────────────────────────┐           ┌───────────────────────────────┐
         │ Base Mainnet (`MPC_Base_Vault`)│          │ Solana (`MPC_Solana_Payer`)   │
         │ Transfers exact Base USDC to  ├──────────►│ Executes Kamino Lend          │
         │ NEAR Intents deposit address  │  1-Click  │ `repay_obligation_liquidity_v2`│
         └───────────────────────────────┘  Solver   └───────────────────────────────┘
```

---

## Adaptive Quantitative Risk Model

Static threshold bots fail DeFi borrowers in one of two ways: under-buffering during violent liquidation cascades (resulting in liquidation on the next candle) or over-repaying during calm mean-reverting pullbacks (draining Base stablecoin yield unnecessarily). Intercept dynamically sizes debt repayments across three quantitative regimes:

| Regime | Trigger Condition | Target Health Factor | Capital Behavior |
| :--- | :--- | :--- | :--- |
| **`HOLD`** | $\text{HF} \ge \text{HF}_{\text{trigger}}$ (default `1.15x`) | — | `100%` of standby USDC remains untouched on Base. |
| **`MICRO_BUFFER_RESCUE`** | $1.10 \le \text{HF} < \text{HF}_{\text{trigger}}$ with calm volatility ($\sigma < 5500\text{ bps}$) | **`1.20x`** | Bridges the minimum USDC required to clear liquidation risk while preserving Base yield. |
| **`CASCADE_DEEP_RESCUE`** | $\text{HF} < 1.10$, or $\text{HF} < \text{HF}_{\text{trigger}}$ with $\sigma \ge 5500\text{ bps}$ or EMA velocity $\le -400\text{ bps}$ | **`1.45x`** | Pre-emptively builds a deep `31.0%` collateral buffer ahead of multi-candle cascade wicks. |

### Multi-Regime Historical Benchmark (`100 SOL` Collateral / `$6,000 USDC` Debt)

| Strategy | Survival Rate | Cascade Crash (`-34%` SOL) | Orderly Pullback (`-12%` SOL) | Sideways Noise (`-7.5%` SOL) |
| :--- | :--- | :--- | :--- | :--- |
| **Unprotected Position** | `66.7%` | **Liquidated** (`$561.00` penalty) | Survived (`$0` deployed) | Survived (`$0` deployed) |
| **Static Micro Bot (`-> 1.20x`)** | `66.7%` | **Liquidated** at wick (`$561.00` penalty) | Survived (`$343.75` deployed) | Survived (`$0` deployed) |
| **Static Conservative Bot (`-> 1.45x`)** | `100.0%` | Survived (`$2,586.21` deployed) | Over-deployed (`$1,318.97` USDC) | Survived (`$0` deployed) |
| **Intercept Adaptive Engine** | **`100.0%`** | **Survived** (`$2,586.21` deployed, `$555.57` saved) | **Optimal** (`$343.75` — **`73.9%` capital saved**) | **Optimal** (`$0` deployed) |

---

## Security & Privacy Guarantees

### 1. Least-Privilege Access Keys & Contract-Sponsored MPC Fees
- **Scoped `FunctionCall` Permission:** The off-chain runner operates exclusively through a restricted NEAR `AccessKeyPermission::FunctionCall` key (`runner.intercept-guardrail-373299.testnet`) scoped solely to `request_rescue_origin_leg`, `request_rescue_destination_leg`, and `cancel_refunded_rescue`. It holds **zero `FullAccess` keys** and cannot invoke `update_policy`, modify contract code, or transfer NEAR.
- **Native Zero-Deposit Compatibility:** Because NEAR `FunctionCall` keys forbid non-zero `attached_deposit` (`DepositWithFunctionCall`), `resolve_mpc_sign_deposit()` automatically sponsors the `0.05 NEAR` `v1.signer::sign` deposit from the guardrail contract's own balance (`v1.signer` refunds unused deposit directly back to the guardrail contract).
- **Allowance Calibration & Operational Rotation:** Cross-contract `300 TGas` calls reserve `~0.3009 NEAR` upfront under NEAR pessimistic gas accounting (`actual gas burned: ~0.0021 NEAR`). Agent keys are provisioned with a `1.00 NEAR` gas allowance and monitored for rotation whenever remaining allowance drops below `0.35 NEAR`.

### 2. Deterministic Byte-Level Exploit Prevention (`11 / 11` Vectors Blocked + Live WASM View Proof)
Every signing request is validated in Rust WASM (`< 1.5 ms`, with live zero-gas `verify_rescue_origin_leg` & `verify_rescue_destination_leg` RPC proofs on `intercept-guardrail-373299.testnet`) before `v1.signer` is invoked:
- **Base Leg 1 (`src/evm_parser.rs`):** Enforces canonical EIP-1559 RLP encoding, `chain_id == 8453`, `to == Base Native USDC`, `value == 0`, `selector == 0xa9059cbb` (explicitly blocking `approve`), `recipient == receipt.oneclick_deposit_address`, `amount == receipt.repay_amount_usdc`, and strict gas-fee bounds (`max_fee_per_gas <= 50 gwei`, `max_priority_fee_per_gas <= 10 gwei`).
- **Solana Leg 2 (`src/solana_parser.rs`):** Rejects 32-byte blind pre-hashes (`64..=1232` byte raw `Message` required) and opaque `V0` Address Lookup Tables (`address_table_lookups_len == 0`), whitelists only `ComputeBudget` (`<= 5M micro-lamports/CU`) and `KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD` same-slot oracle refreshes + `repay_obligation_liquidity_v2`, and pins `obligation`, `lending_market`, `usdc_repay_reserve`, `SPL_TOKEN_PROGRAM` (`Tokenkeg...`, blocking Token-2022 transfer-hook CPI indirection), `SYSVAR_INSTRUCTIONS`, and a non-aliasing `MPC_Solana_Payer` USDC ATA.
- **Async Cross-Contract TOCTOU & Solver Refund Safety (`src/lib.rs`):** Deducts rolling 24-hour spend caps *before* yielding to `v1.signer` (`InFlightLeg1`), blocks `update_policy` while any rescue is in flight, executes non-panicking state rollbacks in `#[private]` callbacks if downstream MPC signing fails, and reconciles 1-Click `REFUNDED` / `FAILED` solver outcomes via `cancel_refunded_rescue` (auto-refunding `MPC_Base_Vault` via `refundTo` while restoring the 24h cap and preserving replay locks).

### 3. Confidential Compute & Zero-Retention Privacy
- **Fresh Cryptographic Nonces:** Every `NEAR AI Cloud` attestation request generates a fresh 32-byte CSPRNG nonce (`crypto.randomBytes(32)`) bound into both the Intel TDX `report_data` commitment and NVIDIA NRAS GPU `eat_nonce`, then cryptographically verifies the enclave's Ed25519 signature over `nonce:requestHash:responseHash`.
- **Stateless Telemetry:** The web dashboard and `/api/intercept` route operate statelessly in memory with zero server-side persistence, database logging, or third-party tracking of user wallet addresses.

---

## Protocol Sustainability & Ecosystem Roadmap

- **Performance-Aligned Protocol Economics (`0` Idle Subscription):** Standby reserves on Base incur zero custody or management fees during `HOLD`. In production, Intercept charges a `15 bps` protection fee strictly on settled emergency rescues—less than `3%` of the `500–1,000 bps` (`5%–10%`) Kamino liquidation penalty prevented.
- **Sub-Cent NEAR Execution Overhead:** Each two-leg cross-chain rescue burns `~0.0042 NEAR` in actual compute gas across `request_rescue_origin_leg` and `request_rescue_destination_leg`, while `v1.signer` automatically refunds unused MPC deposit back into the guardrail contract's sponsored pool.
- **Institutional Solver Spread (`NEAR Intents`):** Partner `ONECLICK_JWT` fee tiers compress stablecoin cross-chain routing from `25 bps` to `1 bp`, keeping automated micro-buffer rebalancing cheaper than manual bridge + DEX execution.
- **Horizontal Multi-Chain Expansion:** Because the core security boundary is byte-level pre-image verification in `near-sdk-rs` + `v1.signer` dual-curve threshold signing, additional destination adapters (**Aave v3**, **Morpho Blue**, **Marginfi**, and **Hyperliquid** cross-margin) plug into the same non-custodial NEAR control plane without taking custody of borrower collateral.

---

## Live On-Chain Verification (NEAR Testnet)

- **Policy Guardrail Contract:** [`intercept-guardrail-373299.testnet`](https://testnet.nearblocks.io/address/intercept-guardrail-373299.testnet)
- **Scoped `FunctionCall` Agent Account:** [`runner.intercept-guardrail-373299.testnet`](https://testnet.nearblocks.io/address/runner.intercept-guardrail-373299.testnet)
- **Derived `v1.signer-prod.testnet` Vaults:** `0xfa1d66b9f3ae95f9d21b8db2315720c2fcde5320` (Base `domain_id: 0`) · `7AqKFEDJ13ZxpnQnBEEM6XmGq2LNa65jXBE4q96emvCo` (Solana `domain_id: 1`)

| Verification Proof | Method / Action | NearBlocks Transaction |
| :--- | :--- | :--- |
| **1. Guardrail Deployment & Initialization** | `DeployContract` + `new(policy)` | [`FHbKGEa9q2h3Pu4adQpyVhSHVAfiPZSFQTk9DNCb6ns9`](https://testnet.nearblocks.io/txns/FHbKGEa9q2h3Pu4adQpyVhSHVAfiPZSFQTk9DNCb6ns9) |
| **2. State-Preserving Upgrade & Policy Update** | `DeployContract` + `update_policy` | [`AtGgegrK4nGFX7Lksu66zSBvgGoqP8Wr7jAQepfaW3Bf`](https://testnet.nearblocks.io/txns/AtGgegrK4nGFX7Lksu66zSBvgGoqP8Wr7jAQepfaW3Bf) |
| **3. Scoped `FunctionCall` Key Provisioning** | `AddKey` (`1.00 NEAR` allowance, 2 methods) | [`3TFzFZ6vF1uEYBEPtvf8X5PDiWo3VKZojJSMzuiKriVF`](https://testnet.nearblocks.io/txns/3TFzFZ6vF1uEYBEPtvf8X5PDiWo3VKZojJSMzuiKriVF) |
| **4. Zero-Deposit Leg 1 MPC Signature (`Secp256k1`)** | `request_rescue_origin_leg` → `v1.signer-prod.testnet` | [`5GZMVE9fokSqLqNNxZTLZEzeHrBbkQSAfLro5NMeZFJt`](https://testnet.nearblocks.io/txns/5GZMVE9fokSqLqNNxZTLZEzeHrBbkQSAfLro5NMeZFJt) |
| **5. Zero-Deposit Leg 2 MPC Signature (`Ed25519`)** | `request_rescue_destination_leg` → `v1.signer-prod.testnet` | [`9mHD6Qp7tCeaMieWyLTYb7wE3YyHRR3BmtqcdzG2xeFr`](https://testnet.nearblocks.io/txns/9mHD6Qp7tCeaMieWyLTYb7wE3YyHRR3BmtqcdzG2xeFr) |
| **6. On-Chain Healthy-Position Guardrail Block** | `PositionHealthyAboveTrigger` (`12200 >= 11500 bps`) | [`i1YgQ5EMZ78FWUoD8kZFKyqpADY6RNo6kKNYTCKrudJ`](https://testnet.nearblocks.io/txns/i1YgQ5EMZ78FWUoD8kZFKyqpADY6RNo6kKNYTCKrudJ) |
| **7. Async Cross-Contract Failure Rollback** | `on_origin_leg_signed` (`rescue_origin_leg_rolled_back`) | [`GnXXpAsFo6w9c77SjkK8VNYvY3uAwY49rPdFPbnzhvkk`](https://testnet.nearblocks.io/txns/GnXXpAsFo6w9c77SjkK8VNYvY3uAwY49rPdFPbnzhvkk) |
| **8. Hardened v3 WASM & Solver-Refund Upgrade** | `DeployContract` (`FfC8pRQss8...`) + `update_policy` | [`AxUeZPcQUQWNjFfhdB84JMN8JRghu21bs9mykXEAZiwD`](https://testnet.nearblocks.io/txns/AxUeZPcQUQWNjFfhdB84JMN8JRghu21bs9mykXEAZiwD) |

---

## Quickstart & Deterministic Verification

### Prerequisites
- **Node.js** `>= 22.0.0` & **npm** `>= 10.0.0`
- **Rust** `>= 1.82` with `wasm32-unknown-unknown` target (`rustup target add wasm32-unknown-unknown`)

### 1. Install Dependencies
```bash
git clone https://github.com/eugenennamdi/Intercept.git
cd Intercept
npm install
```

### 2. Run Smart Contract, Agent & End-to-End Verification Suites
All verification suites run deterministically out of the box without requiring external API keys or funded wallets:

```bash
# Run all 29 Rust smart contract tests + 5 TypeScript agent/verifier suites
npm test

# Run full 5-stage cross-chain pipeline, live NEAR WASM view check, 11-vector red-team & backtest
npm run verify

# Query live NEAR v1.signer MPC derivations, Base RPC (8453) & Solana Mainnet RPC
npm run preflight

# Compile TypeScript packages and Next.js 15 production bundle
npm run build
```

### 3. Run the Web Dashboard Locally
```bash
cp .env.example .env   # optional — works out-of-the-box with zero secrets
npm run dev
```
Open [`http://localhost:3000`](http://localhost:3000) (or the live deployment at [`https://intercept-inky.vercel.app`](https://intercept-inky.vercel.app)) and [`/docs`](https://intercept-inky.vercel.app/docs) for the full technical specification. For Mainnet deployment and live cross-chain execution instructions, see [Section 5 of `ARCHITECTURE.md`](./ARCHITECTURE.md#5-deployment--live-operations-guide).

### 4. Interactive Verification Walkthrough (`Do X -> See Y`)
1. **Open [`https://intercept-inky.vercel.app`](https://intercept-inky.vercel.app) (`Live Market` preset)** → Observe live Solana Mainnet Kamino `Obligation` state (`3,344` bytes) and live Pyth `SOL/USD` volatility held in **`HOLD`** (`$0` bridged while `HF >= 1.15x`), or toggle **`Position Profile`** between `Live PDA (0.185 SOL)` and `Institutional (100 SOL / $5,000 USDC)`.
2. **Select `-20% Dip` vs. `-25% Crash` in the Market Stress Simulator** → Observe the risk engine shift from **`Micro Buffer` (`1.20x` target HF)** during orderly pullbacks to **`Cascade Rescue` (`1.45x` target HF)** under severe downward velocity, pulling a live `Base USDC -> Solana USDC` quote (`dry: true`) from `1click.chaindefuser.com/v0/quote` and verifying both unsigned payloads live against `intercept-guardrail-373299.testnet` WASM view methods.
3. **Open the `Transaction Proofs` tab** → Inspect the live **NEAR AI Cloud** Intel TDX + NVIDIA Hopper hardware quote commitment (`32-byte` CSPRNG nonce binding), the live `NEAR WASM Verified` badge (`intercept-guardrail-373299.testnet`), the raw `68`-byte Base EIP-1559 transfer calldata, and the raw `539`-byte Solana `V0` Kamino repay message.
4. **Click any of the `11` rows under `Security Guardrails`** → Inspect deterministic Rust byte-parser revert codes blocking collateral withdrawal (`0xcaf97572...`), ERC-20 `approve` (`0x095ea7b3`), `V0` Address Lookup Tables, `32`-byte blind pre-hashes, and gas-fee siphoning.
5. **Click `Configure Policy` in the navigation bar** → Override trigger Health Factor, per-rescue/daily USDC spending limits, or supply any live Solana Kamino `Obligation` address to re-run end-to-end verification in real time.

---

## Repository Structure

```text
Intercept/
├── contracts/
│   └── policy-guardrail/        # Rust (near-sdk-rs 5.7.0) on-chain byte-level policy guardrail
│       └── src/
│           ├── lib.rs           # 4-state async MPC state machine, refund reconciliation & sponsored deposit
│           ├── tee_receipt.rs   # Canonical Ed25519 TeeDecisionReceipt verifier & slippage/fee bounds
│           ├── evm_parser.rs    # Strict EIP-1559 RLP decoder & Base USDC transfer verifier
│           ├── solana_parser.rs # Solana V0/Legacy message parser, SPL Token pin & Kamino verifier
│           └── tests.rs         # 29 unit & adversarial red-team tests
├── packages/
│   ├── agent-tee/               # Confidential TEE risk engine, Pyth/Kamino readers & 1-Click client
│   └── web/                     # Next.js 15 App Router dashboard & technical documentation (/docs)
├── scripts/
│   └── deploy-near.sh           # Reproducible WASM build & NEAR deployment script
├── ARCHITECTURE.md              # Deep byte-level protocol specification & Mainnet operations guide
└── LICENSE                      # MIT License
```

## License

Released under the [MIT License](./LICENSE).
