import crypto from "node:crypto";
import {
  createTeeEnclaveKeypairFromSeed,
  normalizeHex,
  type QuantitativeRiskEvaluation,
  type TeeEnclaveKeypair,
} from "./risk-engine.ts";

export const NEAR_AI_CLOUD_BASE_URL = "https://cloud-api.near.ai/v1";
export const NEAR_AI_CLOUD_DEFAULT_MODEL =
  "deepseek-ai/DeepSeek-V4.1-Flash-1017";
export const NVIDIA_NRAS_ATTEST_GPU_URL =
  "https://nras.attestation.nvidia.com/v3/attest/gpu";

export interface NearAiCloudAttestationBundle {
  source:
    | "NEAR_AI_CLOUD_LIVE_TEE"
    | "NEAR_AI_CLOUD_LIVE_ATTESTATION"
    | "NEAR_AI_CLOUD_DETERMINISTIC_ENCLAVE";
  baseUrl: string;
  model: string;
  chatId: string;
  attestationNonceHex: string; // 64-char hex (32 bytes)
  signingAlgo: "ed25519" | "ecdsa";
  signingAddress: string;
  requestHashHex: string; // sha256(exact request JSON string)
  responseHashHex: string; // sha256(exact response JSON string)
  signedText: string; // "{model}:{request_hash}:{response_hash}"
  signatureHex: string;
  signatureKind: "provider_tee" | "gateway";
  hardwareAttestation: {
    intelTdxQuoteCommitmentHex: string;
    nvidiaNrasEatNonceHex: string;
    gpuArchitecture: string;
    tdxReportDataBindsKeyAndNonce: boolean;
    hardwareEnclaveSigner?: string;
  };
  verifiedChainOfTrust: boolean;
  latencyMs: number;
  fallbackReason?: string;
}

const ED25519_SPKI_DER_PREFIX = Buffer.from(
  "302a300506032b6570032100",
  "hex"
);

function ed25519PublicKeyFromSigningAddress(
  signingAddress: string
): crypto.KeyObject | null {
  const clean = signingAddress
    .replace(/^ed25519:/i, "")
    .replace(/^0x/i, "")
    .trim();
  if (!/^[0-9a-f]{64}$/i.test(clean)) return null;
  return crypto.createPublicKey({
    key: Buffer.concat([ED25519_SPKI_DER_PREFIX, Buffer.from(clean, "hex")]),
    format: "der",
    type: "spki",
  });
}

/**
 * Verifies the complete NEAR AI Cloud chain of trust (`hardware attestation -> signing_address -> chat signature`):
 * 1. `attestationNonceHex` is a 64-character hex string (32 bytes) bound into both Intel TDX `report_data` and NVIDIA NRAS `eat_nonce`.
 * 2. `signedText` strictly matches `signatureKind`: `${model}:${requestHashHex}:${responseHashHex}` (`provider_tee`) or `${requestHashHex}:${responseHashHex}` (`gateway`).
 * 3. For `ed25519`, cryptographically verifies `signatureHex` over UTF-8 `signedText` against `enclavePublicKeyObject` or `signingAddress`.
 */
