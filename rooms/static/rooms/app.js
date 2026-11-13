const $ = s => document.querySelector(s);
const root = document.documentElement;
const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;

// Toast messages
document.addEventListener("click", e => {
  const t = e.target.closest("[data-toast]");
  if (t) {
    const o = $("#toast");
    o.textContent = t.dataset.toast;
    o.classList.add("on");
    clearTimeout(o._t);
    o._t = setTimeout(() => o.classList.remove("on"), 2200);
  }
});

// Replay the "rise" animation on an element (used when filters change)
function replay(el, i) {
  el.style.setProperty("--i", i);
  el.classList.remove("in");
  void el.offsetWidth;          // force the browser to restart the animation
  el.classList.add("in");
}

// Room filters
let filt = "all";
function applyFilter() {
  let shown = 0;
  document.querySelectorAll("#grid .card").forEach(c => {
    const ok = filt === "all" || (filt === "avail" && c.dataset.avail === "1") || filt === c.dataset.floor;
    c.hidden = !ok;
    if (ok) replay(c, shown++ % 6);
  });
  const none = $("#none");
  if (none) none.hidden = shown > 0;
  // "Showing 3 rooms on 2nd floor" line (shown on phones)
  const res = $("#res");
  if (res) {
    const chip = [...document.querySelectorAll(".chip")].find(x => x.dataset.f === filt);
    const name = chip ? chip.childNodes[0].textContent.trim() : "";
    const n = shown + (shown === 1 ? " room" : " rooms");
    res.textContent = filt === "all" ? "Showing all " + n : filt === "avail" ? "Showing " + shown + " available " + (shown === 1 ? "room" : "rooms") : "Showing " + n + " on " + name;
  }
}
function setFilter(f) {
  filt = f;
  document.querySelectorAll(".chip").forEach(x => {
    const on = x.dataset.f === f;
    x.setAttribute("aria-pressed", on);
    if (on && x.scrollIntoView && matchMedia("(max-width: 820px)").matches) x.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" });
  });
  applyFilter();
}
document.querySelectorAll(".chip").forEach(c => c.onclick = () => setFilter(c.dataset.f));

// Building overview: "Show in list" centres the room's card on screen, then highlights it for about a second
let hlTimer = 0;
function highlightCard(el) {
  document.querySelectorAll(".card.hl").forEach(c => c.classList.remove("hl"));
  void el.offsetWidth;                       // restart the animation if it is clicked again
  el.classList.add("hl");
  clearTimeout(hlTimer);
  hlTimer = setTimeout(() => el.classList.remove("hl"), 1600);
}
document.addEventListener("click", e => {
  const g = e.target.closest("[data-go]");
  if (!g) return;
  setFilter("all");
  const el = document.getElementById("room-" + g.dataset.go);
  if (!el) return;
  const r = el.getBoundingClientRect();
  const centred = Math.abs((r.top + r.height / 2) - innerHeight / 2) < 6;
  if (reduce || centred) { el.scrollIntoView({ behavior: "auto", block: "center" }); highlightCard(el); return; }
  // wait until the smooth scroll has actually stopped, so the highlight plays on screen
  let done = false;
  const go = () => { if (done) return; done = true; removeEventListener("scrollend", go); highlightCard(el); };
  if ("onscrollend" in window) addEventListener("scrollend", go, { once: true });
  setTimeout(go, 900);                       // fallback for browsers without scrollend
  el.scrollIntoView({ behavior: "smooth", block: "center" });
});

// Scroll reveal: elements fade and rise as they enter the screen
const targets = document.querySelectorAll(".card,.stat,.ledger,.addr,.map,.head,.main,.info,.video,.sub,.receipt,.amen");
if ("IntersectionObserver" in window && !reduce) {
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }), { threshold: 0.12 });
  targets.forEach((el, i) => { el.classList.add("reveal"); el.style.setProperty("--i", i % 6); io.observe(el); });
}

// Cursor spotlight on cards
document.addEventListener("pointermove", e => {
  const c = e.target.closest && e.target.closest(".card");
  if (!c) return;
  const r = c.getBoundingClientRect();
  c.style.setProperty("--mx", (e.clientX - r.left) + "px");
  c.style.setProperty("--my", (e.clientY - r.top) + "px");
});

