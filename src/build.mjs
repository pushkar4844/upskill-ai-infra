#!/usr/bin/env node
// Static site generator for Upskill AI Infra. No dependencies: Node 20+.
//   node src/build.mjs   -> dist/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { esc, md, slug, icon, LEVEL_KEY } from "./lib/util.mjs";
import { header, footer, crumbs, page, SITE } from "./lib/layout.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "dist");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, "content", p), "utf8"));

// ---------------------------------------------------------------- content
const JD = J("role/jd-JR2012776.json");
const OV = J("manual/overview.json");
const DOMAINS = J("manual/domains.json");
const TASKS = J("manual/tasks.json");
const COVERAGE = J("manual/coverage.json");
const RES = J("manual/resources.json");
const ENVS = J("playbook/environments.json");
const SETUP = J("playbook/setup.json");
const TEN = J("playbook/first-ten-days.json");
const DEBUG = J("playbook/debug-ladder.json");
const LABS = J("playbook/labs.json");
const PHASES = J("roadmap/phases.json");
const PRIMERS = J("concepts/primers.json");
const GLOSSARY = J("reference/glossary.json").sort((a, b) => a[0].localeCompare(b[0], "en", { sensitivity: "base" }));

const T = Object.fromEntries(TASKS.map((t) => [t.id, t]));
const ORDER = LABS.map((l) => l.id); // recommended study order
const LAB = Object.fromEntries(LABS.map((l) => [l.id, { ...l, m: T[l.id] }]));
const DOM = Object.fromEntries(DOMAINS.map((d) => [d.key, { ...d, slug: `${d.key.toLowerCase()}-${slug(d.name)}` }]));
const ENV = Object.fromEntries(ENVS.map((e) => [e.code, e]));
const SETUP_IDS = SETUP.map((s) => s.id);
const COV_OF = {};
COVERAGE.rows.forEach((r) => r.tasks.forEach((t) => (COV_OF[t] ||= []).push(r.requirement)));
const hrs = (ids) => ids.reduce((a, id) => a + (LAB[id]?.hours || 0), 0);
for (const id of ORDER) if (!T[id]) throw new Error("manual task missing for " + id);
for (const d of DOMAINS) if (!PRIMERS[d.key]) throw new Error("primer missing for " + d.key);

// ---------------------------------------------------------------- phases
const CAP = ["L1", "L2"];
const phaseIds = (ph) => ph.labs === "setup" ? [] : ph.labs === "Capstone" ? CAP
  : ph.labs === "Senior-core" ? ORDER.filter((id) => LAB[id].level === "Senior" && !CAP.includes(id))
  : ORDER.filter((id) => LAB[id].level === ph.labs);
PHASES.forEach((ph) => { ph.ids = phaseIds(ph); ph.slug = `${ph.num}-${slug(ph.short)}`; ph.url = `roadmap/${ph.slug}/`; });
const PHASE_OF = {};
PHASES.forEach((ph) => ph.ids.forEach((id) => (PHASE_OF[id] = ph)));
SETUP_IDS.forEach((id) => (PHASE_OF[id] = PHASES[0]));
for (const id of ORDER) if (!PHASE_OF[id]) throw new Error("lab not in any phase: " + id);
// modules = domains inside a phase, in order of first appearance
const modules = (ids) => {
  const m = [];
  ids.forEach((id) => { const k = LAB[id].m.domain; let g = m.find((x) => x.key === k); if (!g) m.push((g = { key: k, ids: [] })); g.ids.push(id); });
  return m;
};
const ALL_STEPS = [...SETUP_IDS, ...ORDER]; // the full path, setup first

// ---------------------------------------------------------------- weekly plans
function plan(ids, cap) {
  const weeks = [{ n: 0, phase: PHASES[0], ids: [], setup: true, h: 4 }];
  let cur = null;
  for (const id of ids) {
    const ph = PHASE_OF[id], h = LAB[id].hours;
    if (!cur || cur.phase !== ph || (cur.ids.length && cur.h + h > cap)) weeks.push((cur = { n: weeks.length, phase: ph, ids: [], h: 0 }));
    cur.ids.push(id); cur.h += h;
  }
  return weeks;
}
const CORE = ORDER.filter((id) => LAB[id].m.core);
const PLANS = [
  { key: "full", name: "Full path", ids: ORDER, cap: 20, who: "Studying 3 hours a day, or between jobs.", weeks: plan(ORDER, 20) },
  { key: "core", name: "Core path, part-time", ids: CORE, cap: 11, who: "Working full time. Keeps every area of the posting with fewer labs.", weeks: plan(CORE, 11) },
];

// ---------------------------------------------------------------- helpers
const pages = [];
const add = (p) => pages.push(p);
const labUrl = (id) => /^S\d+$/.test(id) ? `setup/${id.toLowerCase()}/` : `labs/${id.toLowerCase()}/`;
const titleOf = (id) => /^S\d+$/.test(id) ? SETUP.find((s) => s.id === id).title : LAB[id].title;
const linkIds = (text, R) => esc(text).replace(/\b([A-L]\d|S\d{1,2})\b/g, (m) => (LAB[m] || SETUP_IDS.includes(m)) ? `<a href="${R}${labUrl(m)}">${m}</a>` : m);
const lvlPill = (lv) => `<span class="pill lv-${LEVEL_KEY[lv]}">${lv}</span>`;
const corePill = (id) => LAB[id].m.core ? '<span class="pill core" title="Part of the shorter core path">Core</span>' : "";
const envChip = (code) => `<span class="chip" title="${esc(ENV[code].name)}">${icon("server")}${code}</span>`;
const prog = (ids, label = "done") => `<div class="progress" data-prog="${ids.join(",")}" data-prog-label="${label}"><div class="bar"><span></span></div><small data-prog-text>0 of ${ids.length} ${label}</small></div>`;
const codeBlock = (c) => `<div class="code"><button class="copy" type="button" data-copy>Copy</button><pre><code>${esc(c)}</code></pre></div>`;
const shell = (R, section, inner) => header(R, section) + `<main id="main">${inner}</main>` + footer(R);
const domTag = (k, R, link = true) => link ? `<a class="dtag dom-${k}" href="${R}concepts/${DOM[k].slug}/"><b>${k}</b>${esc(DOM[k].name)}</a>` : `<span class="dtag dom-${k}"><b>${k}</b>${esc(DOM[k].name)}</span>`;
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const titlesJson = `<script type="application/json" id="titles">${JSON.stringify(Object.fromEntries(ALL_STEPS.map((id) => [id, titleOf(id)])))}</script>`;
const continueBtn = (R, ids, cls = "btn primary lg") => `<a class="${cls}" data-continue="${ids.join(",")}" href="${R}${labUrl(ids[0])}">${icon("play")}<span>Start with ${ids[0]}</span></a>`;
const phaseBadge = (ph) => `<span class="pnum p${ph.num}">${ph.num}</span>`;
const plainText = (h) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');

const labRow = (R, id) => {
  const l = LAB[id];
  return `<li class="lrow" data-lab="${id}"><a href="${R}labs/${id.toLowerCase()}/">
<span class="tick" aria-hidden="true">${icon("check")}</span>
<span class="lr-main"><span class="lr-top"><span class="lid">${id}</span><b>${esc(l.title)}</b></span><span class="lr-goal">${esc(l.goal)}</span></span>
<span class="lr-meta">${corePill(id)}<span>${icon("clock")}${l.hours} h</span>${envChip(l.env)}</span></a></li>`;
};

