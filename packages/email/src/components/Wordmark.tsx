import { Img, Section } from "@react-email/components";
import { palette, fonts } from "../palette";
import { LOGO_MARK_2X_URL, APP_URL } from "../config";

/**
 * Brand lockup: hosted PNG mark + the "Recomp" + cyan "IQ" wordmark as live
 * HTML text (SVG is stripped by Gmail/Outlook, so the mark is a PNG; the
 * wordmark stays text so it degrades gracefully when Space Grotesk is absent).
 * The 2x PNG is scaled down via width/height for crisp rendering on retina.
 */
export function Wordmark({ size = 22 }: { size?: number }) {
  const mark = Math.round(size * 1.05);
  return (
    <Section style={{ margin: 0 }}>
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        style={{ borderCollapse: "collapse" }}
      >
        <tbody>
          <tr>
            <td style={{ verticalAlign: "middle", paddingRight: Math.round(size * 0.34) }}>
              <a href={APP_URL} style={{ textDecoration: "none" }}>
                <Img
                  src={LOGO_MARK_2X_URL}
                  width={mark}
                  height={mark}
                  alt="RecompIQ"
                  style={{
                    display: "block",
                    border: 0,
                    outline: "none",
                    textDecoration: "none",
                  }}
                />
              </a>
            </td>
            <td style={{ verticalAlign: "middle" }}>
              <a
                href={APP_URL}
                style={{
                  fontFamily: fonts.display,
                  fontWeight: 600,
                  fontSize: size,
                  letterSpacing: "-0.025em",
                  lineHeight: 1,
                  color: palette.fg,
                  textDecoration: "none",
                }}
              >
                Recomp<span style={{ color: palette.primary }}>IQ</span>
              </a>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}
