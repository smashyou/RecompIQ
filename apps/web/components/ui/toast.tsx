"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type ToastKind = "success" | "error";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{
  push: (kind: ToastKind, message: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border p-3 text-sm shadow-lg ${
              t.kind === "success"
                ? "border-[var(--color-accent)] bg-[var(--color-card)]"
                : "border-[var(--color-destructive)] bg-[var(--color-card)]"
            }`}
          >
            {t.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--color-accent)]" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 text-[var(--color-destructive)]" />
            )}
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// Tiny stand-alone hook for forms that just want fire-and-forget.
export function useFireToast() {
  const { push } = useToast();
  return {
    success: (msg: string) => push("success", msg),
    error: (msg: string) => push("error", msg),
  };
}

