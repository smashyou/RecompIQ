import { Stack } from "expo-router";
import { stackScreenOptions } from "@/lib/nav";

export default function CoachLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: "Coach" }} />
    </Stack>
  );
}
