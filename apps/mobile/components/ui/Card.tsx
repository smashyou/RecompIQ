import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme-context";
import { radius } from "@/lib/theme";

// Surface-1 card with hairline border, 14px radius — matches the handoff MCard.
export function Card({ className, style, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      className={cn("p-4", className)}
      style={[
        {
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface1,
        },
        style,
      ]}
      {...rest}
    />
  );
}
