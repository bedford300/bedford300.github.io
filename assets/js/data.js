/**
 * Loads the JSON files in /data once and keeps them in memory.
 * If a file is missing or has a typo, only the section that needs it shows an error.
 *
 * Translations: for languages other than English, a file in data/i18n/<lang>/<name>
 * (listed in data/i18n/languages.json) is merged over the English file. It only needs
 * the fields that are translated; list items are matched by their "id". Anything not
 * translated stays in English.
 */

const cache = new Map();
let lang = 'en';
let overlays = new Set();

export function setLanguage(code, overlayFiles = []) {
    lang = code;
    overlays = new Set(overlayFiles);
    cache.clear();
}

export function getLanguage() {
    return lang;
}

/**
 * Data files are always re-checked with the server ("no-cache" = use the saved copy only if
 * it's unchanged), so edits to events, donors etc. show up on the next visit instead of
 * whenever the browser's saved copy happens to expire. An unchanged file costs a tiny 304 reply.
 */
function fetchJSON(path) {
    return fetch(path, { cache: 'no-cache' }).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    });
}

export function getJSON(name) {
    if (!cache.has(name)) {
        const english = fetchJSON(`data/${name}`).catch((err) => {
            console.error(`[data] Could not load data/${name}. If you just edited it, check it with a JSON validator.`, err);
            throw err;
        });
        const translated = lang !== 'en' && overlays.has(name)
            ? fetchJSON(`data/i18n/${lang}/${name}`).catch((err) => {
                console.warn(`[data] Translation data/i18n/${lang}/${name} could not be loaded; showing English.`, err);
                return null;
            })
            : Promise.resolve(null);
        const request = Promise.all([english, translated])
            .then(([base, over]) => (over ? merge(base, over) : base))
            .catch((err) => {
                cache.delete(name); // allow a retry on the next visit
                throw err;
            });
        cache.set(name, request);
    }
    return cache.get(name);
}

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

/**
 * Merge a translation over the English data.
 * - objects: field by field (fields starting with "_" are notes and are skipped)
 * - lists of items with "id": matched by id; items only in the translation are ignored
 * - other lists and plain values: the translation replaces the English
 */
export function merge(base, over) {
    if (over === undefined || over === null) return base;
    if (Array.isArray(base) && Array.isArray(over)) {
        if (base.length && base.every((x) => isObject(x) && 'id' in x)) {
            const byId = new Map(over.filter((o) => isObject(o) && 'id' in o).map((o) => [o.id, o]));
            return base.map((b) => (byId.has(b.id) ? merge(b, byId.get(b.id)) : b));
        }
        return over;
    }
    if (isObject(base) && isObject(over)) {
        const out = { ...base };
        Object.keys(over).forEach((key) => {
            if (!key.startsWith('_')) out[key] = key in base ? merge(base[key], over[key]) : over[key];
        });
        return out;
    }
    return over;
}

/** Start downloading files early (e.g. when hovering a menu link). Errors are ignored here. */
export function prefetch(names = []) {
    names.forEach((n) => getJSON(n).catch(() => {}));
}

/** Show the friendly "temporarily unavailable" message inside one section only. */
export function sectionError(el, t) {
    if (el) el.innerHTML = `<p class="notice notice-error" role="status">${t('error.section')}</p>`;
}
