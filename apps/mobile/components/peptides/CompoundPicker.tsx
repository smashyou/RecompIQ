import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { vars } from "nativewind";
import { Ionicons } from "@expo/vector-icons";
import { Input } from "@/components/ui/Input";
import { colors } from "@/lib/theme";
import { useTheme } from "@/lib/theme-context";

export interface PickerOption {
  id: string;
  name: string;
  is_blend?: boolean;
}

// Modal searchable picker — RN stand-in for the web <select> of 60+ compounds.
export function CompoundPicker({
  options,
  value,
  onChange,
  placeholder = "Choose a peptide / blend",
}: {
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { cssVars } = useTheme();
  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-lg border border-border bg-input px-3 py-3"
      >
        <Text className={selected ? "text-base text-foreground" : "text-base text-muted-foreground"}>
          {selected ? `${selected.is_blend ? "★ " : ""}${selected.name}` : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        {/* RN Modals render in a separate view host that does not inherit the
            root vars() scope, so re-apply the active scheme's CSS variables here
            (otherwise className colors fall back to the global.css dark default). */}
        <View className="flex-1 justify-end bg-black/50" style={vars(cssVars)}>
          <View className="max-h-[80%] rounded-t-2xl border-t border-border bg-card p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-foreground">Select peptide</Text>
              <Pressable onPress={() => setOpen(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>
            <Input value={query} onChangeText={setQuery} placeholder="Search…" autoCapitalize="none" autoFocus />
            <FlatList
              data={filtered}
              keyExtractor={(o) => o.id}
              keyboardShouldPersistTaps="handled"
              className="mt-2"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex-row items-center justify-between border-b border-border py-3"
                >
                  <Text className="text-base text-foreground">
                    {item.is_blend ? "★ " : ""}
                    {item.name}
                  </Text>
                  {item.id === value ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
