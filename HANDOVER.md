# Highway 19 Media — where things stand

Written 19 September 2026. Accurate as of commit `26d52a7` on `main`,
artifact **v124**.

This is the whole picture: what is live, how it is built, how to change it,
what is left, and what went wrong along the way so it does not go wrong
again.

---

## 1. Links

| Thing | Where |
|---|---|
| Live site | **https://highway19media.com** (and `www.`) |
| Cloudflare preview | `https://highway19media.pages.dev` |
| Repository | **https://github.com/Smartmanmedia/Highway19Media** |
| Working branch | `claude/highway19-home-build-v5yx9o` |
| Preview artifact | https://claude.ai/code/artifact/85c84c56-66d5-43f5-9f75-085ba174990e (v124) |
| Holding page | `/coming-soon/` |
| Facebook | https://www.facebook.com/Highway19Media |

---

## 2. How it is deployed

**Cloudflare Pages, building from GitHub.** No server anywhere — the whole
site is static files.

- **Repo** → `Smartmanmedia/Highway19Media`. Every change lands on `main`.
- **Cloudflare Pages** watches `main` and rebuilds on every push.
  - Framework preset: **None**
  - Build command: `node tools/make_page.js && node tools/build_site.js`
  - Output directory: `dist/site`
  - Node version: **22** (`.node-version`)
- **DNS** — GoDaddy holds the registration; the **nameservers point at
  Cloudflare**, so Cloudflare serves the domain, issues the SSL and runs the
  CDN.
- **Mail** — Hostinger, on MX records inside Cloudflare's DNS. Nothing about
  the site touches it.
- **Any other branch** gets its own preview URL from Pages automatically —
  that is the staging site, no second setup.

`DEPLOY.md` has the long version, including the DNS switch.

### Caching

`_headers` is written by the build:

```
/assets/*      max-age=31536000, immutable      (art, a year)
/build/v2/*    max-age=604800                   (code, a week)
/*             max-age=0, must-revalidate       (pages, every visit)
```

Plus HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`,
`X-Frame-Options`, `Permissions-Policy`, COOP. A redeploy is live
immediately and a returning visitor downloads almost nothing.

**Cache-busting:** every CSS/JS URL carries `?v=<8 hex of sha1>` stamped at
build time, so a code change reaches every page at once rather than up to a
week later.

---

## 3. The build pipeline

Three scripts. **Zero dependencies** — Node's `fs`, `path` and `crypto`
only.

```
node tools/make_page.js        sections  ->  build/v2/page.html
node tools/build_site.js       page.html ->  dist/site     (the live build)
node tools/build_site.js --staging       ->  dist/stage    (noindex)
node tools/build_v2.js         page.html ->  dist/highway19-v2.html
                                             (one self-contained file,
                                              this is what the artifact is)
