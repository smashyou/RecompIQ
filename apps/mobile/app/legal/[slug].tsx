import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { getLegalDoc } from "@peptide/shared/legal";
import { ErrorState } from "@/components/ui/States";

export default function LegalDoc() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const doc = getLegalDoc(slug ?? "");

  if (!doc) {
    return (
      <View className="flex-1 bg-background p-4">
        <ErrorState message="Document not found." />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: doc.title }} />
      <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4 pb-12">
        <View className="gap-4" style={{ width: "100%", maxWidth: 760, alignSelf: "center" }}>
        <Text className="text-xs text-muted-foreground">Last updated {doc.updated}</Text>
        <View className="rounded-lg border border-border bg-muted p-3">
          <Text className="text-sm leading-relaxed text-muted-foreground">{doc.summary}</Text>
        </View>
        {doc.sections.map((s, i) => (
          <View key={i} className="gap-1.5">
            {s.heading ? <Text className="text-base font-semibold text-foreground">{s.heading}</Text> : null}
            {s.body.map((line, j) => (
              <Text
                key={j}
                className={`text-sm leading-relaxed text-muted-foreground ${line.startsWith("• ") ? "pl-3" : ""}`}
              >
                {line}
              </Text>
            ))}
          </View>
        ))}
        <Text className="mt-2 text-xs text-muted-foreground">
          This screen is general information, not legal advice.
        </Text>
        </View>
      </ScrollView>
    </>
  );
}
