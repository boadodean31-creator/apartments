/* "Pick a room": the title types itself out once when the card comes into view.
   Screen readers get the full title straight away, and nothing moves for visitors who asked for less motion. */
(function () {
  "use strict";
  var h = document.querySelector("#bd .bd-ttl h3");
  if (!h) return;
  var text = (h.textContent || "").trim();
  if (!text || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;

  h.setAttribute("aria-label", text);
  h.innerHTML = '<span class="tw-ghost" aria-hidden="true"></span><span class="tw-live" aria-hidden="true"><span class="tw-t"></span><i class="tw-caret"></i></span>';
  h.querySelector(".tw-ghost").textContent = text;   // invisible, keeps the title's width so nothing jumps
  var out = h.querySelector(".tw-t"), n = 0, started = false;

  function type() {
    n += 1;
    out.textContent = text.slice(0, n);
    if (n < text.length) setTimeout(type, 75 + Math.random() * 45);
    else setTimeout(function () { h.classList.add("tw-done"); }, 1600);   // the cursor rests, then fades
  }
  function start() { if (started) return; started = true; setTimeout(type, 350); }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); start(); } }, { threshold: 0.6 });
    io.observe(h);
  } else start();
})();
