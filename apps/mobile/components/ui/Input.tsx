import { useState } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme-context";
import { radius } from "@/lib/theme";

// 42px surface-2 input. Focus lifts the border to primary + a soft wash ring,
// error swaps to danger — matches the handoff Field.
export function Input({
  className,
  style,
  error,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps & { error?: boolean }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;
  return (
    <TextInput
      placeholderTextColor={colors.fgSubtle}
      className={cn("text-base", className)}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        {
          height: 42,
          paddingHorizontal: 13,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor,
          backgroundColor: colors.surface2,
          color: colors.foreground,
        },
        style,
      ]}
      {...rest}
    />
  );
}
