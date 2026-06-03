import { Linking, Text, View } from "react-native";
import { parseMarkdown, type MdBlock, type MdInline } from "@peptide/shared";

// Renders coach/dose text as light markdown (bold, italics, code, links, lists,
// headings) while styling [edu]…[/edu] educational-dose spans. Mirrors the web
// DoseAnnotatedText; assistant messages also append a footer disclaimer (the
// coach screen renders that separately when a dose is present).
export function DoseText({ text, className }: { text: string; className?: string }) {
  const blocks = parseMarkdown(text);
  const base = className ?? "text-sm leading-relaxed text-foreground";
  return (
    <View className="gap-1.5">
      {blocks.map((b, i) => (
        <Block key={i} block={b} base={base} />
      ))}
    </View>
  );
}

function Block({ block, base }: { block: MdBlock; base: string }) {
  switch (block.t) {
    case "h":
      return (
        <Text className="font-semibold text-foreground" style={{ fontSize: block.level === 1 ? 16 : 15 }}>
          <Inline spans={block.spans} />
        </Text>
      );
    case "ul":
      return (
        <View className="gap-1">
          {block.items.map((it, i) => (
            <View key={i} className="flex-row gap-2">
              <Text className={base}>•</Text>
              <Text className={`flex-1 ${base}`}>
                <Inline spans={it} />
              </Text>
            </View>
          ))}
        </View>
      );
    case "ol":
      return (
        <View className="gap-1">
          {block.items.map((it, i) => (
            <View key={i} className="flex-row gap-2">
              <Text className={base}>{i + 1}.</Text>
              <Text className={`flex-1 ${base}`}>
                <Inline spans={it} />
              </Text>
            </View>
          ))}
        </View>
      );
    case "code":
      return (
        <View className="rounded-md border border-border bg-muted px-2.5 py-2">
          <Text className="text-xs text-foreground">{block.v}</Text>
        </View>
      );
    case "hr":
      return <View className="my-1 h-px bg-border" />;
    default:
      return (
        <Text className={base}>
          <Inline spans={block.spans} />
        </Text>
      );
  }
}

function Inline({ spans }: { spans: MdInline[] }) {
  return (
    <>
      {spans.map((s, i) => {
        switch (s.t) {
          case "edu":
            return (
              <Text key={i} className="font-semibold text-accent">
                {s.v}
              </Text>
            );
          case "b":
            return (
              <Text key={i} className="font-semibold text-foreground">
                {s.v}
              </Text>
            );
          case "i":
            return (
              <Text key={i} style={{ fontStyle: "italic" }}>
                {s.v}
              </Text>
            );
          case "code":
            return (
              <Text key={i} className="text-accent">
                {s.v}
              </Text>
            );
          case "link":
            return (
              <Text
                key={i}
                className="text-primary underline"
                onPress={() => Linking.openURL(s.href).catch(() => {})}
              >
                {s.v}
              </Text>
            );
          default:
            return <Text key={i}>{s.v}</Text>;
        }
      })}
    </>
  );
}
