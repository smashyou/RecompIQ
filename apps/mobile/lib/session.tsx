// Auth session context. Wraps the whole app (root _layout) so any screen can
// read the current session and the tab gate can redirect unauthenticated users.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface SessionState {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <SessionContext.Provider value={{ session, loading, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return value;
}
