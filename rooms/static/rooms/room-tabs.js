/* Phone tabs under the photos: Details and Location scroll to their section, Gallery opens the photo viewer. */
(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".rd-tab"));
  if (!tabs.length) return;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function details() { return document.querySelector(".rd-book .rd-feats") ? document.querySelector(".rd-book") : document.querySelector(".rd-glance-inline"); }
  function set(name) { tabs.forEach(function (t) { t.classList.toggle("on", t.dataset.tab === name); }); }
  var lock = 0;
  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      var n = t.dataset.tab;
      if (n === "gallery") { var m = document.querySelector(".rd-mosaic .mo"); if (m) m.click(); return; }
      var el = n === "location" ? document.getElementById("location") : details();
      if (!el) return;
      set(n); lock = Date.now() + 900;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  });
  addEventListener("scroll", function () {
    if (Date.now() < lock) return;
    var loc = document.getElementById("location");
    set(loc && loc.getBoundingClientRect().top < innerHeight * 0.45 ? "location" : "details");
  }, { passive: true });
})();
