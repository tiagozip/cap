const INK = {
  comment: "text-muted-foreground",
  keyword: "text-info",
  string: "text-success",
  number: "text-warning",
  attr: "text-warning",
  builtin: "text-warning",
  punct: "text-muted-foreground",
};

const KEYWORDS = new Set([
  "const",
  "let",
  "var",
  "import",
  "export",
  "default",
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
  "def",
  "func",
  "defer",
  "struct",
  "not",
  "None",
  "True",
  "False",
  "nil",
  "exit",
  "empty",
  "require",
  "unless",
  "using",
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
    "(?<comment>&lt;!--[\\s\\S]*?--&gt;|(?<![:\\w])\\/\\/[^\\n]*)",
    "(?<hex>#[\\da-fA-F]{3,8}\\b)",
    "(?<hash>#[^\\n]*)",
    "(?<str>\"[^\"\\n]*\"|'[^'\\n]*'|`[^`]*`)",
    "(?<tag>&lt;\\/?[a-zA-Z][\\w-]*)",
    "(?<close>\\/?&gt;)",
    "(?<entity>&(?:amp|lt|gt);)",
    "(?<attr>@?[a-zA-Z][\\w:-]*)(?==)",
    "\\b(?<word>[A-Za-z_$][\\w$]*)",
    "(?<![:.\\w])(?<num>\\d+(?:\\.\\d+)?)\\b",
    "(?<arrow>=&gt;)",
    "(?<punct>[{}()[\\];,:=])",
  ].join("|"),
  "g",
);

const ink = (kind, text) => `<span class="${INK[kind]}">${text}</span>`;

export const highlight = (text) =>
  String(text)
    .replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m])
    .replace(TOKENS, (m, ...args) => {
      const g = args.at(-1);
      if (g.comment || g.hash) return ink("comment", m);
      if (g.hex || g.num) return ink("number", m);
      if (g.str) return ink("string", m);
      if (g.tag) return ink("keyword", m);
      if (g.close || g.arrow || g.punct) return ink("punct", m);
      if (g.attr) return ink("attr", m);
      if (KEYWORDS.has(g.word)) return ink("keyword", m);
      if (BUILTINS.has(g.word)) return ink("builtin", m);
      return m;
    });
