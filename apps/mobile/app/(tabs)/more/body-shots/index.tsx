import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Alert, Image, Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Content } from "@/components/ui/Content";
import { Loading, ErrorState, EmptyState } from "@/components/ui/States";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

interface Session {
  id: string;
  captured_at: string;
  front_url: string | null;
  back_url: string | null;
  left_url: string | null;
  right_url: string | null;
  weight_at_capture_lb: number | null;
  notes: string | null;
}

const ANGLES: { key: keyof Session; label: string }[] = [
  { key: "front_url", label: "Front" },
  { key: "back_url", label: "Back" },
  { key: "left_url", label: "Left" },
  { key: "right_url", label: "Right" },
];

export default function BodyShots() {
  const router = useRouter();
  const { session } = useSession();
  const uid = session?.user.id;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    setError(null);
    const { data, error: err } = await supabase
      .from("body_photos")
      .select(
        "id,captured_at,front_url,back_url,left_url,right_url,weight_at_capture_lb,notes",
      )
      .eq("user_id", uid)
      .order("captured_at", { ascending: false })
      .limit(60);
    if (err) setError(err.message);
    else setSessions((data ?? []) as Session[]);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh when returning from the capture screen.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function confirmDelete(id: string) {
    Alert.alert(
      "Delete session?",
      "This removes the session and its photos. Cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => doDelete(id) },
      ],
    );
  }

  async function doDelete(id: string) {
    setDeleting(id);
    try {
      await apiFetch(`/api/body-shots/${id}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      Alert.alert("Could not delete", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setDeleting(null);
    }
  }

  if (loading) return <Loading />;

  return (
    <Content className="gap-4">
      <Button
        title="New session"
        onPress={() => router.push("/(tabs)/more/body-shots/capture")}
      />

      {error ? <ErrorState message={error} /> : null}

      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          hint="Take your first 4-angle set in even, consistent lighting. The scale only tells half the story."
        />
      ) : (
        sessions.map((s) => (
          <View key={s.id} className="gap-3 rounded-xl border border-border bg-card p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">
                  {new Date(s.captured_at).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
                {s.weight_at_capture_lb !== null || s.notes ? (
                  <Text className="text-xs text-muted-foreground">
                    {s.weight_at_capture_lb !== null
                      ? `${Number(s.weight_at_capture_lb).toFixed(1)} lb`
                      : ""}
                    {s.notes
                      ? `${s.weight_at_capture_lb !== null ? " · " : ""}${s.notes}`
                      : ""}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => confirmDelete(s.id)}
                disabled={deleting === s.id}
                hitSlop={8}
                accessibilityLabel="Delete session"
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={deleting === s.id ? colors.mutedForeground : colors.destructive}
                />
              </Pressable>
            </View>

            <View className="flex-row flex-wrap gap-2">
              {ANGLES.map(({ key, label }) => {
                const url = s[key] as string | null;
                return (
                  <View
                    key={key}
                    className="overflow-hidden rounded-lg border border-border bg-muted"
                    style={{ width: "48%" }}
                  >
                    <Pressable
                      onPress={() => url && setLightbox(url)}
                      disabled={!url}
                      className="aspect-[3/4] w-full items-center justify-center"
                    >
                      {url ? (
                        <Image
                          source={{ uri: url }}
                          className="h-full w-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <Text className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          no {label.toLowerCase()}
                        </Text>
                      )}
                    </Pressable>
                    <Text className="border-t border-border px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))
      )}

      <Modal
        visible={lightbox !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLightbox(null)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/90 p-4"
          onPress={() => setLightbox(null)}
        >
          {lightbox ? (
            <Image
              source={{ uri: lightbox }}
              style={{ width: "100%", height: "85%" }}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </Content>
  );
}
