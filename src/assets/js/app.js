/* Upskill AI Infra - UI behaviour: theme, menu, progress, filters, search, copy, table of contents. */
(function () {
  "use strict";
  var PROG = "uai-progress-v1", VER = "uai-verify-v1", THEME = "uai-theme";
  var root = document.documentElement;
  function load(k) { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function rel(p) { return (document.body.getAttribute("data-root") || "./") + p; }
  function readJSON(id) { var el = document.getElementById(id); try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function urlOf(id) { return rel((/^S\d+$/.test(id) ? "setup/" : "labs/") + id.toLowerCase() + "/"); }
  var done = load(PROG);

  // ---------- progress
  function paint() {
    $$("[data-lab]").forEach(function (el) { el.classList.toggle("is-done", !!done[el.getAttribute("data-lab")]); });
    $$("[data-prog]").forEach(function (el) {
      var ids = el.getAttribute("data-prog").split(",").filter(Boolean);
      var n = ids.filter(function (i) { return done[i]; }).length, pct = ids.length ? Math.round(100 * n / ids.length) : 0;
      var bar = $(".bar span", el); if (bar) bar.style.width = pct + "%";
      var t = $("[data-prog-text]", el); if (t) t.textContent = n + " of " + ids.length + " " + (el.getAttribute("data-prog-label") || "done") + (n ? " · " + pct + "%" : "");
    });
    $$("[data-ring]").forEach(function (el) {
      var ids = el.getAttribute("data-ring").split(",");
      var n = ids.filter(function (i) { return done[i]; }).length, pct = Math.round(100 * n / ids.length);
      var c = $(".r-fg", el), L = 2 * Math.PI * 52;
      c.style.strokeDasharray = L; c.style.strokeDashoffset = L * (1 - pct / 100);
      $("[data-ring-pct]", el).textContent = pct + "%";
    });
    $$("[data-complete]").forEach(function (b) {
      var on = !!done[b.getAttribute("data-complete")];
      b.classList.toggle("is-on", on);
      var s = $("span", b); if (s) s.textContent = on ? "Completed · click to undo" : "Mark " + (b.getAttribute("data-label") || "lab") + " complete";
    });
    var titles = readJSON("titles") || {};
    $$("[data-continue]").forEach(function (a) {
      var ids = a.getAttribute("data-continue").split(","), nx = ids.filter(function (i) { return !done[i]; })[0], s = $("span", a);
      var started = ids.some(function (i) { return done[i]; });
      if (!nx) { s.textContent = "All done here · review"; a.href = urlOf(ids[0]); return; }
      a.href = urlOf(nx);
      s.textContent = (started ? "Continue: " : "Start: ") + nx + (titles[nx] ? " · " + titles[nx] : "");
    });
  }

  // ---------- lab catalog filters
  function filters() {
    var f = $("[data-filters]"); if (!f) return;
    var rows = $$("[data-cat-phase] .lrow");
    var q = $("[data-f-q]", f), ph = $("[data-f-phase]", f), dom = $("[data-f-domain]", f), env = $("[data-f-env]", f), st = $("[data-f-status]", f), core = $("[data-f-core]", f);
    var params = new URLSearchParams(location.search);
    if (params.get("q")) q.value = params.get("q");
    if (params.get("domain")) dom.value = params.get("domain");
    if (params.get("phase")) ph.value = params.get("phase");
    function apply() {
      var term = q.value.trim().toLowerCase(), n = 0;
      rows.forEach(function (c) {
        var d = c.dataset;
        var ok = (ph.value === "all" || d.phase === ph.value) && (dom.value === "all" || d.domain === dom.value) &&
          (env.value === "all" || d.env === env.value) && (!core.checked || d.core === "1") &&
          (st.value === "all" || (st.value === "done") === !!done[d.lab]) && (!term || d.text.indexOf(term) > -1);
        c.hidden = !ok; if (ok) n++;
      });
      $$("[data-cat-phase]").forEach(function (s) { s.hidden = !$$(".lrow", s).some(function (r) { return !r.hidden; }); });
      $("[data-f-count]").textContent = n === rows.length ? "Showing all " + n + " labs" : n + " of " + rows.length + " labs match";
      $("[data-f-empty]").hidden = n > 0;
    }
    [q, ph, dom, env, st, core].forEach(function (el) { el.addEventListener("input", apply); el.addEventListener("change", apply); });
    apply();
  }

  // ---------- site search
  function search() {
    var box = $("[data-search]"); if (!box) return;
    var idx = readJSON("search-index") || [], out = $("[data-search-results]"), cnt = $("[data-search-count]");
    idx.forEach(function (it) { it.l = (it.t + " " + it.x).toLowerCase(); it.tl = it.t.toLowerCase(); });
    var q0 = new URLSearchParams(location.search).get("q"); if (q0) box.value = q0;
    function run() {
      var words = box.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.length) { out.innerHTML = ""; cnt.textContent = "Search " + idx.length + " labs, setup steps, concepts and terms."; return; }
      var hits = idx.map(function (it) {
        var score = 0;
        for (var i = 0; i < words.length; i++) { var w = words[i]; if (it.l.indexOf(w) < 0) return null; score += it.tl.indexOf(w) > -1 ? 5 : 1; }
        return { it: it, s: score + (it.k === "Term" || it.k === "Concept" ? 1 : 0) };
      }).filter(Boolean).sort(function (a, b) { return b.s - a.s; }).slice(0, 40);
      cnt.textContent = hits.length ? hits.length + (hits.length === 40 ? "+" : "") + " results" : "No results. Try a tool name such as nccl, dcgm or redfish.";
      out.innerHTML = hits.map(function (h) {
        var x = h.it.x, i = x.toLowerCase().indexOf(words[0]), snip = i > 60 ? "…" + x.slice(i - 50, i + 110) : x.slice(0, 160);
        return '<li><a href="' + esc(h.it.u) + '"><span class="rk">' + esc(h.it.k) + "</span><b>" + esc(h.it.t) + "</b><span class=\"rs\">" + esc(snip) + (x.length > 160 ? "…" : "") + "</span></a></li>";
      }).join("");
    }
    box.addEventListener("input", run); run();
  }

  // ---------- glossary filter
  function glossary() {
    var g = $("[data-gfilter]"); if (!g) return;
    g.addEventListener("input", function () {
      var t = g.value.trim().toLowerCase();
      $$("[data-term]").forEach(function (r) { r.hidden = t && r.getAttribute("data-term").indexOf(t) < 0; });
    });
  }

  // ---------- table of contents highlight
  function tocSpy() {
    var links = $$(".toc:not(.toc-inline) a"); if (!links.length || !("IntersectionObserver" in window)) return;
    var map = {}; links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { links.forEach(function (a) { a.classList.remove("on"); }); var a = map[e.target.id]; if (a) a.classList.add("on"); } });
    }, { rootMargin: "-80px 0px -70% 0px" });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  // ---------- chrome
  function chrome() {
    $$("[data-theme-toggle]").forEach(function (b) {
      b.addEventListener("click", function () {
        var cur = root.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        var nx = cur === "dark" ? "light" : "dark"; root.setAttribute("data-theme", nx); try { localStorage.setItem(THEME, nx); } catch (e) {}
      });
    });
    var mb = $("[data-menu]");
    if (mb) mb.addEventListener("click", function () { var o = document.body.classList.toggle("menu-open"); mb.setAttribute("aria-expanded", o); });
    document.addEventListener("keydown", function (e) {
      var t = e.target.tagName;
      if (e.key === "/" && t !== "INPUT" && t !== "TEXTAREA" && t !== "SELECT") {
        var s = $("[data-search]") || $("[data-f-q]") || $("[data-gfilter]");
        e.preventDefault(); if (s) s.focus(); else location.href = rel("search/");
      }
    });
    $$("[data-copy]").forEach(function (b) {
      b.addEventListener("click", function () {
        var t = b.parentNode.querySelector("code").innerText;
        function ok() { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1400); }
        function fallback() { var ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); ok(); } catch (e) {} ta.remove(); }
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(ok, fallback); else fallback();
      });
    });
    $$("[data-complete]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-complete");
        if (done[id]) delete done[id]; else done[id] = Date.now();
        save(PROG, done); paint();
      });
    });
    var ver = load(VER);
    $$("[data-verify]").forEach(function (c) {
      var k = c.getAttribute("data-verify"); c.checked = !!ver[k];
      c.addEventListener("change", function () { if (c.checked) ver[k] = 1; else delete ver[k]; save(VER, ver); });
    });
  }

  function init() { chrome(); filters(); search(); glossary(); tocSpy(); paint(); }
  window.addEventListener("storage", function (e) { if (e.key === PROG) { done = load(PROG); paint(); } });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
