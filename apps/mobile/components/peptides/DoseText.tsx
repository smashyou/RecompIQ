import { Text } from "react-native";

// Renders coach/dose text, styling [edu]…[/edu] educational-dose spans (mirrors
// the web DoseAnnotatedText). Dose values are always educational summaries, so
// assistant messages also append a footer disclaimer (see coach screen).
export function DoseText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\[edu\][\s\S]*?\[\/edu\])/g);
  return (
    <Text className={className ?? "text-sm leading-relaxed text-foreground"}>
      {parts.map((p, i) => {
        const m = p.match(/^\[edu\]([\s\S]*)\[\/edu\]$/);
        if (m) {
          return (
            <Text key={i} className="font-semibold text-accent">
              {m[1]}
            </Text>
          );
        }
        return <Text key={i}>{p}</Text>;
      })}
    </Text>
  );
}
