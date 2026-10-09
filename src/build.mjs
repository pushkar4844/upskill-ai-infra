#!/usr/bin/env node
// Static site generator for Upskill AI Infra. No dependencies: Node 20+.
//   node src/build.mjs            -> dist/
// Users come from env SITE_USERS="user:pass;user2:pass2" or users.local.json (git-ignored).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { esc, md, slug, linkRefs, icon, LEVELS, MANUAL_LEVEL, LEVEL_KEY } from "./lib/util.mjs";
import { header, footer, crumbs, protectedPage, publicPage, SITE } from "./lib/layout.mjs";
import { newContentKey, encryptText, buildKeyring, parseUsers } from "./lib/crypto.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "dist");
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, "content", p), "utf8"));

// ---------------------------------------------------------------- content
const JD = J("role/jd-JR2012776.json");
const OV = J("manual/overview.json");
const DOMAINS = J("manual/domains.json");
const TASKS = J("manual/tasks.json");
const COVERAGE = J("manual/coverage.json");
const SCHEDULE = J("manual/schedule.json");
const RES = J("manual/resources.json");
const ENVS = J("playbook/environments.json");
const SETUP = J("playbook/setup.json");
const TEN = J("playbook/first-ten-days.json");
const DEBUG = J("playbook/debug-ladder.json");
const LABS = J("playbook/labs.json");

const T = Object.fromEntries(TASKS.map((t) => [t.id, t]));
const ORDER = LABS.map((l) => l.id); // recommended order
const LAB = Object.fromEntries(LABS.map((l) => [l.id, { ...l, ...{ m: T[l.id] } }]));
const DOM = Object.fromEntries(DOMAINS.map((d) => [d.key, { ...d, slug: `${d.key.toLowerCase()}-${slug(d.name)}` }]));
const ENV = Object.fromEntries(ENVS.map((e) => [e.code, e]));
const LAB_IDS = new Set(ORDER), SETUP_IDS = new Set(SETUP.map((s) => s.id));
const WEEK_OF = {};
SCHEDULE.weeks.forEach((w) => w.tasks.forEach((t) => (WEEK_OF[t] = w)));
const COV_OF = {};
COVERAGE.rows.forEach((r) => r.tasks.forEach((t) => (COV_OF[t] ||= []).push(r.requirement)));
const byLevel = (lv) => ORDER.filter((id) => LAB[id].level === lv);
const byDomain = (k) => ORDER.filter((id) => LAB[id].m.domain === k);
const hrs = (ids) => ids.reduce((a, id) => a + LAB[id].hours, 0);
for (const id of ORDER) if (!T[id]) throw new Error("manual task missing for " + id);

// ---------------------------------------------------------------- page registry
const pages = []; // {path, title, page, section, public, body(R)}
const add = (p) => pages.push(p);

// small components
const lvlPill = (lv) => `<span class="pill lv-${LEVEL_KEY[lv]}">${lv}</span>`;
const envChip = (code) => `<span class="chip env" title="${esc(ENV[code].name)}">${icon("server")}${code}</span>`;
const prog = (ids, label = "") => `<div class="progress" data-prog="${ids.join(",")}"><div class="bar"><span></span></div><small data-prog-text>0 / ${ids.length}${label}</small></div>`;
const labCard = (R, id) => {
  const l = LAB[id], d = DOM[l.m.domain];
  return `<a class="lcard" href="${R}labs/${id.toLowerCase()}/" data-lab="${id}" data-level="${l.level}" data-domain="${d.key}" data-env="${l.env}" data-core="${l.m.core ? 1 : 0}" data-text="${esc((id + " " + l.title + " " + d.name + " " + l.goal + " " + l.m.repos.map((r) => r.name).join(" ")).toLowerCase())}">
<div class="lc-top"><span class="lid">${id}</span>${lvlPill(l.level)}${l.m.core ? '<span class="pill core">Core</span>' : ""}<span class="done-badge">${icon("check")}Done</span></div>
<h3>${esc(l.title)}</h3><p>${esc(l.goal)}</p>
<div class="lc-meta"><span>${icon("book")}${esc(d.name)}</span><span>${icon("clock")}${l.hours} h</span>${envChip(l.env)}</div></a>`;
};
const courseCard = (R, d) => {
  const ids = byDomain(d.key);
  const lv = [...new Set(ids.map((i) => LAB[i].level))];
  return `<a class="ccard dom-${d.key}" href="${R}courses/${d.slug}/"><div class="cc-band"><span class="cc-key">${d.key}</span><span class="cc-count">${ids.length} labs · ${hrs(ids)} h</span></div>
<div class="cc-body"><h3>${esc(d.name)}</h3><div class="cc-lv">${lv.map(lvlPill).join("")}</div>${prog(ids)}</div></a>`;
};
const codeBlock = (c) => `<div class="code"><button class="copy" type="button" data-copy>Copy</button><pre><code>${esc(c)}</code></pre></div>`;
const shell = (R, section, inner) => header(R, section) + `<main id="main">${inner}</main>` + footer(R);

