import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { StatBox } from "@/components/ui/StatBox";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { useResponsive } from "@/lib/responsive";
import { colors } from "@/lib/theme";

interface FoodLogRow {
  id: string;
  description: string;
  brand: string | null;
  amount: number;
  unit: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_type: string | null;
  logged_at: string;
}

interface Goal {
  protein_target_g_min: number | null;
  protein_target_g_max: number | null;
}

interface Totals {
  cal: number;
  p: number;
  c: number;
  f: number;
}

const MEAL_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
const MEAL_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  other: "Other",
};

function startOfTodayIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

export default function Food() {
  const router = useRouter();
  const { type } = useResponsive();
  const { session } = useSession();
  const uid = session?.user.id;
  const [logs, setLogs] = useState<FoodLogRow[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      setError(null);
      const today = startOfTodayIso();
      const [logsRes, goalRes] = await Promise.all([
        supabase
          .from("food_logs")
          .select(
            "id,description,brand,amount,unit,calories_kcal,protein_g,carbs_g,fat_g,meal_type,logged_at",
          )
          .gte("logged_at", today)
          .order("logged_at", { ascending: true }),
        supabase
          .from("goals")
          .select("protein_target_g_min,protein_target_g_max")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (logsRes.error) throw logsRes.error;
      setLogs((logsRes.data ?? []) as unknown as FoodLogRow[]);
      setGoal((goalRes.data ?? null) as Goal | null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load food log");
    }
  }, [uid]);

  // Reload on focus so meals logged via log/photo screens appear on return.
  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  if (loading) return <Loading />;

  const totals = logs.reduce<Totals>(
    (a, r) => ({
      cal: a.cal + Number(r.calories_kcal),
      p: a.p + Number(r.protein_g),
      c: a.c + Number(r.carbs_g),
      f: a.f + Number(r.fat_g),
    }),
    { cal: 0, p: 0, c: 0, f: 0 },
  );

  const grouped = new Map<string, FoodLogRow[]>();
  for (const log of logs) {
    const key = log.meal_type ?? "other";
    const arr = grouped.get(key) ?? [];
    arr.push(log);
    grouped.set(key, arr);
  }
  const groups = Array.from(grouped.entries()).sort(
    ([a], [b]) => (MEAL_ORDER[a] ?? 99) - (MEAL_ORDER[b] ?? 99),
  );

  const proteinMax = goal?.protein_target_g_max ?? null;
  const proteinPct =
    proteinMax && proteinMax > 0 ? Math.min(100, Math.round((totals.p / proteinMax) * 100)) : 0;
  const proteinTarget =
    goal?.protein_target_g_min != null && goal?.protein_target_g_max != null
      ? `${goal.protein_target_g_min}–${goal.protein_target_g_max} g`
      : null;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 pb-12 pt-3 gap-4"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={colors.mutedForeground}
        />
      }
    >
      {error ? <ErrorState message={error} /> : null}

      <View className="flex-row gap-3">
        <Button
          title="Add meal"
          onPress={() => router.push("/(tabs)/more/food/log")}
          className="flex-1"
        />
        <Button
          title="Snap photo"
          variant="outline"
          onPress={() => router.push("/(tabs)/more/food/photo")}
          className="flex-1"
        />
      </View>

      <Card>
        <View className="flex-row items-baseline justify-between">
          <Text className="text-sm text-muted-foreground">Protein today</Text>
          {proteinTarget ? (
            <Text className="text-sm text-muted-foreground">target {proteinTarget}</Text>
          ) : null}
        </View>
        <Text className="mt-1 font-bold text-foreground" style={{ fontSize: type.metric }}>
          {Math.round(totals.p)}
          <Text className="text-base text-muted-foreground"> g</Text>
        </Text>
        <View className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <View className="h-full rounded-full bg-primary" style={{ width: `${proteinPct}%` }} />
        </View>
      </Card>

      <View className="flex-row flex-wrap gap-3">
        <StatBox label="Calories" value={`${Math.round(totals.cal)}`} sub="kcal" />
        <StatBox label="Carbs" value={`${Math.round(totals.c)} g`} />
        <StatBox label="Fat" value={`${Math.round(totals.f)} g`} />
      </View>

      {logs.length === 0 ? (
        <EmptyState
          title="Nothing logged today"
          hint="Add your first meal to start filling the macros card."
        />
      ) : (
        groups.map(([mealType, items]) => (
          <View key={mealType} className="gap-2">
            <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {MEAL_LABEL[mealType] ?? mealType}
            </Text>
            <View className="overflow-hidden rounded-xl border border-border bg-card">
              {items.map((log, i) => (
                <View
                  key={log.id}
                  className={`flex-row items-center justify-between gap-3 p-4 ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                      {log.description}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {log.brand ? `${log.brand} · ` : ""}
                      {Number(log.amount)} {log.unit}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-xs text-foreground">
                      {Math.round(Number(log.calories_kcal))} kcal
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      P {Math.round(Number(log.protein_g))}g · C {Math.round(Number(log.carbs_g))}g
                      · F {Math.round(Number(log.fat_g))}g
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
