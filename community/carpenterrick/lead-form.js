/* =============================================================
   Carpenter Rick — lead form

   Posts to Web3Forms, the same service the main site's contact form
   uses, with the same access key — so leads land in
   highway19media@gmail.com. A static host has no server to mail from;
   the browser posts the fields and the service sends the email.

   Reply-to is set to the person who wrote in, so hitting Reply in the
   inbox answers them rather than the service.
   ============================================================= */

const FORM_ENDPOINT = 'https://api.web3forms.com/submit';
const FORM_KEY      = 'e2f57011-b7df-4b38-9c6d-6ba1bf1c04b7';
const FORM_SUBJECT  = "Cabin lead for Carpenter Rick's site";

(() => {
  const offer = document.getElementById('offer');
  const form = document.getElementById('lead-form');
  const errorBox = document.getElementById('lead-error');
  const submit = form.querySelector('.lead__submit');

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const rules = {
    name: v => v.trim().length >= 2 || 'Please enter your name.',
    address: v => v.trim().length >= 5 || 'Please enter the address where the cabin goes.',
    phone: v => v.replace(/\D/g, '').length >= 10 || 'Please enter a 10-digit phone number.',
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Please enter a valid email address.'
  };

  const fields = Object.keys(rules).map(n => form.elements[n]);

  const check = field => {
    const result = rules[field.name](field.value);
    const ok = result === true;
    field.setAttribute('aria-invalid', String(!ok));
    return ok ? '' : result;
  };

  // Validate on blur, then live-correct once a field has been flagged
  fields.forEach(field => {
    field.addEventListener('blur', () => {
      const message = check(field);
      errorBox.textContent = message;
    });
    field.addEventListener('input', () => {
      if (field.getAttribute('aria-invalid') === 'true') {
        const message = check(field);
        errorBox.textContent = message;
      }
    });
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();

    // Bot filled the honeypot — pretend it worked, send nothing.
    if (form.elements.company.value) {
      offer.dataset.state = 'sent';
      return;
    }

    const firstBad = fields.find(field => check(field) !== '');
    if (firstBad) {
      errorBox.textContent = check(firstBad);
      firstBad.focus();
      return;
    }

    errorBox.textContent = '';
    submit.disabled = true;
    submit.textContent = 'Sending…';

    const lead = {
      access_key : FORM_KEY,
      subject    : FORM_SUBJECT,
      from_name  : 'Carpenter Rick landing page',
      replyto    : form.elements.email.value.trim(),
      name       : form.elements.name.value.trim(),
      address    : form.elements.address.value.trim(),
      phone      : form.elements.phone.value.trim(),
      email      : form.elements.email.value.trim(),
      page       : 'community/carpenterrick',
      botcheck   : form.elements.company.value        /* honeypot */
    };

    try {
      if (FORM_ENDPOINT) {
        const response = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(lead)
        });
        const out = await response.json().catch(function () { return {}; });
        if (!response.ok || out.success === false) {
          throw new Error(out.message || 'Endpoint returned ' + response.status);
        }
      } else {
        console.info('[carpenterrick] No FORM_ENDPOINT set — lead not sent:', lead);
      }
      offer.dataset.state = 'sent';
      document.getElementById('lead-done').focus?.();
    } catch (err) {
      console.error('[carpenterrick] lead submit failed:', err);
      errorBox.textContent = 'Something went wrong sending that. Please try again in a moment.';
      submit.disabled = false;
      submit.textContent = 'Book your Build';
    }
  });
})();
