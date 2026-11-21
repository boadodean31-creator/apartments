/* "Pick a room" (desktop): 1st floor first, rows that slide sideways with < and > buttons, a list that scrolls up and down
   with fades and a "More floors" button. All the styling is in pick-scroll.css; phones and tablets ignore it. */
(function () {
  "use strict";
  var bd = document.getElementById("bd");
  if (!bd) return;
  var building = bd.querySelector(".bd-building");
  var body = bd.querySelector(".bd-body");
  if (!building || !body) return;

  var wide = window.matchMedia("(min-width: 1000px)");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var behavior = function () { return reduce.matches ? "auto" : "smooth"; };
  var SVG = function (path) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>'; };
  var make = function (tag, cls, html) { var e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; };

  /* 1st floor first (the markup lists the top floor first, which is kept for phones) */
  var floors = Array.prototype.slice.call(building.querySelectorAll(".bd-floor"));
  var nums = floors.map(function (f) {
    var g = f.querySelector(".bd-fgo");
    var n = g ? parseFloat(g.getAttribute("data-floor")) : NaN;
    return isNaN(n) ? 0 : n;
  });
  var sorted = nums.slice().sort(function (a, b) { return a - b; });
  floors.forEach(function (f, i) { f.style.order = sorted.indexOf(nums[i]); });

  /* the list of floors scrolls up and down */
  var scroll = make("div", "bd-scroll");
  building.parentNode.insertBefore(scroll, building);
  scroll.appendChild(building);
  var fadeUp = make("div", "bd-fade bd-fade-up");
  var fadeDown = make("div", "bd-fade bd-fade-down");
  var more = make("button", "bd-more", "More floors" + SVG("M6 9l6 6 6-6"));
  more.type = "button";
  more.setAttribute("aria-label", "Scroll down to see more floors");
  fadeUp.setAttribute("aria-hidden", "true");
  fadeDown.setAttribute("aria-hidden", "true");
  scroll.appendChild(fadeUp);
  scroll.appendChild(fadeDown);
  scroll.appendChild(more);

  function vertical() {
    var max = building.scrollHeight - building.clientHeight;
    scroll.classList.toggle("can-up", building.scrollTop > 4);
    scroll.classList.toggle("can-down", max > 4 && building.scrollTop < max - 4);
  }
  building.addEventListener("scroll", vertical, { passive: true });
  more.addEventListener("click", function () { building.scrollBy({ top: building.clientHeight * 0.8, behavior: behavior() }); });

  /* every floor: a row that slides sideways */
  floors.forEach(function (f) {
    var rooms = f.querySelector(".bd-rooms");
    if (!rooms) return;
    var row = make("div", "bd-row");
    rooms.parentNode.insertBefore(row, rooms);
    row.appendChild(rooms);
    var prev = make("button", "bd-arr bd-prev", SVG("M15 5l-7 7 7 7"));
    var next = make("button", "bd-arr bd-next", SVG("M9 5l7 7-7 7"));
    prev.type = "button";
    next.type = "button";
    prev.setAttribute("aria-label", "Show the previous rooms on this floor");
    next.setAttribute("aria-label", "Show more rooms on this floor");
    prev.hidden = true;
    next.hidden = true;
    row.appendChild(prev);
    row.appendChild(next);

    function sideways() {
      var max = rooms.scrollWidth - rooms.clientWidth;
      prev.hidden = !(wide.matches && rooms.scrollLeft > 4);
      next.hidden = !(wide.matches && max > 4 && rooms.scrollLeft < max - 4);
    }
    function step() {
      var card = rooms.querySelector(".bd-rm");
      return card ? (card.offsetWidth + 12) * 2 : rooms.clientWidth * 0.9;
    }
    prev.addEventListener("click", function () { rooms.scrollBy({ left: -step(), behavior: behavior() }); });
    next.addEventListener("click", function () { rooms.scrollBy({ left: step(), behavior: behavior() }); });
    rooms.addEventListener("scroll", sideways, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(sideways).observe(rooms);
    window.addEventListener("resize", sideways);
    sideways();
  });

  if (window.ResizeObserver) new ResizeObserver(vertical).observe(building);
  window.addEventListener("resize", vertical);
  vertical();

  /* when a room is picked the card grows and the rows narrow: bring that card into view (inside the two scrollers only, the page never moves) */
  bd.addEventListener("click", function (e) {
    if (!wide.matches || !e.target.closest || !e.target.closest(".bd-rm")) return;
    setTimeout(function () {
      var card = bd.querySelector('.bd-rm[aria-pressed="true"]');
      if (!card) return;
      var rooms = card.parentNode;
      var cr = card.getBoundingClientRect(), rr = rooms.getBoundingClientRect(), br = building.getBoundingClientRect();
      if (cr.left < rr.left + 8) rooms.scrollBy({ left: cr.left - rr.left - 16, behavior: behavior() });
      else if (cr.right > rr.right - 8) rooms.scrollBy({ left: cr.right - rr.right + 16, behavior: behavior() });
      if (cr.top < br.top) building.scrollBy({ top: cr.top - br.top - 16, behavior: behavior() });
      else if (cr.bottom > br.bottom) building.scrollBy({ top: cr.bottom - br.bottom + 44, behavior: behavior() });
    }, 700);
  });
})();
