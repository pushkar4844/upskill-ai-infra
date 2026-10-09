# Architecture

## Why plain HTML + a Node script

- GitHub Pages serves static files; no server runtime is needed.
- Zero dependencies: `node src/build.mjs` works on any machine with Node 20+, nothing to install or keep updated.
- Pages are real HTML files at stable URLs (`/labs/e1/`), so bookmarks and the back button behave normally.

## Build pipeline

```
content/*.json ──► src/build.mjs ──► page bodies (HTML strings)
                          │                 │
                          │       encrypt (AES-256-GCM, content key)
                          ▼                 ▼
                 dist/auth/keyring.json   dist/<route>/index.html  (+ assets/, 404.html, .nojekyll)
```

All links are relative (`../../labs/a1/`), so the site works at `https://<user>.github.io/upskill-ai-infra/` and on localhost.

## Information architecture

| Route | What it is |
|---|---|
| `/` | Public landing page |
| `/login/` | Sign-in |
| `/dashboard/` | Progress ring, track bars, "continue" button, this week's labs, Day-0 progress, all courses |
| `/path/`, `/path/{beginner,intermediate,senior,core,schedule}/` | Learning path, tracks in order, core path, 22-week schedule |
| `/courses/`, `/courses/<domain>/` | 12 courses (one per domain), each listing its labs as modules |
| `/labs/` | Catalog with filters (level, course, environment, status, core, search) |
| `/labs/<id>/` | Lesson page: course outline sidebar + tabs (Overview, Hands-on lab, Field manual, Resources, Interview prep), complete button, previous/next |
| `/setup/`, `/setup/s1..s11/`, `/setup/environments/`, `/setup/first-10-days/` | Day-0 setup as a mini course |
| `/role/`, `/role/coverage/`, `/role/where-you-stand/` | The JD verbatim, requirement-to-lab map, gap analysis |
| `/resources/…` | Hidden gems, reading and free courses, interview bank, certifications, troubleshooting |
| `/about/` | Sources, honesty notes, how access works |

## Client-side JavaScript

- `assets/js/auth.js`: sign-in (PBKDF2 → unwrap content key) and page decryption; redirects to `/login/?next=…` when needed.
- `assets/js/app.js`: theme toggle, mobile menu, copy buttons, tabs (with `#lab`-style deep links), catalog filters,
  progress (`localStorage` key `uai-progress-v1`), self-check boxes (`uai-verify-v1`), dashboard week calculation.

## Quality checks

`npm run check` builds with a plaintext side copy (never deployed) and verifies every internal `href`/`src`, plus no duplicate IDs per page.