// ---------------------------------------------------------------- public: landing + login
const LANDING = (R) => `
<header class="top public"><div class="top-in">
<a class="brand" href="${R}"><span class="logo">${icon("server")}</span><span class="bname">Upskill<b>AI Infra</b></span></a>
<div class="tools"><button class="iconbtn" type="button" data-theme-toggle aria-label="Toggle dark mode">${icon("moon")}</button><a class="btn primary sm" href="${R}login/">${icon("lock")}Sign in</a></div></div></header>
<main id="main">
<section class="hero"><div class="wrap hero-in">
<div class="hero-copy"><p class="eyebrow">Private study track</p>
<h1>Learn GPU infrastructure by <span class="hl">bringing it up yourself</span>.</h1>
<p class="lead">A hands-on path from an empty laptop to a GPU cluster validation kit, built around the NVIDIA <b>Solutions Architect, Infrastructure</b> role. Every lab tells you where to run it, what to type, what you should see, and what to say in the interview.</p>
<div class="actions"><a class="btn primary lg" href="${R}login/">${icon("play")}Start learning</a><a class="btn ghost lg" href="#how">How it works</a></div>
<ul class="hero-stats"><li><b>${LABS.length}</b><span>guided labs</span></li><li><b>${DOMAINS.length}</b><span>courses</span></li><li><b>${hrs(ORDER)} h</b><span>full path</span></li><li><b>${SCHEDULE.weeks.length}</b><span>weeks plan</span></li></ul></div>
<div class="hero-art" aria-hidden="true"><div class="term"><div class="term-bar"><i></i><i></i><i></i><span>lab-gpu · ssm</span></div>
<pre><span class="p">$</span> terraform apply -var instance_type=g4dn.12xlarge
<span class="g">Apply complete! Resources: 6 added.</span>
<span class="p">$</span> dcgmi diag -r 3 -j &gt; r3.json
<span class="g">Diagnostic ......... Pass</span>
<span class="p">$</span> ./build/all_reduce_perf -b 8 -e 4G -f 2 -g 4
<span class="m">#  Avg bus bandwidth    :</span> <span class="g">measured ✓</span>
<span class="p">$</span> labdown
<span class="m">Nothing running. No bill.</span></pre></div></div>
</div></section>
<section class="wrap band" id="how"><h2 class="center">How it works</h2>
<div class="grid4">
<div class="feat">${icon("tool", "i fi")}<h3>Set up once</h3><p>Day-0 guide: WSL2, Docker, Kubernetes CLIs, a guarded AWS sandbox, Terraform templates and a nightly teardown habit.</p></div>
<div class="feat">${icon("flask", "i fi")}<h3>Do the lab</h3><p>Copy-paste steps, the output you should see, self-checks and an "if it breaks" table for every lab.</p></div>
<div class="feat">${icon("brief", "i fi")}<h3>Mapped to the JD</h3><p>Each requirement in the posting points to the labs that prove it. Nothing is filler.</p></div>
<div class="feat">${icon("chat", "i fi")}<h3>Say it in interviews</h3><p>Every lab ends with an answer you can now give, plus an interview bank and certification notes.</p></div>
</div></section>
<section class="wrap band"><h2 class="center">Three tracks, one path</h2>
<div class="grid3">${LEVELS.map((lv) => `<div class="track tr-${LEVEL_KEY[lv]}"><p class="eyebrow">${lv} · ${MANUAL_LEVEL[lv]}</p><h3>${byLevel(lv).length} labs · ${hrs(byLevel(lv))} h</h3><p>${{ Beginner: "Every layer once: Linux triage, XIDs, DCGM, Redfish, RDMA, NCCL, Slurm, GPU Operator.", Intermediate: "Go deep per layer: EFA, burn-in, NUMA, PCIe, OpenBMC, MIG, schedulers, metrics, MFU.", Senior: "Design and own it: acceptance runbooks, fabrics, remediation, operators, rollout plans, capstone." }[lv]}</p></div>`).join("")}</div></section>
<section class="wrap band"><h2 class="center">Courses</h2><div class="pubcourses">${DOMAINS.map((d) => `<div class="pubc dom-${d.key}"><span>${d.key}</span>${esc(d.name)}</div>`).join("")}</div>
<p class="center"><a class="btn primary" href="${R}login/">${icon("lock")}Sign in to open the labs</a></p></section>
</main>
<footer class="foot"><div class="wrap foot-in"><div><b>${SITE.name}</b><p>Private study site. Content is encrypted; sign in to read it.</p></div></div></footer>`;
add({ path: "", title: "Hands-on GPU infrastructure", page: "landing", public: true, body: LANDING });

add({ path: "login/", title: "Sign in", page: "login", public: true, body: (R) => `
<main id="main" class="login-wrap"><div class="login-card">
<a class="brand" href="${R}"><span class="logo">${icon("server")}</span><span class="bname">Upskill<b>AI Infra</b></span></a>
<h1>Sign in</h1><p class="muted">Content on this site is encrypted. Your username and password unlock it in this browser.</p>
<form id="login-form" autocomplete="on">
<label for="u">Username</label><input id="u" name="username" autocomplete="username" required autocapitalize="none" spellcheck="false">
<label for="p">Password</label><div class="pw"><input id="p" name="password" type="password" autocomplete="current-password" required><button type="button" class="link" data-reveal>Show</button></div>
<label class="check"><input type="checkbox" id="remember"> Keep me signed in on this device</label>
<button class="btn primary block" type="submit" id="login-btn">${icon("lock")}Unlock</button>
<p class="err" id="login-err" role="alert" hidden></p></form>
<p class="small muted">Lost access? The site owner can add or reset users and redeploy. See <code>docs/AUTH.md</code> in the repository.</p>
</div></main>` });

// ---------------------------------------------------------------- dashboard
const indexJson = JSON.stringify(ORDER.map((id) => ({ id, t: LAB[id].title, lv: LAB[id].level, d: LAB[id].m.domain, h: LAB[id].hours })));
const schedJson = JSON.stringify({ start: SCHEDULE.start_date, weeks: SCHEDULE.weeks });
add({ path: "dashboard/", title: "Dashboard", page: "dashboard", section: "dashboard", body: (R) => shell(R, "dashboard", `
<script type="application/json" id="labindex">${indexJson}</script>
<script type="application/json" id="schedule">${schedJson}</script>
<section class="dash-hero"><div class="wrap dh-in">
<div><p class="eyebrow">Welcome back</p><h1>Your AI infrastructure path</h1>
<p class="lead">${esc(OV.lead_html.replace(/<[^>]+>/g, ""))}</p>
<div class="actions"><a class="btn primary lg" data-continue href="${R}labs/${ORDER[0].toLowerCase()}/">${icon("play")}<span>Start with ${ORDER[0]}</span></a><a class="btn ghost lg" href="${R}setup/">${icon("tool")}Lab setup</a></div></div>
<div class="ringbox"><div class="ring" data-ring="${ORDER.join(",")}"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="r-bg"/><circle cx="60" cy="60" r="52" class="r-fg"/></svg><div class="ring-txt"><b data-ring-pct>0%</b><span data-ring-count>0 of ${ORDER.length} labs</span></div></div></div>
</div></section>
<div class="wrap">
<section class="grid3 tracks-dash">${LEVELS.map((lv) => `<a class="track tr-${LEVEL_KEY[lv]}" href="${R}path/${LEVEL_KEY[lv]}/"><p class="eyebrow">${lv} track</p><h3>${byLevel(lv).length} labs · ${hrs(byLevel(lv))} h</h3>${prog(byLevel(lv))}</a>`).join("")}</section>
<section class="split">
<div class="panel"><h2>${icon("cal")}This week</h2><div data-week><p class="muted">Loading schedule…</p></div><p class="small"><a href="${R}path/schedule/">Full 22-week schedule →</a></p></div>
<div class="panel"><h2>${icon("tool")}Day-0 setup</h2>${prog(SETUP.map((s) => s.id), " steps")}<ul class="mini">${SETUP.slice(0, 6).map((s) => `<li data-lab="${s.id}"><a href="${R}setup/${s.id.toLowerCase()}/"><span class="lid">${s.id}</span>${esc(s.title)}</a></li>`).join("")}</ul><p class="small"><a href="${R}setup/">All ${SETUP.length} setup steps →</a></p></div>
</section>
<section><div class="sec-head"><h2>Courses</h2><a href="${R}courses/">View all →</a></div><div class="grid-courses">${DOMAINS.map((d) => courseCard(R, DOM[d.key])).join("")}</div></section>
<section class="split">
<div class="panel"><h2>${icon("brief")}The role</h2><p><b>${esc(JD.title)}</b> · ${esc(JD.job_id)}</p><p class="muted">${esc(JD.locations.join(" · "))}</p><p><a href="${R}role/">Read the full posting</a> · <a href="${R}role/coverage/">Requirement → lab map</a></p></div>
<div class="panel"><h2>${icon("star")}Keep handy</h2><ul class="mini plain"><li><a href="${R}resources/interview/">Interview bank</a></li><li><a href="${R}resources/hidden-gems/">Hidden gems</a></li><li><a href="${R}resources/troubleshooting/">When you're stuck</a></li><li><a href="${R}resources/certifications/">Certifications (NCP-AII)</a></li></ul></div>
</section></div>`) });

