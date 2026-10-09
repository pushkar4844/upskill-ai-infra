/* Upskill AI Infra - client-side auth.
   Pages marked data-protected carry AES-256-GCM ciphertext. Signing in derives a
   key-encryption key from the password (PBKDF2-SHA256), unwraps the site content key
   from auth/keyring.json and keeps it in sessionStorage (or localStorage when
   "keep me signed in" is ticked). See docs/AUTH.md. */
(function () {
  "use strict";
  var body = document.body;
  var ROOT = body.getAttribute("data-root") || "./";
  var CK = "uai-ck";
  var enc = new TextEncoder();
  var subtle = window.crypto && window.crypto.subtle;

  function store(k) { try { return sessionStorage.getItem(k) || localStorage.getItem(k); } catch (e) { return null; } }
  function clearKey() { try { sessionStorage.removeItem(CK); localStorage.removeItem(CK); } catch (e) {} }
  function b64d(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function b64e(buf) { var u = new Uint8Array(buf), s = ""; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }

  // Path of the current page relative to the site root, used for ?next=
  function relPath() {
    var base = new URL(ROOT, location.href).pathname;
    var p = location.pathname;
    return (p.indexOf(base) === 0 ? p.slice(base.length) : "") + location.hash;
  }
  function toLogin(reason) {
    location.replace(ROOT + "login/?next=" + encodeURIComponent(relPath()) + (reason ? "&r=" + reason : ""));
  }

  async function decryptPage() {
    var raw = store(CK);
    if (!raw) return toLogin();
    var el = document.getElementById("payload");
    try {
      var p = JSON.parse(el.textContent);
      var key = await subtle.importKey("raw", b64d(raw), "AES-GCM", false, ["decrypt"]);
      var pt = await subtle.decrypt({ name: "AES-GCM", iv: b64d(p.iv) }, key, b64d(p.ct));
      document.getElementById("app").innerHTML = new TextDecoder().decode(pt);
      el.remove();
      window.__uaiReady = true;
      document.dispatchEvent(new CustomEvent("uai:ready"));
    } catch (e) {
      clearKey(); // site was rebuilt with a new key, or the stored key is bad
      toLogin("expired");
    }
  }

  async function login(username, password, remember) {
    if (!subtle) throw new Error("This browser cannot decrypt the site (WebCrypto unavailable). Use a current browser over HTTPS.");
    var res = await fetch(ROOT + "auth/keyring.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load the keyring (" + res.status + ").");
    var ring = await res.json();
    var id = hex(await subtle.digest("SHA-256", enc.encode(ring.siteSalt + ":" + username.trim().toLowerCase())));
    var u = ring.users[id];
    var fail = new Error("Wrong username or password.");
    if (!u) { await new Promise(function (r) { setTimeout(r, 600); }); throw fail; }
    var base = await subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    var kek = await subtle.deriveKey({ name: "PBKDF2", salt: b64d(u.salt), iterations: ring.iter, hash: "SHA-256" }, base,
      { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    var ck;
    try { ck = await subtle.decrypt({ name: "AES-GCM", iv: b64d(u.iv) }, kek, b64d(u.wk)); } catch (e) { throw fail; }
    clearKey();
    try { (remember ? localStorage : sessionStorage).setItem(CK, b64e(ck)); } catch (e) { throw new Error("Browser storage is blocked, so the session can't be kept."); }
  }

  function logout() { clearKey(); location.href = ROOT; }

  window.UAIAuth = { login: login, logout: logout, signedIn: function () { return !!store(CK); }, root: ROOT };

  if (body.hasAttribute("data-protected")) {
    if (!subtle) { document.getElementById("app").innerHTML = '<p class="noscript">Open this site over HTTPS in a current browser.</p>'; return; }
    decryptPage();
  }
})();