const phaseStrip = (R, cur) => `<nav class="pstrip" aria-label="Phases">${PHASES.map((ph) => `<a href="${R}${ph.url}" class="${ph === cur ? "on" : ""}"${ph === cur ? ' aria-current="page"' : ""}>${phaseBadge(ph)}<span>${esc(ph.short)}</span></a>`).join("")}</nav>`;

// ---------------------------------------------------------------- home: the roadmap
const PATH_H = hrs(ORDER);
add({ path: "", title: "", desc: SITE.tagline, pageKey: "home", body: (R) => shell(R, "roadmap", `${titlesJson}
<section class="hero"><div class="wrap hero-in">
<div class="hero-copy">
<p class="eyebrow">Free · hands-on · open source</p>
<h1>Learn GPU and AI infrastructure by <span class="hl">bringing it up yourself</span>.</h1>
<p class="lead">One roadmap in five phases: set up a cheap lab, touch every layer once, go deep, design at scale, then prove it with a capstone. Every lab tells you where to run it, what to type, what you should see, how to fix it and what to say in an interview.</p>
<div class="actions">${continueBtn(R, ALL_STEPS)}<a class="btn ghost lg" href="${R}guide/">${icon("map")}How to use this roadmap</a></div>
<ul class="stats"><li><b>${PHASES.length}</b>phases</li><li><b>${ORDER.length}</b>labs</li><li><b>${DOMAINS.length}</b>topics</li><li><b>~${PATH_H} h</b>full path</li></ul>
</div>
<aside class="hero-card" aria-label="Your progress">
<div class="ring" data-ring="${ALL_STEPS.join(",")}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="r-bg"/><circle cx="60" cy="60" r="52" class="r-fg"/></svg><div class="ring-txt"><b data-ring-pct>0%</b><span>overall</span></div></div>
<ul class="hc-phases">${PHASES.map((ph) => { const ids = ph.ids.length ? ph.ids : SETUP_IDS; return `<li><a href="${R}${ph.url}">${phaseBadge(ph)}<span>${esc(ph.short)}</span></a>${prog(ids, ph.ids.length ? "labs" : "steps")}</li>`; }).join("")}</ul>
<p class="small muted">Progress is saved in this browser only.</p>
</aside>
</div></section>

<section class="wrap sec" id="roadmap">
<div class="sec-head"><div><p class="eyebrow">The roadmap</p><h2>Five phases, in order</h2></div><p class="muted">Each phase has a goal, the labs grouped by topic, and a checkpoint to pass before you move on.</p></div>
<ol class="timeline">${PHASES.map((ph) => {
  const mods = ph.ids.length ? modules(ph.ids) : [];
  const ids = ph.ids.length ? ph.ids : SETUP_IDS;
  return `<li class="tl-item"><div class="tl-rail">${phaseBadge(ph)}</div><article class="tl-card">
<header><p class="eyebrow">Phase ${ph.num}${ph.level ? ` · ${ph.level}` : ""}</p><h3><a href="${R}${ph.url}">${esc(ph.name)}</a></h3><p class="tl-tag">${esc(ph.tagline)}</p></header>
<p>${esc(ph.goal)}</p>
<div class="tl-meta"><span>${icon("flask")}${ph.ids.length ? `${ph.ids.length} labs` : `${SETUP.length} setup steps`}</span><span>${icon("clock")}${ph.ids.length ? `${hrs(ph.ids)} h` : "one evening"}</span>${ph.ids.length ? `<span>${icon("layers")}${mods.length} topics</span>` : ""}</div>
${mods.length ? `<div class="dtags">${mods.map((g) => domTag(g.key, R, false)).join("")}</div>` : ""}
${prog(ids, ph.ids.length ? "labs" : "steps")}
<p class="tl-cta"><a class="btn sm" href="${R}${ph.url}">Open phase ${ph.num} ${icon("arrowR")}</a></p>
</article></li>`;
}).join("")}</ol>
</section>

<section class="band"><div class="wrap sec">
<div class="sec-head"><div><p class="eyebrow">Method</p><h2>Every lab follows the same loop</h2></div><p class="muted">Learn the loop once and every lab reads the same way.</p></div>
<ol class="loop">${[["Read", "The goal, why it matters and what done looks like."], ["Bring up", "The environment named on the lab (laptop, VM, spot GPU…)."], ["Run", "Copy each command block in order."], ["Check", "Compare with “You should see”, tick “Check yourself”."], ["Fix", "Use “If it breaks”, then the debug ladder."], ["Commit", "Script, results and notes into your gpu-lab repo."], ["Tear down", "terraform destroy, then labdown. No idle bill."], ["Say it", "Answer the interview question out loud."]].map(([a, b], i) => `<li><span>${i + 1}</span><b>${a}</b><p>${esc(b)}</p></li>`).join("")}</ol>
</div></section>

<section class="wrap sec">
<div class="sec-head"><div><p class="eyebrow">Pace</p><h2>Pick a pace that fits your week</h2></div></div>
<div class="grid3">
${PLANS.map((p) => `<a class="card link" href="${R}guide/weekly-plan/#${p.key}"><h3>${esc(p.name)}</h3><p class="big">${p.weeks.length - 1} weeks <small>+ setup week</small></p><p>${p.ids.length} labs · ${hrs(p.ids)} h · about ${p.cap} h a week.</p><p class="muted">${esc(p.who)}</p><span class="more">See the week-by-week plan ${icon("arrowR")}</span></a>`).join("")}
<a class="card link" href="${R}labs/"><h3>Pick and choose</h3><p class="big">${ORDER.length} labs</p><p>Already strong somewhere? Filter labs by topic, phase or environment and do only what you need.</p><span class="more">Browse all labs ${icon("arrowR")}</span></a>
</div></section>

<section class="wrap sec">
<div class="split2">
<div class="card prose"><h3>${icon("target")} Who this is for</h3>${OV.notes[0].html}</div>
<div class="card prose"><h3>${icon("brief")} Built around a real job posting</h3><p>Every lab maps to a requirement in NVIDIA's <b>${esc(JD.title)}</b> posting, so nothing is filler. The same skills apply to any GPU platform, cloud or on-prem.</p>
<p><a href="${R}role/">Read the posting</a> · <a href="${R}role/coverage/">See which labs prove each requirement</a></p></div>
</div></section>

<section class="wrap sec">
<div class="sec-head"><div><p class="eyebrow">Topics</p><h2>Twelve topics, each with a short primer</h2></div><p class="muted">Read the primer before a topic's first lab: key ideas, common mistakes and what interviewers probe.</p></div>
<div class="topics">${DOMAINS.map((d) => `<a class="topic dom-${d.key}" href="${R}concepts/${DOM[d.key].slug}/"><b>${d.key}</b><span>${esc(d.name)}</span><small>${ORDER.filter((id) => LAB[id].m.domain === d.key).length} labs</small></a>`).join("")}</div>
</section>

<section class="wrap sec cta-end"><h2>Start tonight</h2><p class="muted">Phase 0 takes one evening and you do not need a GPU for the first week.</p>
<p><a class="btn primary lg" href="${R}${PHASES[0].url}">${icon("play")}Open Phase 0: Set up your lab</a></p></section>`) });

