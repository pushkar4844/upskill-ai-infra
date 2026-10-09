#!/usr/bin/env node
// Build with a plaintext side copy and verify every internal link and anchor target resolves.
//   node tools/check.mjs
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHK = fs.mkdtempSync(path.join(os.tmpdir(), "uai-check-"));
execSync("node src/build.mjs", { cwd: ROOT, stdio: "inherit", env: { ...process.env, UAI_CHECK_DIR: CHK } });
const DIST = path.join(ROOT, "dist");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
let bad = 0, n = 0;
for (const f of walk(CHK).filter((x) => x.endsWith(".html"))) {
  const rel = path.relative(CHK, path.dirname(f));
  const html = fs.readFileSync(f, "utf8");
  for (const m of html.matchAll(/(?:href|src)="([^"#?]*)(#[^"]*)?"/g)) {
    const u = m[1];
    if (!u || /^(https?:|mailto:|javascript:|data:)/.test(u)) continue;
    n++;
    const target = path.join(DIST, rel, u);
    const ok = fs.existsSync(target) && (fs.statSync(target).isFile() || fs.existsSync(path.join(target, "index.html")));
    if (!ok) { bad++; console.log(`BROKEN  ${rel || "/"} -> ${u}`); }
  }
  const dups = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) !== i);
  if (dups.length) { bad++; console.log(`DUP-ID  ${rel}: ${[...new Set(dups)].join(", ")}`); }
}
fs.rmSync(CHK, { recursive: true, force: true });
console.log(`${n} internal links checked, ${bad} problem(s).`);
process.exit(bad ? 1 : 0);
