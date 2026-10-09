# Editing content

All site content lives in `content/` as JSON. Run `npm run check` after any change.

## A lab = two records with the same ID

| File | Fields | Shown as |
|---|---|---|
| `content/playbook/labs.json` | `id, level, title, env, hours, cost, goal, before, steps[{text, code}], expect, verify[], broke[{symptom, fix}], commit, cleanup, interview` | Header facts, Hands-on steps, You should see, Check yourself, If it breaks, Commit and clean up, interview answer |
| `content/manual/tasks.json` | `id, domain, level, core, tier, tier_label, hours, title, jd, steps[] (HTML), deliverable_html, gem_html, repos[{url,name,note}], docs[{url,name}], question` | Why it matters, What done looks like, Go deeper, interview question |

The order of `labs.json` is the study order (phase modules, previous/next, Continue, weekly plans). `level` decides the phase: Beginner → Phase 1, Intermediate → Phase 2, Senior → Phase 3, except L1/L2 → Phase 4.

Text fields in `labs.json` are plain text; wrap commands in backticks for inline code. `code` is shown verbatim with a Copy button. IDs like `S8, F1` in `before` become links.

## Add a lab

1. Add the task to `content/manual/tasks.json` with an ID in the right topic (`A`–`L` + number).
2. Add the hands-on record with the same `id` to `content/playbook/labs.json`, where you want it studied.
3. Optionally list it under a requirement in `content/manual/coverage.json` and add a glossary term pointing to it.
4. `npm run check`, commit, push.

## Other files

- `content/roadmap/phases.json`: phase name, tagline, goal, outcomes, milestone and lab selector.
- `content/concepts/primers.json`: per topic `summary`, `ideas[]`, `pitfalls[]`, `probe`.
- `content/reference/glossary.json`: `[term, definition, labId]`.
- `content/role/jd-JR2012776.json`: the posting verbatim. Do not edit the text; re-capture it if the posting changes.
- `content/playbook/setup.json` (S1–S11), `environments.json`, `first-ten-days.json`, `debug-ladder.json`.
- `content/manual/resources.json`: hidden gems, reading, interview spines and questions, certifications.
- `content/manual/overview.json`: who it's for, lab tiers, practitioner advice, how facts were checked.
