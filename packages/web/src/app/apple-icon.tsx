import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#09090b",
          borderRadius: "40px",
          border: "4px solid #27272a",
        }}
      >
        <svg
          width="112"
          height="112"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M6 5H17.5L12.5 15H6V5Z" fill="#FAFAFA" />
          <path d="M19.5 17H26V27H14.5L19.5 17Z" fill="#FAFAFA" />
          <path d="M22.5 5L26 5L9.5 27H6L22.5 5Z" fill="#A1A1AA" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
