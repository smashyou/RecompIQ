import { TextInput, type TextInputProps } from "react-native";
import { cn } from "@/lib/cn";
import { colors } from "@/lib/theme";

export function Input({ className, ...rest }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.mutedForeground}
      className={cn(
        "rounded-lg border border-border bg-input px-3 py-3 text-base text-foreground",
        className,
      )}
      {...rest}
    />
  );
}
