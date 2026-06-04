// Tests for the shared markdown parser (@peptide/shared/markdown), focused on
// GFM table support + the [edu] dose-span handling that drives the coach
// disclaimer footer. Run: pnpm test:markdown
import { parseMarkdown, parseInline, hasEduDose } from "../packages/shared/src/markdown.ts";

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

// --- Table: basic detection + shape -----------------------------------------
{
  const src = [
    "Intro line.",
    "",
    "| Concern | Why It Matters |",
    "|---|---|",
    "| Epitalon + cancer risk | Telomerase activation [1][3] |",
    "| TA-1 legal status | FDA proposed removal in **Dec 2024** [2] |",
    "",
    "**Bottom line:** done.",
  ].join("\n");
  const b = parseMarkdown(src);
  const table = b.find((x) => x.t === "table");
  check("table block is produced", !!table);
  check("intro renders as its own paragraph", b[0].t === "p");
  check("bottom line renders as its own paragraph", b[b.length - 1].t === "p");
  check("header has 2 columns", table?.header.length === 2);
  check("table has 2 body rows", table?.rows.length === 2);
  check("header cell 1 text", table?.header[0].map((s) => s.v).join("") === "Concern");
  check(
    "body cell inline bold is parsed (not raw **)",
    table?.rows[1][1].some((s) => s.t === "b" && s.v === "Dec 2024"),
  );
}

// --- Table: [edu] dose spans survive inside a cell ---------------------------
{
  const src = ["| Compound | Dose |", "| --- | --- |", "| BPC-157 | [edu]250 mcg[/edu] daily |"].join(
    "\n",
  );
  const b = parseMarkdown(src);
  const table = b.find((x) => x.t === "table");
  check("edu table: detected", !!table);
  const doseCell = table?.rows[0][1] ?? [];
  check(
    "edu span preserved in table cell",
    doseCell.some((s) => s.t === "edu" && s.v === "250 mcg"),
  );
  check("hasEduDose true for the raw table source", hasEduDose(src));
}

// --- Table: alignment colons + missing outer pipes ---------------------------
{
  const src = ["A | B | C", ":--- | :---: | ---:", "1 | 2 | 3"].join("\n");
  const b = parseMarkdown(src);
  const table = b.find((x) => x.t === "table");
  check("pipe-delimited (no outer pipes) table detected", !!table);
  check("3 columns parsed", table?.header.length === 3);
  check("aligned delimiter consumed (1 row, not 2)", table?.rows.length === 1);
}

// --- Negative: a lone piped line is NOT a table (no delimiter row) -----------
{
  const b = parseMarkdown("This | is not | a table");
  check("piped prose without a delimiter stays a paragraph", b.length === 1 && b[0].t === "p");
  check("no spurious table block", !b.some((x) => x.t === "table"));
}

// --- Negative: regular blocks still parse (no regression) --------------------
{
  const b = parseMarkdown("# Heading\n\n- one\n- two\n\nplain para");
  check("heading still parses", b[0].t === "h" && b[0].level === 1);
  check("unordered list still parses", b[1].t === "ul" && b[1].items.length === 2);
  check("paragraph still parses", b[2].t === "p");
}

// --- Inline sanity -----------------------------------------------------------
{
  const spans = parseInline("**bold** and `code` and [link](https://x.io)");
  check("inline bold", spans.some((s) => s.t === "b" && s.v === "bold"));
  check("inline code", spans.some((s) => s.t === "code" && s.v === "code"));
  check("inline link", spans.some((s) => s.t === "link" && s.href === "https://x.io"));
}

console.log(`\nmarkdown: ${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);
