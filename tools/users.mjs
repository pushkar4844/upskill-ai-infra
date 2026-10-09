#!/usr/bin/env node
// Manage local users (users.local.json, git-ignored).
//   node tools/users.mjs add <username> [password]   add or reset; generates a strong password if omitted
//   node tools/users.mjs remove <username>
//   node tools/users.mjs list
//   node tools/users.mjs secret                      print the SITE_USERS value for the GitHub Actions secret
// Rebuild and redeploy after any change; every rebuild also rotates the content key (all sessions sign in again).
import fs from "node:fs";
import path from "node:path";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";

const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "users.local.json");
const read = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []);
const write = (u) => fs.writeFileSync(FILE, JSON.stringify(u, null, 2) + "\n");
const gen = () => {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const b = webcrypto.getRandomValues(new Uint8Array(20));
  return Array.from(b, (x) => a[x % a.length]).join("").replace(/(.{5})(?!$)/g, "$1-");
};
const [cmd, name, pass] = process.argv.slice(2);
const users = read();
if (cmd === "add" && name) {
  if (name.includes(":") || name.includes(";")) throw new Error("username cannot contain : or ;");
  const password = pass || gen();
  if (password.length < 12) throw new Error("password must be at least 12 characters");
  const i = users.findIndex((u) => u.username.toLowerCase() === name.toLowerCase());
  if (i >= 0) users[i].password = password; else users.push({ username: name, password });
  write(users);
  console.log(`${i >= 0 ? "Updated" : "Added"} user "${name}". Password: ${password}`);
} else if (cmd === "remove" && name) {
  write(users.filter((u) => u.username.toLowerCase() !== name.toLowerCase()));
  console.log(`Removed "${name}".`);
} else if (cmd === "list") {
  users.forEach((u) => console.log(u.username));
} else if (cmd === "secret") {
  console.log(users.map((u) => `${u.username}:${u.password}`).join(";"));
} else {
  console.log("usage: node tools/users.mjs add <user> [password] | remove <user> | list | secret");
}
