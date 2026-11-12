// Writes the samples as PrismJS test files (tests/languages/<lang>/*.test in
// the PrismJS repository), for when the language is contributed upstream.
// Usage: node test/export-prism-tests.mjs <output directory>
import fs from "node:fs";
import path from "node:path";
import Prism from "prismjs";

const root = path.join(import.meta.dirname, "..");
const { main } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const lang = main.match(/^prism-(.+)\.js$/)[1];
await import(path.join(root, main));

const out = process.argv[2];
if (!out) {
  console.error("Usage: node test/export-prism-tests.mjs <output directory>");
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });

// PrismJS compares token streams without aliases and whitespace-only strings
function simplify(tokens) {
  return tokens
    .filter((t) => typeof t !== "string" || t.trim())
    .map((t) => {
      if (typeof t === "string") return t;
      return [t.type, typeof t.content === "string" ? t.content : simplify(t.content)];
    });
}

function stringify(stream, indent = "") {
  const inner = indent + "\t";
  const item = (t) => {
    if (typeof t === "string") return JSON.stringify(t);
    const [type, content] = t;
    const value = typeof content === "string" ? JSON.stringify(content) : stringify(content, inner);
    return `[${JSON.stringify(type)}, ${value}]`;
  };
  return `[\n${stream.map((t) => inner + item(t)).join(",\n")}\n${indent}]`;
}

const separator = "\n\n----------------------------------------------------\n\n";
const samples = path.join(import.meta.dirname, "samples");
for (const name of fs.readdirSync(samples).sort()) {
  const code = fs.readFileSync(path.join(samples, name), "utf8").replace(/\n$/, "");
  const tokens = simplify(Prism.tokenize(code, Prism.languages[lang]));
  const file = path.join(out, `${name.replace(/\.[^.]+$/, "").replace(/\W+/g, "_")}.test`);
  fs.writeFileSync(file, `${code}${separator}${stringify(tokens)}${separator}Checks ${name}.\n`);
  console.log(file);
}
