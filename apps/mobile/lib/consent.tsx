// Consent + 18+ gate state. The user must clear the gate (3 acknowledgements +
// 18+ confirmation) before entering the app. Acceptance is persisted to
// AsyncStorage so the gate only shows once per device/install.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "recompiq:consent:v1";

interface ConsentState {
  /** null = still loading from storage. */
  accepted: boolean | null;
  accept: () => void;
}

const ConsentContext = createContext<ConsentState | undefined>(undefined);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (active) setAccepted(stored === "true");
    });
    return () => {
      active = false;
    };
  }, []);

  const accept = useCallback(() => {
    setAccepted(true);
    void AsyncStorage.setItem(STORAGE_KEY, "true");
  }, []);

  const value = useMemo<ConsentState>(() => ({ accepted, accept }), [accepted, accept]);
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentState {
  const value = useContext(ConsentContext);
  if (!value) {
    throw new Error("useConsent must be used within a ConsentProvider");
  }
  return value;
}
