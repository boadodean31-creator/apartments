/* Admin area: side bar, theme, drop zones, photo manager, rooms filter. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }

  /* ---- small pop-up message (same look as the server ones) ---- */
  window.admToast = function (text, kind) {
    var box = $(".m-toasts");
    if (!box) { box = document.createElement("div"); box.className = "m-toasts"; document.body.appendChild(box); }
    var t = document.createElement("div");
    t.className = "m-toast " + (kind || "success"); t.setAttribute("role", kind === "error" ? "alert" : "status");
    t.innerHTML = '<span class="m-ico" aria-hidden="true"></span><span class="m-txt"></span><button type="button" class="m-x" aria-label="Dismiss">×</button><i class="m-bar" aria-hidden="true"></i>';
    $(".m-ico", t).textContent = kind === "error" ? "!" : "✓";
    $(".m-txt", t).textContent = text;
    box.appendChild(t);
    if (kind !== "error") setTimeout(function () { t.remove(); }, 5200);
  };

  /* ---- side bar ---- */
  var root = document.documentElement, body = document.body;
  var collapse = $("#admCollapse");
  if (collapse) collapse.addEventListener("click", function () {
    var on = root.classList.toggle("adm-rail"); store("adm-rail", on ? "1" : "0");
  });
  var burger = $("#admBurger"), scrim = $("#admScrim");
  function drawer(open) {
    body.classList.toggle("adm-open", open);
    if (scrim) scrim.hidden = !open;
    if (burger) { burger.setAttribute("aria-expanded", open ? "true" : "false"); }
  }
  if (burger) burger.addEventListener("click", function () { drawer(!body.classList.contains("adm-open")); });
  if (scrim) scrim.addEventListener("click", function () { drawer(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") drawer(false); });

  var theme = $("#admTheme");
  if (theme) theme.addEventListener("click", function () {
    var next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next; store("theme", next);
  });

  /* ---- generic drop zones: <label class="m-drop"><input type=file> (data-auto = send the form as soon as a file is chosen) ---- */
  $$(".m-drop").forEach(function (z) {
    var input = $("input[type=file]", z);
    if (!input || z.dataset.manual) return;
    ["dragenter", "dragover"].forEach(function (ev) { z.addEventListener(ev, function (e) { e.preventDefault(); z.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { z.addEventListener(ev, function () { z.classList.remove("over"); }); });
    z.addEventListener("drop", function (e) {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files.length) {
        try { input.files = e.dataTransfer.files; } catch (err) { return; }
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    if (z.dataset.auto !== undefined) input.addEventListener("change", function () {
      if (!input.files.length) return;
      var f = input.form; if (!f) return;
      z.classList.add("busy"); var b = $("b", z); if (b) b.textContent = "Uploading " + input.files[0].name + "…";
      if (f.requestSubmit) f.requestSubmit(); else f.submit();
    });
  });
  window.addEventListener("pageshow", function () { $$(".m-drop.busy").forEach(function (z) { z.classList.remove("busy"); }); });

  /* ---- photo manager (room form) ---- */
  var mgr = $("#photomgr");
  if (mgr) (function () {
    var instant = !!mgr.dataset.upload;
    var grid = $("#pm"), drop = $(".m-drop", mgr), pick = $("input[type=file]", drop);
    var count = $("#pmCount"), errBox = $("#pmErr");
    var token = ($("[name=csrfmiddlewaretoken]", mgr) || {}).value || "";
    var realInput = $("#photos");      // new room: the file field that is sent with the form
    var queue = [];                    // new room: files waiting to be saved with the room

    var ICON = {
      star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z"/></svg>',
      del: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/></svg>',
      x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>'
    };
    function refresh() {
      var n = grid.children.length;
      if (count) count.textContent = n ? n : "";
      var hint = $("#pmHint"); if (hint) hint.hidden = n < 2;
    }
    function showErrors(list) {
      if (!errBox) return;
      errBox.textContent = list && list.length ? list.join("  ") : ""; errBox.hidden = !(list && list.length);
    }
    function item(src, id, isNew) {
      var el = document.createElement("div");
      el.className = "pm-item" + (isNew ? " new" : ""); el.draggable = true; if (id) el.dataset.id = id;
      el.innerHTML = '<img alt=""><span class="pm-tag">Cover</span><div class="pm-bar"><button type="button" class="mk" title="Make cover" aria-label="Make this the cover photo">' + ICON.star + '</button><button type="button" class="del" title="' + (instant ? "Delete" : "Remove") + '" aria-label="' + (instant ? "Delete photo" : "Remove photo") + '">' + (instant ? ICON.del : ICON.x) + '</button></div>';
      $("img", el).src = src;
      return el;
    }

    /* order: save (instant) or rebuild the file list (new room) */
    function ids() { return $$(".pm-item", grid).map(function (e) { return e.dataset.id; }).join(","); }
    function syncQueue() {
      var order = $$(".pm-item", grid).map(function (e) { return queue[+e.dataset.q]; }).filter(Boolean);
      var dt = new DataTransfer(); order.forEach(function (f) { dt.items.add(f); });
      if (realInput) realInput.files = dt.files;
    }
    var saving = 0;
    function saveOrder(msg) {
      if (!instant) { syncQueue(); return; }
      var fd = new FormData(); fd.append("order", ids()); fd.append("csrfmiddlewaretoken", token);
      var mine = ++saving;
      fetch(mgr.dataset.order, { method: "POST", body: fd, credentials: "same-origin", headers: { "X-Requested-With": "fetch" } })
        .then(function (r) { if (!r.ok) throw 0; if (mine === saving && msg) window.admToast(msg); })
        .catch(function () { window.admToast("Could not save the order. Please try again.", "error"); });
    }

    /* upload */
    function addFiles(files) {
      files = Array.prototype.filter.call(files, function (f) { return f.type.indexOf("image/") === 0; });
      if (!files.length) { showErrors(["Please choose picture files (JPG or PNG)."]); return; }
      showErrors([]);
      if (!instant) {
        files.forEach(function (f) {
          if (queue.some(function (q) { return q.name === f.name && q.size === f.size && q.lastModified === f.lastModified; })) return;
          queue.push(f);
          var el = item(URL.createObjectURL(f), "", true); el.dataset.q = queue.length - 1; grid.appendChild(el);
        });
        syncQueue(); refresh(); return;
      }
      var fd = new FormData(); fd.append("csrfmiddlewaretoken", token);
      files.forEach(function (f) { fd.append("photos", f); });
      drop.classList.add("busy"); var label = $("b", drop), old = label.innerHTML;
      label.textContent = "Uploading " + files.length + (files.length === 1 ? " photo…" : " photos…");
      fetch(mgr.dataset.upload, { method: "POST", body: fd, credentials: "same-origin", headers: { "X-Requested-With": "fetch" } })
        .then(function (r) { return r.json().catch(function () { return { photos: [], errors: ["Upload failed. Please try again."] }; }); })
        .then(function (d) {
          (d.photos || []).forEach(function (p) { grid.appendChild(item(p.url, p.id, true)); });
          showErrors(d.errors || []);
          if ((d.photos || []).length) window.admToast((d.photos.length === 1 ? "1 photo" : d.photos.length + " photos") + " added. It is live on the website.");
        })
        .catch(function () { showErrors(["Upload failed. Please check your connection and try again."]); })
        .then(function () { drop.classList.remove("busy"); label.innerHTML = old; refresh(); });
    }
    drop.dataset.manual = "1";
    ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.remove("over"); }); });
    drop.addEventListener("drop", function (e) { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files.length && !$(".pm-item.drag")) addFiles(e.dataTransfer.files); });
    pick.addEventListener("change", function () { addFiles(pick.files); pick.value = ""; });

    /* buttons on each photo */
    grid.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var el = b.closest(".pm-item"); if (!el) return;
      if (b.classList.contains("mk")) {
        if (el === grid.firstElementChild) return;
        grid.insertBefore(el, grid.firstElementChild); saveOrder("Cover photo updated."); return;
      }
      if (b.classList.contains("del")) {
        if (!instant) { el.remove(); queue[+el.dataset.q] = null; syncQueue(); refresh(); return; }
        if (!confirm("Delete this photo?")) return;
        var fd = new FormData(); fd.append("csrfmiddlewaretoken", token);
        fetch(mgr.dataset.delete.replace("/0/", "/" + el.dataset.id + "/"), { method: "POST", body: fd, credentials: "same-origin", headers: { "X-Requested-With": "fetch" } })
          .then(function (r) { if (!r.ok) throw 0; el.remove(); refresh(); window.admToast("Photo deleted."); })
          .catch(function () { window.admToast("Could not delete the photo.", "error"); });
      }
    });

    /* drag to reorder (mouse); phones use the star button */
    var dragging = null;
    grid.addEventListener("dragstart", function (e) {
      dragging = e.target.closest(".pm-item"); if (!dragging) return;
      dragging.classList.add("drag"); e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", "photo"); } catch (err) {}
    });
    grid.addEventListener("dragover", function (e) {
      if (!dragging) return; e.preventDefault();
      var over = e.target.closest(".pm-item"); if (!over || over === dragging) return;
      var r = over.getBoundingClientRect(), after = (e.clientX - r.left) > r.width / 2;
      grid.insertBefore(dragging, after ? over.nextSibling : over);
    });
    grid.addEventListener("dragend", function () {
      if (!dragging) return; dragging.classList.remove("drag"); dragging = null;
      var first = grid.firstElementChild && grid.firstElementChild.dataset.id;
      saveOrder("Photo order saved." + (first && first !== mgr.dataset.cover ? " The first photo is now the cover." : "")); mgr.dataset.cover = first || "";
    });
    mgr.dataset.cover = grid.firstElementChild ? grid.firstElementChild.dataset.id : "";
    $$(".pm-item", grid).forEach(function (e) { e.draggable = true; });
    refresh();
  })();

  /* ---- rooms overview: search + filter ---- */
  var search = $("#roomSearch"), seg = $("#roomSeg");
  if (search || seg) {
    var state = "all";
    var apply = function () {
      var q = search ? search.value.trim().toLowerCase() : "", shown = 0;
      $$(".m-row[data-num]").forEach(function (r) {
        var ok = (state === "all" || r.dataset.status === state) && (!q || r.dataset.num.toLowerCase().indexOf(q) > -1 || (r.dataset.type || "").toLowerCase().indexOf(q) > -1);
        r.hidden = !ok; if (ok) shown++;
      });
      $$(".m-floor").forEach(function (f) { f.hidden = !$$(".m-row[data-num]", f).some(function (r) { return !r.hidden; }); });
      var none = $("#roomNone"); if (none) none.hidden = shown > 0;
    };
    if (search) search.addEventListener("input", apply);
    if (seg) seg.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      state = b.dataset.f; $$("button", seg).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); apply();
    });
  }
})();
