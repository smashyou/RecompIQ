import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme-context";
import { radius } from "@/lib/theme";
import { useResponsive } from "@/lib/responsive";

// Mobile consent + 18+ gate. Mirrors the handoff MConsent / web ConsentGate:
// four acknowledgements (educational/research, research-chemical framing,
// jurisdiction/clinician, 18+). "Agree & continue" enables only when all are
// checked. Wording follows the reference verbatim in intent.
type ConsentId = "edu" | "research" | "law" | "age";

const ITEMS: ReadonlyArray<{ id: ConsentId; text: ReactNode }> = [
  {
    id: "edu",
    text: "I understand RecompIQ is for educational and research purposes only, is not medical advice, and does not prescribe, diagnose, or treat.",
  },
  {
    id: "research",
    text: "I understand many referenced compounds are research chemicals not approved for human consumption, and nothing here endorses purchasing, possessing, or administering any substance.",
  },
  {
    id: "law",
    text: "I am solely responsible for complying with the laws of my jurisdiction, and will discuss any protocol with a licensed clinician.",
  },
  { id: "age", text: "I confirm I am 18 years of age or older." },
];

export function ConsentGate({ onEnter }: { onEnter: () => void }) {
  const { colors } = useTheme();
  const { type } = useResponsive();
  const [checks, setChecks] = useState<Record<ConsentId, boolean>>({
    edu: false,
    research: false,
    law: false,
    age: false,
  });
  const all = ITEMS.every((i) => checks[i.id]);

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, justifyContent: "center" }}>
        <View style={{ width: "100%", maxWidth: 480, alignSelf: "center" }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.lg,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface1,
            borderWidth: 1,
            borderColor: colors.primaryLine,
            marginBottom: 18,
          }}
        >
          <Ionicons name="shield-checkmark-outline" size={28} color={colors.primary} />
        </View>

        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            letterSpacing: 1.8,
            textTransform: "uppercase",
            color: colors.primary,
          }}
        >
          Before you enter
        </Text>
        <Text
          style={{
            fontSize: type["2xl"],
            fontWeight: "600",
            letterSpacing: -0.5,
            color: colors.foreground,
            marginTop: 6,
            marginBottom: 8,
          }}
        >
          Acknowledge & consent
        </Text>
        <Text style={{ fontSize: 13, lineHeight: 19, color: colors.mutedForeground, marginBottom: 18 }}>
          RecompIQ is an information and tracking tool. To continue, confirm you understand its
          scope. You can review the full Medical Disclaimer and Research-Use Statement any time in
          Legal & Safety.
        </Text>

        <View style={{ gap: 9 }}>
          {ITEMS.map((item) => {
            const checked = checks[item.id];
            return (
              <Pressable
                key={item.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                onPress={() => setChecks((s) => ({ ...s, [item.id]: !s[item.id] }))}
                style={{
                  flexDirection: "row",
                  gap: 11,
                  alignItems: "flex-start",
                  padding: 13,
                  borderRadius: radius.md,
                  backgroundColor: checked ? colors.primaryWash : colors.surface1,
                  borderWidth: 1,
                  borderColor: checked ? colors.primaryLine : colors.border,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    marginTop: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: checked ? colors.primary : "transparent",
                    borderWidth: 1.5,
                    borderColor: checked ? colors.primary : colors.borderStrong,
                  }}
                >
                  {checked ? (
                    <Ionicons name="checkmark" size={14} color={colors.primaryForeground} />
                  ) : null}
                </View>
                <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: colors.foreground }}>
                  {item.text}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!all}
          onPress={() => all && onEnter()}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            height: 50,
            marginTop: 20,
            borderRadius: radius.md,
            backgroundColor: colors.primary,
            opacity: all ? 1 : 0.4,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.primaryForeground }}>
            Agree & continue
          </Text>
          <Ionicons name="arrow-forward" size={17} color={colors.primaryForeground} />
        </Pressable>

        <Text
          style={{
            fontSize: 11,
            lineHeight: 16,
            color: colors.fgFaint,
            marginTop: 16,
            textAlign: "center",
          }}
        >
          By continuing you accept the Terms of Use and Privacy Policy.
        </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
