import "../global.css";
import { useEffect, useState, type ReactNode } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { vars } from "nativewind";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "@/lib/session";
import { ThemeProvider, useTheme } from "@/lib/theme-context";
import { ConsentProvider, useConsent } from "@/lib/consent";
import { ConsentGate } from "@/components/ConsentGate";
import { BrandSplash } from "@/components/BrandSplash";
import { registerPushToken } from "@/lib/push";

function ThemedApp() {
  const { colors, scheme, cssVars } = useTheme();
  const { accepted, accept } = useConsent();
  const { session } = useSession();

  // Register this device's Expo push token once a session is available, so the
  // server can deliver immediate critical safety alerts. Fire-and-forget; the
  // helper no-ops on simulators / when permission is denied.
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    void registerPushToken(userId);
  }, [userId]);

  // Hold the branded splash long enough for its draw-on animation to play out
  // (~2.2s) on cold launch. The native app.json splash doesn't render in Expo
  // Go, so this animated BrandSplash is the visible launch screen there.
  const [minElapsed, setMinElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), 2500);
    return () => clearTimeout(t);
  }, []);

  // Apply the active scheme's CSS variables at the root so that EVERY
  // NativeWind className color (bg-card, text-foreground, border-border, …)
  // below resolves to the active scheme. Inline `colors` styling reads the
  // same token set, so className- and inline-styled UI stay in sync.
  let body: ReactNode;
  if (accepted === null || !minElapsed) {
    // Branded launch screen until consent resolves AND the min beat elapses.
    body = <BrandSplash />;
  } else if (!accepted) {
    body = (
      <>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <ConsentGate onEnter={accept} />
      </>
    );
  } else {
    body = (
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

  return <View style={[{ flex: 1 }, vars(cssVars)]}>{body}</View>;
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
