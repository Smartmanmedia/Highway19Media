# Building a new page

Written 30 September 2026, against `main` at `9389c71`. Read `DEPLOY.md` for
how the site ships and `HANDOVER.md` for how the home page was built. This one
is the narrower question: **you have been asked for a new page — what do you
actually do?**

---

## 1. First, pick the recipe

There are four ways a page gets built here, and choosing wrong costs a day.
They are not interchangeable; each already exists in `tools/build_site.js` and
each has a page you can copy from.

| Recipe | Use it when | Copy from | Where in `build_site.js` |
|---|---|---|---|
| **A. Shell + body** | Mostly text. Privacy, terms, a policy, an FAQ of prose. | `/privacy/` | §4b `LEGAL` |
| **B. Marked-up page** | One designed page, hand-written HTML, needs the contact card. | `/contact/` | §4a |
| **C. Its own pipeline** | Built from his artboards. Art, animation, a generator. | `/q-a/` | §4b-ii + `tools/qa/` |
| **D. Dropped in whole** | Finished elsewhere, arrives as a folder with its own css/js/art. | `/video-production/` | §4d |

**Recipe A** is one entry in the `LEGAL` array plus a `build/v2/legal-<slug>.html`
body. Nothing else. If the page is words on the site's background, stop here —
it is twenty minutes.

**Recipe B** is a file in `build/v2/` with `<!--HEADER-->`, `<!--FOOTER-->` and
optionally `<!--FORM-CARD-->` in it, and a dozen lines in `build_site.js` that
substitute them. `build/v2/contact.html` is the shortest complete example.

**Recipe C** is the heavy one. `/q-a/` is eight of his Illustrator artboards
with live cards, parallax and running traffic; it has its own five-stage
pipeline under `tools/qa/` that writes `faq.html` at the repo root, and
`build_site.js` then treats that file as a page. Only take this on if the page
really is his artwork.

**Recipe D** is for a page another project finished. `build_site.js` copies the
folder, then swaps the site's header and footer into its `index.html`. Read
§4d before promising anything — three things in the incoming page have to give
way to the chrome (its own footer, its own `consent.js`, its skip link).

---

## 2. The rules the build enforces

`tools/build_site.js` reads every page back off disk after writing it and
**fails the build** unless each one has:

- `<header class="hdr">` and `<footer class="sec9">`
- a `class="skip"` link
- all six chrome assets loaded (`section-fonts.css`, `header.css`,
  `section-09.css`, `consent.css`, `header.js`, `consent.js`)
- no unsubstituted `{{TOKEN}}`
- **the same header and footer link signature as every other page**

That last one is the one that catches people. Add a nav item to one page and
the build stops until every page has it. It prints, on success:

```
chrome: header + footer + 6 assets identical on 9 pages
```

**Never assemble a header or a footer yourself.** `tools/chrome.js` is the only
place either is built. A page in a language that is not Node asks for them
through `tools/chrome-emit.js` (that is why it exists — `tools/qa/build.py` is
Python). Three copies of a header is three chances for it to drift, which is
exactly what that module was written to end.

### Cache-busting

Every CSS and JS URL carries `?v=<8 hex of sha1>` stamped at build time. If
your page links code, run it through `codeHref(f)`. `/assets/*` is served
**immutable for a year**, which is only true while a file's contents do not
change under its name — so anything under `/assets/` that your build
regenerates needs the same hash (see how §4b-ii stamps `assets/css/qa.css`).

### The page has to be in three lists

Adding the page is not finishing it:

1. `sitemap.xml` — §5, near the bottom.
2. `_redirects` — any spelling a person might type (`/qa/`, `/faq/` → `/q-a/`).
3. **The nav and the footer** — `build/v2/header.html` (twice: desktop nav and
   the phone menu) and `build/v2/section-09.html`. A page nothing links to is a
   page nobody finds.

---

## 3. SEO, done the way `/q-a/` does it

Copy the head out of `tools/qa/build.py`. It is the fullest one on the site:

- `<title>`, `<meta name="description">`, `<link rel="canonical">`
- `robots` with `max-snippet:-1` and `max-image-preview:large` — without them
  a rich result is capped at a line
- Open Graph + Twitter card, with the share card's own content hash
- `theme-color`, both favicons
- a JSON-LD `@graph`: `Organization`, `WebSite`, `BreadcrumbList`, and the
  page's own type (`FAQPage` there)

Two things that are easy to get wrong and cost the whole exercise:

- **The text must be in the document**, not fetched on interaction. A shut Q&A
  card is a closed grid row with every word of its answer in the markup. That
  is what makes the schema honest and the page worth a crawler's time.
- **A drawing is not a heading.** His headings are artwork. `/q-a/` carries a
  visually-hidden `<h1>` saying the same words and wraps each question in an
  `<h3>`. Do the same or the page has no outline.

---

## 4. The environment you are working in

