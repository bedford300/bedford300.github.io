/**
 * Interface text lookup. All labels live in data/strings.en.json so the site can be
 * translated later by adding e.g. strings.es.json.
 */

let strings = {};

export function init(loaded) {
    strings = loaded || {};
}

/** t('history.score', { score: 3, total: 10 }) -> "You scored 3 out of 10." */
export function t(key, vars) {
    let s = strings[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (match, name) => (vars[name] ?? match));
    return s;
}

/**
 * Fill placeholders in HTML partials:
 *   data-i18n="key"            -> text content
 *   data-i18n-aria-label="key" -> aria-label
 *   data-site="field"          -> text from site.json
 *   data-site-href="field"     -> href from site.json
 */
export function apply(root, site = {}) {
    root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel)));
    root.querySelectorAll('[data-site]').forEach((el) => { el.textContent = site[el.dataset.site] ?? ''; });
    root.querySelectorAll('[data-site-href]').forEach((el) => { el.href = site[el.dataset.siteHref] || '#'; });
}
