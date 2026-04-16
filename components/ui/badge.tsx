import { type VariantProps, cva } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-accent-subtle text-accent border border-accent/20",
        secondary: "bg-surface-raised text-foreground border border-border",
        success: "bg-success-subtle text-success-foreground border border-success/20",
        warning: "bg-warning-subtle text-warning-foreground border border-warning/20",
        destructive: "bg-destructive-subtle text-destructive-foreground border border-destructive/20",
        live: "bg-destructive/10 text-destructive border border-destructive/20 animate-pulse",
        outline: "border border-border text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
