import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Intercept Geometric Mark
 * Metaphor Fusion: Two precision architectural prisms (Base Origin & Solana Destination)
 * bisected by a deterministic intercept vector slash in negative space.
 */
export function InterceptLogoMark({
  className,
  size = 18,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* Upper-left origin prism */}
      <path d="M7 6H17.5L13 15H7V6Z" fill="currentColor" />
      {/* Lower-right destination prism */}
      <path d="M19 17H25V26H14.5L19 17Z" fill="currentColor" />
      {/* Precision intercept vector */}
      <path
        d="M22 6L25 6L10 26H7L22 6Z"
        fill="currentColor"
        fillOpacity="0.55"
      />
    </svg>
  );
}
