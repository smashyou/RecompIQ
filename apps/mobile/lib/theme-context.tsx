// Theme context: persists the user's preference ('light' | 'dark' | 'system')
// to AsyncStorage and exposes the resolved scheme. Default is dark (the brand's
// primary mode). Mutates the live `colors` object (lib/theme.ts) so static
// imports — SVG fills, StatusBar, navigation theming — track the active scheme.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { applyScheme, themes, type ColorScheme, type ThemeTokens } from "./theme";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "recompiq:theme";

interface ThemeState {
  /** The user's stored preference. */
  preference: ThemePreference;
  /** The concrete scheme in effect right now. */
  scheme: ColorScheme;
  /** The resolved token set for the active scheme. */
  colors: ThemeTokens;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeState | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme(); // 'light' | 'dark' | null
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");

  // Load persisted preference once.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!active) return;
      if (stored === "light" || stored === "dark" || stored === "system") {
        setPreferenceState(stored);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const scheme: ColorScheme =
    preference === "system" ? (system === "light" ? "light" : "dark") : preference;

  // Keep the live `colors` object in sync for static importers.
  applyScheme(scheme);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<ThemeState>(
    () => ({ preference, scheme, colors: themes[scheme], setPreference }),
    [preference, scheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return value;
}
