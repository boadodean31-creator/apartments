/* Opens the "View the building" and "Contact us" windows (floating buttons, top bar "Contact", phone menu). */
(function () {
  var dlg = { building: document.getElementById("dlg-building"), contact: document.getElementById("dlg-contact") };
  if (!dlg.building || !dlg.contact) return;
  var lastFocus = null;

  function open(name) {
    var d = dlg[name]; if (!d || d.open) return;
    lastFocus = document.activeElement;
    var menu = document.getElementById("menuBtn"); if (menu && menu.getAttribute("aria-expanded") === "true") menu.click();
    d.classList.remove("closing"); d.showModal();
    document.documentElement.style.overflow = "hidden";
    if (name === "building") { var t = d.querySelector(".bld-track"); if (t) { t.style.scrollBehavior = "auto"; t.scrollLeft = 0; t.style.scrollBehavior = ""; sync(d); } }
  }
  function close(d) {
    if (!d.open || d.classList.contains("closing")) return;
    var done = function () { d.classList.remove("closing"); d.close(); };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) done(); else { d.classList.add("closing"); setTimeout(done, 190); }
  }
  Object.keys(dlg).forEach(function (k) {
    var d = dlg[k];
    d.addEventListener("cancel", function (e) { e.preventDefault(); close(d); });
    d.addEventListener("close", function () {
      document.documentElement.style.overflow = "";
      if (/[?&](building|contact)=1/.test(location.search)) history.replaceState(null, "", location.pathname + location.hash);
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (_) {} }
    });
    d.addEventListener("click", function (e) { if (e.target === d || e.target.closest("[data-close]")) close(d); else if (!e.target.closest(".pg-card")) close(d); });
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-open]");
    if (b) { e.preventDefault(); open(b.dataset.open); return; }
    var a = e.target.closest("a[href]");
    if (a && /[?&]contact=1/.test(a.getAttribute("href")) && a.pathname === location.pathname) { e.preventDefault(); open("contact"); }
  });

  /* building: previous / next / dots follow the scroll position (swiping works natively) */
  function sync(d) {
    var show = d.querySelector(".bld-show"), t = d.querySelector(".bld-track"); if (!show || !t) return;
    var n = t.children.length, i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth));
    show.dataset.at = i <= 0 ? "0" : (i >= n - 1 ? "last" : "mid");
    show.querySelectorAll(".bld-dots i").forEach(function (el, k) { el.classList.toggle("on", k === i); });
  }
  var bt = dlg.building.querySelector(".bld-track");
  if (bt) {
    bt.addEventListener("scroll", function () { sync(dlg.building); }, { passive: true });
    dlg.building.querySelectorAll(".bld-nav").forEach(function (b) {
      b.addEventListener("click", function () { bt.scrollBy({ left: (b.classList.contains("next") ? 1 : -1) * bt.clientWidth }); });
    });
    bt.addEventListener("keydown", function (e) { if (e.key === "ArrowRight") bt.scrollBy({ left: bt.clientWidth }); if (e.key === "ArrowLeft") bt.scrollBy({ left: -bt.clientWidth }); });
    sync(dlg.building);
  }

  /* admins: save contact details without leaving the page, then show the new details */
  var f = document.getElementById("ct-form");
  if (f) f.addEventListener("submit", function (e) {
    e.preventDefault();
    var err = document.getElementById("ct-err"); err.hidden = true;
    fetch(f.action, { method: "POST", body: new FormData(f), headers: { "X-Requested-With": "XMLHttpRequest" } })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (r) {
        if (r.ok && r.j.ok) { location.href = location.pathname + "?contact=1"; return; }
        var m = []; Object.keys(r.j.errors || {}).forEach(function (k) { m = m.concat(r.j.errors[k]); });
        err.textContent = m[0] || "Could not save. Please try again."; err.hidden = false;
      })
      .catch(function () { err.textContent = "Could not save. Check your connection."; err.hidden = false; });
  });

  /* open from a link such as /?contact=1 or /?building=1 */
  var q = location.search;
  if (/[?&]building=1/.test(q)) open("building"); else if (/[?&]contact=1/.test(q)) open("contact");
})();
