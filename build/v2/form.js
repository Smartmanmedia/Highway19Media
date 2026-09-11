/* THE CONTACT FORM, AND WHERE A LEAD ACTUALLY GOES.
 *
 * Two routes, both ending in the same mailbox - the address is data-to on the
 * form, and it is the only line to change if it moves:
 *
 *   data-endpoint set    POST the fields as JSON and stay on the page. Any
 *                        handler that speaks JSON works - Web3Forms,
 *                        Formspree, a Cloudflare Pages Function.
 *   data-endpoint empty  open a prefilled mail draft to data-to. No account,
 *                        no service, no server. The form works on day one.
 *
 * There is no third state where a lead quietly disappears, which is what an
 * unwired form does by default. */
(() => {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const out = document.getElementById('form-status');
  const btn = form.querySelector('button[type="submit"]');
  /* the colour is a class, not a hex: the card behind this line is white by
     day and #0d1a2f at night, and one green reads on exactly one of them. */
  const say = (t, ok) => { if (!out) return;
    out.textContent = t;
    out.className = 'form__status' + (ok === false ? ' is-err' : ok ? ' is-ok' : ''); };

  form.addEventListener('submit', async e => {
    e.preventDefault();

    /* novalidate is on the form so the browser's own bubbles stay out of his
       layout - so the check has to happen here instead. */
    /* form.elements, not form.name - a form's own .name property shadows the
       field called "name" and hands back a string. */
    const fName = form.elements.namedItem('name');
    const fMail = form.elements.namedItem('email');
    const name  = fName.value.trim();
    const email = fMail.value.trim();
    if (!name)  { say('Your name, first.', false); fName.focus(); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      say('That email address does not look right.', false); fMail.focus(); return; }

    const f = Object.fromEntries(new FormData(form).entries());
    const to  = form.dataset.to || 'hello@highway19media.com';
    const url = (form.dataset.endpoint || '').trim();

    if (!url) {
      const body = [
        'Name: '     + name,
        'Business: ' + (f.business || '-'),
        'Email: '    + email,
        '',
        'What I have now:',
        f.existing || '-',
        '',
        'What I want it to do:',
        f.message  || '-'
      ].join('\n');
      location.href = 'mailto:' + to +
        '?subject=' + encodeURIComponent('Website enquiry - ' + (f.business || name)) +
        '&body='    + encodeURIComponent(body);
      say('Opening your email… send it and we’ll reply within 24 hours.', true);
      return;
    }

    btn.disabled = true;
    say('Sending…');
    try {
      const r = await fetch(url, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        /* access_key is what Web3Forms wants; a handler that does not use it
           ignores it. subject and from_name make the inbox readable. */
        body   : JSON.stringify(Object.assign({}, f, {
          access_key: form.dataset.accessKey || undefined,
          subject   : 'Website enquiry - ' + (f.business || name),
          from_name : name
        }))
      });
      if (!r.ok) throw new Error(r.status);
      form.reset();
      say('Got it. We’ll come back to you within 24 hours.', true);
    } catch (err) {
      say('That did not go through. Email us at ' + to + ' and we’ll pick it up.', false);
    } finally {
      btn.disabled = false;
    }
  });
})();
