import { Text, View } from "react-native";

// Standard disclaimer that must accompany every peptide dose / stack / calculator
// render. Wording is kept VERBATIM with the web app
// (apps/web/components/peptides/safety-disclaimer.tsx) — never paraphrase.
export function SafetyDisclaimer({
  variant = "default",
}: {
  variant?: "default" | "compact";
}) {
  if (variant === "compact") {
    return (
      <View className="rounded-md border border-border bg-muted p-2">
        <Text className="text-[10px] leading-relaxed text-muted-foreground">
          Educational tracking only. Not medical advice. Discuss any protocol with a licensed
          clinician.
        </Text>
      </View>
    );
  }
  return (
    <View className="flex-row gap-3 rounded-lg border border-border bg-muted p-4">
      <View className="mt-1 h-4 w-1 rounded-full bg-muted-foreground" />
      <View className="flex-1 gap-1">
        <Text className="text-xs leading-relaxed text-muted-foreground">
          <Text className="font-semibold text-foreground">Educational tracking only.</Text>{" "}
          RecompIQ does not prescribe doses, diagnose conditions, or replace medical care. All dose
          values are user- or clinician-supplied.
        </Text>
        <Text className="text-xs leading-relaxed text-muted-foreground">
          Discuss any peptide protocol with a licensed clinician before starting, changing, or
          discontinuing. Use sterile technique; do not reuse needles; discard questionable vials.
        </Text>
      </View>
    </View>
  );
}
