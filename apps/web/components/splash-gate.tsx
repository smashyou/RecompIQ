"use client";

import { useEffect, useState } from "react";
import { BrandSplash } from "@/components/brand-splash";

// Shows the branded launch screen once per browser session when the app first
// loads, then fades out. Gated via sessionStorage so internal navigation and
// in-session refreshes don't re-trigger it. Mounted in the authenticated app
// shell so it covers the dashboard/app, not the public marketing pages.
const SESSION_KEY = "ri-splash-seen";
const DURATION_MS = 2200;

export function SplashGate() {
  const [phase, setPhase] = useState<"hidden" | "shown" | "leaving">("hidden");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    setPhase("shown");
    const leave = setTimeout(() => setPhase("leaving"), DURATION_MS);
    const done = setTimeout(() => setPhase("hidden"), DURATION_MS + 450);
    return () => {
      clearTimeout(leave);
      clearTimeout(done);
    };
  }, []);

  if (phase === "hidden") return null;
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        opacity: phase === "leaving" ? 0 : 1,
        transition: "opacity 0.45s ease",
        pointerEvents: phase === "leaving" ? "none" : "auto",
      }}
    >
      <BrandSplash />
    </div>
  );
}