```

### The one rule that keeps catching people

> **Editing a `section-NN.html` and running only `build_site.js` does
> nothing.** `build_site.js` reads `page.html`. You must run `make_page.js`
> first. CSS-only edits do not need it.

### Conventions

- Sections are discovered by filename: any `build/v2/section-NN.html`
  matching `/^section-\d\d\.html$/` is picked up in sort order, and a
  matching `section-NN.css` is linked automatically. Adding a section means
  adding two files — no registry to update.
- Current order: `00, 01, 02, 03, 04, 06, 07, 08, 09` (05 was removed).
- **`cqw` + `container-type:inline-size`** everywhere. Type and geometry are
  shares of the section, so a design converted from his artboard scales
  exactly, at any width.
- **All image work is done in Chromium** via Playwright → canvas →
  `toDataURL('image/webp', q)`. There is no PIL, no sharp, no ImageMagick in
  this environment.

### Build-time guard

`build_site.js` reads every page it wrote back off disk and **fails the
build** unless each one has: the header, the footer, the skip link, all six
shared chrome assets, no unreplaced `{{TOKEN}}`, and a matching nav/footer
link signature. It prints:

```
chrome: header + footer + 6 assets identical on 6 pages
```

This was tested by deliberately breaking it three ways.

---

## 4. What exists now

### Pages

| URL | What |
|---|---|
| `/` | The home page — nine sections |
| `/privacy/` | Privacy (my wording — **you should read it**) |
| `/cookies/` | Cookies (my wording — **you should read it**) |
| `/terms/` | Terms (your own) |
| `/coming-soon/` | Holding page |
| `/404.html` | Not found |

Plus `robots.txt` and `sitemap.xml`, both written by the build.

`/community/` pages (starting with Carpenter Rick) were added to `main` by a
separate session — they are live but were not part of this work.

### The home page, section by section

| # | What it is |
|---|---|
| 00 | **The main banner** — see below |
| 01 | "A Clear Road Forward for Your Business" + "Great Work, No Signage" |
| 02 | "You've Been Down This Road Before" |
| 03 | Road scene |
| 04 | The green services intro + "Explore Our Services" |
| 06 | **Pick Your Lane** — the four service cards |
| 07 | Road map / process |
| 08 | Contact form card |
| 09 | Footer, with the social links |

### Section 00 — the banner, in full

This took the most iterations and is worth writing down exactly.

**Structure.** `.sec0` → `.bn-stage` (his 1937.04 × 1257.84 artboard, as a
box) → `.bn-say` (headline, rule, three bullets) + `.bn-form` (the green
panel).

**Current behaviour, and why:**

```css
.sec0 {
  height: 140svh;                          /* the length of the hold       */
  padding-bottom: min(300px, 25svh);       /* where the words let go       */
  background: ... left center/cover no-repeat;   /* SCROLLS, not fixed     */
  overflow: clip;                          /* NOT hidden — see below       */
  box-shadow: inset 0 -.375rem 0 #000, 0 1.6rem 3.4rem -.6rem rgba(2,14,34,.55);
}
.sec0 .bn-stage {
  position: sticky;
  top: max(200px, calc(var(--hh) + var(--hbar)));
  height: min(calc(100svh - max(200px, …) - 8px), calc(100vw / 1.5400));
  aspect-ratio: 1937.04 / 1257.84;
  container-type: inline-size;
}
```

- The **picture moves**, opening high in the sky and ending on the
  crosswalk. The **words stand still**, because they are `sticky`. That is
  the whole mechanism.
- Anchored **left**, because a 1.4-screen box is much narrower in proportion
  than the 1.683 plate — cover fills the height and takes its crop off the
  sides, and centred that put the pole at the edge and the shield off the
  frame.
- The stage is short enough to be **seen whole** from 200px down: its bottom
  lands on the fold, button included.
- The height is capped **against the width**, so the width is always the
  derived dimension and the 1.540 ratio can never break.

**Measured across nine widths, 1024 → 3440:** stage ratio 1.540 every time;
content holds at 200px for 189–408px of scroll and is verifiably motionless
while it does; the panel sits at exactly 1156 × 574 on his board; heading on
one line; no horizontal scroll. Phone untouched (ratio 0.3189).

**The left column** has one knob:

```css
.sec0 .bn-say { --say: .86; }     /* 1 = his artboard exactly */
```

It scales the column's width and every type size in it, and nothing else —
the panel is independent. Move that one number to resize the words.

**Details taken straight from his artboard, not approximated:**

- The tick bullet — white road-sign disc, red ring 1.57 units thick, black
  check — lifted out of the SVG into `assets/v2/banner/tick.svg` (339 bytes).
  My hand-drawn version (red disc, white check) vanished at 17px.
- The button arrow — blue disc in a white rim, solid flat-tailed white arrow
  — his circles and his polygon, moved to the origin from 1527.4, 904.3.
- The panel's white keyline (`stroke-width` 3 of a 1937 board = `.155cqw`).
- The panel green at 90% (`rgba(12,124,0,.9)`).
- The bullet column capped at his measure: 523.4 units wide, ending at 958.5
  (49.5% of the board) — `max-width: 67%`.

### Assets

`assets/v2/banner/`:

| File | Size | What |
|---|---|---|
| `road-wide.webp` | 394 KB | Day desktop, 1920 wide (1×) |
| `road-wide@2x.webp` | 629 KB | Day desktop, **2525 × 1500** (his New3, retina) |
| `road-wide-night.webp` | 203 KB | Night desktop, 1989 × 1080 — **frame mismatch, see §6** |
| `road-tall.webp` | 215 KB | Day phone, 1088 × 3413 — **old crop, see §6** |
| `road-tall-night.webp` | 700 KB | Night phone — **old crop** |
| `rule.svg` | 14 KB | His red brush stroke, 47 paths |
| `tick.svg` | 339 B | His bullet mark |
| `i-*.svg` | — | The seven field icons |

Encoding is all WebP via Chromium canvas, quality chosen by measuring PSNR
against his source, not by guessing. Sources live in `assets/brand/`.

### Forms

- Both forms (banner and contact card) are driven by one script,
  `build/v2/form.js`, which wires every `form[data-endpoint]` on the page.
- The send goes to **Web3Forms** — a static host has no server, so a service
  does the email. The access key is in the markup and is public by design;
  **Web3Forms sends to the address the key is registered to**, which is
  `highway19media@gmail.com`. There is no recipient in the payload, so
  changing where mail goes means changing it at Web3Forms.
- Honeypot field on both.

### Analytics and consent

- **GA4 `G-50PLEN6KSF`**, loaded **only after consent**. `consent.js` holds
  a `TAGS` list; nothing is fetched until Accept.
- The CSP allows exactly what is needed for GA and Web3Forms and nothing
  else.

### Day / night

`night.css` drives a full night palette off three selectors (`data-mode`,
`data-theme`, `prefers-color-scheme`). The switch is `mode.js`. The banner
swaps `--bn-photo` / `--bn-photo-mob`; the CTA plate turns red and lights up;
the header's `19` and rule turn red on the dark header.

### Share card

`tools/make_og.js` draws the 1200 × 630 card and **fails if the wordmark
exceeds the 560px safe column** — it caught 565px on the first run. It also
writes a square version. Every page's share-card URL is content-stamped.

---

## 5. Workflow conclusions — the traps, and the method

### CSS traps that each cost a debugging cycle

1. **Percentage padding on an absolutely positioned box resolves against its
   containing block, not itself.** 13.52% became 216px a side instead of 64;
   the panel collapsed. Use `cqw`.
2. **`flex-basis` is on the main axis.** `flex:1 1 22rem` became a *height*
   when the consent bar turned into a column and filled half a phone screen.
3. **`aspect-ratio` resolves whichever axis is not already determined.**
   Setting both `height` and a binding `max-width` makes it ignored
   entirely — that is how a 1.540 stage came out at 1.459, squeezed 5%.
4. **`grid-auto-rows:1fr` applies to every implicit row**, headings
   included — 600px of white space under "Pick Your Lane."
5. **An override must sit *after* the rule it overrides** at equal
   specificity. Mine sat before, and tablet cards stayed 967px tall.
6. **A later `margin:` shorthand resets a `margin-top` above it.**
7. **`overflow:hidden` makes a box a scroll container**, and a sticky child
   sticks to its nearest scroll container. The whole sticky banner was inert
   because of one word. `overflow:clip` clips identically and creates none.
8. **`background-attachment:fixed` is positioned against the viewport**, not
   the element — so `cover` crops to the *window's* shape, not the section's.
   This is what kept cutting the sky and the crosswalk.
9. **`scrollWidth` equals `clientWidth` on a box that fits** — it reports the
   border, not text headroom. Use a `Range` to measure text.
10. **A layout that fits exactly is a layout that will break.** Converted
    straight off his artboard, two panel headings ran at 99.5–99.9% of the
    available width. Sub-pixel rounding alone tipped one onto a second line
    at 1920, which ate the button's margin. Everything now carries ~4% slack
    plus `white-space:nowrap`, so the failure can never be a silent reflow.
11. **`svh`, not `vh`** — a collapsing mobile address bar must not resize the
    layout mid-scroll.

### Method that worked

- **Measure against his artboard, normalised.** Render his SVG, read the real
  bounding boxes, render our page, normalise both to his 1937.04 board, and
  print the deltas. That is how the bullet column was found to be 40% too
  wide while the panel was exact to the unit. Eyeballing never found it.
- **Sweep, don't spot-check.** Every change is verified at 8–9 widths from
  1024 to 3440 plus 2–3 phones, with an explicit pass/fail assertion per
  dimension. Several real defects only appeared at 1024 or 2000 × 830.
- **Always run a control.** One diagnosis (the mountain seam) failed its own
  control — switching the suspected layer off changed nothing — so nothing
  was shipped. That was the right outcome.
- **Test the test.** The chrome guard was verified by breaking the page three
  ways on purpose.
- **Verify behaviour, not just geometry.** For the sticky banner the check
  actually scrolls the page and asserts the element did not move.

### Traps in the tooling itself

- Playwright screenshots are **PNG colour type 2 (3 bytes/pixel)**. A decoder
  assuming 4 returns confident nonsense. Decode in the browser via canvas.
- **Smooth scrolling defeats screenshot scripts** — inject
  `html{scroll-behavior:auto}` before scrolling, or you photograph the wrong
  position and believe it.
- **Night mode cannot be tested by setting `data-mode`** — `mode.js` writes
  it back. Click the switch.
- The local preview server (`python3 -m http.server 8099`) **dies between
  commands** and must be restarted each time.
- A DNS response over 512 bytes is **truncated on plain UDP**. This nearly
  produced a report that the DKIM key was broken; with EDNS0 the full
  408-character key was there. All mail auth records are correct.

---

## 6. Things left to do

### Waiting on you — art

| What | Spec |
|---|---|
| **Night desktop plate** | **2525 × 1500** — must match the New3 day frame. The current night art is the old 1.842 crop, so the composition shifts when you toggle. |
| **Mobile day plate** | **2176 × 6824** (or 1600 × 5017) — the phone still runs the old tall crop. |
| **Mobile night plate** | same size |

Export at maximum quality in any format — PNG, WebP or JPEG. Do not compress
them; the web encoding and the density variants are done here.

### Waiting on you — accounts

- **Google Business Profile** — needs the `info@highway19media.com` alias
  working so the verification code can land. Send yourself a test before
  pressing Next.
- **Gmail "Send mail as"** — retry at `smtp.hostinger.com` port **465 with
  SSL**, username `adam@highway19media.com`, webmail password. Port 587 was
  failing.
- **Read `/privacy/` and `/cookies/`** — my wording, your liability.

### Open on the site

- **The mountain seam** between sections 04 and 06 — reproduced and visible,
  but my first diagnosis failed its own control, so nothing was shipped. Still
  unexplained.
- **Night art downloads for daytime visitors** on dark-OS machines — roughly
  200 KB nobody sees. Flagged, not fixed.
- **YouTube and Instagram links** still point at `/coming-soon/`.
- **Meta / Google Ads pixels** — `consent.js` is ready for them; no IDs yet.
- **Highway Gothic Expanded** — the real road-sign face is self-hosted for
  the subheads. Overpass stands in anywhere his file does not cover.

---

## 7. What I have learned about how we work together

Written plainly, because it is more useful than being polite about it.

1. **You want the answer, not the reasoning.** "I told you multiple times to
   cut to the chase with headlines and short bullet points. If I have a
   question I'll ask. Too much info just slows down our communications."
   Short headline, the number, what changed. Detail on request.

2. **Your design is the specification, not a suggestion.** "The reason I'm
   designing is that you will copy it, not invent convenient design." When I
   drew my own tick and my own arrow instead of lifting yours out of the SVG,
   both were wrong and both had to be redone. **Default: extract from the
   artboard. Never approximate a mark you have been given.**

3. **When you say a thing is wrong, it is wrong — and usually not where I
   think.** "The form is the right size, the text is too big" was precise and
   correct. "Compare the text, the alignment, the size" led to a measured
   40% error I had not seen. The instinct to explain why it is actually fine
   has been wrong every time.

4. **When we go around more than twice, I am solving the wrong problem.** The
   banner took six rounds because I kept refining a mechanism instead of
   questioning it. Your Webflow sentence — "image 100% width and 140vh, the
   div sticky 200px from top, the image scrolls until the crossroad, the div
   stops 300px before" — settled it in one pass. **When you repeat yourself,
   stop adjusting and ask for the construction.**

5. **You think in build terms.** Webflow, vh, sticky, opacity, stroke. Talk to
   you in those terms, not in prose about intent.

6. **"Fixed" meant fixed *in the section*, not `background-attachment:fixed`.**
   Same word, different mechanism, four wasted rounds. **When a word could be
   a CSS property or a plain-English description, check which.**

7. **One thing at a time, and no nudging.** "Don't nudge — we're fixing one
   thing at a time. Day." Listing the other four outstanding items at the end
   of every reply was noise. Finish the thing, report it, stop.

8. **Say what it costs, immediately.** Several times two of your requests
   could not both hold — pinned background versus the whole photograph; a
   bigger stage versus a sticky hold. Saying so in one line and letting you
   choose has worked far better than quietly picking one.

9. **Your "ish" is real, and so is your number.** "200 ish px", "stops before
   300px ish" — take the number literally, then guard it so it degrades
   sensibly (the 300px release is capped at 25svh so a short laptop still
   gets a hold).

10. **Report failures plainly.** You have never objected to a correction, only
    to hedging. "It was there, but I'd drawn it my own way" landed better than
    any explanation would have.

11. **You will not give out your phone number** and you have **no business
    address** — a service-area business. Nothing on the site should assume
    either.

12. **Never send you credentials.** I have no access to your machine or
    accounts, and passwords do not travel through here.
