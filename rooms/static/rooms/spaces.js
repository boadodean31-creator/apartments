/* Arrows and "1 / 2" counter for the Where you'll sleep / Restroom rows */
(function () {
  document.querySelectorAll("[data-sp]").forEach(function (box) {
    var track = box.querySelector(".sp-track");
    if (!track) return;
    var prev = box.querySelector(".sp-prev"), next = box.querySelector(".sp-next"), count = box.querySelector(".sp-count"), ctl = box.querySelector(".sp-ctl");
    function pages() { return Math.max(1, Math.ceil((track.scrollWidth - 2) / track.clientWidth)); }
    function sync() {
      var n = pages(), end = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
      var i = end ? n : Math.min(n, Math.round(track.scrollLeft / track.clientWidth) + 1);
      if (ctl) ctl.hidden = n < 2;
      if (count) count.textContent = i + " / " + n;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = end;
    }
    function go(d) { track.scrollBy({ left: d * track.clientWidth, behavior: "smooth" }); }
    if (prev) prev.addEventListener("click", function () { go(-1); });
    if (next) next.addEventListener("click", function () { go(1); });
    track.addEventListener("scroll", function () { window.requestAnimationFrame(sync); }, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  });
})();

/* Click a sleep / restroom photo to see it large (arrows, swipe, Esc work; reuses the photo viewer's look) */
(function () {
  var section = null, items = [], cur = 0, lastFocus = null;
  var lb = document.createElement("div");
  lb.className = "lb"; lb.hidden = true;
  lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true"); lb.setAttribute("aria-label", "Photo viewer");
  lb.innerHTML =
    '<button type="button" class="lb-close" aria-label="Close photo viewer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '<button type="button" class="lb-nav lb-prev" aria-label="Previous photo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
    '<button type="button" class="lb-nav lb-next" aria-label="Next photo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>' +
    '<figure class="lb-stage"><img class="lb-img" alt=""><figcaption class="lb-cap"></figcaption></figure>';
  document.body.appendChild(lb);
  var img = lb.querySelector(".lb-img"), cap = lb.querySelector(".lb-cap");
  var prev = lb.querySelector(".lb-prev"), next = lb.querySelector(".lb-next"), closeBtn = lb.querySelector(".lb-close");

  function render() {
    var it = items[cur];
    img.src = it.dataset.full; img.alt = it.dataset.cap || "";
    cap.textContent = (it.dataset.cap || "") + (items.length > 1 ? "  ·  " + (cur + 1) + " / " + items.length : "");
    prev.hidden = next.hidden = items.length < 2;
  }
  function open(btn) {
    section = btn.closest("[data-sp]");
    items = Array.prototype.slice.call(section.querySelectorAll(".sp-open"));
    cur = Math.max(0, items.indexOf(btn));
    lastFocus = document.activeElement;
    render();
    document.documentElement.style.overflow = "hidden";
    lb.hidden = false; void lb.offsetWidth; lb.classList.add("open");
    closeBtn.focus({ preventScroll: true });
  }
  function close() {
    if (lb.hidden) return;
    lb.classList.remove("open"); lb.hidden = true; img.removeAttribute("src");
    document.documentElement.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  function go(n) { if (items.length < 2) return; cur = (n + items.length) % items.length; render(); }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".sp-open");
    if (b) open(b);
  });
  closeBtn.addEventListener("click", close);
  prev.addEventListener("click", function () { go(cur - 1); });
  next.addEventListener("click", function () { go(cur + 1); });
  lb.addEventListener("click", function (e) { if (!e.target.closest("button, .lb-img, .lb-cap")) close(); });
  document.addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") go(cur - 1);
    else if (e.key === "ArrowRight") go(cur + 1);
  });
  var x0 = null;
  lb.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") x0 = e.clientX; });
  lb.addEventListener("pointerup", function (e) {
    if (x0 === null) return; var dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1));
  });
})();
