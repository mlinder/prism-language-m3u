// Compares Prism's highlighting with the tree-sitter grammar's highlight query,
// character by character. The same file lives in prism-language-webvtt.
import fs from "node:fs";
import { createRequire } from "node:module";
import Prism from "prismjs";
import { Language, Parser, Query } from "web-tree-sitter";

// Token names Prism themes style. Other token types (containers such as
// "directive") don't colour anything themselves.
const STYLED = new Set([
  "atrule", "attr-name", "attr-value", "bold", "boolean", "builtin", "cdata",
  "char", "class-name", "comment", "constant", "deleted", "doctype", "entity",
  "function", "important", "inserted", "italic", "keyword", "namespace",
  "number", "operator", "prolog", "property", "punctuation", "regex",
  "selector", "string", "symbol", "tag", "url", "variable",
]);

const require = createRequire(import.meta.url);
await Parser.init();

export async function loadGrammar(name) {
  const dir = require.resolve(`${name}/package.json`).replace(/package\.json$/, "");
  const language = await Language.load(fs.readFileSync(`${dir}${name}.wasm`));
  const highlights = new Query(language, fs.readFileSync(`${dir}queries/highlights.scm`, "utf8"));
  const parser = new Parser();
  parser.setLanguage(language);
  return { parser, highlights };
}

// Per character: the capture tree-sitter highlights it with, or null. The
// smallest node wins; for the same node, the earliest pattern.
function treeSitterLabels(grammar, text, skipNodes) {
  const tree = grammar.parser.parse(text);
  const labels = new Array(text.length).fill(null);
  const best = new Array(text.length).fill(null);
  for (const match of grammar.highlights.matches(tree.rootNode)) {
    const seen = new Set();
    for (const { name, node } of match.captures) {
      if (name.startsWith("_") || seen.has(node.id)) continue;
      seen.add(node.id);
      const size = node.endIndex - node.startIndex;
      for (let i = node.startIndex; i < node.endIndex; i++) {
        const b = best[i];
        if (!b || size < b.size || (size === b.size && match.patternIndex < b.pattern)) {
          best[i] = { size, pattern: match.patternIndex };
          labels[i] = name;
        }
      }
    }
  }
  const skip = new Array(text.length).fill(false);
  const visit = (node) => {
    if (skipNodes.includes(node.type)) {
      for (let i = node.startIndex; i < node.endIndex; i++) skip[i] = true;
      return;
    }
    for (const child of node.children) visit(child);
  };
  visit(tree.rootNode);
  return { labels, skip, hasError: tree.rootNode.hasError };
}

// Per character: the classes of the innermost styled Prism token, or null.
function prismLabels(text, grammar) {
  const labels = new Array(text.length).fill(null);
  let offset = 0;
  const walk = (tokens, classes) => {
    for (const token of tokens) {
      if (typeof token === "string") {
        for (let i = 0; i < token.length; i++) labels[offset + i] = classes;
        offset += token.length;
        continue;
      }
      const own = [token.type, ...[].concat(token.alias ?? [])].filter((c) => STYLED.has(c));
      const inner = own.length ? own : classes;
      if (typeof token.content === "string") walk([token.content], inner);
      else walk(token.content, inner);
    }
  };
  walk(Prism.tokenize(text, grammar), null);
  return labels;
}

// Differences as runs: { line, column, text, expected, actual }.
export function compare(text, { grammar, prism, mapping, skipNodes = [] }) {
  const ts = treeSitterLabels(grammar, text, skipNodes);
  const pr = prismLabels(text, prism);
  const runs = [];
  let run = null;
  for (let i = 0; i < text.length; i++) {
    const capture = ts.labels[i];
    if (capture && !(capture in mapping)) throw new Error(`No Prism mapping for @${capture}`);
    const expected = capture ? mapping[capture] : null;
    const actual = pr[i];
    const ok =
      ts.skip[i] ||
      /\s/.test(text[i]) ||
      (expected === null && actual === null) ||
      (expected !== null && actual !== null && actual.some((c) => expected.includes(c)));
    if (ok) {
      run = null;
      continue;
    }
    const key = `${capture}|${actual}`;
    if (run && run.key === key && run.end === i) {
      run.end = i + 1;
    } else {
      const before = text.slice(0, i).split("\n");
      run = {
        key,
        start: i,
        end: i + 1,
        line: before.length,
        column: before.at(-1).length + 1,
        expected: capture ? `@${capture} (${expected.join("|")})` : "plain",
        actual: actual ? actual.join(" ") : "plain",
      };
      runs.push(run);
    }
  }
  return {
    hasError: ts.hasError,
    runs: runs.map(({ key, start, end, ...r }) => ({ ...r, text: text.slice(start, end) })),
  };
}

export function format(runs) {
  return runs
    .map((r) => `  ${r.line}:${r.column} ${JSON.stringify(r.text)} expected ${r.expected}, got ${r.actual}`)
    .join("\n");
}
