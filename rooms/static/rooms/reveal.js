/* Fade-and-rise as sections scroll into view. Skips itself for reduced motion or very old browsers. */
(function () {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var groups = ['.inq-grid', '.inq-next li', '.cost-card', '.rev-card', '.know-card', '.nb-item', 'footer.site-foot .wrap.foot > *'];
  var els = [];
  groups.forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el, i) { el.style.setProperty('--d', Math.min(i, 5) * 90 + 'ms'); el.classList.add('rv'); els.push(el); });
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  els.forEach(function (el) { io.observe(el); });
})();

/* Clicking anywhere on an available room card opens that room (the "View room" button still works as before). */
document.addEventListener('click', function (e) {
  var card = e.target.closest && e.target.closest('#grid .card[data-avail="1"]');
  if (!card || e.target.closest('a, button')) return;
  var link = card.querySelector('a.rc-go, a.btn');
  if (link) location.href = link.href;
});
