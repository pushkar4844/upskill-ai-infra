#!/usr/bin/env node
// Build locally and publish dist/ to the gh-pages branch (GitHub Pages: "Deploy from a branch" -> gh-pages / root).
// Uses users.local.json, so no secrets are needed in GitHub. Source of the site stays on main.
//   node tools/deploy.mjs
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sh = (c, cwd = ROOT) => execSync(c, { cwd, stdio: "inherit" });
const out = (c, cwd = ROOT) => execSync(c, { cwd }).toString().trim();

sh("node src/build.mjs");
const remote = out("git remote get-url origin");
const sha = out("git rev-parse --short HEAD");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "uai-pages-"));
fs.cpSync(path.join(ROOT, "dist"), tmp, { recursive: true });
sh("git init -q -b gh-pages", tmp);
sh(`git remote add origin "${remote}"`, tmp);
sh("git add -A", tmp);
sh(`git commit -q -m "Deploy site from ${sha}"`, tmp);
sh("git push -f origin gh-pages", tmp);
fs.rmSync(tmp, { recursive: true, force: true });
console.log("Pushed dist/ to gh-pages. GitHub Pages: Settings -> Pages -> Deploy from a branch -> gh-pages / (root).");