// ---------------------------------------------------------------- phase pages
PHASES.forEach((ph, pi) => {
  const prevPh = PHASES[pi - 1], nextPh = PHASES[pi + 1];
  const ids = ph.ids.length ? ph.ids : SETUP_IDS;
  const mods = modules(ph.ids);
  const fullWeeks = PLANS[0].weeks.filter((w) => w.phase === ph).length;
  const body = (R) => {
    const content = ph.ids.length ? mods.map((g, gi) => `<section class="module">
<header class="mod-head"><span class="mod-n">Module ${gi + 1}</span>${domTag(g.key, R, false)}<span class="muted small">${g.ids.length} lab${g.ids.length > 1 ? "s" : ""} · ${hrs(g.ids)} h</span><a class="small mod-primer" href="${R}concepts/${DOM[g.key].slug}/">${icon("bulb")}Read the primer</a></header>
<ol class="lrows">${g.ids.map((id) => labRow(R, id)).join("")}</ol></section>`).join("")
      : `<section class="module"><header class="mod-head"><span class="mod-n">Setup steps</span><span class="muted small">Do them in order. S1–S6 on day 1, the Terraform files (S7–S9) when you first need them.</span></header>
<ol class="lrows">${SETUP.map((s) => `<li class="lrow" data-lab="${s.id}"><a href="${R}setup/${s.id.toLowerCase()}/"><span class="tick" aria-hidden="true">${icon("check")}</span><span class="lr-main"><span class="lr-top"><span class="lid">${s.id}</span><b>${esc(s.title)}</b></span><span class="lr-goal">${esc(plainText(md(s.why)).split(". ")[0])}.</span></span></a></li>`).join("")}</ol></section>
<div class="split2"><a class="card link" href="${R}guide/environments/"><h3>${icon("server")} The six lab environments</h3><p>Laptop, VMs, one spot GPU, a multi-GPU node, two EFA nodes, rented A100/H100. Every lab says which one it needs.</p><span class="more">Compare environments and costs ${icon("arrowR")}</span></a>
<a class="card link" href="${R}guide/first-10-days/"><h3>${icon("cal")} Your first 10 days</h3><p>A day-by-day plan from an empty laptop to your first DCGM report and nccl-tests run.</p><span class="more">See the first 10 days ${icon("arrowR")}</span></a></div>`;
    return shell(R, "roadmap", `${titlesJson}
<section class="phase-hero p${ph.num}"><div class="wrap">
${crumbs(R, [["Roadmap", ""], [`Phase ${ph.num}`, ""]])}
${phaseStrip(R, ph)}
<div class="ph-in"><div>
<p class="eyebrow">Phase ${ph.num} of ${PHASES.length - 1}${ph.level ? ` · ${ph.level} level` : ""}</p>
<h1>${esc(ph.name)}</h1><p class="lead">${esc(ph.goal)}</p>
<div class="actions">${continueBtn(R, ids)}</div></div>
<dl class="ph-facts"><div><dt>${ph.ids.length ? "Labs" : "Steps"}</dt><dd>${ids.length}</dd></div><div><dt>Hours</dt><dd>${ph.ids.length ? hrs(ph.ids) : "3–4"}</dd></div>${ph.ids.length ? `<div><dt>Topics</dt><dd>${mods.length}</dd></div><div><dt>Weeks at 20 h</dt><dd>${fullWeeks}</dd></div>` : ""}</dl>
</div>${prog(ids, ph.ids.length ? "labs" : "steps")}
</div></section>
<div class="wrap phase-body">
<div class="phase-main">
<h2>What you'll be able to do</h2>
<ul class="ticks">${ph.outcomes.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
<h2>${ph.ids.length ? "Modules" : "Steps"}</h2>
${content}
<div class="callout ok">${icon("flag")}<div><b>Checkpoint before Phase ${ph.num + 1 <= 4 ? ph.num + 1 : "the interview"}.</b> ${md(ph.milestone)}</div></div>
<nav class="pager" aria-label="Phase navigation">
${prevPh ? `<a class="prev" href="${R}${prevPh.url}">${icon("arrowL")}<span><small>Previous phase</small>${prevPh.num} · ${esc(prevPh.name)}</span></a>` : `<a class="prev" href="${R}">${icon("arrowL")}<span><small>Back</small>Roadmap</span></a>`}
${nextPh ? `<a class="next" href="${R}${nextPh.url}"><span><small>Next phase</small>${nextPh.num} · ${esc(nextPh.name)}</span>${icon("arrowR")}</a>` : `<a class="next" href="${R}interview/"><span><small>Next</small>Interview bank</span>${icon("arrowR")}</a>`}
</nav></div>
<aside class="phase-side">
<div class="card"><h3>In this phase</h3><ul class="plain small">${ph.ids.length ? `<li>${icon("layers")} ${mods.map((g) => g.key).join(", ")}</li><li>${icon("star")} ${ph.ids.filter((id) => LAB[id].m.core).length} of ${ph.ids.length} labs are on the core path</li><li>${icon("server")} Environments: ${[...new Set(ph.ids.map((id) => LAB[id].env))].join(", ")}</li>` : `<li>${icon("clock")} One evening</li><li>${icon("dollar")} Cost: free, plus a few cents for a test GPU</li>`}</ul></div>
${ph.ids.length ? `<div class="card"><h3>Read first</h3><ul class="plain small">${mods.map((g) => `<li><a href="${R}concepts/${DOM[g.key].slug}/">${g.key} · ${esc(DOM[g.key].name)}</a></li>`).join("")}</ul></div>` : `<div class="card"><h3>Lab tiers</h3>${OV.notes[1].html}</div>`}
</aside></div>`);
  };
  add({ path: ph.url, title: `Phase ${ph.num}: ${ph.name}`, desc: ph.goal, pageKey: "phase", body });
});

// ---------------------------------------------------------------- lab sidebar (phase outline)
const outline = (R, ph, cur) => {
  const ids = ph.ids.length ? ph.ids : SETUP_IDS;
  const groups = ph.ids.length ? modules(ph.ids) : [{ key: null, ids: SETUP_IDS }];
  return `<aside class="outline" aria-label="Phase outline"><div class="ol-in">
<a class="ol-phase" href="${R}${ph.url}">${phaseBadge(ph)}<span><small>Phase ${ph.num}</small>${esc(ph.name)}</span></a>
${prog(ids, ph.ids.length ? "labs" : "steps")}
${groups.map((g) => `${g.key ? `<p class="ol-mod dom-${g.key}"><b>${g.key}</b>${esc(DOM[g.key].name)}</p>` : ""}<ol class="ol-list">${g.ids.map((s) => `<li data-lab="${s}" class="${s === cur ? "cur" : ""}"><a href="${R}${labUrl(s)}"${s === cur ? ' aria-current="page"' : ""}><span class="dot">${icon("check")}</span><span class="lid">${s}</span><span>${esc(titleOf(s))}</span></a></li>`).join("")}</ol>`).join("")}
<a class="small ol-all" href="${R}">${icon("map")}Full roadmap</a></div></aside>`;
};
const toc = (items) => `<nav class="toc" aria-label="On this page"><p>On this page</p><ol>${items.map(([id, l]) => `<li><a href="#${id}">${l}</a></li>`).join("")}</ol></nav>`;

