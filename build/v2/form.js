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
  /* ONE FORM'S WORTH OF BEHAVIOUR, WIRED TO EVERY FORM ON THE PAGE. This used
   * to fetch #contact-form by id and bind that one. The banner at the top of
   * the home page carries a second form - same fields, same key, different
   * clothes - and an id can only ever name one of them, so the second would
   * have looked live and done nothing at all. Every form that declares where
   * it posts gets this, and each finds its own status line inside itself. */
  const wire = (form) => {
  /* A WAY TO SEE WHAT THE SERVICE ACTUALLY SAID, from a phone, with no console.
     ?formdebug=1 puts the HTTP status and the first 300 characters of the
     reply in the status line instead of the friendly wording, and sends
     nothing anywhere else. Off for every ordinary visitor. */
  const DEBUG = /[?&]formdebug=1\b/.test(location.search);
  const out = form.querySelector('.form__status');
  const btn = form.querySelector('button[type="submit"]');
  /* the colour is a class, not a hex: the card behind this line is white by
     day and #0d1a2f at night, and one green reads on exactly one of them. */
  const say = (t, ok) => { if (!out) return;
    out.textContent = t;
    out.className = 'form__status' + (ok === false ? ' is-err' : ok ? ' is-ok' : ''); };

  /* THE CARD COLLAPSES TO ITS ANSWER.
   *
   * Five empty fields and a Send button left standing under the word "Got it"
   * is a form asking to be filled in again, and the one thing a reader wants
   * at that moment is to know what happens next. So the fields go and the
   * panel takes their place - in the same card, which keeps its paper, its
   * yellow strip and its place on the page while it changes size.
   *
   * The height is MEASURED at both ends rather than guessed at either: what it
   * is now, then what it becomes with the panel in it, and the transition runs
   * between the two. A card that snaps from 700 pixels to 260 takes the rest
   * of the page with it and the reader loses their place. */
  function done() {
    const body = form.querySelector('.form__body');
    const panel = form.querySelector('.form__done');
    if (!body || !panel) { say('Got it. We’ll come back to you within 24 hours.', true); return; }

    const from = form.offsetHeight;
    body.hidden = true; panel.hidden = false;
    const to = form.offsetHeight;

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    form.style.height = from + 'px';
    form.getBoundingClientRect();              /* commit the start height */
    form.style.transition = 'height .5s cubic-bezier(.3,.7,.3,1)';
    form.style.height = to + 'px';
    const clear = () => { form.style.height = ''; form.style.transition = ''; };
    form.addEventListener('transitionend', clear, { once: true });
    setTimeout(clear, 800);                    /* in case the event never comes */
  }

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
    if (f.botcheck) { form.reset(); done(); return; }

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
          subject    : 'Website enquiry - ' + (f.website || name),
          from_name  : name,
          replyto    : email,
          name       : name,
          email      : email,
          'Website'  : f.website || '',
          'Phone'    : f.phone || '',
          'Interested in'  : f.interested || '',
          'Heard about us' : f.heard || '',
          'Notes'    : f.message || ''
        })
      });
      /* SUCCESS HAS TO BE SAID, NOT MERELY NOT-DENIED. This read
         `j.success === false`, so a 200 carrying anything that is not JSON -
         a gateway's HTML error page, a rate-limit notice, an empty body -
         parsed to {}, failed to be `false`, and was shown to the reader as
         "Got it" while nothing had been sent. A service that answers in JSON
         says success:true when it means it; anything else is a failure and is
         treated as one. */
      const raw = await r.text();
      let j = {}; try { j = JSON.parse(raw) } catch (_) {}
      if (DEBUG) { say('HTTP ' + r.status + ' — ' + raw.slice(0, 300), r.ok); return; }
      if (!r.ok || j.success !== true) throw new Error(j.message || ('HTTP ' + r.status));
      form.reset();
      done();
    } catch (err) {
      say(DEBUG ? ('FAILED — ' + (err && err.message))
                : ('That did not go through. Email us at ' + to + ' and we’ll pick it up.'), false);
    } finally {
      btn.disabled = false;
    }
  });
};

  document.querySelectorAll('form[data-endpoint]').forEach(wire);
})();