// ---------------------------------------------------------------- learning path
const pathNav = (R, on) => `<div class="tabs-nav">${[["path/", "Overview"], ["path/beginner/", "Beginner"], ["path/intermediate/", "Intermediate"], ["path/senior/", "Senior"], ["path/core/", "Core path"], ["path/schedule/", "22-week schedule"]].map(([h, l]) => `<a href="${R}${h}" class="${h === on ? "on" : ""}">${l}</a>`).join("")}</div>`;
add({ path: "path/", title: "Learning path", page: "path", section: "path", body: (R) => shell(R, "path", `<div class="wrap">
${crumbs(R, [["Dashboard", "dashboard/"], ["Learning path", ""]])}
<div class="page-head"><h1>Learning path</h1><p class="lead">${OV.time_html}</p></div>${pathNav(R, "path/")}
<div class="steps-flow">
<div class="flow-step"><span>0</span><div><h3><a href="${R}setup/">Day-0 lab setup</a></h3><p>${SETUP.length} steps, one evening. Laptop, AWS guard-rails, Terraform templates, teardown habit.</p></div></div>
${LEVELS.map((lv, i) => `<div class="flow-step tr-${LEVEL_KEY[lv]}"><span>${i + 1}</span><div><h3><a href="${R}path/${LEVEL_KEY[lv]}/">${lv} track</a> <small class="muted">(${MANUAL_LEVEL[lv]} in the field manual)</small></h3><p>${byLevel(lv).length} labs · ${hrs(byLevel(lv))} h</p>${prog(byLevel(lv))}</div></div>`).join("")}
</div>
<div class="callout">${icon("info")}<div><b>Two ways through.</b> The <a href="${R}path/core/">core path</a> (${ORDER.filter((i) => LAB[i].m.core).length} labs, ${hrs(ORDER.filter((i) => LAB[i].m.core))} h) covers every area of the posting for people working full time. The full path is all ${ORDER.length} labs. Labs run in the order shown in each track.</div></div>
<h2>Lab tiers, so cost stays low</h2>${OV.notes.find((n) => n.title.startsWith("Lab tiers"))?.html || ""}
</div>`) });

for (const lv of LEVELS) {
  const ids = byLevel(lv);
  add({ path: `path/${LEVEL_KEY[lv]}/`, title: `${lv} track`, page: "track", section: "path", body: (R) => shell(R, "path", `<div class="wrap">
${crumbs(R, [["Dashboard", "dashboard/"], ["Learning path", "path/"], [`${lv} track`, ""]])}
<div class="page-head"><p class="eyebrow">${MANUAL_LEVEL[lv]} in the field manual</p><h1>${lv} track</h1><p class="lead">${ids.length} labs · ${hrs(ids)} hours. Do them in this order.</p>${prog(ids)}</div>${pathNav(R, `path/${LEVEL_KEY[lv]}/`)}
<ol class="tracklist">${ids.map((id, i) => { const l = LAB[id]; return `<li data-lab="${id}"><span class="tl-n">${i + 1}</span><a href="${R}labs/${id.toLowerCase()}/"><span class="lid">${id}</span><b>${esc(l.title)}</b></a><span class="tl-meta">${esc(DOM[l.m.domain].name)} · ${l.hours} h · ${envChip(l.env)}${l.m.core ? ' <span class="pill core">Core</span>' : ""}</span><span class="done-badge">${icon("check")}</span></li>`; }).join("")}</ol>
</div>`) });
}
{
  const ids = ORDER.filter((i) => LAB[i].m.core);
  add({ path: "path/core/", title: "Core path", page: "track", section: "path", body: (R) => shell(R, "path", `<div class="wrap">
${crumbs(R, [["Dashboard", "dashboard/"], ["Learning path", "path/"], ["Core path", ""]])}
<div class="page-head"><h1>Core path</h1><p class="lead">${OV.time_html}</p>${prog(ids)}</div>${pathNav(R, "path/core/")}
<div class="grid-labs">${ids.map((id) => labCard(R, id)).join("")}</div></div>`) });
}
add({ path: "path/schedule/", title: "22-week schedule", page: "schedule", section: "path", body: (R) => shell(R, "path", `<div class="wrap">
${crumbs(R, [["Dashboard", "dashboard/"], ["Learning path", "path/"], ["Schedule", ""]])}
<div class="page-head"><h1>22-week schedule</h1><p class="lead">${esc(SCHEDULE.lead)}</p></div>${pathNav(R, "path/schedule/")}
<div class="tscroll"><table class="sched"><thead><tr><th>Week</th><th>Starts</th><th>Labs</th><th>Hours</th></tr></thead><tbody>
${SCHEDULE.weeks.map((w, i) => `<tr data-weekrow="${i}"><td><b>${w.week}</b></td><td>${w.starts}</td><td>${w.tasks.map((t) => `<a class="tchip" data-lab="${t}" href="${R}labs/${t.toLowerCase()}/"><span class="lid">${t}</span>${esc(LAB[t].title)}</a>`).join("")}</td><td>${w.hours}</td></tr>`).join("")}
</tbody></table></div></div>`) });

