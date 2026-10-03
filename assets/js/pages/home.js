/** Home page: hero (with the framed Bedford Flag) + countdown, next-event spotlight, calls to action, poll, latest media. */

let timer = null;

export async function render(root, ctx) {
    const { site, media } = ctx;

    root.querySelector('#hero-media').innerHTML = media.picture(site.heroImage, {
        alt: site.heroImageAlt, sizes: '100vw', eager: true, cls: 'hero-img',
    });
    renderHeroFlag(root.querySelector('#hero-flag'), ctx);
    startCountdown(root.querySelector('#countdown'), ctx);
    renderSocial(root.querySelector('#home-social'), ctx);
    renderPoll(root.querySelector('#poll-frame'), ctx);

    await Promise.all([
        renderSpotlight(root.querySelector('#spotlight-body'), ctx),
        renderMedia(root.querySelector('#home-media'), ctx),
    ]);
}

export function destroy() {
    clearInterval(timer);
    timer = null;
}

function startCountdown(el, { site, t, util }) {
    const target = util.parseLocal(site.celebrationDate);
    if (!el || !target) return;
    const draw = () => {
        const ms = target - Date.now();
        if (ms <= 0) { el.hidden = true; destroy(); return; }
        const days = Math.floor(ms / 864e5);
        const hours = Math.floor((ms % 864e5) / 36e5);
        const minutes = Math.floor((ms % 36e5) / 6e4);
        const unit = (n, label) => `<div class="cd-unit"><span class="cd-num">${n}</span><span class="cd-label">${t(label)}</span></div>`;
        el.innerHTML = `<p class="cd-title">${util.esc(site.celebrationLabel || t('home.countdownLabel'))}</p>
            <div class="cd-units" role="timer" aria-label="${util.esc(t('home.countdownLabel'))}">
                ${unit(util.formatNumber(days), 'home.days')}${unit(hours, 'home.hours')}${unit(minutes, 'home.minutes')}
            </div>`;
        el.hidden = false;
    };
    draw();
    clearInterval(timer);
    timer = setInterval(draw, 60_000);
}

function renderSocial(el, { site, util, t }) {
    if (!el) return;
    el.innerHTML = (site.social || []).map((s) => `
        <li><a class="social-link" href="${util.esc(util.safeUrl(s.url))}" target="_blank" rel="noopener">
            <svg aria-hidden="true" focusable="false"><use href="#icon-${util.esc(s.icon)}"></use></svg>
            <span class="visually-hidden">${util.esc(s.name)} ${util.esc(t('footer.newTab'))}</span>
        </a></li>`).join('');
}

/** The Google Form is only inserted when the visitor scrolls near it (it's heavy and sets cookies). */
function renderPoll(el, { site, t, util }) {
    if (!el) return;
    const url = util.safeUrl(site.pollFormUrl);
    el.innerHTML = `
        <div class="poll-slot"><p class="hint">${t('loading')}</p></div>
        <p><a href="${util.esc(url.replace('embedded=true', ''))}" target="_blank" rel="noopener">${t('home.pollFallback')}<span class="visually-hidden"> ${t('footer.newTab')}</span></a></p>`;
    util.onVisible(el, () => {
        el.querySelector('.poll-slot').innerHTML =
            `<iframe src="${util.esc(url)}" title="${util.esc(t('home.pollTitle'))}" loading="lazy" width="640" height="720"></iframe>`;
    });
}

/** The featured upcoming event, otherwise the next planned one (not "proposed"), otherwise the next one. */
export function pickSpotlight(events, util) {
    const today = util.startOfToday();
    const upcoming = events
        .map((e) => ({ ...e, _start: util.parseLocal(e.start), _end: util.parseLocal(e.end || e.start) }))
        .filter((e) => e._start && e._end >= today)
        .sort((a, b) => a._start - b._start);
    return upcoming.find((e) => e.featured) || upcoming.find((e) => e.status !== 'proposed') || upcoming[0] || null;
}

