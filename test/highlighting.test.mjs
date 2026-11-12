// Every sample must highlight the same with Prism as with the tree-sitter
// grammar's highlight query. Set EXTRA_SAMPLES to more directories
// (separated like PATH) to also check files that can't be committed.
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import Prism from "prismjs";
import "../prism-m3u.js";
import { compare, format, loadGrammar } from "./compare.mjs";

// Tree-sitter capture → Prism classes that may highlight it
const mapping = {
  "tag.doctype": ["doctype"],
  keyword: ["tag"],
  property: ["attr-name"],
  operator: ["operator"],
  number: ["number"],
  "punctuation.delimiter": ["punctuation"],
  constant: ["constant"],
  boolean: ["boolean"],
  string: ["string", "attr-value"],
  "string.special": ["string", "url"],
  "string.escape": ["entity"],
  comment: ["comment"],
  variable: ["variable"],
};

const grammar = await loadGrammar("tree-sitter-m3u");
const dirs = [
  path.join(import.meta.dirname, "samples"),
  ...(process.env.EXTRA_SAMPLES?.split(path.delimiter).filter(Boolean) ?? []),
];

// The grammar reads everything after #EXTM3U as a URI
test("IPTV attributes on the header line", () => {
  const [header] = Prism.tokenize('#EXTM3U url-tvg="https://example.com/epg.xml"\n', Prism.languages.m3u);
  const types = (tokens) => tokens.filter((t) => typeof t !== "string").map((t) => t.type);
  assert.deepEqual(types(header.content), ["doctype", "attribute"]);
  assert.deepEqual(types(header.content[2].content), ["attr-name", "operator", "attr-value"]);
});

for (const dir of dirs) {
  for (const name of fs.readdirSync(dir).filter((f) => /\.m3u8?$/.test(f)).sort()) {
    test(name, () => {
      const text = fs.readFileSync(path.join(dir, name), "utf8");
      const { hasError, runs } = compare(text, { grammar, prism: Prism.languages.m3u, mapping });
      assert.equal(hasError, false, "tree-sitter can't parse the sample");
      assert.equal(runs.length, 0, `Prism differs from tree-sitter:\n${format(runs)}`);
    });
  }
}
