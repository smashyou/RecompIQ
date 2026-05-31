/* eslint-disable @next/next/no-img-element */

// Brand lockup: the mark SVG + "Recomp" + cyan "IQ" wordmark in Space Grotesk.
// Per design handoff §5a. Plain <img> (not next/image) — the mark is a tiny
// static SVG and we want exact sizing control next to the text.
export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center" style={{ gap: size * 0.34 }}>
      <img
        src="/logo-mark.svg"
        width={size * 1.05}
        height={size * 1.05}
        alt=""
        style={{ display: "block" }}
      />
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: size,
          letterSpacing: "-0.025em",
          lineHeight: 1,
          color: "var(--fg)",
        }}
      >
        Recomp<span style={{ color: "var(--primary)" }}>IQ</span>
      </span>
    </span>
  );
}