```sh
export NODE_PATH=/opt/node22/lib/node_modules
export CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
N=/opt/node22/bin/node
```

- **Node 22** (`.node-version`). The build has **zero dependencies** — `fs`,
  `path`, `crypto`. Keep it that way.
- **All image work is done in Chromium** via Playwright → canvas →
  `toDataURL('image/webp', q)`. There is no PIL, no sharp, no ImageMagick.
  `tools/qa/embwebp.js` is the pattern.
- **Serve the repo to look at anything**: `python3 -m http.server 8777` from
  the repo root. It dies between turns — restart it.
- **Outbound HTTPS is filtered.** `highway19media.com` and `*.pages.dev` are
  both blocked from here, so you **cannot open the live site or a Cloudflare
  preview**. Build `dist/site`, serve it locally, and check that. Say so
  plainly when you report — do not describe a deployed page you have not seen.

### Build commands, in order

```sh
node tools/make_page.js     # sections -> build/v2/page.html   (home page only)
node tools/build_site.js    # page.html -> dist/site           (the live build)
node tools/build_site.js --staging   -> dist/stage  (noindex)
```

> **Editing a `section-NN.html` and running only `build_site.js` does nothing.**
> `build_site.js` reads `page.html`. Run `make_page.js` first. CSS-only edits
> do not need it.

For `/q-a/`: `sh tools/qa/make.sh` (extract → shadowfix → answers → animate →
build) writes `faq.html`, and **then** `build_site.js`.

---

## 5. Checking it before you say it works

Nothing here has a test suite. Verification is rendering the page and
measuring it. The scripts that did it for `/q-a/` are worth copying:

- **Every width.** 360, 390, 412, 768, 900, 1440, 1920, 2400. Bugs hide at the
  ends of a `clamp()`, not in the middle.
- **Page errors and 404s** — listen for `pageerror` and any response ≥ 400
  while the page loads. A missing bleed strip is silent otherwise.
- **`document.documentElement.scrollWidth === innerWidth`** at every width.
- **Interactive state**, not just the first paint: open every accordion, then
  look for text past its container and for overlapping boxes.
- **Frame time** if anything animates: median, p90 and max over ~70 frames.
  16.7 is 60fps.

And look at the screenshots. Three bugs on `/q-a/` were invisible to every
measurement and obvious in a picture.

---

## 6. Traps this site has already set

Written down because each one cost real time.

**His artboards contain things you do not expect.** The first Q&A artboard has
a full copy of the site's old header drawn into it — bar, lockup, shield, nav,
a CONTACT US button. It was hidden by standing the live bar on top of it, which
held only while the two were the same height. The live bar was later redrawn
shorter and his came out from underneath: two headers, one under the other.
`build_site.js` §4b-ii now cuts the drawn group out at build time. **Before you
place one of his artboards, look at what is in it.**

**Never couple your layout to another component's height.** That is the same
bug stated generally. If you find yourself writing "these two happen to be the
same size", you have written a bug with a delay on it.

**Android inflates text.** A WebView grows text it takes for a block of
reading, by a factor it works out from the container. Symptom: the non-text
parts of your design measure exactly what you set and the type measures much
larger, so everything overflows. No font size fixes it — the bigger the type,
the bigger the boost. `text-size-adjust: 100%` on `html`.

**`line-height` is not a height.** A button whose `line-height` is the whole
button height looks right on one line and opens to double with a chasm down
the middle on two. Centre the content instead.

**A shut box still needs vertical padding.** A fixed-height row with a centred
line looks fine until the words outgrow it, then they sit in the corners.

**His numbers are not phone numbers.** His mobile artboards are drawn about
2.5× a phone. Taken literally they give 11px type in 18px padding; scaled up
naively they shout. Set phone values against his proportions, not instead of
them.

**`getBoundingClientRect()` on a `display:none` section returns zeros**, which
pass most "is it on screen" tests. The phone was running 600 cars on hidden
desktop artboards before anyone checked.

**Measure a mirrored group by all four corners.** Illustrator mirrors groups,
and a mirrored matrix hands back the right-hand edge as `x`. Map all four
corners and take the minimum.

---

## 7. Going live

Cloudflare Pages builds **`main`** on every push. The branch you work on gets
its own preview URL automatically.

```
Build command:  node tools/make_page.js && node tools/build_site.js
Output:         dist/site
```

`dist/` is generated and not committed — the host builds it. Open a PR into
`main`; merging deploys. `DEPLOY.md` has the DNS and the form service.

---

## 8. Still open on the site

- **The contact form does not send.** `data-key` in `build/v2/section-08.html`
  is empty, so it opens a mail draft instead. web3forms.com emails a key back
  in a minute; paste it once and every form on the site works.
- **`/q-a/` section four** shows the Website questions where his artboard draws
  the General ones. Needs his decision, not a fix.
- **Most service pages are not built.** `/coming-soon/` catches them all, and
  it is also the 404.
