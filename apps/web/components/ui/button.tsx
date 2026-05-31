"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--r-md)] font-[family-name:var(--font-sans)] font-semibold transition-[filter,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:border-[var(--primary)] focus-visible:ring-[3px] focus-visible:ring-[var(--primary-wash)] disabled:pointer-events-none disabled:opacity-[0.45]",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-bright)]",
        outline:
          "border border-[var(--border-strong)] bg-transparent text-[var(--fg)] hover:bg-[var(--surface-2)]",
        ghost:
          "border border-transparent bg-transparent text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
        destructive:
          "border border-transparent bg-[var(--danger)] text-[var(--danger-foreground)] hover:brightness-110",
      },
      size: {
        default: "h-10 px-[18px] text-[14px]",
        sm: "h-[34px] rounded-[var(--r-sm)] px-3 text-[13px]",
        lg: "h-12 px-6 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";
