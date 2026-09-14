/* THE CONTACT FORM, AND HOW A LEAD REACHES HIS INBOX.
 *
 * A page on a static host cannot send mail. There is no server behind it to
 * hand a message to - which is the whole reason it is fast, free and has
 * nothing to patch. So the send is done by a form service: the browser POSTs
 * the fields to it, it sends the email, and the reader never leaves the page.
 *
 *   data-endpoint   the service's URL
 *   data-key        the account key it emails you when you sign up. It belongs
 *                   in the markup - that is how these services are built, the
 *                   key only says "deliver to this inbox" and cannot read
 *                   anything back.
 *   data-to         the inbox, for the fallback below and for the copy
 *
 * UNTIL THERE IS A KEY, the form opens a prefilled mail draft instead, so it
 * is never a dead end on a site that is already up. That is a stopgap and it
 * reads like one: the moment data-key is filled in, this file never touches
 * mailto again.
 */
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

    const f   = Object.fromEntries(new FormData(form).entries());
    const to  = form.dataset.to || 'highway19media@gmail.com';
    const url = (form.dataset.endpoint || '').trim();
    const key = (form.dataset.key || '').trim();

    /* A BOT FILLED THE HIDDEN FIELD. Nobody else can see it, so anything in it
       came from something reading the markup rather than the page. It is
       answered like a success and goes nowhere. */
    if (f.botcheck) { form.reset(); say('Got it. We’ll come back to you within 24 hours.', true); return; }

    if (!url || !key) {
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
        /* subject and from_name are what make the inbox readable at a glance;
           replyto is what makes hitting Reply go to the person who wrote in
           rather than to the form service. */
        body   : JSON.stringify({
          access_key : key,
          subject    : 'Website enquiry - ' + (f.business || name),
          from_name  : name,
          replyto    : email,
          name       : name,
          business   : f.business || '',
          email      : email,
          'What they have now'   : f.existing || '',
          'What they want it to do': f.message || ''
        })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.success === false) throw new Error(j.message || r.status);
      form.reset();
      say('Got it. We’ll come back to you within 24 hours.', true);
    } catch (err) {
      say('That did not go through. Email us at ' + to + ' and we’ll pick it up.', false);
    } finally {
      btn.disabled = false;
    }
  });
})();
