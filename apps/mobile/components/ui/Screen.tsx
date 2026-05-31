import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme-context";

// Standard screen frame: safe-area top inset + optional scroll + consistent
// horizontal padding. Bottom inset is owned by the tab bar.
export function Screen({
  children,
  scroll = true,
  className,
}: {
  children: ReactNode;
  scroll?: boolean;
  className?: string;
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={["top"]} className="flex-1" style={{ backgroundColor: colors.background }}>
      {scroll ? (
        <ScrollView
          contentContainerClassName={cn("px-4 pb-12 pt-2", className)}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View className={cn("flex-1 px-4 pt-2", className)}>{children}</View>
      )}
    </SafeAreaView>
  );
}
