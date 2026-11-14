/* Opens the "View the building" and "Contact us" windows (floating buttons, top bar "Contact", phone menu). */
(function () {
  var dlg = { building: document.getElementById("dlg-building"), contact: document.getElementById("dlg-contact") };
  if (!dlg.building || !dlg.contact) return;
  var lmDlg = document.getElementById("dlg-landmark"); if (lmDlg) dlg.landmark = lmDlg;
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
    if (b) { e.preventDefault(); if (b.dataset.open === "landmark") fillLandmark(b); open(b.dataset.open); return; }
    var a = e.target.closest("a[href]");
    if (a && /[?&]contact=1/.test(a.getAttribute("href")) && a.pathname === location.pathname) { e.preventDefault(); open("contact"); }
  });

  /* building: previous / next / dots follow the scroll position (swiping works natively) */
  function sync(d) {
    var show = d.querySelector(".bld-show"), t = d.querySelector(".bld-track"); if (!show || !t) return;
    var n = t.children.length, i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth));
    show.dataset.at = i <= 0 ? "0" : (i >= n - 1 ? "last" : "mid");
    d.querySelectorAll(".bld-th").forEach(function (el, k) { el.classList.toggle("on", k === i); });
  }
  var bt = dlg.building.querySelector(".bld-track");
  if (bt) {
    bt.addEventListener("scroll", function () { sync(dlg.building); }, { passive: true });
    dlg.building.querySelectorAll(".bld-nav").forEach(function (b) {
      b.addEventListener("click", function () { bt.scrollBy({ left: (b.classList.contains("next") ? 1 : -1) * bt.clientWidth }); });
    });
    dlg.building.querySelectorAll(".bld-th").forEach(function (b, k) {
      b.addEventListener("click", function () { bt.scrollTo({ left: k * bt.clientWidth }); });
    });
    bt.addEventListener("keydown", function (e) { if (e.key === "ArrowRight") bt.scrollBy({ left: bt.clientWidth }); if (e.key === "ArrowLeft") bt.scrollBy({ left: -bt.clientWidth }); });
    sync(dlg.building);
  }

  /* "Email us": on a computer open a Gmail compose window (works without a mail app set up);
     on phones and tablets use the normal mail link, which opens the Gmail / Mail app. */
  var mail = document.querySelector(".ct-mail");
  if (mail) mail.addEventListener("click", function (e) {
    var m = /^mailto:([^?]+)/i.exec(mail.getAttribute("href") || ""); if (!m) return;
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform))) return;
    e.preventDefault();
    var url = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(decodeURIComponent(m[1])) + "&su=" + encodeURIComponent("Room inquiry");
    var w = window.open(url, "_blank", "noopener"); if (!w) location.href = mail.getAttribute("href");
  });

  /* admins: the Add / Edit landmark window */
  function fillLandmark(btn) {
    var f = document.getElementById("lm-form"); if (!f) return;
    var edit = btn.dataset.id !== undefined, d = btn.dataset;
    f.reset();
    f.elements.id.value = edit ? d.id : "";
    f.elements.name.value = edit ? d.name : "";
    f.elements.kind.value = edit ? d.kind : "other";
    f.elements.detail.value = edit ? d.detail : "";
    f.elements.maps_url.value = edit ? d.maps : "";
    document.getElementById("lm-title").textContent = edit ? "Edit landmark" : "Add landmark";
    f.querySelector(".lm-save").textContent = edit ? "Save changes" : "Save landmark";
    showPrev(f, edit ? d.photo : "", edit && d.photo ? "Change photo" : "Upload landmark photo");
  }
  function showPrev(f, src, label) {
    var img = f.querySelector(".lm-prev"), t = f.querySelector(".lm-file");
    if (src) { img.src = src; img.hidden = false; } else { img.removeAttribute("src"); img.hidden = true; }
    t.textContent = label;
  }
  var lf = document.getElementById("lm-form");
  if (lf) lf.elements.photo.addEventListener("change", function () {
    var file = this.files && this.files[0];
    if (file) showPrev(lf, URL.createObjectURL(file), file.name); 
  });

  /* "Call now" / "Send a text": phones dial or open Messages. A computer cannot call, so it copies the number
     and tells the visitor (same idea as the Gmail button, which opens Gmail on a computer). */
  var toastEl = null;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "pg-toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    var host = document.querySelector("dialog[open]") || document.body; if (toastEl.parentNode !== host) host.appendChild(toastEl);
    toastEl.textContent = msg; toastEl.classList.add("on"); clearTimeout(toastEl._t); toastEl._t = setTimeout(function () { toastEl.classList.remove("on"); }, 3600);
  }
  function copyText(txt) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(txt).then(function () { return true; }, function () { return false; });
    var ta = document.createElement("textarea"); ta.value = txt; ta.style.cssText = "position:fixed;opacity:0"; (document.querySelector("dialog[open]") || document.body).appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return Promise.resolve(ok);
  }
  var isPhone = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
  document.querySelectorAll(".ct-acts a.ct-btn").forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (isPhone) return;
      e.preventDefault();
      var num = (a.getAttribute("href") || "").replace(/^(tel|sms):/i, "");
      var shown = (document.querySelector(".ct-num strong") || {}).textContent || num;
      var isCall = /^tel:/i.test(a.getAttribute("href"));
      copyText(num).then(function (ok) {
        toast(ok ? (isCall ? "Number copied: " + shown + ". Call it from your phone." : "Number copied: " + shown + ". Send your text from your phone.") : "Call or text " + shown);
      });
    });
  });

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
