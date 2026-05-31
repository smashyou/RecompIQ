import { useState } from "react";
import { Tabs } from "expo-router";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { QuickLogSheet } from "@/components/QuickLogSheet";
import { useTheme } from "@/lib/theme-context";

// Bottom tab bar matching the handoff MTabBar: Home · Coach · center FAB(+) ·
// Peptides · More(Profile). The center FAB is an elevated circular button that
// opens the camera-first quick-log bottom sheet (handoff MQuickLog).
function CenterFab({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quick log"
        onPress={onPress}
        style={{
          width: 50,
          height: 50,
          marginTop: -18,
          borderRadius: 25,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primary,
          borderWidth: 3,
          borderColor: colors.background,
          shadowColor: colors.primary,
          shadowOpacity: 0.5,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={26} color={colors.primaryForeground} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const [logOpen, setLogOpen] = useState(false);
  return (
    <>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.fgSubtle,
        tabBarStyle: {
          backgroundColor: colors.surface1,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: "Coach",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: "",
          tabBarButton: () => <CenterFab onPress={() => setLogOpen(true)} />,
        }}
      />
      <Tabs.Screen
        name="peptides"
        options={{
          title: "Peptides",
          tabBarIcon: ({ color, size }) => <Ionicons name="flask-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
    <QuickLogSheet visible={logOpen} onClose={() => setLogOpen(false)} />
    </>
  );
}
