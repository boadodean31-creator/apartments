/* Home page menu: once the banner has scrolled out of view, the floating bar shrinks to a slim bar
   (logo, Location, Landmarks, Contact and the profile icon). Scroll back up and it opens again. */
(function () {
  var header = document.querySelector("header");
  var hero = document.querySelector(".herowrap");
  if (!header || !hero) return;
  var ticking = false;
  function update() {
    ticking = false;
    var gone = hero.getBoundingClientRect().bottom <= 96;
    if (header.classList.contains("compact") !== gone) header.classList.toggle("compact", gone);
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  update();
})();
