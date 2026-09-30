# Digital business cards

What an NFC tag or a QR code opens: a phone-first card that saves the business
to Contacts in one tap, puts Call / Text / Email / Website one thumb away, and
installs to the home screen as an app we can keep updating behind the icon.

Highway 19 Media's own card is the first one — `/card/` — and it doubles as
the live sales demo.

    cards/template/        the code every card shares (css, js, service worker)
    cards/<slug>/card.json everything that differs between businesses
    cards/<slug>/art/      its pictures, cut by tools/card/make_art.js
    tools/card/build.js    json -> page, .vcf, manifest, worker, QR
                           (run for you by tools/build_site.js, step 4e)

## The URLs to hand out

| Where | URL |
|---|---|
| NFC tag | `https://highway19media.com/card/?s=nfc` |
| Printed QR | `dist/site/card/qr.svg` — already encodes `?s=qr` |
| Installed app | opens `?s=app` on its own |
| Shared by a visitor | `?s=share` |

The `?s=` is how a visit is told apart in analytics. Program NFC tags with any
free NFC writer app (NFC Tools on iOS/Android): *Write → Add a record → URL*.

## A card for a new business

1. `mkdir cards/<slug>` and copy `cards/highway19/card.json` into it.
2. Edit it. The rules:
   - **Empty means absent.** No phone → no Call or Text button and no number in
     the vCard. A module set to `null` is not on the page. Nothing is invented.
   - `theme.accent` is the **only** colour. Every surface, tint, icon and
     button is mixed from it, and text on it goes dark or light by contrast.
     `theme.mode` is `dark` or `light`.
   - `path` is where it lives, e.g. `"/c/carpenterrick/"`.
   - Phones are digits with an optional `+`: `"+18135551234"`.
   - Every link must be `https://`.
   - `identity.logo: false` when the hero photo already shows the logo.
3. Pictures: set `art.hero` (source + crop in source pixels) and `art.icon`
   (a square-ish transparent logo + the background colour), then

       SHARP=/path/to/node_modules/sharp node tools/card/make_art.js <slug>

   and commit what it writes to `cards/<slug>/art/`. The host's build never
   needs sharp — it only copies.
4. `node tools/make_page.js && node tools/build_site.js` — a card with a
   missing field, a bad phone, an http link or a missing picture stops the build.

### Modules

All optional, shown in this order when present:

| Key | Shape |
|---|---|
| `story` | `{ title, video, poster, line }` — `.mp4` plays in place, anything else (YouTube) links out |
| `gallery` | `{ title, items: [{ src, alt, url? }] }` — a sideways swipe strip |
| `services` | `{ title, items: [{ name, line, url }] }` |
| `offer` | `{ title, line, until?, code?, url?, cta? }` — a code is tap-to-copy |
| `review` | `{ url, title?, line? }` — the Google “write a review” link |
| `lead` | `{ title, line, to, endpoint, key }` — Web3Forms; no key → a mail draft |
| `share` | `true` — native share sheet + a full-screen QR to show across a table |
| `install` | `{ title, line }` — the Keep-us-on-your-phone block |
| `promo` | `{ title, line, url }` — “Want one for your business?” |

A hero video instead of a photo: `art.video = { src, poster, alt }` — muted,
looped, and still for anyone with reduced motion or Save-Data on.

## How the pieces behave

- **Save to Contacts** is a real `.vcf` file (vCard 3.0 — the one iOS, Android
  and Outlook all read), served inline so iPhone opens the contact sheet rather
  than dropping a file in Downloads. It carries the logo as the photo and a
  link back to the card.
- **Install.** Android Chrome gets its own install prompt. iPhone can't be
  prompted by any website, so the button opens the three-step Share → Add to
  Home Screen sheet. Inside Instagram/Facebook/TikTok's own browser nothing can
  install, so it says to open in Safari/Chrome and offers to copy the link. Once
  installed the block disappears.
- **Updates.** The service worker always tries the network first for the card
  itself, so an edit reaches every installed copy the next time it's opened with
  signal; with none, the last copy opens instead of an error.
- **Desktop** gets a QR code and “made for your phone” — plus “View it here
  anyway”, for showing it off from a laptop.
- **Counting** goes through the site's own consent banner and `h19Track`, so
  nothing is sent until a visitor says yes. Events: `save_contact`, `call`,
  `text`, `email`, `website`, `book`, `directions`, `social_click` (label =
  network), `service_click`, `review_click`, `share`, `share_done`, `show_qr`,
  `install_click`, `install_accepted`/`install_dismissed`, `app_installed`,
  `generate_lead`, `promo_click` — each with `card` and `source`.
  Honest limit: a visitor who declines the banner isn't counted. For raw visit
  numbers regardless, turn on Cloudflare Web Analytics for the Pages project
  (cookieless, no code change).

## Highway 19's card — still to fill in

These are empty on purpose because nothing in the repo says what they are:

- `contact.phone` / `sms` — turns on **Call** and **Text** and puts the number
  in the contact. (The website leaves the phone off deliberately; the card is a
  different decision.)
- `identity.person` / `title` — e.g. Adam's full name and role; the contact is
  then filed under the person, at the company.
- `modules.review.url` — the Google Business Profile “write a review” link.
- `social.instagram` / `tiktok` / `youtube` / `linkedin` — only Facebook exists today.
- `modules.story`, `gallery`, `offer` — a reel, portfolio shots, a current offer.
- `modules.promo.url` — points at `/contact/` until the product page exists.
