# Upskill AI Infra

A free, hands-on roadmap for learning GPU and AI infrastructure: from your first Linux triage script to a two-node GPU cluster validation kit.

**Live site:** https://pushkar4844.github.io/upskill-ai-infra/

## What's inside

| | |
|---|---|
| **Roadmap** | 5 phases in order: Set up your lab → Foundations → Practitioner → Senior → Capstone. Each phase has a goal, outcomes, topic modules and a checkpoint. |
| **50 labs** | Where to run it, copy-paste steps, what you should see, self-checks, "if it breaks", commit/cleanup, an interview answer and curated repos/docs. |
| **12 concept primers** | Key ideas, common mistakes and what interviewers probe for each topic (Linux, GPU health, topology, BMC, RDMA, NCCL, Slurm, Kubernetes, cloud, observability, LLM literacy, capstone). |
| **Study guide** | How to use the roadmap, generated weekly plans (full and part-time core path), first 10 days, environments and cost. |
| **Interview, the role, resources** | Interview bank, the NVIDIA Solutions Architect, Infrastructure posting verbatim, a requirement → lab map, hidden gems, reading, certifications, debug ladder and glossary. |

No accounts or analytics. Progress and self-check ticks are kept in the browser's local storage.

## Run locally

Needs Node 20+. No dependencies.

```bash
npm run dev      # build to dist/ and serve on http://localhost:8080
npm run check    # build and verify every internal link and anchor
```

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which checks, builds and publishes `dist/` to the `gh-pages` branch (Settings → Pages → Deploy from a branch → `gh-pages` / root). To publish from your machine instead: `npm run deploy`.

## Repository layout

```
content/            all text, as JSON (edit here)
  roadmap/          phases.json - the five phases
  playbook/         labs, setup steps, environments, first 10 days, debug ladder
  manual/           field-manual tasks, topics, JD coverage, resources, overview notes
  concepts/         primers.json - one primer per topic
  reference/        glossary.json
  role/             the job posting, verbatim
src/
  build.mjs         static site generator -> dist/
  lib/              layout and helpers
  assets/           css, js, favicon
tools/              serve, check, deploy
docs/               ARCHITECTURE.md, CONTENT.md
```

See [docs/CONTENT.md](docs/CONTENT.md) to edit or add labs and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the build works.

## Notes

Commands follow each project's documented usage and were checked against current releases in October 2026, but they have not been run on your hardware. Cloud prices are estimates; always tear down what you create. Corrections are welcome as issues or pull requests.
