import { useState } from "react";
import { useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSession } from "@/lib/session";
import { useResponsive } from "@/lib/responsive";

const DEMO_EMAIL = "demo@recompiq.app";
const DEMO_PASSWORD = "DemoUser!2026";

export default function SignIn() {
  const { signIn } = useSession();
  const router = useRouter();
  const { type } = useResponsive();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(withEmail = email, withPassword = password) {
    setError(null);
    setSubmitting(true);
    const { error: err } = await signIn(withEmail, withPassword);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    router.replace("/(tabs)");
  }

  function useDemo() {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    void onSubmit(DEMO_EMAIL, DEMO_PASSWORD);
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-center px-6"
      >
        <View style={{ width: "100%", maxWidth: 440, alignSelf: "center" }}>
        <View className="mb-8">
          <Text className="font-bold text-foreground" style={{ fontSize: type["3xl"] }}>RecompIQ</Text>
          <Text className="mt-1 text-base text-muted-foreground">
            Sign in to your recomposition coach.
          </Text>
        </View>

        <View className="gap-3">
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-muted-foreground">Email</Text>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-muted-foreground">Password</Text>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

          <Button
            title="Sign in"
            onPress={() => onSubmit()}
            loading={submitting}
            disabled={!email || !password}
            className="mt-2"
          />
          <Button title="Use demo account" variant="outline" onPress={useDemo} disabled={submitting} />

          <View className="mt-2 flex-row items-center justify-between">
            <Pressable onPress={() => router.push("/(auth)/sign-up")}>
              <Text className="text-sm text-primary">Create account</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/(auth)/reset")}>
              <Text className="text-sm text-muted-foreground">Forgot password?</Text>
            </Pressable>
          </View>
        </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