// ---------------------------------------------------------------- courses
add({ path: "courses/", title: "Courses", page: "courses", section: "courses", body: (R) => shell(R, "courses", `<div class="wrap">
${crumbs(R, [["Dashboard", "dashboard/"], ["Courses", ""]])}
<div class="page-head"><h1>Courses</h1><p class="lead">${DOMAINS.length} courses, one per domain of the job. Each course groups its labs from Beginner to Senior.</p></div>
<div class="grid-courses">${DOMAINS.map((d) => courseCard(R, DOM[d.key])).join("")}</div></div>`) });

for (const d0 of DOMAINS) {
  const d = DOM[d0.key], ids = byDomain(d.key);
  const reqs = COVERAGE.rows.filter((r) => r.tasks.some((t) => ids.includes(t)));
  add({ path: `courses/${d.slug}/`, title: d.name, page: "course", section: "courses", body: (R) => shell(R, "courses", `
<section class="course-hero dom-${d.key}"><div class="wrap">
${crumbs(R, [["Dashboard", "dashboard/"], ["Courses", "courses/"], [d.name, ""]])}
<div class="ch-in"><span class="cc-key big">${d.key}</span><div><h1>${esc(d.name)}</h1><p>${ids.length} labs · ${hrs(ids)} hours · ${[...new Set(ids.map((i) => LAB[i].level))].join(", ")}</p>${prog(ids)}</div></div>
<div class="actions"><a class="btn primary" data-continue-in="${ids.join(",")}" href="${R}labs/${ids[0].toLowerCase()}/">${icon("play")}<span>Start ${ids[0]}</span></a></div></div></section>
<div class="wrap course-body"><div>
<h2>Labs in this course</h2>
<ol class="modules">${ids.map((id, i) => { const l = LAB[id]; return `<li data-lab="${id}"><a href="${R}labs/${id.toLowerCase()}/"><span class="mod-n">${i + 1}</span><div><div class="mod-top"><span class="lid">${id}</span>${lvlPill(l.level)}${l.m.core ? '<span class="pill core">Core</span>' : ""}</div><h3>${esc(l.title)}</h3><p>${esc(l.goal)}</p><div class="lc-meta"><span>${icon("clock")}${l.hours} h</span>${envChip(l.env)}<span>${icon("dollar")}${esc(l.cost)}</span></div></div><span class="done-badge">${icon("check")}Done</span></a></li>`; }).join("")}</ol></div>
<aside class="side-card"><h3>What the JD asks for here</h3>${reqs.length ? `<ul class="plain">${reqs.map((r) => `<li>${esc(r.requirement)}</li>`).join("")}</ul>` : '<p class="muted">Supports several requirements indirectly.</p>'}
<p class="small"><a href="${R}role/coverage/">Full requirement → lab map</a></p></aside></div>`) });
}

// ---------------------------------------------------------------- labs catalog
add({ path: "labs/", title: "All labs", page: "catalog", section: "labs", body: (R) => shell(R, "labs", `<div class="wrap">
${crumbs(R, [["Dashboard", "dashboard/"], ["Labs", ""]])}
<div class="page-head"><h1>All labs</h1><p class="lead">${ORDER.length} guided labs. Filter by level, course or where it runs.</p>${prog(ORDER)}</div>
<div class="filters" data-filters>
<div class="seg" role="group" aria-label="Level"><button type="button" class="on" data-f-level="all">All</button>${LEVELS.map((l) => `<button type="button" data-f-level="${l}">${l}</button>`).join("")}</div>
<select data-f-domain aria-label="Course"><option value="all">All courses</option>${DOMAINS.map((d) => `<option value="${d.key}">${d.key} · ${esc(d.name)}</option>`).join("")}</select>
<select data-f-env aria-label="Environment"><option value="all">Any environment</option>${ENVS.map((e) => `<option value="${e.code}">${e.code} · ${esc(e.name)}</option>`).join("")}</select>
<select data-f-status aria-label="Status"><option value="all">Any status</option><option value="todo">Not done</option><option value="done">Done</option></select>
<label class="check"><input type="checkbox" data-f-core> Core path only</label>
<input type="search" data-f-q placeholder="Search title, tool, repo…" aria-label="Search labs">
</div>
<p class="small muted" data-f-count></p>
<div class="grid-labs">${ORDER.map((id) => labCard(R, id)).join("")}</div>
<p class="empty" data-f-empty hidden>No lab matches these filters.</p></div>`) });

