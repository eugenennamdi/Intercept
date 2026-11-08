import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "destructive"
  | "contrast";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const badgeVariants: Record<BadgeVariant, string> = {
  default:
    "border-transparent bg-zinc-900 text-zinc-50 font-medium",
  secondary:
    "border-zinc-200 bg-zinc-100 text-zinc-800",
  outline:
    "border-zinc-200 text-zinc-600 bg-white",
  destructive:
    "border-zinc-300 bg-zinc-100 text-zinc-900 bg-monochrome-hatch font-medium",
  contrast:
    "border-zinc-900 bg-zinc-900 text-zinc-50 font-semibold",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium leading-none whitespace-nowrap",
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  );
}
