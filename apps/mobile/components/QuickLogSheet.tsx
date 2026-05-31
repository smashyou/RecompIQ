import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme-context";
import { radius } from "@/lib/theme";

// Camera-first quick-log bottom sheet — matches the handoff MQuickLog:
// grab handle + title + 2x2 action tiles (Weight / Glucose / Dose / Vitals)
// each deep-linking to the existing log surfaces, plus a full-width
// "Snap a meal photo" primary action to the existing food-photo flow.
//
// Implemented as a slide-up transparent Modal (RN-native, no new deps) rather
// than a gesture-driven sheet, so it stays build-safe while reproducing the
// reference composition.

interface Latest {
  weight: string | null;
  glucose: string | null;
  dose: string | null;
  bp: string | null;
}

export function QuickLogSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { session } = useSession();
  const { colors } = useTheme();
  const [latest, setLatest] = useState<Latest>({ weight: null, glucose: null, dose: null, bp: null });

  useEffect(() => {
    if (!visible || !session) return;
    let active = true;
    const uid = session.user.id;
    (async () => {
      const [wRes, vRes, dRes] = await Promise.all([
        supabase.from("weights").select("value_lb").eq("user_id", uid).order("logged_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("vitals").select("glucose_mgdl,bp_systolic,bp_diastolic").eq("user_id", uid).order("logged_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("peptide_doses").select("compounds(name)").eq("user_id", uid).order("taken_at", { ascending: false }).limit(2),
      ]);
      if (!active) return;
      const w = (wRes.data as any)?.value_lb ?? null;
      const v = vRes.data as any;
      const doses = (dRes.data ?? []) as any[];
      const names = doses.map((d) => d.compounds?.name).filter(Boolean);
      setLatest({
        weight: w != null ? `${w} lb` : null,
        glucose: v?.glucose_mgdl != null ? `${v.glucose_mgdl} mg/dL` : null,
        dose: names.length ? names.slice(0, 2).join(" + ") : null,
        bp: v?.bp_systolic != null && v?.bp_diastolic != null ? `${v.bp_systolic}/${v.bp_diastolic}` : null,
      });
    })();
    return () => {
      active = false;
    };
  }, [visible, session]);

  function go(path: Parameters<typeof router.push>[0]) {
    onClose();
    router.push(path);
  }

  const tiles: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | null; tone: string; onPress: () => void }[] = [
    { icon: "scale-outline", label: "Weight", value: latest.weight, tone: colors.primary, onPress: () => go("/(tabs)/log?tab=weight") },
    { icon: "water-outline", label: "Glucose", value: latest.glucose, tone: colors.positive, onPress: () => go("/(tabs)/log?tab=vitals") },
    { icon: "medical-outline", label: "Dose", value: latest.dose, tone: colors.primary, onPress: () => go("/(tabs)/peptides/dose-log") },
    { icon: "heart-outline", label: "Vitals", value: latest.bp, tone: colors.warn, onPress: () => go("/(tabs)/log?tab=vitals") },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface1,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 40,
          }}
        >
          <View style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: colors.surface3, alignSelf: "center", marginBottom: 16 }} />
          <Text style={{ fontSize: 19, fontWeight: "600", color: colors.foreground, marginBottom: 4 }}>Quick log</Text>
          <Text style={{ fontSize: 12, color: colors.fgSubtle, marginBottom: 16 }}>One tap to record. Times stamp automatically.</Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 11 }}>
            {tiles.map((t) => (
              <Pressable
                key={t.label}
                onPress={t.onPress}
                style={{
                  width: "47.5%",
                  flexGrow: 1,
                  gap: 10,
                  padding: 15,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface2,
                }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={t.icon} size={17} color={t.tone} />
                </View>
                <View>
                  <Text style={{ fontSize: 13.5, fontWeight: "600", color: colors.foreground }}>{t.label}</Text>
                  <Text style={{ fontSize: 11, color: colors.fgSubtle, marginTop: 2 }} numberOfLines={1}>
                    {t.value ?? "Tap to log"}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => go("/(tabs)/more/food/photo")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginTop: 14,
              height: 46,
              borderRadius: radius.md,
              backgroundColor: colors.primary,
            }}
          >
            <Ionicons name="camera-outline" size={17} color={colors.primaryForeground} />
            <Text style={{ fontSize: 14.5, fontWeight: "600", color: colors.primaryForeground }}>Snap a meal photo</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
