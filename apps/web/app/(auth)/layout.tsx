import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 py-4">
        <Link href="/" className="text-sm text-[var(--color-muted-foreground)] hover:opacity-80">
          ← Back to home
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6">{children}</div>
      </main>
      <footer className="px-6 py-4 text-center text-xs text-[var(--color-muted-foreground)]">
        Educational tracking only. Not medical advice.
      </footer>
    </div>
  );
}
