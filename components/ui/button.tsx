import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ className, asChild, variant = "primary", ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition-transform duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean/50 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-ocean text-white shadow-soft hover:-translate-y-0.5",
        variant === "secondary" && "bg-white/80 text-ocean ring-1 ring-ocean/10 hover:bg-white",
        variant === "ghost" && "bg-transparent text-ocean hover:bg-ocean/5",
        variant === "danger" && "bg-terracotta text-white hover:-translate-y-0.5",
        className,
      )}
      {...props}
    />
  );
}
