import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const invalid = error || ariaInvalid === true || ariaInvalid === "true";
    return (
      <input
        type={type}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-[42px] w-full rounded-[var(--r-md)] border bg-[var(--surface-2)] px-[13px] font-[family-name:var(--font-sans)] text-[14px] text-[var(--fg)] transition-[border-color,box-shadow] duration-[120ms] placeholder:text-[var(--fg-subtle)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-[0.45]",
          invalid
            ? "border-[var(--danger)] focus-visible:border-[var(--danger)] focus-visible:ring-[3px] focus-visible:ring-[var(--danger-wash)]"
            : "border-border focus-visible:border-[var(--primary)] focus-visible:ring-[3px] focus-visible:ring-[var(--primary-wash)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