async function renderSpotlight(el, ctx) {
    const { data, t, util, media } = ctx;
    const { esc } = util;
    try {
        const { events = [] } = await data.getJSON('events.json');
        const e = pickSpotlight(events, util);
        if (!e) {
            el.innerHTML = `<p class="notice">${t('home.noUpcoming')}</p>`;
            return;
        }
        const when = e.dateTBD
            ? esc(e.dateLabel || t('events.tbd'))
            : `${util.formatDate(e._start)}${util.hasTime(e.start) ? ` · ${util.formatTime(e._start)}` : ''}`;
        el.innerHTML = `
            <article class="spotlight-card${e.image ? '' : ' no-media'}">
                ${e.image ? `<div class="spotlight-media">${media.picture(e.image, { alt: e.imageAlt || '', sizes: '(min-width: 900px) 480px, 100vw', cls: 'cover-img' })}</div>` : ''}
                <div class="spotlight-body">
                    <p class="badge badge-${e.category === 'main' ? 'main' : 'community'}">${t(`events.category.${e.category === 'main' ? 'main' : 'community'}`)}</p>
                    <h3 class="spotlight-title">${esc(e.title)}</h3>
                    <p class="event-when"><strong>${when}</strong></p>
                    <p class="event-where">${esc(e.location)}</p>
                    ${e.host ? `<p class="event-host">${esc(t('events.hostedBy', { host: e.host }))}</p>` : ''}
                    <p>${esc(e.description)}</p>
                    <a class="btn btn-primary" href="#events/${encodeURIComponent(e.id)}">${t('btn.details')}<span class="visually-hidden">: ${esc(e.title)}</span></a>
                </div>
            </article>`;
    } catch {
        data.sectionError(el, t);
    } finally {
        el.removeAttribute('aria-busy');
    }
}

/**
 * The Bedford Flag, framed beside the title (site.json -> heroFlag).
 * The whole frame is clickable via the "Read its story" link (see .hero-flag-link::after).
 */
function renderHeroFlag(slot, { site, media, util }) {
    const f = site.heroFlag;
    if (!slot) return;
    if (!f?.image) { slot.remove(); return; }
    const { esc } = util;
    slot.innerHTML = `
        <figure class="hero-flag">
            <div class="hero-flag-frame">
                ${media.picture(f.image, { alt: f.imageAlt || '', sizes: '(min-width: 900px) 300px, 150px', maxWidth: 800, cls: 'hero-flag-img' })}
            </div>
            <figcaption class="hero-flag-caption">
                <span class="hero-flag-title">${esc(f.caption)}</span>
                ${f.link ? `<a class="hero-flag-link" href="${esc(util.safeUrl(f.link))}">${esc(f.linkLabel || '')} <span aria-hidden="true">→</span></a>` : ''}
            </figcaption>
        </figure>`;
    // Visible above the fold: don't lazy-load it.
    slot.querySelector('img')?.setAttribute('loading', 'eager');
}

async function renderMedia(el, ctx) {
    const { data, t, util, media } = ctx;
    try {
        const gallery = await data.getJSON('gallery.json');
        const albums = [...(gallery.albums || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
        const photos = albums.flatMap((a) => a.photos || []).slice(0, 6);
        const video = gallery.featuredVideo || albums.flatMap((a) => a.videos || [])[0];

        el.innerHTML = `
            <ul class="thumb-grid thumb-grid-home">
                ${photos.map((p, i) => `<li><button type="button" class="thumb" data-index="${i}">
                    ${media.picture(p.src, { alt: p.alt || p.caption || '', sizes: '(min-width: 900px) 200px, 33vw', maxWidth: 800, cls: 'thumb-img' })}
                </button></li>`).join('')}
            </ul>
            ${video ? `<div class="home-video">${media.videoCard(video)}</div>` : ''}`;
        el.querySelectorAll('.thumb').forEach((btn) => btn.addEventListener('click', () => {
            media.openLightbox(photos, Number(btn.dataset.index), btn);
        }));
        if (video) util.onVisible(el, () => media.warmUpVideos());
    } catch {
        data.sectionError(el, t);
    }
}
