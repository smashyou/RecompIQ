import { Text, View } from "react-native";
import type { EvidenceLevel } from "@peptide/shared";
import { colors } from "@/lib/theme";

// Mirrors apps/web/components/peptides/evidence-badge.tsx — same labels + tones.
const LABEL: Record<EvidenceLevel, string> = {
  FDA_APPROVED: "FDA approved",
  HUMAN_RCT: "Human RCT",
  HUMAN_OBS: "Human observational",
  ANIMAL: "Animal only",
  MECHANISTIC: "Mechanistic",
  ANECDOTAL: "Anecdotal",
};

const TONE: Record<EvidenceLevel, string> = {
  FDA_APPROVED: colors.accent,
  HUMAN_RCT: colors.accent,
  HUMAN_OBS: colors.primary,
  ANIMAL: colors.mutedForeground,
  MECHANISTIC: colors.mutedForeground,
  ANECDOTAL: colors.destructive,
};

export function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  const tone = TONE[level];
  return (
    <View
      className="shrink-0 self-start rounded-full border px-2 py-0.5"
      style={{ borderColor: tone }}
    >
      <Text
        className="text-[10px] font-medium uppercase"
        style={{ color: tone, letterSpacing: 0.6 }}
      >
        {LABEL[level]}
      </Text>
    </View>
  );
}
