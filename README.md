# Bedford 300 · Friends of Tricentennial website

A static website celebrating Bedford, Massachusetts' 300th anniversary (1729–2029). It is built with plain HTML, CSS and JavaScript: no framework, no npm and no build step. It is hosted on GitHub Pages.

**Non-technical editors:** see [EDITING_GUIDE.md](EDITING_GUIDE.md).

## Run it locally

```bash
python -m http.server 8000
# open http://localhost:8000
```

A local web server is needed because the site loads its JSON data with `fetch()`, which browsers block for `file://` pages.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch.** Choose `main` and `/ (root)`.
3. **Settings → Actions → General → Workflow permissions:** select **Read and write permissions**. The image optimizer commits the resized photos back to the repository.
4. Set `siteUrl` in `data/site.json` to the final address. The QR code and calendar files use it.
5. Optional custom domain: add it under Settings → Pages. GitHub creates a `CNAME` file for you.

`.nojekyll` tells GitHub Pages to serve the files as they are.

## How it's organized

```
index.html              Page shell (header, <main>, footer). Holds the VERSION number (see below).
404.html                Sends unknown addresses to #home.
components/             nav.html, footer.html (loaded once)
pages/                  One HTML layout per page; no content, only placeholders
data/                   ALL content, as JSON files (see EDITING_GUIDE.md)
assets/css/style.css    The only stylesheet. Colors and fonts are set in :root at the top.
assets/js/main.js       Start-up: loads shared data, header and footer, then starts the router
assets/js/router.js     Hash router (#events, #events/porchfest, #gallery/<album>)
assets/js/data.js       Loads and caches data/*.json; per-section error messages
assets/js/i18n.js       t('key') lookup from data/strings.en.json
assets/js/media.js      Responsive images, YouTube click-to-play, lightbox
assets/js/util.js       Small helpers (escaping, dates, lazy script loading, "Show more")
assets/js/pages/*.js    One module per page: render(root, ctx, sub), optional update(sub) and destroy()
assets/fonts/           Self-hosted Merriweather (headings) + Source Sans 3 (body)
assets/vendor/          Leaflet 1.9.4 (map) and qrcode-generator 1.4.4, both loaded only when needed
assets/images/originals/  Photos as uploaded by editors
assets/images/optimized/  AUTO-GENERATED resized WebP/JPEG (never edit)
scripts/optimize_images.py   Photo optimizer (run by the GitHub Action)
scripts/make_test_data.py    Developer tool: placeholder photos + 100-photo/20-video test gallery
.github/workflows/optimize-images.yml
```

### Page modules and `ctx`

Page modules don't import anything. The router passes them a `ctx` object containing `site`, `t`, `i18n`, `data`, `media`, `util` and `version`. All code therefore loads with the same `?v=` version, so a visitor never mixes old and new files.

To add a page:
1. Create `pages/<name>.html` and `assets/js/pages/<name>.js`, exporting `render(root, ctx, sub)`.
2. Add the page to `ROUTES` in `assets/js/main.js`.
3. Add a link in `components/nav.html` and its label in `data/strings.en.json`.

### Cache busting (VERSION)

GitHub Pages tells browsers to cache files for about 10 minutes, and that can't be changed. After you change any **CSS or JS** file, change `?v=...` on the **two lines marked VERSION in `index.html`**, for example to today's date. Every other code and page file picks the version up from `main.js` automatically. Data files (`data/*.json`) don't need this: `data.js` fetches them with `cache: 'no-cache'`, so browsers re-check them on every visit (a 304 when unchanged) and edits show up on the next page load, once GitHub Pages has published them (usually within a minute or two).

## Languages (i18n)

- `data/i18n/languages.json` lists the languages in the header menu (code, native name, short label, locale for dates/numbers, and which data files have translations).
- Interface labels: `data/strings.<code>.json`. English is loaded first and the chosen language on top, so missing labels fall back to English.
- Content translations: `data/i18n/<code>/<file>.json` are merged over the English data file by `data.js` (objects field by field; lists of items with `id` matched by id). Only files listed in that language's `overlays` are requested, so there are no 404s.
- Language choice: `?lang=xx` in the URL, then the saved choice (`localStorage`), then the browser's languages, then English. Switching reloads the page with `?lang=xx`, keeping the `#section`.
- Dates, weekday names and numbers use `Intl` with the language's locale (`util.setLocale`).
- Chinese, Japanese and Korean use system CJK fonts for their characters (the self-hosted fonts are Latin-only), with Latin letters still in the site fonts.
- The header measures itself (language, text size A/A+/A++, screen width) and picks: one row (`.is-wide`); else two rows (`.is-wide.is-two-row`: logo, text size, Donate and language on top, menu links below; the text-size/Donate block and language button are moved in the DOM so Tab order matches what you see); else the Menu button (screens under 900 px, or when even two rows don't fit). On crowded phones the Menu button becomes icon-only (`.is-tight`). So large text on a scaled high-resolution laptop (e.g. 2400×1600 at 150%) keeps the desktop menu, and longer translations never wrap or overlap.

## Performance design

- **Lazy loading by page:** each page's HTML, JS and JSON load only when it is first visited. Hovering or focusing a menu link prefetches that page.
- **Photos:** the GitHub Action makes 400/800/1600 px WebP versions plus an 800 px JPEG fallback, removes GPS and camera metadata, and records size and dominant color in `data/image-manifest.json`. `media.picture()` uses the manifest to output `srcset`/`sizes`, `width`/`height` and a color placeholder. Every image except the Home hero is `loading="lazy"`. The hero is preloaded with `fetchpriority="high"`.
- **YouTube:** only a thumbnail and a play button are shown. The `youtube-nocookie.com` player loads on click, and only one video plays at a time.
- **Map, QR code and Google Form:** loaded only when scrolled into view.
- **Long lists:** shown 24 at a time with a "Show more" button.
- **Fonts:** two self-hosted `.woff2` files with `font-display: swap`.

**Lighthouse (mobile, simulated slow 4G), on a local server that behaves like GitHub Pages:** Performance 99, Accessibility 100, Best Practices 100 (96 on the Gallery page while test videos use placeholder IDs), SEO 100. CLS is 0 and LCP is about 2.0 s. The Home page transfers about 126 KB in total.

## Photo optimizer

The optimizer runs automatically on every push that changes `assets/images/originals/**`. To run it yourself:

```bash
pip install Pillow
python scripts/optimize_images.py
```

## Test data

`python scripts/make_test_data.py` regenerates the placeholder photos and the **test** gallery: 5 albums, 100 photos and 20 placeholder YouTube links. Before launch:

1. Delete `assets/images/originals/test-gallery/`.
2. Replace `data/gallery.json` with real albums.
3. Replace the sample donors in `data/donors.json`.

The optimizer removes the leftover resized copies on its next run.

## Finding placeholders

Search the project for `PLACEHOLDER` and `"verified": false`. History facts, quiz questions and map coordinates must be checked by the Bedford Historical Society before `verified` is set to `true`. Set `showDraftBadges` to `false` in `site.json` to hide the "Draft" badges.
