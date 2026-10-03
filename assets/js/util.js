/**
 * Small shared helpers. No imports: every module receives these through `ctx.util`.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape text before putting it into HTML. Use for ALL values that come from data files. */
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Only allow http(s), mailto and relative links from data files. */
export function safeUrl(url) {
    const s = String(url ?? '').trim();
    if (!s) return '';
    if (/^(https?:|mailto:|tel:)/i.test(s) || !/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
    return '';
}

/** True when a URL is still a PLACEHOLDER or empty. */
export const isPlaceholder = (url) => !url || /PLACEHOLDER/i.test(url);

/**
 * Parse "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" as a local (Bedford) date and time.
 * Avoids `new Date("YYYY-MM-DD")`, which browsers treat as UTC midnight.
 */
export function parseLocal(str) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(str ?? ''));
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
}

export const hasTime = (str) => /T\d{2}:\d{2}/.test(String(str ?? ''));

/* Dates and numbers follow the visitor's chosen language (set once at start-up by main.js). */
let locale = 'en-US';
let dateFmt;
let timeFmt;
let monthFmt;
let monthShortFmt;
let numberFmt;
let moneyFmt;

export function setLocale(code) {
    try {
        Intl.DateTimeFormat.supportedLocalesOf([code]);
        locale = code;
    } catch {
        locale = 'en-US';
    }
    dateFmt = new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
    timeFmt = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
    monthFmt = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
    monthShortFmt = new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' });
    numberFmt = new Intl.NumberFormat(locale);
    moneyFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
setLocale('en-US');

export const formatDate = (d) => (d ? dateFmt.format(d) : '');
export const formatTime = (d) => (d ? timeFmt.format(d) : '');
export const formatMonth = (d) => (d ? monthFmt.format(d) : '');
export const formatMonthShort = (d) => (d ? monthShortFmt.format(d) : '');
export const formatNumber = (n) => numberFmt.format(Number(n) || 0);
export const money = (n) => moneyFmt.format(Number(n) || 0);

/** Weekday names, Sunday first, in the current language: [{ short, long }]. */
export function weekdays() {
    const shortFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const longFmt = new Intl.DateTimeFormat(locale, { weekday: 'long' });
    // 2023-01-01 was a Sunday
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(2023, 0, 1 + i);
        return { short: shortFmt.format(d), long: longFmt.format(d) };
    });
}

export function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const loaded = new Map();

/** Load a classic script once (used for Leaflet and the QR library, only when needed). */
export function loadScript(src) {
    if (!loaded.has(src)) {
        loaded.set(src, new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = resolve;
            s.onerror = () => { loaded.delete(src); reject(new Error(`Failed to load ${src}`)); };
            document.head.appendChild(s);
        }));
    }
    return loaded.get(src);
}

/** Load a stylesheet once. */
export function loadCSS(href) {
    if (!loaded.has(href)) {
        loaded.set(href, new Promise((resolve, reject) => {
            const l = document.createElement('link');
            l.rel = 'stylesheet';
            l.href = href;
            l.onload = resolve;
            l.onerror = () => { loaded.delete(href); reject(new Error(`Failed to load ${href}`)); };
            document.head.appendChild(l);
        }));
    }
    return loaded.get(href);
}

/** Add <link rel="preconnect"> once, so the browser warms up a connection before it's needed. */
const preconnected = new Set();
export function preconnect(origin) {
    if (preconnected.has(origin)) return;
    preconnected.add(origin);
    const l = document.createElement('link');
    l.rel = 'preconnect';
    l.href = origin;
    l.crossOrigin = '';
    document.head.appendChild(l);
}

/** Run `callback` once, when `el` comes within `margin` of the screen. */
export function onVisible(el, callback, margin = '200px') {
    if (!('IntersectionObserver' in window)) { callback(); return () => {}; }
    const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
            io.disconnect();
            callback();
        }
    }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
}

/**
 * Render a long list in pages of `pageSize` with a "Show more" button
 * (no infinite scroll, so keyboard users can always reach the footer).
 * After "Show more", focus moves to the first newly added item.
 */
export function showMore(listEl, items, renderItem, { pageSize = 24, label = 'Show more' } = {}) {
    let shown = 0;
    let button = null;
    listEl.nextElementSibling?.classList.contains('show-more') && listEl.nextElementSibling.remove();

    const addPage = () => {
        const next = items.slice(shown, shown + pageSize);
        const tpl = document.createElement('template');
        tpl.innerHTML = next.map((item, i) => renderItem(item, shown + i)).join('');
        const first = tpl.content.firstElementChild;
        listEl.append(tpl.content);
        shown += next.length;
        if (button) {
            if (shown >= items.length) button.remove();
            else button.textContent = `${label} (${items.length - shown})`;
        }
        return first;
    };

    addPage();
    if (shown < items.length) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-secondary show-more';
        button.textContent = `${label} (${items.length - shown})`;
        button.addEventListener('click', () => {
            const first = addPage();
            const target = first?.matches('a,button') ? first : first?.querySelector('a,button') || first;
            if (target) {
                if (!target.matches('a,button')) target.tabIndex = -1;
                target.focus();
            }
        });
        listEl.after(button);
    }
}

/** Debounce a function (used by the donor search box). */
export function debounce(fn, ms = 200) {
    let id;
    return (...args) => {
        clearTimeout(id);
        id = setTimeout(() => fn(...args), ms);
    };
}
