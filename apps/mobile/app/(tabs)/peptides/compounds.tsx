import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import type { EvidenceLevel } from "@peptide/shared";
import { EvidenceBadge } from "@/components/ui/EvidenceBadge";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Loading, ErrorState } from "@/components/ui/States";
import { supabase } from "@/lib/supabase";

interface Row {
  slug: string;
  name: string;
  category: string;
  evidence_level: EvidenceLevel;
  fda_approved: boolean;
  short_description: string;
  typical_route: string | null;
  aliases: string[];
}

export default function Compounds() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    supabase
      .from("compounds")
      .select("slug, name, category, evidence_level, fda_approved, short_description, typical_route, aliases")
      .order("name")
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.aliases ?? []).some((a) => a.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  if (loading) return <Loading />;

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-3">
        <Input value={query} onChangeText={setQuery} placeholder="Search compounds + aliases…" autoCapitalize="none" />
      </View>
      {error ? (
        <View className="p-4"><ErrorState message={error} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.slug}
          contentContainerClassName="px-4 pb-12 pt-3 gap-3"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: "/(tabs)/peptides/library/[slug]", params: { slug: item.slug } })}
              className="rounded-xl border border-border bg-card p-4 active:opacity-70"
            >
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 text-base font-semibold text-foreground">{item.name}</Text>
                <View className="flex-row items-center gap-1">
                  {item.fda_approved ? <Pill label="FDA" tone="accent" /> : null}
                  <EvidenceBadge level={item.evidence_level} />
                </View>
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
