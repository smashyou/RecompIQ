import { ActivityIndicator, Pressable, Text, View, type PressableProps } from "react-native";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme-context";
import { radius } from "@/lib/theme";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends Omit<PressableProps, "children"> {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  left?: ReactNode;
  right?: ReactNode;
}

const SIZES: Record<Size, { height: number; padding: number; fontSize: number; radius: number }> = {
  sm: { height: 34, padding: 12, fontSize: 13, radius: radius.sm },
  md: { height: 40, padding: 18, fontSize: 14, radius: radius.md },
  lg: { height: 48, padding: 24, fontSize: 15, radius: radius.md },
};

export function Button({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  left,
  right,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const s = SIZES[size];
  const isDisabled = disabled || loading;

  const variants: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.primary, fg: colors.primaryForeground, border: "transparent" },
    outline: { bg: "transparent", fg: colors.foreground, border: colors.borderStrong },
    ghost: { bg: "transparent", fg: colors.mutedForeground, border: "transparent" },
    danger: { bg: colors.danger, fg: colors.dangerForeground, border: "transparent" },
  };
  const v = variants[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      className={cn("flex-row items-center justify-center", className)}
      style={{
        gap: 8,
        height: s.height,
        paddingHorizontal: s.padding,
        borderRadius: s.radius,
        borderWidth: 1,
        borderColor: v.border,
        backgroundColor: v.bg,
        opacity: isDisabled ? 0.4 : 1,
      }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {left ? <View>{left}</View> : null}
          <Text style={{ color: v.fg, fontSize: s.fontSize, fontWeight: "600" }}>{title}</Text>
          {right ? <View>{right}</View> : null}
        </>
      )}
    </Pressable>
  );
}
