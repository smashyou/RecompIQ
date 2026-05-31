import { Stack } from "expo-router";
import { stackScreenOptions } from "@/lib/nav";

export default function LegalLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: "Legal & Safety" }} />
      <Stack.Screen name="[slug]" options={{ title: "" }} />
    </Stack>
  );
}
