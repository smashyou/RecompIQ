import { useRouter } from "expo-router";
import { Text } from "react-native";
import { LEGAL_DOCS } from "@peptide/shared/legal";
import { Content } from "@/components/ui/Content";
import { ListRow } from "@/components/ui/ListRow";

export default function LegalList() {
  const router = useRouter();
  return (
    <Content className="gap-3">
      <Text className="text-sm leading-relaxed text-muted-foreground">
        RecompIQ is an educational and research-tracking tool — not medical advice, and not a source
        for any compound.
      </Text>
      {LEGAL_DOCS.map((d) => (
        <ListRow
          key={d.slug}
          title={d.title}
          subtitle={d.summary}
          icon="document-text-outline"
          onPress={() => router.push({ pathname: "/legal/[slug]", params: { slug: d.slug } })}
        />
      ))}
    </Content>
  );
}
