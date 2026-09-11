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

### Pointing the domain, with the registrar at Hostinger

Two ways, and the second is the one to take.

**Nameservers (recommended).** In Cloudflare, **Add a site** →
`highway19media.com` → Free plan. Cloudflare reads the DNS Hostinger is
serving and shows two nameservers (`something.ns.cloudflare.com`). In
Hostinger: **Domains → highway19media.com → DNS / Nameservers → Change
nameservers → Use custom nameservers**, paste both, save. It takes anywhere
from ten minutes to a few hours. After it goes active, the Pages project's
**Custom domains** tab adds the records itself and the SSL certificate is
issued automatically.

**CNAME only.** Keep Hostinger's nameservers and add, in Hostinger's DNS
editor, a CNAME from `www` to `<project>.pages.dev`, plus a redirect from the
bare domain to `www`. It works, but the bare domain cannot be a CNAME at most
registrars, and Cloudflare's caching and SSL are only partly in play.

**The WordPress install can stay where it is** until the switch: nothing here
touches Hostinger's hosting, only which nameservers answer for the domain. If
the WordPress site is live on that domain now, it stops being reachable the
moment the nameservers change - so change them when the Pages build is green.

Every other branch gets its own preview URL automatically — that is the staging
site, no second setup. To make a branch build the noindex version, set its build
command to `node tools/make_page.js --staging && node tools/build_site.js --staging`
and its output directory to `dist/stage`.

`_headers` is written by the build: his art is cached for a year, the page is
revalidated every visit, so a redeploy is live immediately and a returning
visitor downloads almost nothing.

## The contact form

`build/v2/section-08.html` carries the two lines that decide where a lead goes:

    data-to="highway19media@gmail.com"      the mailbox
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
at `/coming-soon/`, which is his own **Road work ahead** page
(`build/v2/soon.html`, from `incoming/Under Construction.rar`). It is also the
404, so a mistyped URL gets the same answer. Two changes were made to it: its
fonts come from `section-fonts.css` instead of Google, and its button opens a
mail draft to the address below.

## What is not on the site, deliberately

No phone number, no booking link, no calendar. The form and the email address
are the only ways in.
