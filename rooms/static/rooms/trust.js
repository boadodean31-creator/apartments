/* Send-an-inquiry form: sends in the background and shows the answer in place (falls back to a normal form post). */
(function () {
  var form = document.getElementById('inq-form');
  if (!form || !window.fetch) return;
  var msg = document.getElementById('inq-msg');
  function say(text, ok) { msg.hidden = false; msg.textContent = text; msg.className = 'inq-msg ' + (ok ? 'ok' : 'err'); }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    form.querySelectorAll('.is-bad').forEach(function (x) { x.classList.remove('is-bad'); });
    var btn = form.querySelector('.inq-send');
    btn.disabled = true; var old = btn.textContent; btn.textContent = 'Sending…';
    fetch(form.action, { method: 'POST', body: new FormData(form), headers: { 'X-Requested-With': 'fetch' }, credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { return { ok: false, message: 'Something went wrong. Please call us instead.' }; }); })
      .then(function (d) {
        say(d.message, d.ok);
        if (d.ok) { form.querySelectorAll('input[name=name],input[name=phone],input[name=email],textarea').forEach(function (x) { x.value = ''; }); }
        else if (d.field) { var f = form.elements[d.field]; if (f) { f.classList.add('is-bad'); f.focus(); } }
      })
      .catch(function () { say('We could not send that. Check your connection or call us instead.', false); })
      .then(function () { btn.disabled = false; btn.textContent = old; });
  });
})();


/* Viber chat button. Viber opens only if the Viber app is installed on that device, and a website can't check that.
   So if nothing seems to open, we copy the number and tell the visitor what to do instead of leaving a dead button. */
(function () {
  var onPhone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  function pretty(d) { return d.indexOf('63') === 0 && d.length === 12 ? '0' + d.slice(2, 5) + ' ' + d.slice(5, 8) + ' ' + d.slice(8) : '+' + d; }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.chat-viber');
    if (!a) return;
    var m = (a.getAttribute('href') || '').match(/number=(?:%2B|\+)?(\d+)/i);
    if (!m) return;
    var digits = m[1], appOpened = false;
    if (onPhone) a.setAttribute('href', 'viber://add?number=' + digits);   // phones use Viber's "chat with this number" link
    function left() { appOpened = true; }                                  // the page lost focus: Viber (or its permission box) took over
    window.addEventListener('blur', left, { once: true });
    document.addEventListener('visibilitychange', left, { once: true });
    setTimeout(function () {
      window.removeEventListener('blur', left);
      document.removeEventListener('visibilitychange', left);
      if (appOpened) return;
      var num = pretty(digits);
      try { navigator.clipboard.writeText(num); } catch (err) { /* copying is a bonus, the number is also shown */ }
      var row = a.closest('.chat-row') || a.parentNode;
      var note = row.parentNode.querySelector('.chat-note');
      if (!note) {
        note = document.createElement('p'); note.className = 'chat-note'; note.setAttribute('role', 'status');
        row.parentNode.insertBefore(note, row.nextSibling);
      }
      note.textContent = 'Viber didn’t open. It may not be installed on this device. Our Viber number is ';
      var b = document.createElement('b'); b.textContent = num; note.appendChild(b);
      note.appendChild(document.createTextNode(' (copied). Open Viber and paste it in the search box.'));
    }, 1800);
  }, true);
})();
