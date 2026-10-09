/* Upskill AI Infra - UI behaviour: theme, menu, progress, tabs, filters, copy, login. */
(function () {
  "use strict";
  var PROG = "uai-progress-v1", VER = "uai-verify-v1", THEME = "uai-theme";
  var root = document.documentElement;
  function load(k) { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  var done = load(PROG);

  // ---------- progress rendering
  function paint() {
    $$("[data-lab]").forEach(function (el) { el.classList.toggle("is-done", !!done[el.getAttribute("data-lab")]); });
    $$("[data-prog]").forEach(function (el) {
      var ids = el.getAttribute("data-prog").split(",").filter(Boolean);
      var n = ids.filter(function (i) { return done[i]; }).length;
      var pct = ids.length ? Math.round(100 * n / ids.length) : 0;
      var bar = $(".bar span", el); if (bar) bar.style.width = pct + "%";
      var t = $("[data-prog-text]", el); if (t) t.textContent = n + " / " + ids.length + " done · " + pct + "%";
    });
    $$("[data-ring]").forEach(function (el) {
      var ids = el.getAttribute("data-ring").split(",");
      var n = ids.filter(function (i) { return done[i]; }).length, pct = Math.round(100 * n / ids.length);
      var c = $(".r-fg", el), L = 2 * Math.PI * 52;
      c.style.strokeDasharray = L; c.style.strokeDashoffset = L * (1 - pct / 100);
      $("[data-ring-pct]", el).textContent = pct + "%";
      $("[data-ring-count]", el).textContent = n + " of " + ids.length + " labs";
    });
    $$("[data-complete]").forEach(function (b) {
      var on = !!done[b.getAttribute("data-complete")];
      b.classList.toggle("is-on", on);
      var s = $("span", b); if (s) s.textContent = on ? "Completed - click to undo" : ("Mark " + (b.getAttribute("data-label") || "lab") + " complete");
    });
    var idx = readJSON("labindex");
    if (idx) {
      var next = idx.filter(function (l) { return !done[l.id]; })[0];
      $$("[data-continue]").forEach(function (a) {
        if (!next) { a.querySelector("span").textContent = "All labs done - review the capstone"; a.href = rel("labs/l1/"); return; }
        a.href = rel("labs/" + next.id.toLowerCase() + "/");
        a.querySelector("span").textContent = (Object.keys(done).length ? "Continue: " : "Start: ") + next.id + " · " + next.t;
      });
    }
    $$("[data-continue-in]").forEach(function (a) {
      var ids = a.getAttribute("data-continue-in").split(","), nx = ids.filter(function (i) { return !done[i]; })[0];
      if (nx) { a.href = rel("labs/" + nx.toLowerCase() + "/"); $("span", a).textContent = (ids.indexOf(nx) ? "Continue " : "Start ") + nx; }
      else { $("span", a).textContent = "Course complete"; }
    });
  }
  function rel(p) { return (document.body.getAttribute("data-root") || "./") + p; }
  function readJSON(id) { var el = document.getElementById(id); try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; } }

  // ---------- this week (dashboard) + schedule highlight
  function weekInfo() {
    var s = readJSON("schedule"); if (!s) return null;
    var start = new Date(s.start + "T00:00:00"), now = new Date();
    var w = Math.floor((now - start) / (7 * 864e5));
    return { s: s, w: w, days: Math.ceil((start - now) / 864e5) };
  }
  function renderWeek() {
    var box = $("[data-week]"); if (!box) return;
    var wi = weekInfo(), idx = readJSON("labindex") || [], T = {};
    idx.forEach(function (l) { T[l.id] = l; });
    var s = wi.s, w = wi.w, week, head;
    if (w < 0) { week = s.weeks[0]; head = "Week 1 starts in " + wi.days + " day" + (wi.days === 1 ? "" : "s") + " (" + week.starts + "). Use the time for Day-0 setup."; }
    else if (w >= s.weeks.length) { week = s.weeks[s.weeks.length - 1]; head = "The 22-week plan has finished. Keep going at your own pace."; }
    else { week = s.weeks[w]; head = week.week + " · starts " + week.starts + " · " + week.hours + " h planned"; }
    box.innerHTML = '<p class="muted">' + head + '</p><ul class="mini">' + week.tasks.map(function (id) {
      var l = T[id] || { t: "" };
      return '<li data-lab="' + id + '"><a href="' + rel("labs/" + id.toLowerCase() + "/") + '"><span class="lid">' + id + "</span>" + esc(l.t) + "</a></li>";
    }).join("") + "</ul>";
  }
  function markWeekRow() {
    var rows = $$("[data-weekrow]"); if (!rows.length) return;
    var start = new Date("2026-10-12T00:00:00"), w = Math.floor((new Date() - start) / (7 * 864e5));
    rows.forEach(function (r) { if (+r.getAttribute("data-weekrow") === w) r.classList.add("now"); });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ---------- tabs
  function tabs() {
    $$("[data-tabs]").forEach(function (box) {
      var list = $$('[role="tab"]', box);
      function show(tab, push) {
        list.forEach(function (t) {
          var on = t === tab; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1;
          document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
        });
        if (push) history.replaceState(null, "", "#" + tab.id.replace("tab-", ""));
      }
      list.forEach(function (t, i) {
        t.addEventListener("click", function () { show(t, true); });
        t.addEventListener("keydown", function (e) {
          var k = e.key, j = k === "ArrowRight" ? i + 1 : k === "ArrowLeft" ? i - 1 : null;
          if (j === null) return; e.preventDefault(); var n = list[(j + list.length) % list.length]; n.focus(); show(n, true);
        });
      });
      var h = location.hash.slice(1), start = h && document.getElementById("tab-" + h);
      if (start) show(start, false);
      $$("[data-goto-tab]").forEach(function (b) {
        b.addEventListener("click", function () { var t = document.getElementById(b.getAttribute("data-goto-tab")); show(t, true); box.scrollIntoView({ behavior: "smooth", block: "start" }); });
      });
    });
  }

  // ---------- catalog filters
  function filters() {
    var f = $("[data-filters]"); if (!f) return;
    var cards = $$(".grid-labs .lcard"), level = "all";
    var q = $("[data-f-q]", f), dom = $("[data-f-domain]", f), env = $("[data-f-env]", f), st = $("[data-f-status]", f), core = $("[data-f-core]", f);
    var params = new URLSearchParams(location.search);
    if (params.get("q")) q.value = params.get("q");
    if (params.get("domain")) dom.value = params.get("domain");
    function apply() {
      var term = q.value.trim().toLowerCase(), n = 0;
      cards.forEach(function (c) {
        var ok = (level === "all" || c.dataset.level === level) && (dom.value === "all" || c.dataset.domain === dom.value) &&
          (env.value === "all" || c.dataset.env === env.value) && (!core.checked || c.dataset.core === "1") &&
          (st.value === "all" || (st.value === "done") === !!done[c.dataset.lab]) && (!term || c.dataset.text.indexOf(term) > -1);
        c.hidden = !ok; if (ok) n++;
      });
      $("[data-f-count]").textContent = n + " of " + cards.length + " labs";
      $("[data-f-empty]").hidden = n > 0;
    }
    $$("[data-f-level]", f).forEach(function (b) {
      b.addEventListener("click", function () { $$("[data-f-level]", f).forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on"); level = b.getAttribute("data-f-level"); apply(); });
    });
    [q, dom, env, st, core].forEach(function (el) { el.addEventListener("input", apply); el.addEventListener("change", apply); });
    apply();
  }

  // ---------- login form
  function loginForm() {
    var form = $("#login-form"); if (!form) return;
    var params = new URLSearchParams(location.search), err = $("#login-err");
    if (params.get("r") === "expired") { err.hidden = false; err.textContent = "The site was updated or your session ended. Please sign in again."; }
    if (window.UAIAuth.signedIn() && params.get("r") !== "expired") { go(); return; }
    $("[data-reveal]").addEventListener("click", function (e) { var p = $("#p"); p.type = p.type === "password" ? "text" : "password"; e.target.textContent = p.type === "password" ? "Show" : "Hide"; });
    form.addEventListener("submit", async function (e) {
      e.preventDefault(); err.hidden = true;
      var btn = $("#login-btn"); btn.disabled = true; btn.classList.add("busy");
      try { await window.UAIAuth.login($("#u").value, $("#p").value, $("#remember").checked); go(); }
      catch (x) { err.hidden = false; err.textContent = x.message; btn.disabled = false; btn.classList.remove("busy"); $("#p").select(); }
    });
    function go() {
      var n = params.get("next") || "dashboard/";
      if (/^(https?:)?\/\//i.test(n) || n.indexOf("..") > -1) n = "dashboard/";
      location.replace(rel(n || "dashboard/"));
    }
  }

  // ---------- common chrome
  function chrome() {
    $$("[data-theme-toggle]").forEach(function (b) {
      b.addEventListener("click", function () {
        var cur = root.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        var nx = cur === "dark" ? "light" : "dark"; root.setAttribute("data-theme", nx); try { localStorage.setItem(THEME, nx); } catch (e) {}
      });
    });
    $$("[data-logout]").forEach(function (b) { b.addEventListener("click", function () { window.UAIAuth.logout(); }); });
    var mb = $("[data-menu]");
    if (mb) mb.addEventListener("click", function () { var o = document.body.classList.toggle("menu-open"); mb.setAttribute("aria-expanded", o); });
    $$("[data-copy]").forEach(function (b) {
      b.addEventListener("click", function () {
        var t = b.parentNode.querySelector("code").innerText;
        function ok() { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1400); }
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(ok, fallback); else fallback();
        function fallback() { var ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); ok(); } catch (e) {} ta.remove(); }
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
    // landing page: signed-in users go straight in
    if (document.body.getAttribute("data-page") === "landing" && window.UAIAuth && window.UAIAuth.signedIn()) {
      $$('a[href$="login/"]').forEach(function (a) { a.href = rel("dashboard/"); var s = a.lastChild; if (s && s.nodeType === 3) s.textContent = "Go to dashboard"; });
    }
  }

  function init() { chrome(); tabs(); filters(); renderWeek(); markWeekRow(); loginForm(); paint(); }
  window.addEventListener("storage", function (e) { if (e.key === PROG) { done = load(PROG); paint(); } });
  if (document.body.hasAttribute("data-protected")) { if (window.__uaiReady) init(); else document.addEventListener("uai:ready", init); }
  else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
