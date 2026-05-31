import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Content } from "@/components/ui/Content";
import { Pill } from "@/components/ui/Pill";
import { Segmented } from "@/components/ui/Segmented";
import { Loading, ErrorState, EmptyState } from "@/components/ui/States";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

interface Exercise {
  name: string;
  sets?: number;
  reps?: number;
  duration_min?: number;
  notes?: string;
}
interface TemplateRow {
  slug: string;
  name: string;
  phase: string;
  session_type: string;
  description: string;
  exercises: Exercise[];
}

const PHASES: string[] = ["P1", "P2", "P3"];

export default function WorkoutTemplates() {
  const router = useRouter();
  const { session } = useSession();
  const uid = session?.user.id;
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [userPhase, setUserPhase] = useState("P1");
  const [filter, setFilter] = useState("P1");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let mounted = true;
    Promise.all([
      supabase
        .from("workout_templates")
        .select("slug,name,phase,session_type,description,exercises")
        .order("phase")
        .order("name"),
      supabase
        .from("goals")
        .select("phase")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([tplRes, goalRes]) => {
      if (!mounted) return;
      if (tplRes.error) setError(tplRes.error.message);
      else setTemplates((tplRes.data ?? []) as unknown as TemplateRow[]);
      const phase = (goalRes.data?.phase as string | null) ?? "P1";
      setUserPhase(phase);
      setFilter(phase);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [uid]);

  const filtered = useMemo(
    () => templates.filter((t) => filter === "all" || t.phase === filter),
    [templates, filter],
  );

  const options = useMemo(
    () => [
      { value: "all", label: "All" },
      ...PHASES.map((p) => ({
        value: p,
        label: p === userPhase ? `${p} ·★` : p,
      })),
    ],
    [userPhase],
  );

  if (loading) return <Loading />;
  if (error)
    return (
      <View className="flex-1 bg-background p-4">
        <ErrorState message={error} />
      </View>
    );

  return (
    <Content className="gap-4">
      <Segmented options={options} value={filter} onChange={setFilter} />

      {filtered.length === 0 ? (
        <EmptyState title="No templates" hint="None for this phase yet." />
      ) : (
        filtered.map((t) => (
          <Card key={t.slug} className="gap-3">
            <View>
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-base font-semibold text-foreground">{t.name}</Text>
                <Pill label={t.phase} />
                <Pill label={t.session_type} />
              </View>
              <Text className="mt-1 text-sm text-muted-foreground">{t.description}</Text>
            </View>
            <View className="gap-1">
              {t.exercises.slice(0, 6).map((ex, i) => (
                <Text key={i} className="text-xs text-muted-foreground">
                  <Text className="font-medium text-foreground">{ex.name}</Text>
                  {ex.sets && ex.reps ? ` · ${ex.sets}×${ex.reps}` : ""}
                  {ex.duration_min ? ` · ${ex.duration_min} min` : ""}
                  {ex.notes ? ` · ${ex.notes}` : ""}
                </Text>
              ))}
              {t.exercises.length > 6 ? (
                <Text className="text-[10px] text-muted-foreground">
                  + {t.exercises.length - 6} more…
                </Text>
              ) : null}
            </View>
            <Button
              title="Start from this template"
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/more/workouts/new",
                  params: { template: t.slug },
                })
              }
            />
          </Card>
        ))
      )}
    </Content>
  );
}
