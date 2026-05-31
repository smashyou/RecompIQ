import { Stack, useRouter } from "expo-router";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { stackScreenOptions } from "@/lib/nav";
import { colors } from "@/lib/theme";

export default function LegalLayout() {
  const router = useRouter();
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="index"
        options={{
          title: "Legal & Safety",
          // Root of this pushed stack has no auto back button — add one that
          // pops back to wherever it was opened from (More / onboarding / signup).
          headerLeft: () => (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
              hitSlop={12}
              className="pr-3"
            >
              <Ionicons name="chevron-back" size={26} color={colors.foreground} />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="[slug]" options={{ title: "", headerBackTitle: "Legal" }} />
    </Stack>
  );
}