// Header shadow after scrolling
const hdr = document.querySelector("header");
const onScroll = () => hdr && hdr.classList.toggle("scrolled", window.scrollY > 8);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Dark mode toggle (the button spins each time)
const tb = $("#theme");
let angle = 0;
const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme:dark)").matches;
const sync = () => tb && tb.setAttribute("aria-label", isDark() ? "Switch to light mode" : "Switch to dark mode");
if (tb) tb.onclick = () => {
  const n = isDark() ? "light" : "dark";
  root.dataset.theme = n;
  try { localStorage.setItem("theme", n); } catch (e) {}
  angle += 180;
  tb.style.setProperty("--r", angle + "deg");
  sync();
};
sync();

/* Navbar: highlight the pill for the section / page the visitor is on */
(() => {
  const links = [...document.querySelectorAll("header .navpill, header .portal-link")];
  if (!links.length) return;
  const mark = (el) => links.forEach((a) => { const on = a === el; a.classList.toggle("active", on); on ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current"); });
  const portal = links.find((a) => a.classList.contains("portal-link"));
  if (portal && location.pathname.startsWith(new URL(portal.href).pathname)) { mark(portal); return; }
  const home = links.find((a) => a.classList.contains("navpill"));
  if (!home || location.pathname !== new URL(home.href).pathname) return;
  const spots = links.filter((a) => a.classList.contains("navpill")).map((a) => ({ a, s: document.querySelector(new URL(a.href).hash) })).filter((x) => x.s);
  if (!spots.length || !("IntersectionObserver" in window)) return;
  const seen = new Map();
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => seen.set(e.target, e.isIntersecting));
    const cur = spots.find((x) => seen.get(x.s));
    mark(cur ? cur.a : null);
  }, { rootMargin: "-40% 0px -50% 0px" });
  spots.forEach((x) => io.observe(x.s));
})();


/* Phone menu: the burger button opens a panel with every link */
(() => {
  const btn = document.getElementById("menuBtn"), panel = document.getElementById("mnav"), hdr = document.querySelector("header");
  if (!btn || !panel || !hdr) return;
  const set = (open) => {
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    hdr.classList.toggle("menu-open", open);
  };
  btn.addEventListener("click", (e) => { e.stopPropagation(); set(panel.hidden); });
  panel.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
  document.addEventListener("click", (e) => { if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) set(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { set(false); btn.focus(); } });
  window.matchMedia("(min-width: 961px)").addEventListener("change", (m) => { if (m.matches) set(false); });
})();


// "Landmarks" in the top bar: bring "Everything you need is close by" to the exact middle of the screen
(function () {
  const reduceM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function target(el, smooth) {
    const hd = document.querySelector("header"), hh = hd ? hd.getBoundingClientRect().bottom : 0;
    const r = el.getBoundingClientRect(), usable = innerHeight - hh;
    const y = r.height + 32 <= usable ? scrollY + r.top - hh - (usable - r.height) / 2 : scrollY + r.top - hh - 16;
    scrollTo({ top: Math.max(0, y), behavior: smooth && !reduceM ? "smooth" : "auto" });
  }
  function bring(smooth) {
    const el = document.getElementById("nearby"); if (!el) return false;
    target(el, smooth);
    // scroll-reveal animations can nudge the section after it lands, so measure once more when it stops
    let last = scrollY, still = 0; const t0 = performance.now();
    (function tick() {
      if (scrollY === last) { if (++still >= 8) { target(el, false); return; } } else { still = 0; last = scrollY; }
      if (performance.now() - t0 < 2400) requestAnimationFrame(tick);
    })();
    return true;
  }
  document.addEventListener("click", function (e) {
    const a = e.target.closest && e.target.closest('a[href$="#nearby"]');
    if (!a || !document.getElementById("nearby")) return;       // on other pages the link just goes to the home page
    e.preventDefault();
    try { history.replaceState(null, "", location.pathname + "#nearby"); } catch (_) {}
    bring(true);
  });
  if (location.hash === "#nearby") addEventListener("load", function () { setTimeout(function () { bring(false); }, 200); });
})();
