import { esc, icon } from "./util.mjs";

export const SITE = { name: "Upskill AI Infra", short: "UAI", tagline: "Hands-on path to NVIDIA Solutions Architect, Infrastructure" };

const NAV = [
  { key: "dashboard", label: "Dashboard", href: "dashboard/", ic: "home" },
  { key: "path", label: "Learning Path", href: "path/", ic: "path" },
  { key: "courses", label: "Courses", href: "courses/", ic: "book" },
  { key: "labs", label: "Labs", href: "labs/", ic: "flask" },
  { key: "setup", label: "Lab Setup", href: "setup/", ic: "tool" },
  { key: "role", label: "The Role", href: "role/", ic: "brief" },
  { key: "resources", label: "Resources", href: "resources/", ic: "star" },
];

const logo = (R) => `<a class="brand" href="${R}dashboard/" aria-label="${SITE.name} home"><span class="logo">${icon("server", "i")}</span><span class="bname">Upskill<b>AI Infra</b></span></a>`;

export function header(R, section) {
  const links = NAV.map((n) => `<a href="${R}${n.href}" class="${n.key === section ? "on" : ""}"${n.key === section ? ' aria-current="page"' : ""}>${icon(n.ic)}<span>${n.label}</span></a>`).join("");
  return `<header class="top"><div class="top-in">
${logo(R)}
<button class="iconbtn menu-btn" type="button" aria-label="Open menu" aria-expanded="false" data-menu>${icon("menu")}</button>
<nav class="mainnav" aria-label="Main">${links}</nav>
<div class="tools">
<form class="search" action="${R}labs/" role="search"><label class="sr" for="gsearch">Search labs</label>${icon("search")}<input id="gsearch" name="q" type="search" placeholder="Search labs…" autocomplete="off"></form>
<button class="iconbtn" type="button" data-theme-toggle aria-label="Toggle dark mode" title="Toggle theme">${icon("moon")}</button>
<button class="iconbtn" type="button" data-logout aria-label="Sign out" title="Sign out">${icon("out")}</button>
</div></div></header>`;
}

export function footer(R) {
  return `<footer class="foot"><div class="wrap foot-in">
<div><b>${SITE.name}</b><p>${SITE.tagline}. Private study site.</p></div>
<div class="flinks"><a href="${R}about/">About &amp; sources</a><a href="${R}resources/troubleshooting/">When you're stuck</a><a href="${R}role/">The JD</a></div>
</div></footer>`;
}

export function crumbs(R, items) {
  return `<nav class="crumbs" aria-label="Breadcrumb">${items.map(([label, href], i) =>
    i === items.length - 1 ? `<span aria-current="page">${esc(label)}</span>` : `<a href="${R}${href}">${esc(label)}</a>`).join(`<span class="sep">/</span>`)}</nav>`;
}

export function pageHead(R, title, desc = SITE.tagline) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${SITE.name}</title>
<meta name="description" content="${esc(desc)}"><meta name="robots" content="noindex,nofollow">
<link rel="icon" href="${R}assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${R}assets/css/app.css">
<script>try{var t=localStorage.getItem("uai-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
</head>`;
}

// Protected: body content is replaced by ciphertext; auth.js decrypts it in the browser.
export function protectedPage(R, { title, page }, payload) {
  return `${pageHead(R, "Sign in required")}
<body data-root="${R}" data-page="${page}" data-protected>
<div id="app"><div class="gate"><div class="gate-card">${icon("lock", "i big")}<p>Unlocking…</p></div></div></div>
<script type="application/json" id="payload">${JSON.stringify(payload)}</script>
<noscript><p class="noscript">This site needs JavaScript to decrypt its content.</p></noscript>
<script src="${R}assets/js/auth.js"></script>
<script src="${R}assets/js/app.js"></script>
</body></html>`;
}

export function publicPage(R, { title, page }, body) {
  return `${pageHead(R, title)}
<body data-root="${R}" data-page="${page}">
<div id="app">${body}</div>
<script src="${R}assets/js/auth.js"></script>
<script src="${R}assets/js/app.js"></script>
</body></html>`;
}
