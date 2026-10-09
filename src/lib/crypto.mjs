// Build-time encryption for the static site.
//
// Model (same algorithms the browser uses through WebCrypto):
//   - A random 256-bit content key (CK) is generated per build.
//   - Every protected page body is encrypted with AES-256-GCM under CK.
//   - For each user, a key-encryption key KEK = PBKDF2-SHA256(password, per-user salt, ITER)
//     wraps CK (AES-256-GCM). Only the wrapped key is published, in auth/keyring.json.
//   - Usernames are stored as SHA-256(siteSalt + ":" + lower(username)), never in clear.
// Without a valid username + password nobody can unwrap CK, so page bodies stay ciphertext.
import { webcrypto as wc } from "node:crypto";
const subtle = wc.subtle;
const enc = new TextEncoder();
export const ITER = 310000;

const b64 = (buf) => Buffer.from(buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf).toString("base64");
const rand = (n) => wc.getRandomValues(new Uint8Array(n));

export async function newContentKey() {
  const raw = rand(32);
  const key = await subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  return { raw, key };
}

export async function encryptText(ck, text) {
  const iv = rand(12);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, ck.key, enc.encode(text));
  return { iv: b64(iv), ct: b64(ct) };
}

async function sha256hex(s) {
  const h = await subtle.digest("SHA-256", enc.encode(s));
  return Buffer.from(h).toString("hex");
}

export async function buildKeyring(ck, users) {
  const siteSalt = b64(rand(16));
  const out = { v: 1, alg: "PBKDF2-SHA256/AES-256-GCM", iter: ITER, siteSalt, users: {} };
  for (const { username, password } of users) {
    const salt = rand(16);
    const base = await subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    const kek = await subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base,
      { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    const iv = rand(12);
    const wrapped = await subtle.encrypt({ name: "AES-GCM", iv }, kek, ck.raw);
    out.users[await sha256hex(siteSalt + ":" + username.trim().toLowerCase())] = { salt: b64(salt), iv: b64(iv), wk: b64(wrapped) };
  }
  return out;
}

// SITE_USERS="alice:pass1;bob:pass2"  or users.local.json [{"username":"alice","password":"..."}]
export function parseUsers(env, fileJson) {
  if (env && env.trim()) {
    return env.split(/[;\n]/).map((p) => p.trim()).filter(Boolean).map((p) => {
      const i = p.indexOf(":");
      if (i < 1) throw new Error("SITE_USERS entries must look like username:password");
      return { username: p.slice(0, i), password: p.slice(i + 1) };
    });
  }
  return fileJson || [];
}
