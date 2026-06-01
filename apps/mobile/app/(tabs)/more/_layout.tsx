import { Stack } from "expo-router";
import { stackScreenOptions } from "@/lib/nav";

export default function MoreLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: "More" }} />
      <Stack.Screen name="goals" options={{ title: "Your Goals" }} />
      <Stack.Screen name="health" options={{ title: "Watch & Scale Sync" }} />
      <Stack.Screen name="food/index" options={{ title: "Food" }} />
      <Stack.Screen name="food/log" options={{ title: "Add Food" }} />
      <Stack.Screen name="food/photo" options={{ title: "Snap a Meal" }} />
      <Stack.Screen name="workouts/index" options={{ title: "Workouts" }} />
      <Stack.Screen name="workouts/templates" options={{ title: "Templates" }} />
      <Stack.Screen name="workouts/new" options={{ title: "New Workout" }} />
      <Stack.Screen name="body-shots/index" options={{ title: "Body Shots" }} />
      <Stack.Screen name="body-shots/capture" options={{ title: "Capture" }} />
      <Stack.Screen name="projections" options={{ title: "Projections" }} />
      <Stack.Screen name="labs" options={{ title: "Labs & Biomarkers" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="account" options={{ title: "Account" }} />
      <Stack.Screen name="admin" options={{ title: "Admin" }} />
    </Stack>
  );
}
