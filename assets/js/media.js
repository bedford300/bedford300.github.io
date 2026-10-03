/**
 * Photos and videos, built for speed:
 *  - picture(): responsive WebP images from data/image-manifest.json, lazy-loaded,
 *    with width/height and a dominant-color background (no layout jumps).
 *  - videoCard(): YouTube "click-to-play" preview. The real YouTube player loads only on click.
 *  - openLightbox(): accessible full-screen photo viewer that downloads large photos on demand.
 */

const PLACEHOLDER = 'assets/images/placeholder.svg';
const YT_THUMB = 'https://i.ytimg.com';
const YT_EMBED = 'https://www.youtube-nocookie.com';

let manifest = {};
let t = (k) => k;
let util;

export function init(options) {
    manifest = options.manifest || {};
    t = options.t;
    util = options.util;
    installImageFallback();
    installVideoHandlers();
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

/**
 * Responsive image HTML for a photo path from a data file
 * (e.g. "assets/images/originals/events/porchfest.jpg").
 *
 * @param {string} src     original path, as written in the JSON files
 * @param {object} options alt, sizes (must match the CSS layout), eager (only for the
 *                         one above-the-fold hero image), cls (class on <img>),
 *                         maxWidth (skip versions wider than this)
 */
export function picture(src, { alt = '', sizes = '100vw', eager = false, cls = '', maxWidth = Infinity } = {}) {
    const { esc } = util;
    const loading = eager ? 'loading="eager" fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"';
    if (!src) {
        return `<img class="${cls} img-missing" src="${PLACEHOLDER}" alt="${esc(alt)}" width="400" height="267" ${loading}>`;
    }
    const entry = manifest[src];
    if (!entry) {
        // Not optimized yet (the GitHub Action may still be running): show the original.
        return `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" ${loading}>`;
    }
    let widths = entry.widths.filter((w) => w <= maxWidth);
    if (!widths.length) widths = [entry.widths[0]];
    const srcset = widths.map((w) => `${entry.base}-${w}.webp ${w}w`).join(', ');
    return `<picture><source type="image/webp" srcset="${srcset}" sizes="${esc(sizes)}">` +
        `<img class="${cls}" src="${entry.base}-${entry.jpg}.jpg" alt="${esc(alt)}" width="${entry.w}" height="${entry.h}" ` +
        `style="background-color:${entry.color}" ${loading}></picture>`;
}

/** URL of the largest optimized version (used by the lightbox only when a photo is opened). */
export function largeUrl(src) {
    const entry = manifest[src];
    if (!entry) return src || PLACEHOLDER;
    return `${entry.base}-${entry.widths[entry.widths.length - 1]}.webp`;
}

export function dimensions(src) {
    const entry = manifest[src];
    return entry ? { w: entry.w, h: entry.h, color: entry.color } : null;
}

/** Replace broken images with a neutral placeholder instead of a broken-image icon. */
function installImageFallback() {
    document.addEventListener('error', (e) => {
        const img = e.target;
        if (!(img instanceof HTMLImageElement) || img.dataset.fallback) return;
        img.dataset.fallback = '1';
        if (img.parentElement?.tagName === 'PICTURE') img.parentElement.querySelectorAll('source').forEach((s) => s.remove());
        img.removeAttribute('srcset');
        img.src = PLACEHOLDER;
        img.classList.add('img-missing');
        console.warn('[media] Image not found:', img.currentSrc || img.src);
    }, true);
}

/* ------------------------------------------------------------------ */
/* YouTube click-to-play                                               */
/* ------------------------------------------------------------------ */

/** Accepts watch?v=, youtu.be/, shorts/, embed/, live/ links or a bare 11-character ID. */
export function youtubeId(url) {
    const s = String(url ?? '').trim();
    if (/^[\w-]{11}$/.test(s)) return s;
    try {
        const u = new URL(s);
        const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
        let id = null;
        if (host === 'youtu.be') id = u.pathname.split('/')[1];
        else if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) {
            id = u.searchParams.get('v');
            const m = /^\/(embed|shorts|live|v)\/([\w-]{11})/.exec(u.pathname);
            if (!id && m) id = m[2];
        }
        return id && /^[\w-]{11}$/.test(id) ? id : null;
    } catch {
        return null;
    }
}

/** HTML for one video preview card. */
export function videoCard(video = {}) {
    const { esc } = util;
    const title = video.title || t('video.untitled');
    const id = youtubeId(video.url);
    if (!id) {
        console.warn('[media] Not a valid YouTube link:', video.url);
        return `<div class="video-card video-unavailable"><div class="video-frame"><p>${esc(t('video.unavailable'))}</p></div>` +
            `<p class="video-title">${esc(title)}</p></div>`;
    }
    return `<div class="video-card" data-yt="${id}" data-title="${esc(title)}">` +
        `<div class="video-frame">${facade(id, title)}</div>` +
        `<p class="video-title">${esc(title)}</p>` +
        `<a class="video-link" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener">` +
        `${esc(t('video.watchOnYouTube'))}<span class="visually-hidden"> ${esc(t('footer.newTab'))}</span></a></div>`;
}

