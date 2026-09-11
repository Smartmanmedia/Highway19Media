# Going live

The site is a static build. Nothing here needs a database, a theme or a plugin.

    node tools/make_page.js       # sections  -> build/v2/page.html
    node tools/build_site.js      # page      -> dist/site   (live)
    node tools/build_site.js --staging        -> dist/stage  (noindex)

`dist/` is generated and not committed — the host builds it.

## Cloudflare Pages (recommended)

Free, no bandwidth cap, global CDN, free SSL, and it redeploys on every push.

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → this repository.
2. Build settings:
   - Framework preset: **None**
   - Build command: `node tools/make_page.js && node tools/build_site.js`
   - Build output directory: `dist/site`
3. **Custom domains** → add `highway19media.com` and `www.highway19media.com`.
   Cloudflare gives the DNS records; set them at the current registrar, or move
   the nameservers across and it does it itself.

Every other branch gets its own preview URL automatically — that is the staging
site, no second setup. To make a branch build the noindex version, set its build
command to `node tools/make_page.js --staging && node tools/build_site.js --staging`
and its output directory to `dist/stage`.

`_headers` is written by the build: his art is cached for a year, the page is
revalidated every visit, so a redeploy is live immediately and a returning
visitor downloads almost nothing.

## The contact form

`build/v2/section-08.html` carries the two lines that decide where a lead goes:

    data-to="hello@highway19media.com"      the mailbox
    data-endpoint=""                        empty = open the visitor's email

Empty is the current setting, and it works on any host with no account
anywhere: the form validates, then opens a prefilled message to `data-to`.

To take the send in the background instead, sign up at **web3forms.com** (free,
no backend, it emails you), then set:

    data-endpoint="https://api.web3forms.com/submit"
    data-access-key="<the key they email you>"

Nothing else changes — `form.js` posts the same fields either way.

## Links that are not built yet

Every service page, the Q&A, the legal pages and the three social icons point
at `/coming-soon/`, which is `build/v2/soon.html`. Replace that file with the
real construction page when it exists; the links do not need touching.

## What is not on the site, deliberately

No phone number, no booking link, no calendar. The form and the email address
are the only ways in.
