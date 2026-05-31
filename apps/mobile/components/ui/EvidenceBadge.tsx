import { Text, View } from "react-native";
import type { EvidenceLevel } from "@peptide/shared";
import { useTheme } from "@/lib/theme-context";
import { radius } from "@/lib/theme";

// Mirrors apps/web/components/peptides/evidence-badge.tsx + the handoff
// Primitives EvidenceBadge: a pill with a leading dot, per-grade evidence color.
const LABEL: Record<EvidenceLevel, string> = {
  FDA_APPROVED: "FDA approved",
  HUMAN_RCT: "Human RCT",
  HUMAN_OBS: "Human obs.",
  ANIMAL: "Animal only",
  MECHANISTIC: "Mechanistic",
  ANECDOTAL: "Anecdotal",
};

export function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  const { colors } = useTheme();
  const tone: Record<EvidenceLevel, string> = {
    FDA_APPROVED: colors.evFda,
    HUMAN_RCT: colors.evRct,
    HUMAN_OBS: colors.evObs,
    ANIMAL: colors.evAnimal,
    MECHANISTIC: colors.evMech,
    ANECDOTAL: colors.evAnecdotal,
  };
  const c = tone[level];
  return (
    <View
      className="shrink-0 flex-row items-center self-start"
      style={{
        gap: 6,
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: c,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
      <Text
        className="text-[10px] font-semibold uppercase"
        style={{ color: c, letterSpacing: 0.7 }}
      >
        {LABEL[level]}
      </Text>
    </View>
  );
}
