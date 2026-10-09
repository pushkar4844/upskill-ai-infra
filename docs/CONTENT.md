# Editing content

All site content lives in `content/` as JSON. The build fails loudly if a lab and its field-manual task get out of sync.

## A lab = two records with the same ID

| File | Field | Shown in |
|---|---|---|
| `content/playbook/labs.json` | `id, level, title, env, hours, cost, goal, before, steps[{text, code}], expect, verify[], broke[{symptom, fix}], commit, cleanup, interview` | Overview header, **Hands-on lab** tab, Interview answer |
| `content/manual/tasks.json` | `id, domain, level, core, tier, tier_label, hours, title, jd, steps[] (HTML), deliverable_html, gem_html, repos[{url,name,note}], docs[{url,name}], question` | **Field manual**, **Resources**, JD line, Interview question |

The order of `labs.json` is the recommended study order (dashboard "Continue", tracks, previous/next).

Text fields in `labs.json` are plain text; wrap commands in backticks for inline code. `code` is shown verbatim with a Copy button.
`before` can mention IDs like `S8, F1`; they become links automatically.

## Add a lab

1. Pick an ID in the right domain (`A`–`L` + number) and add it to `content/manual/tasks.json`.
2. Add the hands-on record with the same `id` to `content/playbook/labs.json`, in the position you want it studied.
3. Optionally reference it in `content/manual/schedule.json` (a week) and `content/manual/coverage.json` (a JD requirement).
4. `npm run check`, then `npm run deploy`.

## Other files

- `content/role/jd-JR2012776.json`: the posting verbatim (`description_html` is the original HTML from NVIDIA careers). Do not edit the text; re-capture it if the posting changes.
- `content/playbook/setup.json`: Day-0 steps S1–S11. `environments.json`: environment codes (L, V, G1, G4, G2N, R).
- `content/manual/resources.json`: hidden gems, reading, free courses, interview spines/questions, certifications.
- `content/manual/overview.json`: intro, "where you stand", lab tiers, how sources were checked.