// ---------------------------------------------------------------- lab pages
ORDER.forEach((id, idx) => {
  const l = LAB[id], m = l.m, d = DOM[m.domain];
  const sib = byDomain(d.key);
  const prev = ORDER[idx - 1], next = ORDER[idx + 1];
  const wk = WEEK_OF[id];
  const covs = COV_OF[id] || [];
  add({ path: `labs/${id.toLowerCase()}/`, title: `${id} ${l.title}`, page: "lab", section: "labs", body: (R) => shell(R, "labs", `
<div class="lesson" data-labpage="${id}">
<aside class="lesson-side" aria-label="Course outline"><div class="ls-in">
<a class="ls-course dom-${d.key}" href="${R}courses/${d.slug}/"><span class="cc-key">${d.key}</span><span>${esc(d.name)}</span></a>
${prog(sib)}
<ol class="ls-list">${sib.map((s) => `<li data-lab="${s}" class="${s === id ? "cur" : ""}"><a href="${R}labs/${s.toLowerCase()}/"${s === id ? ' aria-current="page"' : ""}><span class="ls-dot">${icon("check")}</span><span class="lid">${s}</span>${esc(LAB[s].title)}</a></li>`).join("")}</ol>
<a class="small" href="${R}labs/">All labs →</a></div></aside>
<article class="lesson-main">
${crumbs(R, [["Labs", "labs/"], [d.name, `courses/${d.slug}/`], [id, ""]])}
<header class="lesson-head">
<div class="lh-tags"><span class="lid big">${id}</span>${lvlPill(l.level)}<span class="pill plain">${MANUAL_LEVEL[l.level]}</span>${m.core ? '<span class="pill core">Core path</span>' : ""}<span class="done-badge" data-lab="${id}">${icon("check")}Completed</span></div>
<h1>${esc(l.title)}</h1><p class="lead">${md(l.goal)}</p>
<div class="facts">
<div><small>Where you run it</small>${envChip(l.env)} ${esc(ENV[l.env].name)}</div>
<div><small>Time</small>${l.hours} hours</div>
<div><small>Cost</small>${esc(l.cost)}</div>
<div><small>Hardware tier</small>${esc(m.tier_label)}</div>
<div><small>Do first</small>${linkRefs(l.before, R, LAB_IDS, SETUP_IDS)}</div>
${wk ? `<div><small>Schedule</small><a href="${R}path/schedule/">${wk.week} · ${wk.starts}</a></div>` : ""}
</div></header>
<div class="tabs" data-tabs>
<div class="tablist" role="tablist" aria-label="Lab sections">
<button role="tab" id="tab-overview" aria-controls="p-overview" aria-selected="true">Overview</button>
<button role="tab" id="tab-lab" aria-controls="p-lab" aria-selected="false">Hands-on lab</button>
<button role="tab" id="tab-manual" aria-controls="p-manual" aria-selected="false">Field manual</button>
<button role="tab" id="tab-resources" aria-controls="p-resources" aria-selected="false">Resources <span class="count">${m.repos.length + m.docs.length}</span></button>
<button role="tab" id="tab-interview" aria-controls="p-interview" aria-selected="false">Interview prep</button>
</div>
<section role="tabpanel" id="p-overview" aria-labelledby="tab-overview">
<div class="callout jd">${icon("brief")}<div><b>Why it matters for the role.</b> ${esc(((s) => s.charAt(0).toUpperCase() + s.slice(1))(m.jd.replace(/^JD( stand-out)?:\s*/i, "")))}</div></div>
${covs.length ? `<h3>JD requirements this lab gives evidence for</h3><ul class="plain ticks">${covs.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
<div class="two">
<div class="box"><h3>${icon("check")}What you deliver</h3><p>${m.deliverable_html}</p><p class="small muted"><b>Commit:</b> ${md(l.commit)}</p></div>
<div class="box"><h3>${icon("server")}Environment</h3><p><b>${l.env}</b> · ${esc(ENV[l.env].name)}</p><p class="small muted">${esc(ENV[l.env].cost)}. ${esc(ENV[l.env].use)}</p><p class="small"><a href="${R}setup/environments/">About environments</a></p></div>
</div>
${m.gem_html ? `<div class="callout gem">${icon("gem")}<div><b>Hidden gem.</b> ${m.gem_html}</div></div>` : ""}
<p><button class="btn primary" type="button" data-goto-tab="tab-lab">${icon("play")}Start the hands-on lab</button></p>
</section>
<section role="tabpanel" id="p-lab" aria-labelledby="tab-lab" hidden>
<h2>Steps</h2>
<ol class="steps">${l.steps.map((s, i) => `<li><div class="st-text">${md(s.text)}</div>${s.code ? codeBlock(s.code) : ""}</li>`).join("")}</ol>
<div class="callout ok">${icon("check")}<div><b>You should see.</b> ${md(l.expect)}</div></div>
<h3>Check yourself</h3><ul class="checklist">${l.verify.map((v, i) => `<li><label><input type="checkbox" data-verify="${id}:${i}"> ${md(v)}</label></li>`).join("")}</ul>
${l.broke.length ? `<h3>If it breaks</h3><div class="tscroll"><table class="brk"><thead><tr><th>Symptom</th><th>Fix</th></tr></thead><tbody>${l.broke.map((b) => `<tr><td>${md(b.symptom)}</td><td>${md(b.fix)}</td></tr>`).join("")}</tbody></table></div><p class="small"><a href="${R}resources/troubleshooting/">General debug ladder →</a></p>` : ""}
<div class="two"><div class="box"><h3>Commit to your repo</h3><p>${md(l.commit)}</p></div><div class="box warn"><h3>Clean up</h3><p>${md(l.cleanup)}</p></div></div>
</section>
<section role="tabpanel" id="p-manual" aria-labelledby="tab-manual" hidden>
<p class="muted">The original task from the GPU Bring-Up Field Manual. The hands-on tab turns it into commands; this is the outcome you're aiming for.</p>
<h3>Steps</h3><ol class="msteps">${m.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
<div class="callout">${icon("check")}<div><b>Deliverable.</b> ${m.deliverable_html}</div></div>
${m.gem_html ? `<div class="callout gem">${icon("gem")}<div><b>Hidden gem.</b> ${m.gem_html}</div></div>` : ""}
</section>
<section role="tabpanel" id="p-resources" aria-labelledby="tab-resources" hidden>
${m.repos.length ? `<h3>Repositories</h3><ul class="reflist">${m.repos.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${icon("link")}${esc(r.name)}</a>${r.note ? `<span>${esc(r.note)}</span>` : ""}</li>`).join("")}</ul>` : ""}
${m.docs.length ? `<h3>Docs and reading</h3><ul class="reflist">${m.docs.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${icon("book")}${esc(r.name)}</a></li>`).join("")}</ul>` : ""}
</section>
<section role="tabpanel" id="p-interview" aria-labelledby="tab-interview" hidden>
<div class="qa"><p class="q">${icon("chat")}<b>Be ready for:</b> ${esc(m.question)}</p>
<details class="ans"><summary>Show the answer you can now give</summary><p>${md(l.interview)}</p></details></div>
<p class="small"><a href="${R}resources/interview/">Full interview bank →</a></p>
</section>
</div>
<div class="complete-bar"><button class="btn primary" type="button" data-complete="${id}">${icon("check")}<span>Mark lab complete</span></button><span class="small muted">Progress is saved in this browser.</span></div>
<nav class="pager" aria-label="Lab navigation">
${prev ? `<a class="prev" href="${R}labs/${prev.toLowerCase()}/">${icon("arrowL")}<span><small>Previous</small>${prev} · ${esc(LAB[prev].title)}</span></a>` : "<span></span>"}
${next ? `<a class="next" href="${R}labs/${next.toLowerCase()}/"><span><small>Next</small>${next} · ${esc(LAB[next].title)}</span>${icon("arrowR")}</a>` : "<span></span>"}
</nav></article></div>`) });
});

// ---------------------------------------------------------------- setup
const setupSide = (R, cur) => `<aside class="lesson-side" aria-label="Setup outline"><div class="ls-in">
<a class="ls-course setup-c" href="${R}setup/"><span class="cc-key">0</span><span>Day-0 lab setup</span></a>${prog(SETUP.map((s) => s.id))}
<ol class="ls-list">${SETUP.map((s) => `<li data-lab="${s.id}" class="${s.id === cur ? "cur" : ""}"><a href="${R}setup/${s.id.toLowerCase()}/"><span class="ls-dot">${icon("check")}</span><span class="lid">${s.id}</span>${esc(s.title)}</a></li>`).join("")}</ol>
<ul class="ls-extra"><li class="${cur === "env" ? "cur" : ""}"><a href="${R}setup/environments/">Environments</a></li><li class="${cur === "ten" ? "cur" : ""}"><a href="${R}setup/first-10-days/">Your first 10 days</a></li></ul></div></aside>`;
add({ path: "setup/", title: "Lab setup", page: "setup", section: "setup", body: (R) => shell(R, "setup", `<div class="lesson">${setupSide(R, "")}<article class="lesson-main">
${crumbs(R, [["Dashboard", "dashboard/"], ["Lab setup", ""]])}
<header class="lesson-head"><p class="eyebrow">Start here</p><h1>Day-0: set up your lab</h1>
<p class="lead">Do these in order. S1–S6 take one evening. S7–S9 are Terraform files you'll reuse for the rest of the plan. S10 is the habit that keeps your bill near zero.</p></header>
<div class="callout">${icon("info")}<div><b>Your first move:</b> open <a href="${R}setup/s1/">S1</a> and install WSL2. Then do S2 to S6 on day 1. You do not need a GPU for the first week. GPU labs come after you have practised the commands on cheap or free environments.</div></div>
<h2>Every lab follows the same loop</h2>
<div class="loop">${[["Read", "Goal and “Do first”. Open the field manual tab for background."], ["Bring up", "The environment named in “Where you run it”."], ["Run", "Copy each command block in order."], ["Check", "Compare with “You should see” and tick “Check yourself”."], ["Fix", "Use “If it breaks”, then the debug ladder."], ["Commit", "Script + results + notes/<lab>.md into your gpu-lab repo."], ["Tear down", "terraform destroy, then labdown."], ["Say it", "Practise the interview answer out loud."]].map(([a, b], i) => `<div><span>${i + 1}</span><b>${a}</b><p>${esc(b)}</p></div>`).join("")}</div>
<h2>Setup steps</h2><ol class="modules">${SETUP.map((s, i) => `<li data-lab="${s.id}"><a href="${R}setup/${s.id.toLowerCase()}/"><span class="mod-n">${s.id}</span><div><h3>${esc(s.title)}</h3><p>${md(s.why.split(". ")[0])}.</p></div><span class="done-badge">${icon("check")}Done</span></a></li>`).join("")}</ol>
<div class="callout warn">${icon("info")}<div><b>Honest notes.</b> These commands follow each project's documented usage, but they have not been run on your machine. Package names, Helm values and release tags change between versions, so where a step says "check the README / --help", do that. Cloud prices are rough; check the current spot price before you start. Your progress ticks are saved in this browser only.</div></div>
</article></div>`) });
SETUP.forEach((s, i) => {
  const prev = SETUP[i - 1], next = SETUP[i + 1];
  add({ path: `setup/${s.id.toLowerCase()}/`, title: `${s.id} ${s.title}`, page: "setupstep", section: "setup", body: (R) => shell(R, "setup", `<div class="lesson">${setupSide(R, s.id)}<article class="lesson-main">
${crumbs(R, [["Lab setup", "setup/"], [s.id, ""]])}
<header class="lesson-head"><div class="lh-tags"><span class="lid big">${s.id}</span><span class="done-badge" data-lab="${s.id}">${icon("check")}Completed</span></div><h1>${esc(s.title)}</h1></header>
<div class="prose"><p>${md(s.why)}</p></div>
${s.code ? codeBlock(s.code) : ""}
<div class="callout ok">${icon("check")}<div><b>You should see.</b> ${md(s.expect)}</div></div>
<div class="complete-bar"><button class="btn primary" type="button" data-complete="${s.id}" data-label="step">${icon("check")}<span>Mark step complete</span></button></div>
<nav class="pager">${prev ? `<a class="prev" href="${R}setup/${prev.id.toLowerCase()}/">${icon("arrowL")}<span><small>Previous</small>${prev.id} · ${esc(prev.title)}</span></a>` : `<a class="prev" href="${R}setup/">${icon("arrowL")}<span><small>Back</small>Setup overview</span></a>`}
${next ? `<a class="next" href="${R}setup/${next.id.toLowerCase()}/"><span><small>Next</small>${next.id} · ${esc(next.title)}</span>${icon("arrowR")}</a>` : `<a class="next" href="${R}setup/first-10-days/"><span><small>Next</small>Your first 10 days</span>${icon("arrowR")}</a>`}</nav>
</article></div>`) });
});
add({ path: "setup/environments/", title: "Environments", page: "setup", section: "setup", body: (R) => shell(R, "setup", `<div class="lesson">${setupSide(R, "env")}<article class="lesson-main">
${crumbs(R, [["Lab setup", "setup/"], ["Environments", ""]])}
<header class="lesson-head"><h1>Environments</h1><p class="lead">Every lab is tagged with a code that says where it runs.</p></header>
<div class="envgrid">${ENVS.map((e) => `<div class="envcard"><span class="chip env big">${e.code}</span><h3>${esc(e.name)}</h3><p><b>Rough cost:</b> ${esc(e.cost)}</p><p class="muted">${esc(e.use)}</p><p class="small">${ORDER.filter((id) => LAB[id].env === e.code).map((id) => `<a href="${R}labs/${id.toLowerCase()}/">${id}</a>`).join(" ")}</p></div>`).join("")}</div>
<div class="callout">${icon("dollar")}<div>A rough total: if you keep to spot instances and destroy after each session, the full plan costs a few hundred dollars. Most of that is the multi-node (G2N) and rented (R) sessions; group those labs into the same sessions.</div></div>
</article></div>`) });
add({ path: "setup/first-10-days/", title: "Your first 10 days", page: "setup", section: "setup", body: (R) => shell(R, "setup", `<div class="lesson">${setupSide(R, "ten")}<article class="lesson-main">
${crumbs(R, [["Lab setup", "setup/"], ["First 10 days", ""]])}
<header class="lesson-head"><h1>Your first 10 days</h1><p class="lead">After day 10, continue down the track in order. The Beginner track teaches every layer once; Intermediate goes deeper per layer; Senior combines them into designs, automation and the capstone.</p></header>
<ol class="days">${TEN.map((t) => `<li><span class="day">${esc(t.day)}</span><div><b>${linkRefs(t.labs, R, LAB_IDS, SETUP_IDS)}</b><p>${esc(t.outcome)}</p></div><span class="chip">${icon("clock")}${esc(t.time)}</span></li>`).join("")}</ol>
<p><a class="btn primary" href="${R}path/beginner/">${icon("play")}Go to the Beginner track</a></p>
</article></div>`) });

// ---------------------------------------------------------------- role
const roleNav = (R, on) => `<div class="tabs-nav">${[["role/", "Job posting"], ["role/coverage/", "Requirement → lab map"], ["role/where-you-stand/", "Where you stand"]].map(([h, l]) => `<a href="${R}${h}" class="${h === on ? "on" : ""}">${l}</a>`).join("")}</div>`;
add({ path: "role/", title: JD.title, page: "role", section: "role", body: (R) => shell(R, "role", `<div class="wrap">
${crumbs(R, [["Dashboard", "dashboard/"], ["The role", ""]])}
<div class="page-head"><p class="eyebrow">NVIDIA · ${esc(JD.department)}</p><h1>${esc(JD.title)}</h1></div>${roleNav(R, "role/")}
<div class="role-grid"><article class="jd prose">${JD.description_html}</article>
<aside class="side-card sticky"><h3>Posting details</h3><dl class="kv">
<dt>Job ID</dt><dd>${esc(JD.job_id)}</dd><dt>Locations</dt><dd>${JD.locations.map(esc).join("<br>")}</dd>
<dt>Department</dt><dd>${esc(JD.department)}</dd><dt>Type</dt><dd>${esc(JD.time_type)} · ${esc(JD.job_type)}</dd>
<dt>Captured</dt><dd>${esc(JD.fetched)} (verbatim from NVIDIA careers)</dd></dl>
<p><a class="btn primary block" href="${esc(JD.source_url)}" target="_blank" rel="noopener">${icon("link")}Open on NVIDIA careers</a></p>
<p><a class="btn ghost block" href="${esc(JD.apply_url)}" target="_blank" rel="noopener">Apply (Workday)</a></p>
<p class="small muted">The posting says applications are accepted at least until August 30, 2026. Check the live page before you apply.</p>
<p class="small"><a href="${R}role/coverage/">See which labs prove each requirement →</a></p></aside></div></div>`) });
add({ path: "role/coverage/", title: "Requirement → lab map", page: "role", section: "role", body: (R) => shell(R, "role", `<div class="wrap">
${crumbs(R, [["Dashboard", "dashboard/"], ["The role", "role/"], ["Requirement → lab map", ""]])}
<div class="page-head"><h1>Requirement → lab map</h1><p class="lead">${esc(COVERAGE.lead)}</p></div>${roleNav(R, "role/coverage/")}
<div class="covlist">${COVERAGE.rows.map((r) => `<div class="covrow"><div><h3>${esc(r.requirement)}</h3>${prog(r.tasks)}</div><div class="covlabs">${r.tasks.map((t) => `<a class="tchip" data-lab="${t}" href="${R}labs/${t.toLowerCase()}/"><span class="lid">${t}</span>${esc(LAB[t].title)}</a>`).join("")}</div></div>`).join("")}</div></div>`) });
add({ path: "role/where-you-stand/", title: "Where you stand", page: "role", section: "role", body: (R) => shell(R, "role", `<div class="wrap">
${crumbs(R, [["Dashboard", "dashboard/"], ["The role", "role/"], ["Where you stand", ""]])}
<div class="page-head"><h1>Where you stand</h1><p class="lead">${OV.lead_html}</p></div>${roleNav(R, "role/where-you-stand/")}
<div class="notegrid">${OV.notes.map((n) => `<div class="box prose"><h3>${esc(n.title)}</h3>${n.html}</div>`).join("")}</div></div>`) });

// ---------------------------------------------------------------- resources
const resCards = [["resources/hidden-gems/", "gem", "Hidden gems", RES.gems.lead], ["resources/reading/", "book", "Reading & free courses", RES.reading.lead], ["resources/interview/", "chat", "Interview bank", RES.interview.lead], ["resources/certifications/", "cert", "Certifications", "NCP-AII, NCA-AIIO and CKS: what they cover and when to book."], ["resources/troubleshooting/", "bug", "When you're stuck", "The debug ladder: a fixed order of checks for any failed lab."]];
const resNav = (R, on) => `<div class="tabs-nav">${[["resources/", "All"], ...resCards.map((c) => [c[0], c[2]])].map(([h, l]) => `<a href="${R}${h}" class="${h === on ? "on" : ""}">${l}</a>`).join("")}</div>`;
const resPage = (p, title, inner) => add({ path: p, title, page: "resources", section: "resources", body: (R) => shell(R, "resources", `<div class="wrap">${crumbs(R, [["Dashboard", "dashboard/"], ["Resources", "resources/"], [title, ""]])}<div class="page-head"><h1>${title}</h1></div>${resNav(R, p)}${inner(R)}</div>`) });
add({ path: "resources/", title: "Resources", page: "resources", section: "resources", body: (R) => shell(R, "resources", `<div class="wrap">${crumbs(R, [["Dashboard", "dashboard/"], ["Resources", ""]])}<div class="page-head"><h1>Resources</h1><p class="lead">Everything that supports the labs.</p></div>${resNav(R, "resources/")}
<div class="grid3">${resCards.map(([h, ic, t, d]) => `<a class="rcard" href="${R}${h}">${icon(ic, "i fi")}<h3>${t}</h3><p>${esc(d)}</p></a>`).join("")}</div></div>`) });
resPage("resources/hidden-gems/", "Hidden gems", (R) => `<p class="lead">${esc(RES.gems.lead)}</p><div class="gemgrid">${RES.gems.items.map((g) => `<div class="gemcard"><a href="${esc(g.url)}" target="_blank" rel="noopener">${icon("gem")}${esc(g.name)}</a><p>${esc(g.why)}</p><p class="small">Used in ${g.tasks.split(/,\s*/).map((t) => LAB_IDS.has(t) ? `<a href="${R}labs/${t.toLowerCase()}/">${t}</a>` : esc(t)).join(", ")}</p></div>`).join("")}</div>`);
resPage("resources/reading/", "Reading & free courses", (R) => `<p class="lead">${esc(RES.reading.lead)}</p><ul class="readlist">${RES.reading.items.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${icon("book")}${esc(r.name)}</a><span>${esc(r.why)}</span></li>`).join("")}</ul>${RES.reading.extra.map((x) => `<div class="box prose"><h3>${esc(x.title)}</h3>${x.html}</div>`).join("")}`);
resPage("resources/interview/", "Interview bank", (R) => `<p class="lead">${esc(RES.interview.lead)}</p>
<h2>Answer spines</h2><div class="spines">${RES.interview.spines.map((s) => `<div class="box"><h3>${esc(s.title)}</h3><p>${esc(s.answer)}</p></div>`).join("")}</div>
<h2>Questions by course</h2>${DOMAINS.map((d) => { const qs = RES.interview.questions.filter((q) => q.task[0] === d.key); return qs.length ? `<h3 class="qhead"><span class="cc-key sm dom-${d.key}">${d.key}</span>${esc(d.name)}</h3><div class="qlist">${qs.map((q) => `<details class="ans"><summary><span class="lid">${q.task}</span>${esc(q.question)}</summary><p>${md(LAB[q.task].interview)}</p><p class="small"><a href="${R}labs/${q.task.toLowerCase()}/">Open lab ${q.task} →</a></p></details>`).join("")}</div>` : ""; }).join("")}`);
resPage("resources/certifications/", "Certifications", () => `<div class="notegrid">${RES.certifications.map((c) => `<div class="box prose"><h3>${esc(c.title)}</h3>${c.html}</div>`).join("")}</div><p class="small muted">Schedule note: ${esc(SCHEDULE.lead)}</p>`);
resPage("resources/troubleshooting/", "When you're stuck", () => `<p class="lead">Use the same order of checks for every failed lab.</p><ol class="ladder">${DEBUG.map((d) => `<li><b>${esc(d.step.replace(/^\d+\.\s*/, ""))}</b><p>${md(d.text)}</p></li>`).join("")}</ol>
<div class="callout">${icon("info")}<div>Write every failure down in <code>notes/&lt;lab&gt;.md</code> as symptom, cause, fix. After 50 labs you'll have dozens of real debugging stories, which is what interviewers ask for.</div></div>`);

// ---------------------------------------------------------------- about
add({ path: "about/", title: "About & sources", page: "about", section: "", body: (R) => shell(R, "", `<div class="wrap narrow">${crumbs(R, [["Dashboard", "dashboard/"], ["About", ""]])}
<div class="page-head"><h1>About this site</h1></div><div class="prose">
<p>This site combines three sources into one course: the <b>NVIDIA job posting</b> (${esc(JD.job_id)}, captured verbatim on ${esc(JD.fetched)}), the <b>GPU Bring-Up Field Manual</b> (what to learn: 50 tasks, verified repos and docs) and the <b>GPU Lab Playbook</b> (how to do it: environments, commands, checks, fixes). Lab IDs (A1…L2) are the same everywhere.</p>
${OV.notes.filter((n) => n.title.startsWith("How I checked")).map((n) => `<h2>${esc(n.title)}</h2>${n.html}`).join("")}
<h2>Honest notes</h2><p>The lab commands follow each project's documented usage but have not been run on your machine. Package names, Helm values and release tags change between versions; where a step says "check the README / --help", do that. Cloud prices are rough.</p>
<p class="muted">${esc(OV.footer)}</p>
<h2>Privacy and access</h2><p>Every page except the landing and sign-in pages is encrypted (AES-256-GCM). Signing in derives a key from your password (PBKDF2, 310,000 iterations) that unlocks the content in your browser. Progress is stored only in this browser.</p>
</div></div>`) });

// ---------------------------------------------------------------- write
async function main() {
  const t0 = Date.now();
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.cpSync(path.join(ROOT, "src", "assets"), path.join(OUT, "assets"), { recursive: true });
  fs.writeFileSync(path.join(OUT, ".nojekyll"), "");

  let fileUsers = null;
  const uf = path.join(ROOT, "users.local.json");
  if (fs.existsSync(uf)) fileUsers = JSON.parse(fs.readFileSync(uf, "utf8"));
  const users = parseUsers(process.env.SITE_USERS, fileUsers);
  if (!users.length) throw new Error("No users. Set SITE_USERS='user:pass' or create users.local.json (see docs/AUTH.md).");
  for (const u of users) if (u.password.length < 12) throw new Error(`Password for ${u.username} must be at least 12 characters.`);
  const ck = await newContentKey();
  fs.mkdirSync(path.join(OUT, "auth"), { recursive: true });
  fs.writeFileSync(path.join(OUT, "auth", "keyring.json"), JSON.stringify(await buildKeyring(ck, users)));

  for (const p of pages) {
    const depth = p.path ? p.path.split("/").filter(Boolean).length : 0;
    const R = depth ? "../".repeat(depth) : "./";
    const body = p.body(R);
    const html = p.public ? publicPage(R, p, body) : protectedPage(R, p, await encryptText(ck, body));
    const dir = path.join(OUT, p.path);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html);
    if (process.env.UAI_CHECK_DIR) { // plaintext copy for tools/check.mjs only (never deployed)
      const cdir = path.join(process.env.UAI_CHECK_DIR, p.path); fs.mkdirSync(cdir, { recursive: true });
      fs.writeFileSync(path.join(cdir, "index.html"), body);
    }
  }
  fs.writeFileSync(path.join(OUT, "404.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:#0b1733;color:#e8eefc;text-align:center;padding:20px}a{color:#8fd11c}</style></head>
<body><div><h1>Page not found</h1><p>The page moved or never existed.</p><p><a id="home" href="/">Go to the dashboard</a></p></div>
<script>var s=location.pathname.split("/").filter(Boolean);document.getElementById("home").href=(location.hostname.endsWith("github.io")&&s.length?"/"+s[0]+"/":"/")+"dashboard/";</script></body></html>`);
  console.log(`Built ${pages.length} pages (${pages.filter((p) => !p.public).length} encrypted) for ${users.length} user(s) in ${Date.now() - t0} ms -> dist/`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
