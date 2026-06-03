// Tiny, dependency-free markdown parser for AI-coach / dose text.
//
// The coach returns light markdown (bold, italics, inline code, links, bullet
// and numbered lists, headings, paragraphs). `wrapDoseLike()` additionally wraps
// dose-like substrings in [edu]…[/edu] markers. This parser turns that into a
// flat block/inline AST that web (HTML) and mobile (RN) thin renderers share,
// so doses keep their inline "educational-only" highlight + the disclaimer
// footer. We intentionally parse our OWN limited subset (no raw HTML) to avoid
// the XSS surface of a general markdown→HTML pipeline on a health product.

export type MdInline =
  | { t: "text"; v: string }
  | { t: "b"; v: string }
  | { t: "i"; v: string }
  | { t: "code"; v: string }
  | { t: "edu"; v: string }
  | { t: "link"; v: string; href: string };

export type MdBlock =
  | { t: "p"; spans: MdInline[] }
  | { t: "h"; level: 1 | 2 | 3; spans: MdInline[] }
  | { t: "ul"; items: MdInline[][] }
  | { t: "ol"; items: MdInline[][] }
  | { t: "code"; v: string }
  | { t: "hr" };

// edu | inline-code | **bold** | *italic* | [text](href)
// (underscore emphasis is intentionally omitted — LLM output uses */** and
// underscores cause false italics in snake_case / URLs.)
const INLINE_RE =
  /\[edu\]([\s\S]*?)\[\/edu\]|`([^`]+)`|\*\*([\s\S]+?)\*\*|\*([^*\n]+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(text: string): MdInline[] {
  const out: MdInline[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ t: "text", v: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: "edu", v: m[1] });
    else if (m[2] !== undefined) out.push({ t: "code", v: m[2] });
    else if (m[3] !== undefined) out.push({ t: "b", v: m[3] });
    else if (m[4] !== undefined) out.push({ t: "i", v: m[4] });
    else if (m[5] !== undefined) out.push({ t: "link", v: m[5], href: m[6]! });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out.length ? out : [{ t: "text", v: text }];
}

export function parseMarkdown(src: string): MdBlock[] {
  const lines = (src ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) {
      blocks.push({ t: "p", spans: parseInline(para.join(" ").trim()) });
      para = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!.trim();

    // Fenced code block
    if (/^```/.test(line)) {
      flushPara();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i]!.trim())) {
        code.push(lines[i]!);
        i++;
      }
      i++; // consume closing fence
      blocks.push({ t: "code", v: code.join("\n") });
      continue;
    }

    if (line === "") {
      flushPara();
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushPara();
      blocks.push({ t: "hr" });
      i++;
      continue;
    }

    // Heading (#, ##, ###)
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      blocks.push({ t: "h", level: h[1]!.length as 1 | 2 | 3, spans: parseInline(h[2]!.trim()) });
      i++;
      continue;
    }

    // Unordered list (-, *, +)
    if (/^[-*+]\s+/.test(line)) {
      flushPara();
      const items: MdInline[][] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i]!.trim())) {
        items.push(parseInline(lines[i]!.trim().replace(/^[-*+]\s+/, "")));
        i++;
      }
      blocks.push({ t: "ul", items });
      continue;
    }

    // Ordered list (1. 2. …)
    if (/^\d+\.\s+/.test(line)) {
      flushPara();
      const items: MdInline[][] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!.trim())) {
        items.push(parseInline(lines[i]!.trim().replace(/^\d+\.\s+/, "")));
        i++;
      }
      blocks.push({ t: "ol", items });
      continue;
    }

    para.push(line);
    i++;
  }
  flushPara();
  return blocks;
}

/** True when the text carries an [edu]…[/edu] dose span (drives the disclaimer footer). */
export function hasEduDose(src: string): boolean {
  return /\[edu\][\s\S]*?\[\/edu\]/.test(src ?? "");
}
