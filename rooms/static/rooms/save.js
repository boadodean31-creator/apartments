/* Room cards: heart = save (kept in this browser only), share button = share link or copy it. */
(function () {
  var KEY = "ribay-saved-rooms";
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
  function write(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  var saved = read();
  var chip = document.querySelector(".chip-saved");

  function toast(msg) {
    var t = document.getElementById("rc-toast");
    if (!t) { t = document.createElement("div"); t.id = "rc-toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("on");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("on"); }, 2200);
  }
  function paint() {
    document.querySelectorAll("[data-save]").forEach(function (b) {
      var on = saved.indexOf(b.dataset.save) > -1, card = b.closest(".card");
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.setAttribute("aria-label", (on ? "Remove Room " : "Save Room ") + b.dataset.save + (on ? " from saved" : ""));
      if (card) card.classList.toggle("is-saved", on);
    });
    if (chip) {
      chip.hidden = saved.length === 0;
      var n = chip.querySelector(".n"); if (n) n.textContent = saved.length;
      if (!saved.length && chip.getAttribute("aria-pressed") === "true") { var all = document.querySelector('.chip[data-f="all"]'); if (all) all.click(); }
    }
    if (typeof applyFilter === "function" && typeof filt !== "undefined" && filt === "saved") applyFilter();
  }
  document.addEventListener("click", function (e) {
    var sv = e.target.closest && e.target.closest("[data-save]");
    if (sv) {
      e.preventDefault(); e.stopPropagation();
      var id = sv.dataset.save, i = saved.indexOf(id);
      if (i > -1) saved.splice(i, 1); else { saved.push(id); sv.classList.remove("pop"); void sv.offsetWidth; sv.classList.add("pop"); toast("Saved Room " + id); }
      write(saved); paint(); return;
    }
    var sh = e.target.closest && e.target.closest("[data-share]");
    if (sh) {
      e.preventDefault(); e.stopPropagation();
      var url = new URL(sh.dataset.url, location.href).href, title = sh.dataset.title || document.title;
      if (navigator.share) { navigator.share({ title: title, url: url }).catch(function () {}); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { toast("Link copied"); }, function () { toast(url); });
      else toast(url);
    }
  });
  paint();
})();
