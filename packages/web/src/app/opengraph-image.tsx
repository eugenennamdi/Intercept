import { ImageResponse } from "next/og";

export const alt =
  "Intercept — Non-Custodial Cross-Chain Liquidation Defense Built on NEAR";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#fafafa",
          color: "#09090b",
          padding: "64px 72px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Outer architectural frame */}
        <div
          style={{
            position: "absolute",
            top: "24px",
            left: "24px",
            right: "24px",
            bottom: "24px",
            backgroundColor: "#ffffff",
            border: "1px solid #e4e4e7",
            borderRadius: "20px",
            display: "flex",
          }}
        />

        {/* Top Header Row: Brand Mark + Status Pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "12px",
                backgroundColor: "#09090b",
                border: "1px solid #27272a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="30"
                height="30"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M8 7H17.5L13.5 15H8V7Z" fill="#FAFAFA" />
                <path d="M18.5 17H24V25H14.5L18.5 17Z" fill="#FAFAFA" />
                <path d="M21.5 7L24 7L10.5 25H8L21.5 7Z" fill="#A1A1AA" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  color: "#09090b",
                }}
              >
                INTERCEPT
              </span>
              <span
                style={{
                  fontSize: "13px",
                  color: "#71717a",
                  letterSpacing: "0.06em",
                }}
              >
                INTERCEPT-GUARDRAIL-373299.TESTNET
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 18px",
              borderRadius: "9999px",
              backgroundColor: "#f4f4f5",
              border: "1px solid #e4e4e7",
              fontSize: "14px",
              fontWeight: 600,
              color: "#18181b",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "9999px",
                backgroundColor: "#09090b",
              }}
            />
            <span>BUILT ON NEAR · NON-CUSTODIAL · 11/11 EXPLOITS BLOCKED</span>
          </div>
        </div>

        {/* Center Main Statement */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            maxWidth: "960px",
          }}
        >
          <div
            style={{
              fontSize: "62px",
              fontWeight: 700,
              lineHeight: 1.06,
              letterSpacing: "-0.04em",
              color: "#09090b",
            }}
          >
            Cross-Chain Liquidation Defense, Built on NEAR.
          </div>
          <div
            style={{
              fontSize: "22px",
              lineHeight: 1.45,
              color: "#52525b",
              maxWidth: "820px",
              letterSpacing: "-0.01em",
            }}
          >
            Keep SOL collateral in self-custody on Solana and standby USDC on Base.
            NEAR Confidential AI, Rust Policy Guardrails, Chain Signatures, and
            Intents settle debt repayments automatically before liquidation.
          </div>
        </div>

        {/* Bottom Architectural Spec Grid */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            paddingTop: "28px",
            borderTop: "1px solid #e4e4e7",
          }}
        >
          {[
            { label: "CONFIDENTIAL AI", value: "NEAR AI Cloud (Intel TDX)" },
            { label: "ON-CHAIN POLICY", value: "Rust WASM Byte Guardrail" },
            { label: "CROSS-CHAIN BRIDGE", value: "NEAR Intents 1-Click" },
            { label: "MULTI-CHAIN MPC", value: "Chain Signatures (v1.signer)" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  color: "#71717a",
                  letterSpacing: "0.08em",
                }}
              >
                {item.label}
              </span>
              <span
                style={{
                  fontSize: "17px",
                  fontWeight: 600,
                  color: "#09090b",
                  letterSpacing: "-0.01em",
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
