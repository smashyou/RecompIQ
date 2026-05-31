import { colors } from "./theme";

// Shared native-header styling for every section Stack.
export const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.foreground,
  headerTitleStyle: { color: colors.foreground },
  contentStyle: { backgroundColor: colors.background },
} as const;