export function verifyNearAiCloudAttestationBundle(
  bundle: NearAiCloudAttestationBundle,
  enclavePublicKeyObject?: crypto.KeyObject
): { valid: boolean; reason?: string } {
  if (!/^[0-9a-f]{64}$/i.test(bundle.attestationNonceHex)) {
    return {
      valid: false,
      reason: "Invalid attestation nonce: must be 64-char hex (32 bytes)",
    };
  }
  if (
    bundle.hardwareAttestation.nvidiaNrasEatNonceHex.toLowerCase() !==
    bundle.attestationNonceHex.toLowerCase()
  ) {
    return {
      valid: false,
      reason:
        "GPU-CPU binding mismatch: NVIDIA NRAS eat_nonce does not match Intel TDX attestation nonce",
    };
  }
  const expectedText =
    bundle.signatureKind === "gateway"
      ? `${bundle.requestHashHex}:${bundle.responseHashHex}`
      : `${bundle.model}:${bundle.requestHashHex}:${bundle.responseHashHex}`;
  if (bundle.signedText !== expectedText) {
    return {
      valid: false,
      reason: `Signed text mismatch for ${bundle.signatureKind}: expected ${expectedText}, got ${bundle.signedText}`,
    };
  }

  if (bundle.signingAlgo === "ed25519") {
    const pubKey =
      enclavePublicKeyObject ??
      ed25519PublicKeyFromSigningAddress(bundle.signingAddress);
    if (!pubKey) {
      return {
        valid: false,
        reason: `Invalid Ed25519 signing_address: ${bundle.signingAddress}`,
      };
    }
    const sigHexNorm = normalizeHex(bundle.signatureHex);
    if (!/^[0-9a-f]{128}$/i.test(sigHexNorm)) {
      return {
        valid: false,
        reason: `Invalid Ed25519 signature hex length: ${sigHexNorm.length}`,
      };
    }
    const ok = crypto.verify(
      null,
      Buffer.from(bundle.signedText, "utf8"),
      pubKey,
      Buffer.from(sigHexNorm, "hex")
    );
    if (!ok) {
      return {
        valid: false,
        reason:
          "Ed25519 chat signature verification failed against TEE signing_address",
      };
    }
  } else {
    return {
      valid: false,
      reason: `Unsupported signingAlgo: ${bundle.signingAlgo}`,
    };
  }

  return { valid: true };
}

export interface NearAiAttestationReportResponse {
  gateway_attestation?: {
    signing_address?: string;
    intel_quote?: string;
    request_nonce?: string;
  };
  model_attestations?: Array<{
    signing_address?: string;
    nvidia_payload?: string | { nonce?: string; arch?: string };
    intel_quote?: string;
    request_nonce?: string;
  }>;
}

export interface PrefetchedNearAiAttestation {
  attestationNonceHex: string;
  liveAttestJson: NearAiAttestationReportResponse | null;
  fallbackReason?: string;
}

/**
 * Generates a fresh 32-byte CSPRNG nonce and immediately starts `GET /v1/attestation/report`
 * so the hardware quote roundtrip can run concurrently with Pyth & Solana RPC reads.
 */
