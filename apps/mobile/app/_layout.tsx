import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/lib/session";
import { ThemeProvider, useTheme } from "@/lib/theme-context";
import { ConsentProvider, useConsent } from "@/lib/consent";
import { ConsentGate } from "@/components/ConsentGate";

function ThemedApp() {
  const { colors, scheme } = useTheme();
  const { accepted, accept } = useConsent();

  // Gate the whole app behind the consent + 18+ acknowledgement.
  if (accepted === null) {
    return <View style={{ flex: 1, backgroundColor: colors.bgDeep }} />;
  }
  if (!accepted) {
    return (
      <>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <ConsentGate onEnter={accept} />
      </>
    );
  }

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="legal" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ConsentProvider>
            <SessionProvider>
              <ThemedApp />
            </SessionProvider>
          </ConsentProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
