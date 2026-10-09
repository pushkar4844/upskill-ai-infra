import { esc, icon } from "./util.mjs";

export const SITE = {
  name: "Upskill AI Infra",
  tagline: "A hands-on roadmap for learning GPU and AI infrastructure, from your first triage script to a cluster validation kit",
  repo: "https://github.com/pushkar4844/upskill-ai-infra",
};

export const NAV = [
  { key: "roadmap", label: "Roadmap", href: "" },
  { key: "guide", label: "Study guide", href: "guide/" },
  { key: "labs", label: "Labs", href: "labs/" },
  { key: "concepts", label: "Concepts", href: "concepts/" },
  { key: "interview", label: "Interview", href: "interview/" },
  { key: "role", label: "The role", href: "role/" },
  { key: "resources", label: "Resources", href: "resources/" },
];

export function header(R, section) {
  const links = NAV.map((n) => `<a href="${R}${n.href}"${n.key === section ? ' class="on" aria-current="page"' : ""}>${n.label}</a>`).join("");
  return `<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="top-in">
<a class="brand" href="${R}" aria-label="${SITE.name} home"><span class="logo">${icon("layers")}</span><span>Upskill <b>AI Infra</b></span></a>
<nav class="mainnav" id="mainnav" aria-label="Main">${links}</nav>
<div class="tools">
<a class="iconbtn" href="${R}search/" aria-label="Search" title="Search (/)">${icon("search")}</a>
<button class="iconbtn" type="button" data-theme-toggle aria-label="Toggle dark mode" title="Toggle theme">${icon("moon")}</button>
<button class="iconbtn menu-btn" type="button" aria-label="Menu" aria-controls="mainnav" aria-expanded="false" data-menu>${icon("menu")}</button>
</div></div></header>`;
}

export function footer(R) {
  return `<footer class="foot"><div class="wrap foot-in">
<div class="foot-brand"><b>${SITE.name}</b><p>${esc(SITE.tagline)}. Free and open; progress is saved only in your browser.</p></div>
<div class="foot-cols">
<div><h4>Learn</h4><a href="${R}">Roadmap</a><a href="${R}guide/">Study guide</a><a href="${R}labs/">All labs</a><a href="${R}concepts/">Concepts</a></div>
<div><h4>Prepare</h4><a href="${R}interview/">Interview bank</a><a href="${R}role/">The role</a><a href="${R}resources/certifications/">Certifications</a></div>
<div><h4>Help</h4><a href="${R}resources/troubleshooting/">When you're stuck</a><a href="${R}resources/glossary/">Glossary</a><a href="${R}about/">About &amp; sources</a><a href="${SITE.repo}" target="_blank" rel="noopener">Source on GitHub</a></div>
</div></div></footer>`;
}

export function crumbs(R, items) {
  return `<nav class="crumbs" aria-label="Breadcrumb">${items.map(([label, href], i) =>
    i === items.length - 1 ? `<span aria-current="page">${esc(label)}</span>` : `<a href="${R}${href}">${esc(label)}</a>`).join(`<span class="sep" aria-hidden="true">›</span>`)}</nav>`;
}

export function page(R, { title, desc, pageKey }, body) {
  const full = title ? `${title} · ${SITE.name}` : `${SITE.name}: GPU infrastructure roadmap`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(desc || SITE.tagline)}">
<meta property="og:title" content="${esc(full)}"><meta property="og:description" content="${esc(desc || SITE.tagline)}"><meta property="og:type" content="website">
<meta name="theme-color" content="#0f172a">
<link rel="icon" href="${R}assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${R}assets/css/app.css">
<script>try{var t=localStorage.getItem("uai-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
</head>
<body data-root="${R}" data-page="${pageKey}">
${body}
<script src="${R}assets/js/app.js"></script>
</body></html>`;
}
