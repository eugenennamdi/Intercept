import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "destructive"
  | "emerald"
  | "amber";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const badgeVariants: Record<BadgeVariant, string> = {
  default:
    "border-transparent bg-primary text-primary-foreground",
  secondary:
    "border-transparent bg-secondary text-secondary-foreground",
  outline:
    "border-border text-muted-foreground bg-transparent",
  destructive:
    "border-red-500/30 bg-red-500/10 text-red-400",
  emerald:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  amber:
    "border-amber-500/30 bg-amber-500/10 text-amber-400",
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
