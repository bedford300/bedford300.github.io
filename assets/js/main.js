/**
 * Site start-up: loads shared data, header and footer, then starts the router.
 *
 * Every module is loaded with the same "?v=" version as this file (set in index.html),
 * so visitors always get matching, up-to-date code. Page modules don't import anything;
 * they receive everything they need through `ctx`.
 */

const VERSION = new URL(import.meta.url).searchParams.get('v') || 'dev';
const Q = `?v=${VERSION}`;

const ROUTES = {
    home: { title: 'page.home', data: ['events.json', 'gallery.json'] },
    events: { title: 'page.events', data: ['events.json', 'promotions.json'] },
    history: { title: 'page.history', data: ['history.json', 'quiz.json', 'sites.json', 'town-gift.json'] },
    gallery: { title: 'page.gallery', data: ['gallery.json'] },
    support: { title: 'page.support', data: ['sponsors.json'] },
    donors: { title: 'page.donors', data: ['donors.json'] },
    legal: { title: 'page.legal', data: ['legal.json'] },
};

const TEXT_SIZE_KEY = 'bedford300-text-size';
const LANG_KEY = 'bedford300-lang';

const fetchText = (url) => fetch(url).then((res) => {
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.text();
});

const [util, data, i18n, media, { Router }] = await Promise.all(
    ['util', 'data', 'i18n', 'media', 'router'].map((name) => import(`./${name}.js${Q}`)),
);

// Language first: it decides which labels and translated data files to load.
const languageList = await fetch('data/i18n/languages.json', { cache: 'no-cache' })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
const LANGUAGES = languageList?.languages?.length ? languageList.languages : [{ code: 'en', name: 'English', short: 'EN', locale: 'en-US', overlays: [] }];
const LANG = pickLanguage(LANGUAGES, languageList?.default || 'en');
data.setLanguage(LANG.code, LANG.overlays);
util.setLocale(LANG.locale || LANG.code);
document.documentElement.lang = LANG.code;

const [site, strings, manifest, navHtml, footerHtml] = await Promise.all([
    data.getJSON('site.json').catch(() => ({})),
    // English labels first, then the chosen language on top: any missing label stays English
    Promise.all([
        data.getJSON('strings.en.json').catch(() => ({})),
        LANG.code === 'en' ? {} : data.getJSON(`strings.${LANG.code}.json`).catch(() => ({})),
    ]).then(([en, translated]) => ({ ...en, ...translated })),
    data.getJSON('image-manifest.json').catch(() => ({})),
    fetchText(`components/nav.html${Q}`).catch((err) => { console.error(err); return ''; }),
    fetchText(`components/footer.html${Q}`).catch((err) => { console.error(err); return ''; }),
]);

i18n.init(strings);
media.init({ manifest: manifest.images, t: i18n.t, util });

const ctx = { site, t: i18n.t, i18n, data, media, util, version: VERSION, lang: LANG.code };

setupHeader(navHtml);
setupLanguageMenu();
setupHeaderFit();
setupFooter(footerHtml);
setupSkipLink();
setupBackToTop();
document.addEventListener('routechange', () => markNewTabLinks(document.getElementById('content-viewport')));

new Router({ routes: ROUTES, ctx, viewport: document.getElementById('content-viewport'), version: VERSION }).start();

/* ------------------------------------------------------------------ */

/**
 * Show the full one-line menu only when it really fits; otherwise use the "Menu" button.
 * Translated labels and larger text sizes need more room, so this is measured, not guessed.
 */
function setupHeaderFit() {
    const header = document.getElementById('navbar-container');
    const inner = header.querySelector('.header-inner');
    if (!inner) return;
    const MIN_WIDE = 900; // never use the one-line menu on phones or small tablets
    const brand = header.querySelector('.brand');
    const overflows = () => inner.scrollWidth > inner.clientWidth + 1;
    const nav = header.querySelector('.primary-nav');
    const actions = header.querySelector('.header-actions'); // text size + Donate
    const langSlot = header.querySelector('.lang-menu');
    const navOverflows = () => nav && nav.scrollWidth > nav.clientWidth + 1;
    // Text size + Donate live inside the menu (phone menu, one-row header) or in the
    // top row next to the language button (two-row header). Moving them keeps their
    // listeners and makes the keyboard Tab order follow the visual order.
    const placeActions = (topRow) => {
        if (!actions || !nav || !langSlot) return;
        if (topRow) {
            // top row (before the menu links): text size + Donate, then language
            if (actions.parentElement !== inner) inner.insertBefore(actions, nav);
            if (langSlot.nextElementSibling !== nav) inner.insertBefore(langSlot, nav);
        } else {
            if (actions.parentElement !== nav) nav.appendChild(actions);
            if (inner.lastElementChild !== langSlot) inner.appendChild(langSlot);
        }
    };
    const fit = () => {
        // Moving elements can drop keyboard focus (e.g. after pressing A++ with the keyboard): restore it.
        const focused = document.activeElement;
        header.classList.remove('is-tight', 'is-two-row');
        placeActions(false);
        let mode = 'menu';
        if (window.innerWidth >= MIN_WIDE) {
            // 1) everything on one row
            header.classList.add('is-wide');
            if (!overflows()) mode = 'one-row';
            else {
                // 2) two rows: logo, text size, Donate, language on top; the menu links below
                header.classList.add('is-two-row');
                placeActions(true);
                // The top row must stay one line (brand, text size, Donate and language side by side)
                const brandBottom = brand ? brand.getBoundingClientRect().bottom : 0;
                const topRowWraps = [actions, langSlot].some((el) => el && el.getBoundingClientRect().top >= brandBottom);
                if (!overflows() && !navOverflows() && !topRowWraps) mode = 'two-row';
                else placeActions(false);
            }
        }
        if (mode === 'menu') {
            // 3) the "Menu" button (phones, small tablets)
            header.classList.remove('is-wide', 'is-two-row');
            // Phone layout still too crowded (e.g. a long "Menu" word)? Make the Menu button icon-only.
            const brandSquashed = brand && (brand.scrollWidth > brand.clientWidth + 1 || brand.offsetHeight > 64);
            if (overflows() || brandSquashed) header.classList.add('is-tight');
        }
        if (focused && focused !== document.activeElement && header.contains(focused)) focused.focus({ preventScroll: true });
    };
    fit();
    let queued = false;
    const refit = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; fit(); });
    };
    window.addEventListener('resize', refit);
    document.fonts?.ready.then(refit);
    header.querySelectorAll('[data-text-size]').forEach((b) => b.addEventListener('click', refit));
}

