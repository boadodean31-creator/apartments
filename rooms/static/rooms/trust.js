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
