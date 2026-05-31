import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import type { EvidenceLevel } from "@peptide/shared";
import { EvidenceBadge } from "@/components/ui/EvidenceBadge";
import { Input } from "@/components/ui/Input";
import { TileSelect, type TileOption } from "@/components/ui/TileSelect";
import { Loading, ErrorState } from "@/components/ui/States";
import { supabase } from "@/lib/supabase";

interface CompoundRow {
  slug: string;
  name: string;
  category: string;
  evidence_level: EvidenceLevel;
  fda_approved: boolean;
  short_description: string;
  typical_route: string | null;
  is_blend: boolean;
}

const CATEGORIES: ReadonlyArray<TileOption<string>> = [
  { value: "all", label: "All", icon: "apps-outline" },
  { value: "incretin", label: "Incretin", icon: "flame-outline" },
  { value: "growth_factor", label: "Growth", icon: "barbell-outline" },
  { value: "tissue_repair", label: "Repair", icon: "bandage-outline" },
  { value: "metabolic", label: "Metabolic", icon: "flash-outline" },
  { value: "longevity", label: "Longevity", icon: "hourglass-outline" },
  { value: "blend", label: "Blend", icon: "layers-outline" },
  { value: "other", label: "Other", icon: "ellipsis-horizontal-outline" },
];

export default function Library() {
  const router = useRouter();
  const [rows, setRows] = useState<CompoundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  useEffect(() => {
    supabase
      .from("compounds")
      .select("slug, name, category, evidence_level, fda_approved, short_description, typical_route, is_blend")
      .order("name")
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setRows((data ?? []) as CompoundRow[]);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (category === "blend") {
        if (!r.is_blend) return false;
      } else if (category !== "all" && r.category !== category) {
        return false;
      }
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.short_description.toLowerCase().includes(q);
    });
  }, [rows, query, category]);

  if (loading) return <Loading />;

  return (
    <View className="flex-1 bg-background">
      <View className="gap-3 px-4 pt-3">
        <Input value={query} onChangeText={setQuery} placeholder="Search compounds…" autoCapitalize="none" />
        <TileSelect options={CATEGORIES} value={category} onChange={setCategory} columns={4} />
      </View>
      {error ? (
        <View className="p-4">
          <ErrorState message={error} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.slug}
          contentContainerClassName="px-4 pb-12 pt-3 gap-3"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text className="mt-8 text-center text-sm text-muted-foreground">No compounds match.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({ pathname: "/(tabs)/peptides/library/[slug]", params: { slug: item.slug } })
              }
              className="rounded-xl border border-border bg-card p-4 active:opacity-70"
            >
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 text-base font-semibold text-foreground">{item.name}</Text>
                <EvidenceBadge level={item.evidence_level} />
              </View>
              <Text className="mt-1 text-sm leading-snug text-muted-foreground" numberOfLines={2}>
                {item.short_description}
              </Text>
              <Text className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
                {item.category.replace("_", " ")}
                {item.typical_route ? ` · ${item.typical_route}` : ""}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
