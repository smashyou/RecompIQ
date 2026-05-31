import { Text, View } from "react-native";
import type { ContraindicationFinding } from "@peptide/peptides/contraindications";

// Mirrors the web ContraindicationBanner: groups absolute (avoid) vs relative
// (caution) findings from evaluateContraindications().
export function ContraindicationBanner({ findings }: { findings: ContraindicationFinding[] }) {
  if (!findings.length) return null;
  const absolute = findings.filter((f) => f.severity === "absolute");
  const relative = findings.filter((f) => f.severity === "relative");
  return (
    <View className="gap-3 rounded-lg border border-destructive bg-card p-4">
      <Text className="text-sm font-semibold text-destructive">Contraindication check</Text>
      {absolute.length ? (
        <View className="gap-2">
          {absolute.map((f, i) => (
            <View key={`a${i}`} className="gap-0.5">
              <Text className="text-sm font-medium text-destructive">{f.compoundName} — avoid</Text>
              <Text className="text-xs leading-snug text-muted-foreground">
                {f.reason} · matched {f.matchedAgainst}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {relative.length ? (
        <View className="gap-2">
          {relative.map((f, i) => (
            <View key={`r${i}`} className="gap-0.5">
              <Text className="text-sm font-medium text-foreground">{f.compoundName} — caution</Text>
              <Text className="text-xs leading-snug text-muted-foreground">
                {f.reason} · matched {f.matchedAgainst}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text className="text-[10px] text-muted-foreground">
        Loose keyword matching — discuss anything flagged with a clinician.
      </Text>
    </View>
  );
}