function facade(id, title) {
    const { esc } = util;
    return `<button type="button" class="yt-play" aria-label="${esc(t('video.play', { title }))}">` +
        `<img src="${YT_THUMB}/vi/${id}/hqdefault.jpg" alt="" width="480" height="360" loading="lazy" decoding="async">` +
        `<span class="yt-play-icon" aria-hidden="true"></span></button>`;
}

/** Call on pages that show videos so thumbnails start faster. */
export function warmUpVideos() {
    util.preconnect(YT_THUMB);
}

function stopVideo(card) {
    card.classList.remove('is-playing');
    card.querySelector('.video-frame').innerHTML = facade(card.dataset.yt, card.dataset.title);
}

function playVideo(card) {
    // Only one video at a time
    document.querySelectorAll('.video-card.is-playing').forEach((other) => other !== card && stopVideo(other));
    const { esc } = util;
    const frame = card.querySelector('.video-frame');
    frame.innerHTML = `<iframe src="${YT_EMBED}/embed/${card.dataset.yt}?autoplay=1&rel=0" title="${esc(card.dataset.title)}" ` +
        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    card.classList.add('is-playing');
    frame.querySelector('iframe').focus();
}

function installVideoHandlers() {
    document.addEventListener('click', (e) => {
        const button = e.target.closest('.yt-play');
        if (button) playVideo(button.closest('.video-card'));
    });
    // Warm up the player connection when someone is about to click.
    const warm = (e) => { if (e.target.closest?.('.yt-play')) util.preconnect(YT_EMBED); };
    document.addEventListener('pointerover', warm);
    document.addEventListener('focusin', warm);
}

/** Stop any playing video (called by the router when leaving a page). */
export function stopAllVideos() {
    document.querySelectorAll('.video-card.is-playing').forEach(stopVideo);
}

/* ------------------------------------------------------------------ */
/* Lightbox                                                            */
/* ------------------------------------------------------------------ */

let box = null;
let items = [];
let index = 0;
let opener = null;

function buildLightbox() {
    box = document.createElement('dialog');
    box.className = 'lightbox';
    box.setAttribute('aria-label', t('gallery.lightboxLabel'));
    box.innerHTML = `
        <div class="lb-inner">
            <button type="button" class="lb-close btn-icon" aria-label="${t('btn.close')}">✕</button>
            <figure class="lb-figure">
                <div class="lb-img-wrap"><img class="lb-img" alt=""></div>
                <figcaption class="lb-caption" aria-live="polite">
                    <span class="lb-count"></span>
                    <span class="lb-text"></span>
                    <span class="lb-credit"></span>
                </figcaption>
            </figure>
            <button type="button" class="lb-prev btn-icon" aria-label="${t('btn.previous')}">‹</button>
            <button type="button" class="lb-next btn-icon" aria-label="${t('btn.next')}">›</button>
        </div>`;
    document.body.appendChild(box);
    box.querySelector('.lb-close').addEventListener('click', () => box.close());
    box.querySelector('.lb-prev').addEventListener('click', () => show(index - 1));
    box.querySelector('.lb-next').addEventListener('click', () => show(index + 1));
    box.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    });
    // Click on the dark backdrop closes it
    box.addEventListener('click', (e) => { if (e.target === box) box.close(); });
    box.addEventListener('close', () => {
        document.documentElement.classList.remove('no-scroll');
        opener?.focus();
    });
}

function show(i) {
    index = (i + items.length) % items.length;
    const item = items[index];
    const img = box.querySelector('.lb-img');
    const dims = dimensions(item.src);
    img.removeAttribute('data-fallback');
    img.classList.remove('img-missing');
    if (dims) { img.width = dims.w; img.height = dims.h; img.style.backgroundColor = dims.color; }
    img.src = largeUrl(item.src);
    img.alt = item.alt || '';
    box.querySelector('.lb-count').textContent = t('gallery.photoOf', { n: index + 1, total: items.length });
    box.querySelector('.lb-text').textContent = item.caption || '';
    box.querySelector('.lb-credit').textContent = item.credit ? t('gallery.credit', { name: item.credit }) : '';
    const single = items.length < 2;
    box.querySelector('.lb-prev').hidden = single;
    box.querySelector('.lb-next').hidden = single;
    // Preload only the next photo
    if (!single) new Image().src = largeUrl(items[(index + 1) % items.length].src);
}

/** Open the photo viewer. `list` = [{src, alt, caption, credit}], `start` = index. */
export function openLightbox(list, start = 0, from = document.activeElement) {
    if (!box) buildLightbox();
    items = list;
    opener = from;
    show(start);
    document.documentElement.classList.add('no-scroll');
    box.showModal();
    box.querySelector('.lb-close').focus();
}
