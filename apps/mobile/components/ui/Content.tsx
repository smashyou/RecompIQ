import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme-context";
import { useResponsive } from "@/lib/responsive";

// Content frame for screens INSIDE a stack (the native header owns the top safe
// area). Tab-root screens without a header use <Screen> instead.
// Responsive: horizontal padding follows the fluid space scale (more on tablet)
// and content is capped + centered so it doesn't stretch edge-to-edge on iPad.
const MAX_CONTENT = 760;

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
  const { space } = useResponsive();
  // className (often gap-*) goes on the inner column so its gaps still apply.
  const inner = (
    <View className={cn(className)} style={{ width: "100%", maxWidth: MAX_CONTENT, alignSelf: "center" }}>
      {children}
    </View>
  );
  if (!scroll) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.background, paddingHorizontal: space.page, paddingTop: 12 }}
      >
        {inner}
      </View>
    );
  }
  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingHorizontal: space.page, paddingTop: 12, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
    >
      {inner}
    </ScrollView>
  );
}
