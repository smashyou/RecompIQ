"use client";

// Root error boundary. Replaces the root layout when it errors, so it must
// render its own <html>/<body>. Kept dependency-free + inline-styled so it
// can't itself fail to render.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" data-theme="dark">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#121419",
          color: "#f4f5f7",
          fontFamily:
            '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
          textAlign: "center",
          padding: 24,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 22, letterSpacing: "-0.02em" }}>
          Recomp<span style={{ color: "#1FC2CE" }}>IQ</span>
        </span>
        <p style={{ color: "#b3b8c1", fontSize: 15, lineHeight: 1.5, maxWidth: 360 }}>
          Something went wrong. Try again — your data is safe.
        </p>
        <button
          onClick={() => reset()}
          style={{
            background: "#1FC2CE",
            color: "#0b1013",
            border: "none",
            borderRadius: 10,
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
