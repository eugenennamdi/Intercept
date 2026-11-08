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
    "border-transparent bg-primary text-primary-foreground font-medium",
  secondary:
    "border-zinc-800 bg-secondary text-zinc-200",
  outline:
    "border-zinc-800 text-zinc-400 bg-transparent",
  destructive:
    "border-zinc-500/60 bg-zinc-900 text-zinc-100 bg-monochrome-hatch",
  contrast:
    "border-zinc-300/80 bg-zinc-100 text-zinc-950 font-semibold",
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
