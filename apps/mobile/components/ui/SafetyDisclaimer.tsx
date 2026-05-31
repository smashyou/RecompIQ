import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme-context";
import { radius } from "@/lib/theme";

// Standard disclaimer that must accompany every peptide dose / stack / calculator
// render. Wording is kept VERBATIM with the web app
// (apps/web/components/peptides/safety-disclaimer.tsx) — never paraphrase.
// Styling follows the handoff Primitives SafetyDisclaimer (shield + primary
// wash on default; bordered surface on compact).
export function SafetyDisclaimer({
  variant = "default",
}: {
  variant?: "default" | "compact";
}) {
  const { colors } = useTheme();

  if (variant === "compact") {
    return (
      <View
        className="flex-row items-center"
        style={{
          gap: 9,
          paddingVertical: 9,
          paddingHorizontal: 12,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface1,
        }}
      >
        <Ionicons name="shield-outline" size={14} color={colors.fgSubtle} />
        <Text style={{ flex: 1, fontSize: 11.5, lineHeight: 16, color: colors.fgSubtle }}>
          Educational tracking only. Not medical advice. Discuss any protocol with a licensed
          clinician.
        </Text>
      </View>
    );
  }

  return (
    <View
      className="flex-row"
      style={{
        gap: 12,
        padding: 14,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.primaryLine,
        backgroundColor: colors.primaryWash,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface1,
          borderWidth: 1,
          borderColor: colors.primaryLine,
        }}
      >
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
      </View>
      <View className="flex-1" style={{ gap: 3 }}>
        <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.mutedForeground }}>
          <Text style={{ fontWeight: "600", color: colors.foreground }}>
            Educational tracking only.
          </Text>{" "}
          RecompIQ does not prescribe doses, diagnose conditions, or replace medical care. All dose
          values are user- or clinician-supplied.
        </Text>
        <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.mutedForeground }}>
          Discuss any peptide protocol with a licensed clinician before starting, changing, or
          discontinuing. Use sterile technique; do not reuse needles; discard questionable vials.
        </Text>
      </View>
    </View>
  );
}
