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

    /* finger swipe (touch / pen): the photo follows your finger, the next or previous one comes in beside it */
    if (o.swipe) {
      box.style.touchAction = "pan-y";
      var d = null;
      box.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "mouse" || urls.length < 2 || busy) return;
        d = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, on: false, nx: null, n: 0, dir: 0 };
      });
      box.addEventListener("pointermove", function (e) {
        if (!d || e.pointerId !== d.id) return;
        var dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (!d.on) {
          if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) { d.on = true; busy = true; clearTimeout(timer); try { box.setPointerCapture(e.pointerId); } catch (_) {} }
          else return;
        }
        var dir = dx < 0 ? 1 : -1, W = box.clientWidth;
        if (dir !== d.dir) {
          if (d.nx) d.nx.remove();
          d.dir = dir; d.n = (i + dir + urls.length) % urls.length;
          var nx = new Image(); nx.alt = base.alt; nx.className = "sl-img"; nx.src = urls[d.n]; box.appendChild(nx); d.nx = nx;
        }
        d.dx = dx;
        base.style.transition = "none"; d.nx.style.transition = "none";
        base.style.transform = "translateX(" + dx + "px)";
        d.nx.style.transform = "translateX(" + (dx + dir * W) + "px)";
      });
      var finish = function (cancel) {
        if (!d) return;
        var s = d; d = null;
        if (!s.on || !s.nx) { busy = false; return; }
        var W = box.clientWidth, g = gen;
        var fast = Math.abs(s.dx) / Math.max(1, performance.now() - s.t) > 0.5 && Math.abs(s.dx) > 30;
        var commit = !cancel && (Math.abs(s.dx) > W * 0.22 || fast);
        var ease = reduce ? "none" : "transform .32s cubic-bezier(.2,.8,.2,1)";
        base.style.transition = ease; s.nx.style.transition = ease;
        base.style.transform = "translateX(" + (commit ? -s.dir * W : 0) + "px)";
        s.nx.style.transform = "translateX(" + (commit ? 0 : s.dir * W) + "px)";
        setTimeout(function () {
          var done = function () {
            s.nx.remove();
            base.style.transition = "none"; base.style.transform = ""; void base.offsetWidth; base.style.transition = "";
            busy = false; paintDots(); schedule();
          };
          if (g !== gen) { s.nx.remove(); base.style.transition = ""; base.style.transform = ""; busy = false; return; }
          if (commit) { i = s.n; base.src = urls[i]; if (base.decode) base.decode().then(done, done); else done(); } else done();
        }, reduce ? 0 : 340);
      };
      box.addEventListener("pointerup", function () { finish(false); });
      box.addEventListener("pointercancel", function () { finish(true); });
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
