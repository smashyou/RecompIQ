import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";
import { cn } from "@/lib/cn";
import { colors } from "@/lib/theme";

type Variant = "primary" | "outline" | "ghost";

interface Props extends Omit<PressableProps, "children"> {
  title: string;
  variant?: Variant;
  loading?: boolean;
}

const CONTAINER: Record<Variant, string> = {
  primary: "bg-primary",
  outline: "border border-border bg-transparent",
  ghost: "bg-transparent",
};

const TEXT: Record<Variant, string> = {
  primary: "text-primary-foreground",
  outline: "text-foreground",
  ghost: "text-primary",
};

export function Button({
  title,
  variant = "primary",
  loading = false,
  disabled,
  className,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      className={cn(
        "flex-row items-center justify-center rounded-lg px-4 py-3",
        CONTAINER[variant],
        isDisabled && "opacity-50",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? colors.primaryForeground : colors.primary}
        />
      ) : (
        <Text className={cn("text-base font-semibold", TEXT[variant])}>{title}</Text>
      )}
    </Pressable>
  );
}
