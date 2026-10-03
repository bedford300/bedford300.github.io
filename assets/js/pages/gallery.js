/**
 * Photos & Videos page.
 *   #gallery            -> album grid (filter by year/event) + all videos
 *   #gallery/<albumId>  -> one album: thumbnail grid (opens the lightbox) + the album's videos
 */

let state = null;

const ALBUM_SIZES = '(min-width: 1100px) 340px, (min-width: 640px) 45vw, 100vw';
const THUMB_SIZES = '(min-width: 1100px) 250px, (min-width: 640px) 30vw, 50vw';

export async function render(root, ctx, sub) {
    const { data, t } = ctx;
    const body = root.querySelector('#gallery-body');
    state = { ctx, body, albums: [], year: 'all', event: 'all' };
    try {
        const gallery = await data.getJSON('gallery.json');
        state.albums = (gallery.albums || [])
            .map((a) => ({ ...a, photos: checkAlt(a.photos || [], a.id) }))
            .sort((a, b) => String(b.date).localeCompare(String(a.date)));
        ctx.media.warmUpVideos();
        draw(sub);
    } catch {
        data.sectionError(body, t);
    } finally {
        body.removeAttribute('aria-busy');
    }
}

export async function update(sub) {
    if (state) draw(sub);
}

export function destroy() {
    state = null;
}

/** Every photo needs alt text. Fall back to the caption and warn the editors in the console. */
function checkAlt(photos, albumId) {
    return photos.map((p) => {
        if (p.alt) return p;
        console.warn(`[gallery] Photo without "alt" text in album "${albumId}":`, p.src);
        return { ...p, alt: p.caption || '' };
    });
}

function draw(sub) {
    const album = sub && state.albums.find((a) => a.id === sub);
    if (album) drawAlbum(album);
    else drawIndex();
}

/* ---------- Album list ---------- */

function drawIndex() {
    const { ctx, body } = state;
    const { t, util } = ctx;
    const { esc } = util;
    const years = [...new Set(state.albums.map((a) => String(a.date).slice(0, 4)).filter(Boolean))].sort().reverse();
    const events = [...new Set(state.albums.map((a) => a.event).filter(Boolean))].sort();
    const option = (value, label, current) => `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(label)}</option>`;
    const pretty = (s) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    body.innerHTML = `
        <section aria-labelledby="albums-title">
            <h2 id="albums-title" class="section-title">${t('gallery.albums')}</h2>
            <div class="filters">
                <div class="field field-inline">
                    <label for="gallery-year">${t('gallery.filterYear')}</label>
                    <select id="gallery-year">${option('all', t('gallery.all'), state.year)}${years.map((y) => option(y, y, state.year)).join('')}</select>
                </div>
                <div class="field field-inline">
                    <label for="gallery-event">${t('gallery.filterEvent')}</label>
                    <select id="gallery-event">${option('all', t('gallery.all'), state.event)}${events.map((e) => option(e, pretty(e), state.event)).join('')}</select>
                </div>
            </div>
            <p class="visually-hidden" aria-live="polite" id="album-count"></p>
            <ul class="album-grid" id="album-grid"></ul>
        </section>
        <section aria-labelledby="videos-title" class="section-top">
            <h2 id="videos-title" class="section-title">${t('gallery.videos')}</h2>
            <div class="video-grid" id="video-grid"></div>
        </section>`;

    const drawAlbums = () => {
        const list = state.albums.filter((a) =>
            (state.year === 'all' || String(a.date).startsWith(state.year)) &&
            (state.event === 'all' || a.event === state.event));
        const grid = body.querySelector('#album-grid');
        grid.innerHTML = '';
        body.querySelector('#album-count').textContent = `${list.length} ${t('gallery.albums').toLowerCase()}`;
        if (!list.length) {
            grid.nextElementSibling?.classList.contains('show-more') && grid.nextElementSibling.remove();
            grid.innerHTML = `<li class="notice">${t('gallery.empty')}</li>`;
            return;
        }
        util.showMore(grid, list, albumCard, { label: t('btn.showMore') });
    };
    body.querySelector('#gallery-year').addEventListener('change', (e) => { state.year = e.target.value; drawAlbums(); });
    body.querySelector('#gallery-event').addEventListener('change', (e) => { state.event = e.target.value; drawAlbums(); });
    drawAlbums();

    const videos = state.albums.flatMap((a) => a.videos || []);
    const videoGrid = body.querySelector('#video-grid');
    if (videos.length) util.showMore(videoGrid, videos, (v) => ctx.media.videoCard(v), { pageSize: 9, label: t('btn.showMore') });
    else videoGrid.closest('section').hidden = true;
}

function albumCard(a) {
    const { t, util, media } = state.ctx;
    const { esc } = util;
    const date = util.parseLocal(a.date);
    return `<li>
        <a class="album-card" href="#gallery/${encodeURIComponent(a.id)}">
            <div class="album-cover">${media.picture(a.cover || a.photos[0]?.src, { alt: '', sizes: ALBUM_SIZES, maxWidth: 800, cls: 'cover-img' })}</div>
            <span class="album-title">${esc(a.title)}</span>
            <span class="album-meta">${date ? util.formatDate(date) : ''} · ${t('gallery.photos', { count: a.photos.length })}</span>
        </a>
    </li>`;
}

/* ---------- One album ---------- */

function drawAlbum(album) {
    const { ctx, body } = state;
    const { t, util, media } = ctx;
    const { esc } = util;
    const date = util.parseLocal(album.date);

    body.innerHTML = `
        <p><a class="back-link" href="#gallery">‹ ${t('gallery.backToAlbums')}</a></p>
        <section id="gallery-${esc(album.id)}" aria-labelledby="album-title">
            <h2 id="album-title" class="section-title">${esc(album.title)}</h2>
            <p class="album-meta">${date ? util.formatDate(date) : ''} · ${t('gallery.photos', { count: album.photos.length })}</p>
            ${album.description ? `<p>${esc(album.description)}</p>` : ''}
            <ul class="thumb-grid" id="photo-grid"></ul>
        </section>
        ${(album.videos || []).length ? `<section class="section-top" aria-labelledby="album-videos-title">
            <h2 id="album-videos-title" class="section-title">${t('gallery.videos')}</h2>
            <div class="video-grid">${album.videos.map((v) => media.videoCard(v)).join('')}</div>
        </section>` : ''}`;

    const grid = body.querySelector('#photo-grid');
    util.showMore(grid, album.photos, (p, i) => `<li>
        <button type="button" class="thumb" data-index="${i}">
            ${media.picture(p.src, { alt: p.alt, sizes: THUMB_SIZES, maxWidth: 800, cls: 'thumb-img' })}
        </button></li>`, { label: t('btn.showMore') });
    grid.addEventListener('click', (e) => {
        const thumb = e.target.closest('.thumb');
        if (thumb) media.openLightbox(album.photos, Number(thumb.dataset.index), thumb);
    });
}
