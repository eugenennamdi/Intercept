# AGENTS.md — Codebase & Verification Guide

Technical reference for developers and automated code-review agents working in the `Intercept` monorepo.

## 1. Zero-Secret Reproducible Commands

All unit tests, adversarial exploit checks, live read-only RPC verifiers, and production builds run out of the box with **zero API keys or private keys required**:

```bash
# 1. Run 29 Rust WASM contract tests + 5 TypeScript TEE/parser suites
npm test

# 2. Run 5-stage cross-chain pipeline, live NEAR Testnet WASM view check, 11-vector red-team & 3-regime backtest
npm run verify

# 3. Query live NEAR Mainnet v1.signer MPC derivations, Base Mainnet (8453) & Solana Mainnet RPC
npm run preflight

# 4. Build @intercept/agent-tee (tsc) and @intercept/web (Next.js 15 App Router)
npm run build
```

## 2. Claim-to-Code Map

| System Component | Source File | Key Symbols & Responsibilities |
| :--- | :--- | :--- |
| **On-Chain Policy State Machine (`near-sdk-rs 5.29.1`)** | `contracts/policy-guardrail/src/lib.rs` | `InterceptPolicyContract`, 4-state async lifecycle (`InFlightLeg1 -> ReadyForLeg2 -> InFlightLeg2 -> Completed`), `resolve_mpc_sign_deposit` (`0.05 NEAR` zero-deposit sponsorship), `cancel_refunded_rescue`, zero-gas `verify_rescue_origin_leg` / `verify_rescue_destination_leg` view methods. |
| **Canonical TEE Receipt Verifier** | `contracts/policy-guardrail/src/tee_receipt.rs` | `verify_tee_receipt`: Ed25519 signature verification over `INTERCEPT_TEE_RECEIPT_V1\|...`, timestamp freshness (`30..=3600s`), `min_trigger_hf_bps` check, and slippage/solver-fee bounds. |
| **Base EIP-1559 RLP Byte Parser** | `contracts/policy-guardrail/src/evm_parser.rs` | `verify_eip1559_base_usdc_transfer`: strict canonical RLP decoding (`0x02`), pins `chain_id == 8453`, Base Native USDC (`0x8335...2913`), `transfer(0xa9059cbb)` (blocks `approve`), recipient, exact amount, and `<= 50 gwei` gas cap. |
| **Solana V0 / Kamino Byte Parser** | `contracts/policy-guardrail/src/solana_parser.rs` | `verify_solana_kamino_repay_message`: rejects 32-byte blind pre-hashes and `V0` Address Lookup Tables, whitelists `ComputeBudget` + `KLend2g...` refresh/repay discriminators (`0x74aed54cb435d290`), pins user `Obligation`, Kamino market, USDC reserve, and classic `SPL_TOKEN_PROGRAM`. |
| **Contract Unit & Red-Team Suite (`29` tests)** | `contracts/policy-guardrail/src/tests.rs` | End-to-end Leg 1/Leg 2 flow, `v1.signer` `payload_v2` (`Ecdsa` / `Eddsa`), callback rollbacks, solver-refund allowance restoration, and adversarial revert proofs. |
| **NEAR AI Cloud Hardware Attestation** | `packages/agent-tee/src/near-ai-cloud.ts` | `prefetchNearAiCloudAttestationReport` & `executeNearAiCloudVerifiableInference`: binds fresh 32-byte CSPRNG nonces to live Intel TDX DCAP + NVIDIA Hopper `/v1/attestation/report` quotes (`cloud-api.near.ai/v1`). |
| **Live Solana Kamino & Pyth Readers** | `packages/agent-tee/src/kamino-reader.ts`, `pyth-volatility.ts` | Zero-copy binary decoding of live Solana Mainnet Kamino `Obligation` (`3,344` bytes, PDA `C5dZVpvp...`) and Pyth `PriceUpdateV2` (`7UVimff...`) spot/EMA/confidence intervals. |
| **NEAR Intents 1-Click Client** | `packages/agent-tee/src/oneclick-client.ts` | `fetchOneClickRescueQuote`: live `POST https://1click.chaindefuser.com/v0/quote` (`Base USDC -> Solana USDC`) with solver-spread headroom and `refundTo = MPC_Base_Vault`. |
| **NEAR RPC, MPC Derivation & Live WASM View Check** | `packages/agent-tee/src/mainnet-broadcaster.ts` | `deriveMpcAddressesFromNearSigner` (`v1.signer` / `v1.signer-prod.testnet`), `verifyRescuePayloadsOnNearWasmView` (live RPC WASM check against `intercept-guardrail-373299.testnet`), and `invokeNearPolicyContractLive`. |
| **Quantitative Volatility Model & Backtest** | `packages/agent-tee/src/risk-engine.ts`, `backtest.ts` | `evaluateDynamicDeRiskingModel` (`HOLD` / `MICRO_BUFFER_RESCUE` `1.20x` / `CASCADE_DEEP_RESCUE` `1.45x`) and `runQuantitativeBacktestSuite` (`100%` cascade survival, `73.9%` standby capital saved). |
| **Web Dashboard & Stateless API** | `packages/web/src/app/page.tsx`, `api/intercept/route.ts`, `docs/page.tsx` | Interactive stress simulator, live NEAR WASM proof inspector, 11-vector security matrix, policy override drawer, and full `/docs` specification. |

## 3. Live Network vs. Funded Broadcast Scope

- **Runs Live by Default (`npm run verify`, `npm run dev`, and `intercept-inky.vercel.app`):**
  - Reads live Solana Mainnet Pyth `PriceUpdateV2` and Kamino `Obligation` binary account state.
  - Reads live Base Mainnet (`8453`) gas/nonce and NEAR `v1.signer` deterministic MPC public keys.
  - Fetches live keyless Intel TDX + NVIDIA Hopper attestation quotes from `https://cloud-api.near.ai/v1/attestation/report`.
  - Requests live non-committal cross-chain quotes (`dry: true`) from `https://1click.chaindefuser.com/v0/quote`.
  - Executes live zero-gas WASM view calls (`verify_rescue_origin_leg` & `verify_rescue_destination_leg`) against `intercept-guardrail-373299.testnet` on NEAR Testnet RPC.
- **Requires Funded Vaults & Scoped Key (`npm run rescue:live`):**
  - State-mutating `broadcast_tx_commit` signing via `v1.signer` and live USDC transfer/repayment on Base and Solana execute only when `NEAR_ACCOUNT_ID`, `NEAR_PRIVATE_KEY`, and `POLICY_CONTRACT_ID` are configured in `.env`.