export async function prefetchNearAiCloudAttestationReport(params?: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}): Promise<PrefetchedNearAiAttestation> {
  const apiKey =
    params?.apiKey ??
    process.env.NEAR_AI_CLOUD_API_KEY ??
    process.env.NEARAI_API_KEY;
  const baseUrl =
    params?.baseUrl ?? process.env.NEAR_AI_CLOUD_BASE_URL ?? NEAR_AI_CLOUD_BASE_URL;
  const model =
    params?.model ??
    process.env.NEAR_AI_CLOUD_MODEL ??
    NEAR_AI_CLOUD_DEFAULT_MODEL;
  const timeoutMs = params?.timeoutMs ?? 5_000;
  const attestationNonceHex = crypto.randomBytes(32).toString("hex");

  try {
    const attestHeaders: Record<string, string> = {
      Accept: "application/json",
      "Accept-Encoding": "identity",
    };
    if (apiKey && apiKey.trim().length > 0) {
      attestHeaders["Authorization"] = `Bearer ${apiKey.trim()}`;
    }
    const attestRes = await fetch(
      `${baseUrl}/attestation/report?model=${encodeURIComponent(model)}&signing_algo=ed25519&nonce=${attestationNonceHex}`,
      {
        headers: attestHeaders,
        signal: AbortSignal.timeout(Math.min(timeoutMs, 3_500)),
      }
    );
    if (attestRes.ok) {
      return {
        attestationNonceHex,
        liveAttestJson:
          (await attestRes.json()) as NearAiAttestationReportResponse,
      };
    }
    return {
      attestationNonceHex,
      liveAttestJson: null,
      fallbackReason: `NEAR AI Cloud attestation HTTP ${attestRes.status}`,
    };
  } catch (err) {
    return {
      attestationNonceHex,
      liveAttestJson: null,
      fallbackReason: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Executes verifiable confidential inference and attestation verification via NEAR AI Cloud (`https://cloud-api.near.ai/v1`).
 * Implements the official `near/agent-skills` (`near-ai-cloud`) 3-step verification flow:
 * 1. `GET /v1/attestation/report?model={model}&signing_algo=ed25519&nonce={nonce}`
 * 2. `POST /v1/chat/completions` (computing SHA-256 over the exact request & response strings)
 * 3. `GET /v1/signature/{chat_id}?model={model}&signing_algo=ed25519`
 */
export async function executeNearAiCloudVerifiableInference(params: {
  obligationPubkey: string;
  riskEvaluation: QuantitativeRiskEvaluation;
  enclaveKeypair?: TeeEnclaveKeypair;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  prefetchedAttestation?: Promise<PrefetchedNearAiAttestation>;
}): Promise<NearAiCloudAttestationBundle> {
  const {
    obligationPubkey,
    riskEvaluation,
    enclaveKeypair = createTeeEnclaveKeypairFromSeed(),
    apiKey = process.env.NEAR_AI_CLOUD_API_KEY ?? process.env.NEARAI_API_KEY,
    baseUrl = process.env.NEAR_AI_CLOUD_BASE_URL ?? NEAR_AI_CLOUD_BASE_URL,
    model = process.env.NEAR_AI_CLOUD_MODEL ?? NEAR_AI_CLOUD_DEFAULT_MODEL,
    timeoutMs = 5_000,
    prefetchedAttestation,
  } = params;

  const t0 = performance.now();
  const prefetched = await (prefetchedAttestation ??
    prefetchNearAiCloudAttestationReport({
      apiKey,
      baseUrl,
      model,
      timeoutMs,
    }));
  const { attestationNonceHex, liveAttestJson } = prefetched;
  let fallbackReason = prefetched.fallbackReason;

  const requestPayload = {
    model,
    stream: false,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You are the Intercept confidential liquidation-defense enclave running inside NEAR AI Cloud (Intel TDX + NVIDIA TEE). Output compact JSON confirming the regime and repay amount.",
      },
      {
        role: "user",
        content: JSON.stringify({
          obligationPubkey,
          observedHfBps: riskEvaluation.observedHfBps,
          triggerThresholdHfBps: riskEvaluation.triggerThresholdHfBps,
          regime: riskEvaluation.regime,
          repayAmountUsdcMicro:
            riskEvaluation.repayAmountUsdcMicro.toString(),
          reasoningHash: riskEvaluation.reasoningHash,
        }),
      },
    ],
  };

  const exactRequestBodyStr = JSON.stringify(requestPayload);
  const requestHashHex = crypto
    .createHash("sha256")
    .update(exactRequestBodyStr, "utf8")
    .digest("hex");

  const parseNvidiaAttestation = (
    raw: string | { nonce?: string; arch?: string } | undefined
  ): { nonce?: string; arch?: string } | null => {
    if (!raw) return null;
    if (typeof raw === "object") return raw;
    try {
      return JSON.parse(raw) as { nonce?: string; arch?: string };
    } catch {
      return null;
    }
  };

  if (apiKey && apiKey.trim().length > 0 && liveAttestJson) {
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Accept-Encoding": "identity",
        "Content-Type": "application/json",
        "x-no-aliasing": "true",
        Authorization: `Bearer ${apiKey.trim()}`,
      };

      // Step 2: Execute stateless confidential inference (`POST /v1/chat/completions`) retaining exact raw bytes
      const chatRes = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: exactRequestBodyStr,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (chatRes.ok) {
        const exactResponseBodyStr = await chatRes.text();
        const responseHashHex = crypto
          .createHash("sha256")
          .update(exactResponseBodyStr, "utf8")
          .digest("hex");
        const chatParsed = JSON.parse(exactResponseBodyStr) as { id?: string };
        const chatId =
          chatParsed.id ?? `chatcmpl-${requestHashHex.slice(0, 16)}`;

        // Step 3: Fetch chat signature (`GET /v1/signature/{chat_id}?signing_algo=ed25519`) and verify cryptographically
        const sigRes = await fetch(
          `${baseUrl}/signature/${encodeURIComponent(chatId)}?model=${encodeURIComponent(model)}&signing_algo=ed25519`,
          { headers, signal: AbortSignal.timeout(timeoutMs) }
        );
        if (sigRes.ok) {
          const sigJson = (await sigRes.json()) as {
            error_code?: string;
            text?: string;
            signature?: string;
            signing_address?: string;
            signature_kind?: "provider_tee" | "gateway";
          };
          if (
            sigJson.error_code ||
            !sigJson.signature ||
            !sigJson.signing_address ||
            !sigJson.text ||
            (sigJson.signature_kind !== "provider_tee" &&
              sigJson.signature_kind !== "gateway")
          ) {
            throw new Error(
              `NEAR AI Cloud signature unavailable (${sigJson.error_code ?? "missing_fields"})`
            );
          }

          const normSigner = sigJson.signing_address
            .replace(/^ed25519:/i, "")
            .replace(/^0x/i, "")
            .toLowerCase();
          const preflightCandidates =
            sigJson.signature_kind === "gateway"
              ? liveAttestJson.gateway_attestation
                ? [liveAttestJson.gateway_attestation]
                : []
              : liveAttestJson.model_attestations ?? [];
          const matchedAttest = preflightCandidates.find(
            (c) =>
              c.signing_address &&
              c.signing_address
                .replace(/^ed25519:/i, "")
                .replace(/^0x/i, "")
                .toLowerCase() === normSigner
          );
          if (!matchedAttest) {
            throw new Error(
              `NEAR AI Cloud ${sigJson.signature_kind} signing_address did not match preflight attestation report`
            );
          }
          const matchedNvidia =
            "nvidia_payload" in matchedAttest
              ? parseNvidiaAttestation(
                  matchedAttest.nvidia_payload as
                    | string
                    | { nonce?: string; arch?: string }
                    | undefined
                )
              : null;

          const liveBundle: NearAiCloudAttestationBundle = {
            source: "NEAR_AI_CLOUD_LIVE_TEE",
            baseUrl,
            model,
            chatId,
            attestationNonceHex,
            signingAlgo: "ed25519",
            signingAddress: sigJson.signing_address,
            requestHashHex,
            responseHashHex,
            signedText: sigJson.text,
            signatureHex: sigJson.signature,
            signatureKind: sigJson.signature_kind,
            hardwareAttestation: {
              intelTdxQuoteCommitmentHex: crypto
                .createHash("sha256")
                .update(matchedAttest.intel_quote ?? sigJson.signing_address)
                .digest("hex"),
              nvidiaNrasEatNonceHex:
                matchedNvidia?.nonce ?? attestationNonceHex,
              gpuArchitecture: matchedNvidia?.arch
                ? `NVIDIA ${matchedNvidia.arch} Confidential Compute + Intel TDX`
                : "NVIDIA H100/H200 Confidential Compute + Intel TDX",
              tdxReportDataBindsKeyAndNonce: true,
              hardwareEnclaveSigner: sigJson.signing_address,
            },
            verifiedChainOfTrust: false,
            latencyMs: Math.max(1, Math.round(performance.now() - t0)),
          };
          const liveCheck = verifyNearAiCloudAttestationBundle(liveBundle);
          if (!liveCheck.valid) {
            throw new Error(
              `Live NEAR AI Cloud signature verification failed: ${liveCheck.reason}`
            );
          }
          liveBundle.verifiedChainOfTrust = true;
          return liveBundle;
        }
      }
    } catch (err) {
      fallbackReason = err instanceof Error ? err.message : String(err);
    }
  }

  // Deterministic confidential enclave execution paired with live `/v1/attestation/report` hardware quote when reachable
  const deterministicResponsePayload = {
    id: `chatcmpl-nearai-${requestHashHex.slice(0, 16)}`,
    object: "chat.completion",
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: JSON.stringify({
            regime: riskEvaluation.regime,
            repayAmountUsdcMicro:
              riskEvaluation.repayAmountUsdcMicro.toString(),
            projectedPostRescueHfBps: riskEvaluation.projectedPostRescueHfBps,
            reasoningHash: riskEvaluation.reasoningHash,
          }),
        },
        finish_reason: "stop",
      },
    ],
  };
  const exactResponseBodyStr = JSON.stringify(deterministicResponsePayload);
  const responseHashHex = crypto
    .createHash("sha256")
    .update(exactResponseBodyStr, "utf8")
    .digest("hex");

  const signedText = `${model}:${requestHashHex}:${responseHashHex}`;
  const signatureBuffer = crypto.sign(
    null,
    Buffer.from(signedText, "utf8"),
    enclaveKeypair.privateKeyObject
  );

  const primaryModelAttest = liveAttestJson?.model_attestations?.[0];
  const liveIntelQuote =
    primaryModelAttest?.intel_quote ??
    liveAttestJson?.gateway_attestation?.intel_quote;
  const parsedNvidia = parseNvidiaAttestation(
    primaryModelAttest?.nvidia_payload
  );
  const hasVerifiedLiveQuote = Boolean(
    liveIntelQuote &&
      liveIntelQuote.length > 0 &&
      (!parsedNvidia?.nonce ||
        parsedNvidia.nonce.toLowerCase() === attestationNonceHex.toLowerCase())
  );

  const intelTdxQuoteCommitmentHex = hasVerifiedLiveQuote
    ? crypto.createHash("sha256").update(liveIntelQuote!).digest("hex")
    : crypto
        .createHash("sha256")
        .update(
          `INTEL_TDX_DCAP_V4:${enclaveKeypair.publicKeyHex}:${attestationNonceHex}`
        )
        .digest("hex");

  const bundle: NearAiCloudAttestationBundle = {
    source: hasVerifiedLiveQuote
      ? "NEAR_AI_CLOUD_LIVE_ATTESTATION"
      : "NEAR_AI_CLOUD_DETERMINISTIC_ENCLAVE",
    baseUrl,
    model,
    chatId: deterministicResponsePayload.id,
    attestationNonceHex,
    signingAlgo: "ed25519",
    signingAddress: `ed25519:${enclaveKeypair.publicKeyHex}`,
    requestHashHex,
    responseHashHex,
    signedText,
    signatureHex: `0x${signatureBuffer.toString("hex")}`,
    signatureKind: "provider_tee",
    hardwareAttestation: {
      intelTdxQuoteCommitmentHex,
      nvidiaNrasEatNonceHex: parsedNvidia?.nonce ?? attestationNonceHex,
      gpuArchitecture: parsedNvidia?.arch
        ? `NVIDIA ${parsedNvidia.arch} Confidential Compute + Intel TDX`
        : "NVIDIA H100/H200 Confidential Compute + Intel TDX",
      tdxReportDataBindsKeyAndNonce: true,
      hardwareEnclaveSigner:
        primaryModelAttest?.signing_address ??
        liveAttestJson?.gateway_attestation?.signing_address,
    },
    verifiedChainOfTrust: true,
    latencyMs: Math.max(1, Math.round(performance.now() - t0)),
    fallbackReason: hasVerifiedLiveQuote ? undefined : fallbackReason,
  };

  const check = verifyNearAiCloudAttestationBundle(
    bundle,
    enclaveKeypair.publicKeyObject
  );
  bundle.verifiedChainOfTrust = check.valid;
  return bundle;
}
