/* Photo slideshow used by the "Pick a room" panel and by the room cards (on hover).
   RibaySlides.create(box, {interval, dots, hoverPause}) -> { load(urls, first), play(), stop(), reset() }
   The box must contain one <img>. The next photo slides in over it; dots show progress. */
(function () {
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DUR = 700;

  function create(box, o) {
    o = o || {};
    var interval = o.interval || 3000;
    var base = box.querySelector("img");
    var urls = [], i = 0, timer = 0, busy = false, hovering = false, playing = false, gen = 0;
    var dotsEl = null;

    if (o.dots) { dotsEl = document.createElement("div"); dotsEl.className = "sl-dots"; dotsEl.setAttribute("aria-hidden", "true"); box.appendChild(dotsEl); }
    if (o.hoverPause) {
      box.addEventListener("pointerenter", function () { hovering = true; clearTimeout(timer); if (dotsEl) dotsEl.classList.add("paused"); });
      box.addEventListener("pointerleave", function () { hovering = false; if (dotsEl) dotsEl.classList.remove("paused"); if (playing) schedule(); });
    }

    function paintDots() {
      if (!dotsEl) return;
      dotsEl.innerHTML = "";
      if (urls.length < 2) return;
      for (var k = 0; k < urls.length; k++) {
        var d = document.createElement("i");
        if (k === i) { d.className = "on"; d.style.setProperty("--t", interval + "ms"); }
        dotsEl.appendChild(d);
      }
    }
    function schedule() { clearTimeout(timer); if (!playing || hovering || urls.length < 2 || reduce) return; timer = setTimeout(function () { go((i + 1) % urls.length); }, o.first && i === 0 ? o.first : interval); }

    function go(n) {
      if (busy || n === i || !urls[n]) { schedule(); return; }
      busy = true; var g = gen;
      var nx = new Image(); nx.alt = base.alt; nx.className = "sl-img sl-in";
      var ready = function () {
        if (g !== gen) { busy = false; return; }
        box.appendChild(nx); void nx.offsetWidth;
        base.classList.add("sl-out"); nx.classList.remove("sl-in");
        i = n; paintDots();
        setTimeout(function () {
          if (g === gen) {
            base.style.transition = "none"; base.src = urls[n]; base.classList.remove("sl-out"); void base.offsetWidth; base.style.transition = "";
          }
          nx.remove(); busy = false; schedule();
        }, DUR + 30);
      };
      nx.onload = ready; nx.onerror = function () { busy = false; urls.splice(n, 1); schedule(); };
      nx.src = urls[n];
    }

    return {
      load: function (list, first) {
        gen++; clearTimeout(timer); busy = false;
        box.querySelectorAll(".sl-img").forEach(function (x) { x.remove(); });
        base.classList.remove("sl-out");
        urls = (list || []).filter(Boolean); if (!urls.length && first) urls = [first];
        i = 0; paintDots();
        if (o.autoplay !== false) this.play();
      },
      play: function () { playing = true; schedule(); },
      stop: function () { playing = false; clearTimeout(timer); },
      reset: function () {            // back to the first photo, no animation
        gen++; clearTimeout(timer); busy = false; playing = false;
        box.querySelectorAll(".sl-img").forEach(function (x) { x.remove(); });
        base.classList.remove("sl-out");
        if (urls[0] && i !== 0) { base.style.transition = "none"; base.src = urls[0]; void base.offsetWidth; base.style.transition = ""; }
        i = 0; paintDots();
      },
      count: function () { return urls.length; }
    };
  }
  window.RibaySlides = { create: create };

  /* Room cards: hovering a card previews its other photos */
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches || reduce) return;
  document.querySelectorAll(".card[data-photos]").forEach(function (card) {
    var urls = (card.dataset.photos || "").split("|").filter(Boolean);
    var thumb = card.querySelector(".thumb"); if (urls.length < 2 || !thumb || !thumb.querySelector("img")) return;
    var s = null;
    card.addEventListener("pointerenter", function () {
      if (!s) s = create(thumb, { interval: 1500, first: 700, dots: true });
      s.load(urls); card.classList.add("peek");
    });
    card.addEventListener("pointerleave", function () { card.classList.remove("peek"); if (s) s.reset(); });
  });
})();
