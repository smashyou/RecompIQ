import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme-context";
import { useResponsive } from "@/lib/responsive";

// Standard screen frame: safe-area top inset + optional scroll + responsive
// horizontal padding (fluid space scale, more on tablet) with content capped +
// centered so it doesn't stretch edge-to-edge on iPad. Bottom inset is owned by
// the tab bar.
const MAX_CONTENT = 760;

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
  const { space } = useResponsive();
  const inner = (
    <View className={cn(className)} style={{ width: "100%", maxWidth: MAX_CONTENT, alignSelf: "center" }}>
      {children}
    </View>
  );
  return (
    <SafeAreaView edges={["top"]} className="flex-1" style={{ backgroundColor: colors.background }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space.page, paddingTop: 8, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          {inner}
        </ScrollView>
      ) : (
        <View className="flex-1" style={{ paddingHorizontal: space.page, paddingTop: 8 }}>
          {inner}
        </View>
      )}
    </SafeAreaView>
  );
}
