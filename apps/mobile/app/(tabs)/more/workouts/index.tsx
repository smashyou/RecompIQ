import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { FlatList, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Loading, ErrorState, EmptyState } from "@/components/ui/States";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useResponsive } from "@/lib/responsive";

interface WorkoutRow {
  id: string;
  session_type: string;
  phase: string | null;
  date: string;
  duration_min: number | null;
  template_slug: string | null;
  name: string | null;
  perceived_exertion: number | null;
  workout_exercises: { name: string }[];
}

export default function Workouts() {
  const router = useRouter();
  const { type } = useResponsive();
  const { session } = useSession();
  const uid = session?.user.id;
  const [rows, setRows] = useState<WorkoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    const { data, error: err } = await supabase
      .from("workouts")
      .select(
        "id,session_type,phase,date,duration_min,template_slug,name,perceived_exertion, workout_exercises(name)",
      )
      .eq("user_id", uid)
      .order("date", { ascending: false })
      .limit(30);
    if (err) setError(err.message);
    else setRows((data ?? []) as unknown as WorkoutRow[]);
    setLoading(false);
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) return <Loading />;

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row gap-2 px-4 pt-3">
        <Button
          title="Templates"
          variant="outline"
          className="flex-1"
          onPress={() => router.push("/(tabs)/more/workouts/templates")}
        />
        <Button
          title="New session"
          variant="primary"
          className="flex-1"
          onPress={() => router.push("/(tabs)/more/workouts/new")}
        />
      </View>
      {error ? (
        <View className="p-4">
          <ErrorState message={error} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-4 pb-12 pt-3 gap-3"
          ListEmptyComponent={
            <View className="mt-8">
              <EmptyState
                title="No sessions yet"
                hint="Start from a template or log freeform."
              />
            </View>
          }
          renderItem={({ item: w }) => (
            <View className="rounded-xl border border-border bg-card p-4">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text
                  className="font-semibold text-foreground"
                  style={{ fontSize: type.lg, flexShrink: 1 }}
                  numberOfLines={1}
                >
                  {w.name ?? w.template_slug ?? `${w.session_type} session`}
                </Text>
                <Pill label={w.session_type} />
                {w.phase ? <Pill label={w.phase} /> : null}
              </View>
              <Text className="mt-1 text-sm text-muted-foreground">
                {new Date(w.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {w.duration_min ? ` · ${w.duration_min} min` : ""}
                {w.perceived_exertion ? ` · RPE ${w.perceived_exertion}` : ""}
                {w.workout_exercises.length > 0
                  ? ` · ${w.workout_exercises.length} exercises`
                  : ""}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
