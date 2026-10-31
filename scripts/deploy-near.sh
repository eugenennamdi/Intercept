#!/usr/bin/env bash
set -euo pipefail

# Intercept Policy Guardrail Contract — Reproducible Build & NEAR Deployment Script
# Usage:
#   npm run deploy:near                           # Compiles release WASM and prints deploy command
#   POLICY_CONTRACT_ID=guardrail.your.near NEAR_NETWORK=mainnet npm run deploy:near -- --deploy

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> [1/2] Building release WASM (wasm32-unknown-unknown)..."
cargo build --manifest-path contracts/policy-guardrail/Cargo.toml --target wasm32-unknown-unknown --release

WASM_PATH="contracts/policy-guardrail/target/wasm32-unknown-unknown/release/intercept_policy_guardrail.wasm"
WASM_BYTES=$(wc -c < "$WASM_PATH" | tr -d ' ')
echo "==> Compiled WASM: $WASM_PATH (${WASM_BYTES} bytes)"

CONTRACT_ID="${POLICY_CONTRACT_ID:-guardrail.intercept-defi.near}"
NETWORK="${NEAR_NETWORK:-mainnet}"
OWNER_ID="${OWNER_NEAR_ID:-keeper-owner.near}"
AGENT_ID="${NEAR_ACCOUNT_ID:-tee-agent.intercept-defi.near}"
MPC_SIGNER="${MPC_SIGNER_CONTRACT_ID:-v1.signer}"

INIT_ARGS=$(cat <<EOF
{
  "policy": {
    "owner_id": "${OWNER_ID}",
    "authorized_agent_id": "${AGENT_ID}",
    "mpc_signer_contract": "${MPC_SIGNER}",
    "tee_enclave_pubkey_hex": "ef03c6fb5128efac12f621f4496fd3b84aa00f3df130f925b82e5d24c2a3a054",
    "mpc_base_vault_address_hex": "0x72faa1abaf92e0c4b791f15acedb496c8979746c",
    "mpc_solana_payer_pubkey": "GZMAbwapG99YKCsA2CDVc4bXeBzd7nvKMQgtm9K8aKas",
    "user_kamino_obligation_pubkey": "C5dZVpvpA39SNLDkojsi98nRePRRy8ELhtxak8m2vMq",
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
}
EOF
)

if [[ "${1:-}" == "--deploy" ]]; then
  echo "==> [2/2] Deploying ${WASM_PATH} to ${CONTRACT_ID} (${NETWORK})..."
  near contract deploy "${CONTRACT_ID}" use-file "${WASM_PATH}" with-init-call new json-args "${INIT_ARGS}" prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' network-config "${NETWORK}" sign-with-keychain send
else
  echo "==> [2/2] Ready to deploy! Run with '--deploy' or execute via near-cli-rs:"
  echo "near contract deploy ${CONTRACT_ID} use-file ${WASM_PATH} with-init-call new json-args '${INIT_ARGS}' prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' network-config ${NETWORK}"
fi
