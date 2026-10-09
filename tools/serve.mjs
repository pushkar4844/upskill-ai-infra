#!/usr/bin/env node
// Tiny static server for dist/ (WebCrypto needs http://localhost, not file://).
//   node tools/serve.mjs [port]   -> http://localhost:8080/
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = path.join(DIST, p);
  if (!f.startsWith(DIST)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
    if (!p.endsWith("/")) { res.writeHead(301, { Location: p + "/" }).end(); return; }
    f = path.join(f, "index.html");
  }
  if (!fs.existsSync(f)) { res.writeHead(404, { "Content-Type": TYPES[".html"] }); res.end(fs.readFileSync(path.join(DIST, "404.html"))); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`Serving dist/ at http://localhost:${PORT}/`));
