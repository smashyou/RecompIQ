import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Content } from "./Content";
import { colors } from "@/lib/theme";

// Temporary navigable placeholder while the parity build fills sections in.
export function Stub({ name }: { name: string }) {
  return (
    <Content>
      <View className="mt-8 items-center gap-3">
        <Ionicons name="construct-outline" size={32} color={colors.mutedForeground} />
        <Text className="text-base font-medium text-foreground">{name}</Text>
        <Text className="text-center text-sm text-muted-foreground">
          This screen is part of the in-progress web-parity build.
        </Text>
      </View>
    </Content>
  );
}
