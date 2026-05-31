import { Stack } from "expo-router";
import { stackScreenOptions } from "@/lib/nav";
import { PeptideSelectionProvider } from "@/lib/peptide-selection";

export default function PeptidesLayout() {
  return (
    <PeptideSelectionProvider>
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="index" options={{ title: "Peptides" }} />
        <Stack.Screen name="compounds" options={{ title: "Compound Catalog" }} />
        <Stack.Screen name="library/index" options={{ title: "Protocol Library" }} />
        <Stack.Screen name="library/[slug]" options={{ title: "" }} />
        <Stack.Screen name="reconstitution" options={{ title: "Reconstitution" }} />
        <Stack.Screen name="protocols" options={{ title: "Protocols" }} />
        <Stack.Screen name="dose-log" options={{ title: "Dose Log" }} />
        <Stack.Screen name="inventory" options={{ title: "Inventory & Spend" }} />
        <Stack.Screen name="stacks-new" options={{ title: "Add to Regimen" }} />
      </Stack>
    </PeptideSelectionProvider>
  );
}
