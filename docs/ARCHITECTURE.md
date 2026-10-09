# Architecture

A zero-dependency static site generator (`src/build.mjs`, Node 20+) turns the JSON in `content/` into plain HTML pages in `dist/`. All links are relative, so the site works from any sub-path (GitHub Pages serves it under `/upskill-ai-infra/`).

## Information architecture

| URL | Page |
|---|---|
| `/` | Roadmap: hero, overall progress, the five phases as a timeline, the lab loop, pace options, topics |
| `/roadmap/<n>-<name>/` | A phase: goal, outcomes, modules (labs grouped by topic in study order), checkpoint |
| `/setup/sN/` | Phase 0 setup steps |
| `/labs/` and `/labs/<id>/` | Filterable lab index; one scrolling page per lab with a phase outline (left) and "on this page" (right) |
| `/concepts/` and `/concepts/<topic>/` | Topic primers |
| `/guide/…` | How to use the roadmap, weekly plans, first 10 days, environments |
| `/interview/`, `/role/…`, `/resources/…`, `/search/`, `/about/` | Supporting pages |

Old URLs from the first version (`/dashboard/`, `/path/`, `/courses/`, `/setup/`, …) are static redirect pages.

## Derived data

- **Phases** come from `content/roadmap/phases.json`. Its `labs` field selects labs: `setup`, a level (`Beginner`, `Intermediate`), `Senior-core` (Senior minus L1/L2) or `Capstone` (L1, L2).
- **Modules** are a phase's labs grouped by topic, ordered by first appearance in `labs.json`.
- **Weekly plans** are packed at build time: labs in study order, a new week when the hour cap is reached or the phase changes. Full path: 20 h/week. Core path: 11 h/week.
- **Search** uses an index embedded in `/search/` (phases, labs, setup steps, concepts, glossary).

## Browser behaviour (`src/assets/js/app.js`)

Theme toggle, mobile menu, `/` to search, copy buttons, lab completion (`localStorage` key `uai-progress-v1`), self-check ticks (`uai-verify-v1`), progress bars and ring, "Continue" buttons, catalog filters, glossary filter and the table-of-contents highlight. Pages are fully readable without JavaScript.

## Checks

`npm run check` builds, then verifies every internal `href`/`src` and `#anchor` resolves and that no page repeats an `id`. The build itself fails if a lab is missing its field-manual task, a topic has no primer, or a lab belongs to no phase.
