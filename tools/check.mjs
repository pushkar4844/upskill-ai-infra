#!/usr/bin/env node
// Build, then verify every internal link and #anchor resolves and no page has duplicate ids.
//   node tools/check.mjs
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
execSync("node src/build.mjs", { cwd: ROOT, stdio: "inherit" });
const DIST = path.join(ROOT, "dist");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const ids = (f) => new Set([...fs.readFileSync(f, "utf8").matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
let bad = 0, n = 0;
for (const f of walk(DIST).filter((x) => x.endsWith(".html"))) {
  const dir = path.dirname(f);
  const html = fs.readFileSync(f, "utf8").replace(/<script type="application\/json"[\s\S]*?<\/script>/g, "");
  for (const m of html.matchAll(/(?:href|src)="([^"#?]*)(?:\?[^"#]*)?(#[^"]*)?"/g)) {
    const [, u, hash] = m;
    if (/^(https?:|mailto:|javascript:|data:)/.test(u) || (!u && !hash)) continue;
    n++;
    let target = u ? path.join(dir, u) : f;
    if (u && fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, "index.html");
    if (!fs.existsSync(target)) { bad++; console.log(`BROKEN  ${path.relative(DIST, f)} -> ${u}`); continue; }
    if (hash && hash.length > 1 && target.endsWith(".html") && !ids(target).has(decodeURIComponent(hash.slice(1)))) { bad++; console.log(`ANCHOR  ${path.relative(DIST, f)} -> ${u}${hash}`); }
  }
  const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dups = all.filter((v, i, a) => a.indexOf(v) !== i);
  if (dups.length) { bad++; console.log(`DUP-ID  ${path.relative(DIST, f)}: ${[...new Set(dups)].join(", ")}`); }
}
console.log(`${n} internal links checked, ${bad} problem(s).`);
process.exit(bad ? 1 : 0);
