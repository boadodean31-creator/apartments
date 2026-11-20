/* Home page menu: once the banner has scrolled out of view, the floating bar shrinks to a slim bar
   (logo, Location, Landmarks, Contact and the profile icon / Log in). Scroll back up and it opens again.
   It also highlights the menu link of the section you are reading (Rooms, Location, Landmarks). */
(function () {
  var header = document.querySelector("header");
  var hero = document.querySelector(".herowrap");
  if (!header || !hero) return;

  var spy = [["rooms", "#rooms"], ["location", "#location"], ["nearby", "#nearby"]].map(function (x) {
    return { link: header.querySelector('.nav nav a[href$="' + x[1] + '"]'), sec: document.getElementById(x[0]) };
  }).filter(function (x) { return x.link && x.sec; });

  var ticking = false;
  function update() {
    ticking = false;
    var gone = hero.getBoundingClientRect().bottom <= 96;
    if (header.classList.contains("compact") !== gone) header.classList.toggle("compact", gone);

    var line = 150, current = null;   // the section that crosses a line just below the bar
    spy.forEach(function (x) { var r = x.sec.getBoundingClientRect(); if (r.top <= line && r.bottom > line) current = x.link; });
    spy.forEach(function (x) {
      var on = x.link === current;
      if (x.link.classList.contains("on") !== on) { x.link.classList.toggle("on", on); on ? x.link.setAttribute("aria-current", "true") : x.link.removeAttribute("aria-current"); }
    });
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  update();
})();