/**
 * Choose the language: ?lang=xx in the address, then the visitor's saved choice,
 * then the browser's preferred languages, then the default (English).
 */
function pickLanguage(list, fallback) {
    const byCode = new Map(list.map((l) => [l.code.toLowerCase(), l]));
    const match = (raw) => {
        if (!raw) return null;
        const c = String(raw).toLowerCase();
        if (byCode.has(c)) return byCode.get(c);
        if (c.startsWith('zh')) return byCode.get(/(tw|hk|mo|hant)/.test(c) ? 'zh-tw' : 'zh-cn') || null;
        return byCode.get(c.split('-')[0]) || null;
    };
    let saved = null;
    try { saved = localStorage.getItem(LANG_KEY); } catch { /* storage blocked */ }
    const fromUrl = new URLSearchParams(location.search).get('lang');
    const chosen = match(fromUrl) || match(saved) || (navigator.languages || [navigator.language]).map(match).find(Boolean) || match(fallback) || list[0];
    if (fromUrl && match(fromUrl)) {
        try { localStorage.setItem(LANG_KEY, chosen.code); } catch { /* storage blocked */ }
    }
    return chosen;
}

/** Globe button in the header's right corner, opening the list of languages. */
function setupLanguageMenu() {
    const slot = document.getElementById('lang-menu');
    if (!slot || LANGUAGES.length < 2) { slot?.remove(); return; }
    const { esc } = util;
    const label = i18n.t('language.button', { name: LANG.name });
    slot.innerHTML = `
        <button type="button" class="lang-toggle" aria-expanded="false" aria-controls="lang-list" aria-label="${esc(label)}" title="${esc(i18n.t('language.label'))}">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M2.8 12h18.4M12 2.8c2.6 2.6 3.9 5.7 3.9 9.2s-1.3 6.6-3.9 9.2M12 2.8C9.4 5.4 8.1 8.5 8.1 12s1.3 6.6 3.9 9.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
            <span class="lang-short" lang="${esc(LANG.code)}">${esc(LANG.short || LANG.code.toUpperCase())}</span>
        </button>
        <ul id="lang-list" class="lang-list" hidden>
            ${LANGUAGES.map((l) => `<li><a href="?lang=${encodeURIComponent(l.code)}" lang="${esc(l.code)}" hreflang="${esc(l.code)}" data-lang="${esc(l.code)}"${l.code === LANG.code ? ' aria-current="true"' : ''}>${esc(l.name)}</a></li>`).join('')}
        </ul>`;

    const toggle = slot.querySelector('.lang-toggle');
    const list = slot.querySelector('.lang-list');
    const setOpen = (open, focusToggle) => {
        toggle.setAttribute('aria-expanded', String(open));
        list.hidden = !open;
        if (!open && focusToggle) toggle.focus();
    };
    toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        setOpen(open);
        if (open) list.querySelector('[aria-current="true"]')?.focus();
    });
    // Choosing a language reloads the page in that language, keeping the current section (#hash).
    list.addEventListener('click', (e) => {
        const link = e.target.closest('a[data-lang]');
        if (!link) return;
        e.preventDefault();
        try { localStorage.setItem(LANG_KEY, link.dataset.lang); } catch { /* storage blocked */ }
        const url = new URL(location.href);
        url.searchParams.set('lang', link.dataset.lang);
        location.href = url.toString();
    });
    slot.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { e.stopPropagation(); setOpen(false, true); }
        if (['ArrowDown', 'ArrowUp'].includes(e.key) && !list.hidden) {
            const links = [...list.querySelectorAll('a')];
            const i = links.indexOf(document.activeElement);
            e.preventDefault();
            links[(i + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length].focus();
        }
    });
    document.addEventListener('click', (e) => { if (!slot.contains(e.target)) setOpen(false); });
    slot.addEventListener('focusout', (e) => { if (!slot.contains(e.relatedTarget)) setOpen(false); });
    document.addEventListener('routechange', () => setOpen(false));

    // Note that some content (events, history...) is still English-only (shown at the top of each page)
    if (LANG.code !== 'en') {
        ctx.pageNote = `<p class="lang-note" role="note">${esc(i18n.t('language.englishOnly'))}</p>`;
    }
}

