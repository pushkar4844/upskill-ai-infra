# Authentication and encryption

GitHub Pages only serves static files, so there is no server to check passwords. Instead the site is **encrypted at build
time** and **decrypted in the browser** by people who have a valid username and password.

## How it works

1. `src/build.mjs` generates a random 256-bit **content key (CK)** on every build.
2. Every protected page body is encrypted with **AES-256-GCM** under CK. The HTML file only contains the ciphertext.
3. For each user, a key-encryption key is derived from the password with **PBKDF2-SHA256, 310,000 iterations** and a random salt.
   It wraps CK (AES-256-GCM). The result is written to `dist/auth/keyring.json`.
4. Usernames are not stored in clear: the keyring uses `SHA-256(siteSalt + ":" + lowercase(username))` as the lookup key.
5. On the sign-in page, `assets/js/auth.js` repeats the derivation with WebCrypto, unwraps CK and stores it in
   `sessionStorage` (or `localStorage` when "Keep me signed in" is ticked). Each page then decrypts itself.
6. A wrong password fails to unwrap CK, so it fails without telling an attacker whether the username exists.

Public pages: the landing page (`/`), `/login/` and `404.html`. They contain no lab content.

## Managing users

```bash
node tools/users.mjs add alice            # generates a strong password and prints it once
node tools/users.mjs add bob 'my-own-long-password'
node tools/users.mjs list
node tools/users.mjs remove alice
node tools/users.mjs secret               # prints the SITE_USERS value for GitHub Actions
npm run deploy                            # rebuild + publish (required after any change)
```

Users are kept in `users.local.json` (git-ignored). Passwords must be 12 characters or more.

**Every rebuild rotates the content key.** After you redeploy, everyone must sign in again. That is also how you revoke
access: remove the user and redeploy.

## Limits

- Strength comes from password length. Use the generated passwords (20 random characters).
- Anyone you give a password to can read everything, and could save decrypted pages.
- The keyring and ciphertext are public files, so an attacker can try passwords offline. PBKDF2 at 310k iterations slows that
  down; long random passwords make it infeasible.
- **The source content in `content/` is plain text in Git.** If the repository is public, the login protects the website,
  not the repository. Make the repository private if the content must stay private.
- Progress and checkboxes are stored in the browser's localStorage. Nothing is sent anywhere.
