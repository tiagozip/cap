const INK = {
  comment: "text-muted-foreground",
  keyword: "text-info",
  string: "text-success",
  number: "text-warning",
};

const KEYWORDS = new Set([
  "const",
  "let",
  "var",
  "import",
  "export",
  "from",
  "await",
  "new",
  "return",
  "async",
  "function",
  "if",
  "else",
  "for",
  "while",
  "try",
  "catch",
  "throw",
  "true",
  "false",
  "null",
  "undefined",
  "void",
  "typeof",
  "in",
  "of",
]);
const BUILTINS = new Set([
  "fetch",
  "JSON",
  "console",
  "document",
  "window",
  "Math",
  "Promise",
]);

const TOKENS = new RegExp(
  [
    "(&lt;!--[\\s\\S]*?--&gt;)",
    "(\\/\\/[^\\n]*)",
    "(#[\\da-fA-F]{3,8}\\b)",
    "(#[^\\n]*)",
    "(\"[^\"\\n]*\"|'[^'\\n]*'|`[^`]*`)",
    "(&lt;\\/?[a-zA-Z][\\w-]*)",
    "([a-zA-Z][\\w-]*)(?==)",
    "\\b([A-Za-z_$][\\w$]*)\\b",
    "\\b(\\d+(?:\\.\\d+)?)\\b",
  ].join("|"),
  "g",
);

export const highlight = (text) =>
  String(text)
    .replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m])
    .replace(TOKENS, (m, html, slash, hex, hash, str, tag, attr, word, num) => {
      const comment = html || slash || hash;
      if (comment) return `<span class="${INK.comment}">${comment}</span>`;
      if (hex) return `<span class="${INK.number}">${hex}</span>`;
      if (str) return `<span class="${INK.string}">${str}</span>`;
      if (tag) return `<span class="${INK.keyword}">${tag}</span>`;
      if (attr) return `<span class="text-warning">${attr}</span>`;
      if (word && KEYWORDS.has(word))
        return `<span class="${INK.keyword}">${word}</span>`;
      if (word && BUILTINS.has(word))
        return `<span class="text-warning">${word}</span>`;
      if (num) return `<span class="${INK.number}">${num}</span>`;
      return m;
    });
