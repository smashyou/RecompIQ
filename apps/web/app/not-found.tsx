import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export default function NotFound() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center"
      style={{ background: "var(--bg-deep)" }}
    >
      <Wordmark size={24} />
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--fg-subtle)",
        }}
      >
        404 · Not found
      </p>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "var(--fg)",
        }}
      >
        That page doesn&apos;t exist
      </h1>
      <Link
        href="/dashboard"
        className="rounded-lg px-4 py-2 text-sm font-semibold"
        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        Back to dashboard
      </Link>
    </div>
  );
}