// ---------------------------------------------------------------- lab pages
ORDER.forEach((id, idx) => {
  const l = LAB[id], m = l.m, d = DOM[m.domain], ph = PHASE_OF[id];
  const prev = ORDER[idx - 1], next = ORDER[idx + 1];
  const covs = COV_OF[id] || [];
  const sections = [["why", "Why it matters"], ["done", "What done looks like"], ["steps", "Hands-on steps"], ["check", "Check yourself"], ...(l.broke.length ? [["broke", "If it breaks"]] : []), ["finish", "Commit and clean up"], ["interview", "Interview"], ["deeper", "Go deeper"]];
  add({ path: `labs/${id.toLowerCase()}/`, title: `${id} ${l.title}`, desc: l.goal, pageKey: "lab", body: (R) => shell(R, "labs", `
<div class="lesson">${outline(R, ph, id)}
<article class="lesson-main">
${crumbs(R, [["Roadmap", ""], [`Phase ${ph.num}`, ph.url], [`${id}`, ""]])}
<header class="lesson-head">
<div class="lh-tags"><span class="lid big">${id}</span>${domTag(d.key, R)}${lvlPill(l.level)}${corePill(id)}<span class="done-badge" data-lab="${id}">${icon("check")}Completed</span></div>
<h1>${esc(l.title)}</h1><p class="lead">${md(l.goal)}</p>
<dl class="facts">
<div><dt>Where</dt><dd>${envChip(l.env)} ${esc(ENV[l.env].name)}</dd></div>
<div><dt>Time</dt><dd>${l.hours} hours</dd></div>
<div><dt>Cost</dt><dd>${esc(l.cost)}</dd></div>
<div><dt>Do first</dt><dd>${linkIds(l.before, R)}</dd></div>
</dl></header>
${toc(sections).replace('class="toc"', 'class="toc toc-inline"')}

<section id="why" class="lsec"><h2>${icon("target")}Why it matters</h2>
<p>${esc(cap1(m.jd.replace(/^JD( stand-out)?:\s*/i, "")))}</p>
${covs.length ? `<p class="small muted">Gives evidence for these requirements in the posting:</p><ul class="ticks small">${covs.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
<p class="small"><a href="${R}concepts/${d.slug}/">${icon("bulb")}New to ${esc(d.name.toLowerCase())}? Read the 5-minute primer first.</a></p>
</section>

<section id="done" class="lsec"><h2>${icon("flag")}What done looks like</h2>
<div class="callout ok">${icon("check")}<div><b>Deliverable.</b> ${m.deliverable_html}</div></div>
<details class="more-box"><summary>The outcome, step by step (field manual version)</summary><ol class="msteps">${m.steps.map((s) => `<li>${s}</li>`).join("")}</ol></details>
</section>

<section id="steps" class="lsec"><h2>${icon("play")}Hands-on steps</h2>
<ol class="steps">${l.steps.map((s) => `<li><div class="st-text">${md(s.text)}</div>${s.code ? codeBlock(s.code) : ""}</li>`).join("")}</ol>
<div class="callout info">${icon("info")}<div><b>You should see.</b> ${md(l.expect)}</div></div>
</section>

<section id="check" class="lsec"><h2>${icon("list")}Check yourself</h2>
<ul class="checklist">${l.verify.map((v, i) => `<li><label><input type="checkbox" data-verify="${id}:${i}"><span>${md(v)}</span></label></li>`).join("")}</ul>
</section>

${l.broke.length ? `<section id="broke" class="lsec"><h2>${icon("bug")}If it breaks</h2>
<div class="tscroll"><table class="brk"><thead><tr><th>Symptom</th><th>Fix</th></tr></thead><tbody>${l.broke.map((b) => `<tr><td>${md(b.symptom)}</td><td>${md(b.fix)}</td></tr>`).join("")}</tbody></table></div>
<p class="small">Still stuck? Follow the <a href="${R}resources/troubleshooting/">debug ladder</a>.</p></section>` : ""}

<section id="finish" class="lsec"><h2>${icon("check")}Commit and clean up</h2>
<div class="split2"><div class="card"><h3>Commit to your repo</h3><p>${md(l.commit)}</p></div><div class="card warn"><h3>Clean up</h3><p>${md(l.cleanup)}</p></div></div>
</section>

<section id="interview" class="lsec"><h2>${icon("chat")}Interview</h2>
<p class="q"><b>Be ready for:</b> ${esc(m.question)}</p>
<details class="ans"><summary>Show the answer you can now give</summary><p>${md(l.interview)}</p></details>
</section>

<section id="deeper" class="lsec"><h2>${icon("book")}Go deeper</h2>
${m.gem_html ? `<div class="callout gem">${icon("gem")}<div><b>Hidden gem.</b> ${m.gem_html}</div></div>` : ""}
<div class="split2">
${m.repos.length ? `<div><h3>Repositories</h3><ul class="reflist">${m.repos.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)}${icon("external")}</a>${r.note ? `<span>${esc(r.note)}</span>` : ""}</li>`).join("")}</ul></div>` : ""}
${m.docs.length ? `<div><h3>Docs and reading</h3><ul class="reflist">${m.docs.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)}${icon("external")}</a></li>`).join("")}</ul></div>` : ""}
</div></section>

<div class="complete-bar"><button class="btn primary" type="button" data-complete="${id}">${icon("check")}<span>Mark lab complete</span></button><span class="small muted">Saved in this browser.</span></div>
<nav class="pager" aria-label="Lab navigation">
${prev ? `<a class="prev" href="${R}labs/${prev.toLowerCase()}/">${icon("arrowL")}<span><small>Previous</small>${prev} · ${esc(LAB[prev].title)}</span></a>` : `<a class="prev" href="${R}setup/${SETUP_IDS.at(-1).toLowerCase()}/">${icon("arrowL")}<span><small>Previous</small>${SETUP_IDS.at(-1)} · ${esc(titleOf(SETUP_IDS.at(-1)))}</span></a>`}
${next ? `<a class="next" href="${R}labs/${next.toLowerCase()}/"><span><small>Next${PHASE_OF[next] !== ph ? ` · Phase ${PHASE_OF[next].num}` : ""}</small>${next} · ${esc(LAB[next].title)}</span>${icon("arrowR")}</a>` : `<a class="next" href="${R}interview/"><span><small>Next</small>Interview bank</span>${icon("arrowR")}</a>`}
</nav></article>
${toc(sections)}
</div>`) });
});

// ---------------------------------------------------------------- setup steps (phase 0)
SETUP.forEach((s, i) => {
  const prev = SETUP[i - 1], next = SETUP[i + 1];
  add({ path: `setup/${s.id.toLowerCase()}/`, title: `${s.id} ${s.title}`, desc: plainText(md(s.why)).slice(0, 160), pageKey: "setup", body: (R) => shell(R, "roadmap", `
<div class="lesson">${outline(R, PHASES[0], s.id)}<article class="lesson-main">
${crumbs(R, [["Roadmap", ""], ["Phase 0", PHASES[0].url], [s.id, ""]])}
<header class="lesson-head"><div class="lh-tags"><span class="lid big">${s.id}</span><span class="pill">Setup step ${i + 1} of ${SETUP.length}</span><span class="done-badge" data-lab="${s.id}">${icon("check")}Completed</span></div><h1>${esc(s.title)}</h1></header>
<section class="lsec"><h2>${icon("target")}Why</h2><p>${md(s.why)}</p></section>
${s.code ? `<section class="lsec"><h2>${icon("play")}Do it</h2>${codeBlock(s.code)}</section>` : ""}
<div class="callout info">${icon("info")}<div><b>You should see.</b> ${md(s.expect)}</div></div>
<div class="complete-bar"><button class="btn primary" type="button" data-complete="${s.id}" data-label="step">${icon("check")}<span>Mark step complete</span></button></div>
<nav class="pager">${prev ? `<a class="prev" href="${R}setup/${prev.id.toLowerCase()}/">${icon("arrowL")}<span><small>Previous</small>${prev.id} · ${esc(prev.title)}</span></a>` : `<a class="prev" href="${R}${PHASES[0].url}">${icon("arrowL")}<span><small>Back</small>Phase 0 overview</span></a>`}
${next ? `<a class="next" href="${R}setup/${next.id.toLowerCase()}/"><span><small>Next</small>${next.id} · ${esc(next.title)}</span>${icon("arrowR")}</a>` : `<a class="next" href="${R}labs/${ORDER[0].toLowerCase()}/"><span><small>Next · Phase 1</small>${ORDER[0]} · ${esc(LAB[ORDER[0]].title)}</span>${icon("arrowR")}</a>`}</nav>
</article></div>`) });
});

// ---------------------------------------------------------------- study guide
const GUIDE = [["guide/", "How to use this roadmap"], ["guide/weekly-plan/", "Weekly plans"], ["guide/first-10-days/", "First 10 days"], ["guide/environments/", "Environments & cost"]];
const guidePage = (p, title, desc, inner) => add({ path: p, title, desc, pageKey: "guide", body: (R) => shell(R, "guide", `<div class="wrap">
<div class="page-head"><p class="eyebrow">Study guide</p><h1>${esc(title)}</h1>${desc ? `<p class="lead">${desc}</p>` : ""}</div>
<nav class="subnav" aria-label="Study guide">${GUIDE.map(([h, l]) => `<a href="${R}${h}"${h === p ? ' class="on" aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
${inner(R)}</div>`) });

guidePage("guide/", "How to use this roadmap", "Work through the phases in order. Inside a phase, do the labs top to bottom: each one builds on the labs before it.", (R) => `
<div class="split2">
<div class="card prose"><h3>${icon("map")} The structure</h3>
<ul><li><b>Phases</b> are stages of the journey (Setup → Foundations → Practitioner → Senior → Capstone). Each has a goal and a checkpoint.</li>
<li><b>Modules</b> group a phase's labs by topic, for example “GPU health and diagnostics”.</li>
<li><b>Labs</b> are 2–20 hour hands-on tasks with commands, expected output, self-checks, fixes and an interview answer.</li>
<li><b>Concept primers</b> explain each of the 12 topics in five minutes. Read one before a topic's first lab.</li></ul></div>
<div class="card prose"><h3>${icon("target")} Who this is for</h3>${OV.notes[0].html}</div>
</div>
<h2>A session, start to finish</h2>
<ol class="loop">${[["Pick", "Open the roadmap; “Continue” takes you to your next unfinished lab."], ["Read", "Why it matters, what done looks like, the primer if the topic is new."], ["Bring up", "Create the environment on the lab. Note the time."], ["Run", "Copy each block. Write surprises into notes/<lab>.md."], ["Check", "Compare with “You should see”. Tick each self-check."], ["Fix", "“If it breaks”, then the debug ladder."], ["Commit", "Scripts, results, notes. Push."], ["Tear down", "terraform destroy, labdown. Then say the interview answer out loud."]].map(([a, b], i) => `<li><span>${i + 1}</span><b>${a}</b><p>${esc(b)}</p></li>`).join("")}</ol>
<h2>Insights that shape the path</h2>
<div class="grid3">
<div class="card"><h3>${icon("dollar")} Practise cheap first</h3><p>Every expensive lab has a free rehearsal: Soft-RoCE before EFA, Redfish mockups before real BMCs, Slurm in Docker and KWOK fake GPUs before real clusters. Rent big hardware only to measure.</p></div>
<div class="card"><h3>${icon("list")} Evidence over reading</h3><p>Each lab ends with an artifact in your repo: a script, a report, a plot. Fifty small artifacts are more convincing than any certificate.</p></div>
<div class="card"><h3>${icon("bug")} Collect failures</h3><p>Write every failure down as symptom, cause, fix. Interviewers for infrastructure roles ask for debugging stories more than anything else.</p></div>
</div>
<div class="split2">
<div class="card prose"><h3>${icon("server")} ${esc(OV.notes[1].title)}</h3>${OV.notes[1].html}</div>
<div class="card prose"><h3>${icon("chat")} Advice from a practitioner</h3>${OV.notes[2].html.replace(/\b([A-L]\d)\b/g, (x) => LAB[x] ? `<a href="${R}labs/${x.toLowerCase()}/">${x}</a>` : x)}</div>
</div>
<div class="callout warn">${icon("alert")}<div><b>Honest notes.</b> Commands follow each project's documented usage and were checked against current releases (October 2026), but they have not been run on your machine. Release tags, Helm values and package names change; where a step says “check the README / --help”, do that. Cloud prices are rough: check the current spot price and always destroy what you create.</div></div>`);

guidePage("guide/weekly-plan/", "Weekly plans", "Two ready-made schedules. Weeks break at phase boundaries, so each week stays on one stage of the roadmap.", (R) => `
${PLANS.map((p) => `<section class="plan" id="${p.key}"><div class="sec-head"><div><h2>${esc(p.name)}</h2><p class="muted">${esc(p.who)} ${p.ids.length} labs, ${hrs(p.ids)} hours, about ${p.cap} hours a week: ${p.weeks.length - 1} weeks plus a setup week.</p></div></div>
<div class="tscroll"><table class="sched"><thead><tr><th>Week</th><th>Phase</th><th>Labs</th><th>Hours</th></tr></thead><tbody>
${p.weeks.map((w) => `<tr><td><b>${w.n === 0 ? "0" : w.n}</b></td><td>${phaseBadge(w.phase)} ${esc(w.phase.short)}</td><td>${w.setup ? `<a class="tchip" href="${R}${PHASES[0].url}"><span class="lid">S1–S11</span>Set up your lab</a>` : w.ids.map((t) => `<a class="tchip" data-lab="${t}" href="${R}labs/${t.toLowerCase()}/"><span class="lid">${t}</span>${esc(LAB[t].title)}</a>`).join("")}</td><td>${w.setup ? "3–4" : w.h}</td></tr>`).join("")}
</tbody></table></div></section>`).join("")}
<div class="callout">${icon("info")}<div>Hours are estimates for a first attempt and include reading and write-up. Group the multi-node labs (environment G2N) and rented-GPU labs (R) into the same sessions to save money.</div></div>`);

guidePage("guide/first-10-days/", "Your first 10 days", "From an empty laptop to your first GPU diagnostics report. After day 10, continue down Phase 1 in order.", (R) => `
<ol class="days">${TEN.map((t) => `<li><span class="day">${esc(t.day)}</span><div><b>${linkIds(t.labs, R)}</b><p>${esc(t.outcome)}</p></div><span class="chip">${icon("clock")}${esc(t.time)}</span></li>`).join("")}</ol>
<p><a class="btn primary" href="${R}${PHASES[1].url}">${icon("play")}Go to Phase 1: Foundations</a></p>`);

guidePage("guide/environments/", "Environments and cost", "Every lab is tagged with a code that says where it runs. Most of the path runs on a laptop or one cheap spot GPU.", (R) => `
<div class="envgrid">${ENVS.map((e) => { const ids = ORDER.filter((id) => LAB[id].env === e.code); return `<div class="card env"><span class="chip big">${e.code}</span><h3>${esc(e.name)}</h3><p><b>Rough cost:</b> ${esc(e.cost)}</p><p class="muted">${esc(e.use)}</p><p class="small"><b>${ids.length} labs:</b> ${ids.map((id) => `<a href="${R}labs/${id.toLowerCase()}/">${id}</a>`).join(" ")}</p></div>`; }).join("")}</div>
<div class="callout">${icon("dollar")}<div>If you keep to spot instances and destroy after each session, the full path costs a few hundred dollars. Most of that is the multi-node (G2N) and rented (R) sessions. The budget alarm from <a href="${R}setup/s2/">S2</a> and the <code>labdown</code> check from <a href="${R}setup/s10/">S10</a> are what keep it there.</div></div>`);

// ---------------------------------------------------------------- labs catalog
add({ path: "labs/", title: "All labs", desc: `${ORDER.length} hands-on GPU infrastructure labs, filterable by phase, topic and environment.`, pageKey: "catalog", body: (R) => shell(R, "labs", `<div class="wrap">
<div class="page-head"><p class="eyebrow">Labs</p><h1>All ${ORDER.length} labs</h1><p class="lead">In roadmap order. Filter by phase, topic or where it runs, or search for a tool.</p>${prog(ORDER, "labs")}</div>
<div class="filters" data-filters>
<input type="search" data-f-q placeholder="Search: nccl, redfish, slurm, efa…" aria-label="Search labs">
<select data-f-phase aria-label="Phase"><option value="all">All phases</option>${PHASES.slice(1).map((p) => `<option value="${p.num}">Phase ${p.num} · ${esc(p.short)}</option>`).join("")}</select>
<select data-f-domain aria-label="Topic"><option value="all">All topics</option>${DOMAINS.map((d) => `<option value="${d.key}">${d.key} · ${esc(d.name)}</option>`).join("")}</select>
<select data-f-env aria-label="Environment"><option value="all">Any environment</option>${ENVS.map((e) => `<option value="${e.code}">${e.code} · ${esc(e.name.split(" (")[0])}</option>`).join("")}</select>
<select data-f-status aria-label="Status"><option value="all">Any status</option><option value="todo">Not done</option><option value="done">Done</option></select>
<label class="check"><input type="checkbox" data-f-core> Core path only</label>
</div>
<p class="small muted" data-f-count aria-live="polite"></p>
${PHASES.slice(1).map((ph) => `<section class="cat-phase" data-cat-phase><h2>${phaseBadge(ph)} Phase ${ph.num} · ${esc(ph.name)}</h2>
<ol class="lrows">${ph.ids.map((id) => labRow(R, id).replace('<li class="lrow"', `<li class="lrow" data-phase="${ph.num}" data-domain="${LAB[id].m.domain}" data-env="${LAB[id].env}" data-core="${LAB[id].m.core ? 1 : 0}" data-text="${esc((id + " " + LAB[id].title + " " + DOM[LAB[id].m.domain].name + " " + LAB[id].goal + " " + LAB[id].m.repos.map((r) => r.name).join(" ")).toLowerCase())}"`)).join("")}</ol></section>`).join("")}
<p class="empty" data-f-empty hidden>No lab matches these filters.</p></div>`) });

// ---------------------------------------------------------------- concepts
add({ path: "concepts/", title: "Concepts", desc: "Five-minute primers on the twelve topics of GPU infrastructure.", pageKey: "concepts", body: (R) => shell(R, "concepts", `<div class="wrap">
<div class="page-head"><p class="eyebrow">Concepts</p><h1>Twelve topics, five minutes each</h1><p class="lead">Each primer gives you the key ideas, the common mistakes and what interviewers probe, then links to the labs where you practise it. Read one before a topic's first lab.</p></div>
<div class="cgrid">${DOMAINS.map((d) => { const ids = ORDER.filter((id) => LAB[id].m.domain === d.key); return `<a class="ccard dom-${d.key}" href="${R}concepts/${DOM[d.key].slug}/"><span class="ck">${d.key}</span><h3>${esc(d.name)}</h3><p>${esc(PRIMERS[d.key].summary)}</p><small>${ids.length} labs · phases ${[...new Set(ids.map((i) => PHASE_OF[i].num))].join(", ")}</small></a>`; }).join("")}</div>
<p><a href="${R}resources/glossary/">${icon("book")}Looking for a single term? Use the glossary.</a></p></div>`) });

DOMAINS.forEach((d0, i) => {
  const d = DOM[d0.key], P = PRIMERS[d.key];
  const ids = ORDER.filter((id) => LAB[id].m.domain === d.key);
  const reqs = COVERAGE.rows.filter((r) => r.tasks.some((t) => ids.includes(t)));
  const prevD = DOMAINS[i - 1], nextD = DOMAINS[i + 1];
  const terms = GLOSSARY.filter((g) => g[2] && LAB[g[2]]?.m.domain === d.key);
  add({ path: `concepts/${d.slug}/`, title: d.name, desc: P.summary, pageKey: "concept", body: (R) => shell(R, "concepts", `<div class="wrap narrowish">
${crumbs(R, [["Concepts", "concepts/"], [d.name, ""]])}
<div class="page-head concept-head dom-${d.key}"><span class="ck big">${d.key}</span><div><p class="eyebrow">Concept primer</p><h1>${esc(d.name)}</h1><p class="lead">${esc(P.summary)}</p></div></div>
<div class="concept-grid"><div>
<h2>${icon("bulb")}Key ideas</h2><ol class="ideas">${P.ideas.map((x) => `<li>${md(x)}</li>`).join("")}</ol>
<h2>${icon("alert")}Common mistakes</h2><ul class="pitfalls">${P.pitfalls.map((x) => `<li>${md(x)}</li>`).join("")}</ul>
<h2>${icon("chat")}What interviewers probe</h2><blockquote class="probe">${esc(P.probe)}</blockquote>
<h2>${icon("flask")}Practise it</h2><ol class="lrows">${ids.map((id) => labRow(R, id).replace('<span class="lr-meta">', `<span class="lr-meta"><span class="pill">Phase ${PHASE_OF[id].num}</span>`)).join("")}</ol>
</div><aside>
${reqs.length ? `<div class="card"><h3>In the job posting</h3><ul class="plain small">${reqs.map((r) => `<li>${esc(r.requirement)}</li>`).join("")}</ul></div>` : ""}
${terms.length ? `<div class="card"><h3>Terms</h3><dl class="mini-gloss">${terms.map((g) => `<dt>${esc(g[0])}</dt><dd>${md(g[1])}</dd>`).join("")}</dl></div>` : ""}
</aside></div>
<nav class="pager">${prevD ? `<a class="prev" href="${R}concepts/${DOM[prevD.key].slug}/">${icon("arrowL")}<span><small>Previous topic</small>${prevD.key} · ${esc(prevD.name)}</span></a>` : `<a class="prev" href="${R}concepts/">${icon("arrowL")}<span><small>Back</small>All concepts</span></a>`}
${nextD ? `<a class="next" href="${R}concepts/${DOM[nextD.key].slug}/"><span><small>Next topic</small>${nextD.key} · ${esc(nextD.name)}</span>${icon("arrowR")}</a>` : `<a class="next" href="${R}concepts/"><span><small>Back to</small>All concepts</span>${icon("arrowR")}</a>`}</nav>
</div>`) });
});

// ---------------------------------------------------------------- interview
add({ path: "interview/", title: "Interview bank", desc: "Interview questions for GPU infrastructure roles, with answers grounded in the labs.", pageKey: "interview", body: (R) => shell(R, "interview", `<div class="wrap narrowish">
<div class="page-head"><p class="eyebrow">Interview</p><h1>Interview bank</h1><p class="lead">${esc(RES.interview.lead)} Answer out loud first, then open the answer.</p></div>
<h2>Short answers to know cold</h2>
<div class="spines">${RES.interview.spines.map((s) => `<div class="card"><h3>${esc(s.title)}</h3><p>${esc(s.answer)}</p></div>`).join("")}</div>
<h2>What interviewers probe, by topic</h2>
<ul class="probes">${DOMAINS.map((d) => `<li><a class="dtag dom-${d.key}" href="${R}concepts/${DOM[d.key].slug}/"><b>${d.key}</b>${esc(d.name)}</a><span>${esc(PRIMERS[d.key].probe)}</span></li>`).join("")}</ul>
<h2>One question per lab</h2>
${PHASES.slice(1).map((ph) => `<h3 class="qhead">${phaseBadge(ph)} Phase ${ph.num} · ${esc(ph.name)}</h3><div class="qlist">${ph.ids.map((id) => `<details class="ans"><summary><span class="lid">${id}</span>${esc(LAB[id].m.question)}</summary><p>${md(LAB[id].interview)}</p><p class="small"><a href="${R}labs/${id.toLowerCase()}/">Open lab ${id} →</a></p></details>`).join("")}</div>`).join("")}
</div>`) });

// ---------------------------------------------------------------- role
const ROLE = [["role/", "Job posting"], ["role/coverage/", "Requirement → lab map"]];
const roleNav = (R, on) => `<nav class="subnav" aria-label="The role">${ROLE.map(([h, l]) => `<a href="${R}${h}"${h === on ? ' class="on" aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
add({ path: "role/", title: JD.title, desc: `The NVIDIA ${JD.title} posting this roadmap is built around, verbatim.`, pageKey: "role", body: (R) => shell(R, "role", `<div class="wrap">
<div class="page-head"><p class="eyebrow">The role · NVIDIA · ${esc(JD.department)}</p><h1>${esc(JD.title)}</h1><p class="lead">The posting this roadmap is built around, copied verbatim. Use it to see why each lab exists.</p></div>${roleNav(R, "role/")}
<div class="role-grid"><article class="jd prose card">${JD.description_html}</article>
<aside class="side-sticky"><div class="card"><h3>Posting details</h3><dl class="kv">
<dt>Job ID</dt><dd>${esc(JD.job_id)}</dd><dt>Locations</dt><dd>${JD.locations.map(esc).join("<br>")}</dd>
<dt>Type</dt><dd>${esc(JD.time_type)} · ${esc(JD.job_type)}</dd>
<dt>Captured</dt><dd>${esc(JD.fetched)}</dd></dl>
<p><a class="btn primary block" href="${esc(JD.source_url)}" target="_blank" rel="noopener">Open on NVIDIA careers ${icon("external")}</a></p>
<p class="small muted">The posting said applications would be accepted at least until August 30, 2026. Check the live page to see whether it is still open; similar roles are posted regularly.</p></div>
<div class="card"><h3>How the roadmap covers it</h3><p class="small">${COVERAGE.rows.length} requirements, each mapped to the labs that give you evidence for it.</p><p><a class="btn block" href="${R}role/coverage/">See the map</a></p></div></aside></div></div>`) });
add({ path: "role/coverage/", title: "Requirement → lab map", desc: "Each requirement in the posting and the labs that prove it.", pageKey: "role", body: (R) => shell(R, "role", `<div class="wrap">
<div class="page-head"><p class="eyebrow">The role</p><h1>Requirement → lab map</h1><p class="lead">${esc(COVERAGE.lead)}</p></div>${roleNav(R, "role/coverage/")}
<div class="covlist">${COVERAGE.rows.map((r) => `<div class="covrow card"><div><h3>${esc(r.requirement)}</h3>${prog(r.tasks, "labs")}</div><div class="covlabs">${r.tasks.map((t) => `<a class="tchip" data-lab="${t}" href="${R}labs/${t.toLowerCase()}/"><span class="lid">${t}</span>${esc(LAB[t].title)}</a>`).join("")}</div></div>`).join("")}</div></div>`) });

// ---------------------------------------------------------------- resources
const RESN = [["resources/", "Overview"], ["resources/hidden-gems/", "Hidden gems"], ["resources/reading/", "Reading"], ["resources/certifications/", "Certifications"], ["resources/troubleshooting/", "When you're stuck"], ["resources/glossary/", "Glossary"]];
const resPage = (p, title, lead, inner) => add({ path: p, title, desc: lead, pageKey: "resources", body: (R) => shell(R, "resources", `<div class="wrap">
<div class="page-head"><p class="eyebrow">Resources</p><h1>${esc(title)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ""}</div>
<nav class="subnav" aria-label="Resources">${RESN.map(([h, l]) => `<a href="${R}${h}"${h === p ? ' class="on" aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
${inner(R)}</div>`) });
resPage("resources/", "Resources", "Everything that supports the labs, in one place.", (R) => `<div class="grid3">${[
  ["resources/hidden-gems/", "gem", "Hidden gems", RES.gems.lead],
  ["resources/reading/", "book", "Reading and free courses", RES.reading.lead],
  ["resources/certifications/", "cert", "Certifications", "NCP-AII, NCA-AIIO and CKS: what they cover and when to book."],
  ["resources/troubleshooting/", "bug", "When you're stuck", "The debug ladder: one fixed order of checks for any failed lab."],
  ["resources/glossary/", "list", "Glossary", `${GLOSSARY.length} terms from XID to KV cache, each linked to the lab that teaches it.`],
  ["interview/", "chat", "Interview bank", RES.interview.lead]].map(([h, ic, t, d]) => `<a class="card link" href="${R}${h}"><h3>${icon(ic)} ${t}</h3><p>${esc(d)}</p><span class="more">Open ${icon("arrowR")}</span></a>`).join("")}</div>`);
resPage("resources/hidden-gems/", "Hidden gems", RES.gems.lead, (R) => `<div class="gemgrid">${RES.gems.items.map((g) => `<div class="card"><h3><a href="${esc(g.url)}" target="_blank" rel="noopener">${esc(g.name)} ${icon("external")}</a></h3><p>${esc(g.why)}</p><p class="small muted">Used in ${linkIds(g.tasks, R)}</p></div>`).join("")}</div>`);
resPage("resources/reading/", "Reading and free courses", RES.reading.lead, () => `<ul class="readlist">${RES.reading.items.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)} ${icon("external")}</a><span>${esc(r.why)}</span></li>`).join("")}</ul>${RES.reading.extra.map((x) => `<div class="card prose"><h3>${esc(x.title)}</h3>${x.html}</div>`).join("")}`);
resPage("resources/certifications/", "Certifications", "Optional, but useful as a forcing function. Book an exam date once you are halfway through Phase 2.", () => `<div class="notegrid">${RES.certifications.map((c) => `<div class="card prose"><h3>${esc(c.title)}</h3>${c.html}</div>`).join("")}</div>`);
resPage("resources/troubleshooting/", "When you're stuck", "Use the same order of checks for every failed lab.", () => `<ol class="ladder">${DEBUG.map((d) => `<li><b>${esc(d.step.replace(/^\d+\.\s*/, ""))}</b><p>${md(d.text)}</p></li>`).join("")}</ol>
<div class="callout">${icon("info")}<div>Write every failure down in <code>notes/&lt;lab&gt;.md</code> as symptom, cause, fix. After 50 labs you'll have dozens of real debugging stories, which is what interviewers ask for.</div></div>`);
resPage("resources/glossary/", "Glossary", "Short definitions. Each term links to the lab where you meet it first.", (R) => `
<input type="search" class="gfilter" data-gfilter placeholder="Filter terms…" aria-label="Filter glossary">
<dl class="gloss">${GLOSSARY.map(([t, def, lab]) => `<div data-term="${esc((t + " " + def).toLowerCase())}"><dt id="${slug(t)}">${esc(t)}</dt><dd>${md(def)}${lab && LAB[lab] ? ` <a class="small" href="${R}labs/${lab.toLowerCase()}/">Lab ${lab} →</a>` : ""}</dd></div>`).join("")}</dl>`);

// ---------------------------------------------------------------- about
add({ path: "about/", title: "About and sources", desc: "Where the content comes from and how it was checked.", pageKey: "about", body: (R) => shell(R, "", `<div class="wrap narrow">
<div class="page-head"><p class="eyebrow">About</p><h1>About this roadmap</h1></div><div class="prose">
<p>This is a free, open learning roadmap for GPU and AI infrastructure. It combines three sources: NVIDIA's <a href="${R}role/">${esc(JD.title)}</a> posting (${esc(JD.job_id)}, captured verbatim on ${esc(JD.fetched)}), the <b>GPU Bring-Up Field Manual</b> (what to learn: 50 tasks with verified repositories and docs) and the <b>GPU Lab Playbook</b> (how to do it: environments, commands, checks and fixes). Lab IDs (A1 … L2) are the same everywhere.</p>
<h2>${esc(OV.notes[3].title)}</h2>${OV.notes[3].html}
<h2>Honest notes</h2><p>The lab commands follow each project's documented usage but have not been run on your machine. Release tags and Helm values change; where a step says “check the README / --help”, do that. Cloud prices are rough estimates.</p>
<h2>Your data</h2><p>There are no accounts, cookies or analytics. Lab progress, self-check ticks and the theme choice are stored in your browser's local storage and never leave your device. Clearing site data resets them.</p>
<h2>Contribute</h2><p>Spotted an outdated command or a broken link? Open an issue or pull request on <a href="${SITE.repo}" target="_blank" rel="noopener">GitHub</a>. All content lives in plain JSON under <code>content/</code>.</p>
<p class="muted">${esc(OV.footer)}</p>
</div></div>`) });

// ---------------------------------------------------------------- search
const searchIndex = (R) => JSON.stringify([
  ...PHASES.map((ph) => ({ k: "Phase", t: `Phase ${ph.num}: ${ph.name}`, u: R + ph.url, x: ph.goal })),
  ...ORDER.map((id) => ({ k: "Lab", t: `${id} · ${LAB[id].title}`, u: R + labUrl(id), x: `${LAB[id].goal} ${DOM[LAB[id].m.domain].name} ${LAB[id].m.repos.map((r) => r.name).join(" ")} ${LAB[id].steps.map((s) => s.code || "").join(" ").slice(0, 600)}` })),
  ...SETUP.map((s) => ({ k: "Setup", t: `${s.id} · ${s.title}`, u: R + labUrl(s.id), x: plainText(md(s.why)) })),
  ...DOMAINS.map((d) => ({ k: "Concept", t: d.name, u: `${R}concepts/${DOM[d.key].slug}/`, x: `${PRIMERS[d.key].summary} ${PRIMERS[d.key].ideas.join(" ")}` })),
  ...GLOSSARY.map(([t, def]) => ({ k: "Term", t, u: `${R}resources/glossary/#${slug(t)}`, x: def })),
]).replace(/</g, "\\u003c");
add({ path: "search/", title: "Search", desc: "Search labs, concepts and terms.", pageKey: "search", body: (R) => shell(R, "", `<div class="wrap narrow">
<div class="page-head"><h1>Search</h1></div>
<script type="application/json" id="search-index">${searchIndex(R)}</script>
<input type="search" class="bigsearch" data-search placeholder="Try: xid, nccl, redfish, kueue, kv cache…" aria-label="Search the site" autofocus>
<p class="small muted" data-search-count aria-live="polite"></p>
<ol class="results" data-search-results></ol></div>`) });

// ---------------------------------------------------------------- redirects for old URLs
const REDIRECTS = { "dashboard/": "", "login/": "", "path/": "", "path/schedule/": "guide/weekly-plan/", "courses/": "concepts/", "setup/": PHASES[0].url, "setup/environments/": "guide/environments/", "setup/first-10-days/": "guide/first-10-days/", "resources/interview/": "interview/" };

// ---------------------------------------------------------------- write
const t0 = Date.now();
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(ROOT, "src", "assets"), path.join(OUT, "assets"), { recursive: true });
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
const relRoot = (p) => { const n = p ? p.split("/").filter(Boolean).length : 0; return n ? "../".repeat(n) : "./"; };
for (const p of pages) {
  const R = relRoot(p.path);
  const dir = path.join(OUT, p.path);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), page(R, p, p.body(R)));
}
for (const [from, to] of Object.entries(REDIRECTS)) {
  const R = relRoot(from), dir = path.join(OUT, from);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), `<!doctype html><meta charset="utf-8"><title>Moved</title><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=${R}${to}"><link rel="canonical" href="${R}${to}"><p>This page moved to <a href="${R}${to}">${R}${to}</a>.</p>`);
}
// lab IDs in old /labs/<id>/ URLs still exist; any other unknown path gets a friendly 404
fs.writeFileSync(path.join(OUT, "404.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found · ${SITE.name}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:#0f172a;color:#e2e8f0;text-align:center;padding:20px}a{color:#a3e635}</style></head>
<body><div><h1>Page not found</h1><p>The page moved or never existed.</p><p><a id="home" href="/">Go to the roadmap</a></p></div>
<script>var s=location.pathname.split("/").filter(Boolean);document.getElementById("home").href=location.hostname.endsWith("github.io")&&s.length?"/"+s[0]+"/":"/";</script></body></html>`);
fs.writeFileSync(path.join(OUT, "robots.txt"), "User-agent: *\nAllow: /\n");
console.log(`Built ${pages.length} pages + ${Object.keys(REDIRECTS).length} redirects in ${Date.now() - t0} ms -> dist/`);
