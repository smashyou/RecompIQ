"use client";

import { useEffect, useState } from "react";
import { Sun, Monitor, Moon, type LucideIcon } from "lucide-react";

// Theme controller — flips <html data-theme> and persists to localStorage.
// Colors re-resolve via the tokens' light-dark(); React state here only drives
// the control's active pip. Ported from the design handoff's Theme.jsx.
export const RITheme = {
  KEY: "recompiq-theme",
  get(): string {
    if (typeof document === "undefined") return "dark";
    return document.documentElement.dataset.theme || "dark";
  },
  set(t: string) {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(RITheme.KEY, t);
    } catch {
      // localStorage unavailable — fine, just don't persist.
    }
    window.dispatchEvent(new CustomEvent("ri-theme", { detail: t }));
  },
};

const THEME_OPTS: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "system", label: "System", Icon: Monitor },
  { id: "dark", label: "Dark", Icon: Moon },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [active, setActive] = useState("dark");

  useEffect(() => {
    setActive(RITheme.get());
    const handler = (e: Event) => setActive((e as CustomEvent<string>).detail);
    window.addEventListener("ri-theme", handler);
    return () => window.removeEventListener("ri-theme", handler);
  }, []);

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 rounded-full border p-[3px]"
      style={{
        background: "var(--surface-2)",
        borderColor: "var(--border)",
      }}
    >
      {THEME_OPTS.map(({ id, label, Icon }) => {
        const on = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => RITheme.set(id)}
            title={label}
            aria-pressed={on}
            className="inline-flex h-7 items-center gap-1.5 rounded-full text-xs font-semibold transition-colors"
            style={{
              padding: compact ? "0 8px" : "0 11px",
              background: on ? "var(--primary)" : "transparent",
              color: on ? "var(--primary-foreground)" : "var(--fg-subtle)",
            }}
          >
            <Icon size={14} strokeWidth={on ? 2.1 : 1.75} />
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