function setupHeader(html) {
    const header = document.getElementById('navbar-container');
    header.innerHTML = html;
    i18n.apply(header, site);
    markNewTabLinks(header);

    // The header is sticky: publish its height (it changes with text size and screen width)
    // so jump links and the mobile menu can account for it.
    const publishHeight = () => document.documentElement.style.setProperty('--header-offset', `${header.offsetHeight}px`);
    publishHeight();
    if ('ResizeObserver' in window) new ResizeObserver(publishHeight).observe(header);

    // Mobile menu
    const toggle = header.querySelector('.nav-toggle');
    const nav = header.querySelector('.primary-nav');
    const setOpen = (open) => {
        toggle?.setAttribute('aria-expanded', String(open));
        nav?.classList.toggle('is-open', open);
    };
    toggle?.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('routechange', () => setOpen(false));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
            setOpen(false);
            toggle.focus();
        }
    });

    // Text size (A / A+ / A++), remembered on this device
    const buttons = header.querySelectorAll('[data-text-size]');
    const applySize = (size) => {
        document.documentElement.dataset.textSize = size;
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.textSize === size)));
    };
    let saved = 'normal';
    try { saved = localStorage.getItem(TEXT_SIZE_KEY) || 'normal'; } catch { /* storage blocked */ }
    applySize(saved);
    buttons.forEach((b) => b.addEventListener('click', () => {
        applySize(b.dataset.textSize);
        try { localStorage.setItem(TEXT_SIZE_KEY, b.dataset.textSize); } catch { /* storage blocked */ }
    }));
}

function setupFooter(html) {
    const footer = document.getElementById('footer-container');
    footer.innerHTML = html;
    i18n.apply(footer, site);
    const { esc } = util;

    const social = footer.querySelector('#social-links');
    if (social) {
        social.innerHTML = (site.social || []).map((s) => `
            <li><a class="social-link" href="${esc(util.safeUrl(s.url))}" target="_blank" rel="noopener">
                <svg aria-hidden="true" focusable="false"><use href="#icon-${esc(s.icon)}"></use></svg>
                <span class="visually-hidden">${esc(s.name)} ${esc(i18n.t('footer.newTab'))}</span>
            </a></li>`).join('');
    }
    const nonprofit = footer.querySelector('#footer-nonprofit');
    if (nonprofit) nonprofit.textContent = i18n.t('footer.nonprofit', { ein: site.ein || '' });
    const email = footer.querySelector('#footer-email');
    if (email && site.contactEmail) {
        email.href = `mailto:${site.contactEmail}`;
        email.textContent = site.contactEmail;
    }
    const year = footer.querySelector('#footer-year');
    if (year) year.textContent = new Date().getFullYear();
    markNewTabLinks(footer);
}

/** Tell screen-reader users when a link opens a new tab. */
function markNewTabLinks(root) {
    root.querySelectorAll('a[target="_blank"]:not([data-newtab-marked])').forEach((a) => {
        a.dataset.newtabMarked = '1';
        if (a.querySelector('.visually-hidden')) return;
        a.insertAdjacentHTML('beforeend', `<span class="visually-hidden"> ${util.esc(i18n.t('footer.newTab'))}</span>`);
    });
}

/**
 * Floating "Back to top" button. It appears after scrolling about one screen down
 * and moves keyboard focus to the page heading so keyboard users land at the top too.
 */
function setupBackToTop() {
    const button = document.getElementById('back-to-top');
    if (!button) return;
    button.setAttribute('aria-label', i18n.t('backToTop'));
    button.title = i18n.t('backToTop');

    let ticking = false;
    const update = () => {
        ticking = false;
        button.hidden = window.scrollY < Math.max(600, window.innerHeight * 0.8);
    };
    window.addEventListener('scroll', () => {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
    }, { passive: true });
    document.addEventListener('routechange', update);
    update();

    button.addEventListener('click', () => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        const heading = document.querySelector('#content-viewport h1');
        if (heading) {
            heading.tabIndex = -1;
            heading.focus({ preventScroll: true });
        }
    });
}

/** The skip link must not change the route, so handle it here instead of via the hash. */
function setupSkipLink() {
    const link = document.querySelector('.skip-link');
    link.textContent = i18n.t('skipLink');
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const main = document.getElementById('content-viewport');
        main.focus();
        main.scrollIntoView();
    });
}
