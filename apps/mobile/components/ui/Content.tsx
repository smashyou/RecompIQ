import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme-context";

// Content frame for screens INSIDE a stack (the native header owns the top safe
// area). Tab-root screens without a header use <Screen> instead.
export function Content({
  children,
  scroll = true,
  className,
}: {
  children: ReactNode;
  scroll?: boolean;
  className?: string;
}) {
  const { colors } = useTheme();
  if (!scroll) {
    return (
      <View className={cn("flex-1 px-4 pt-3", className)} style={{ backgroundColor: colors.background }}>
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: colors.background }}
      contentContainerClassName={cn("px-4 pb-12 pt-3", className)}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
