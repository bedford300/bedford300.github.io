/**
 * Router - lightweight hash router (modeled on kaliejia.github.io's router.js).
 *
 *   #events            -> pages/events.html + assets/js/pages/events.js
 *   #events/porchfest  -> same page, then scrolls to the element with id "porchfest" or "events-porchfest"
 *
 * Improvements over the reference:
 *   - Each page (HTML, JS module and JSON data) loads only when first visited, then stays cached.
 *   - Hovering or focusing a menu link prefetches that page so it opens instantly.
 *   - After every page change: page title updated, focus moved to the <h1>, active link marked.
 */

export class Router {
    constructor({ routes, ctx, viewport, version }) {
        this.routes = routes;
        this.ctx = ctx;
        this.viewport = viewport;
        this.query = `?v=${version}`;
        this.partials = new Map();
        this.modules = new Map();
        this.prefetched = new Set();
        this.current = null;
        this.currentModule = null;
        this.token = 0;
        this.firstRender = true;
    }

    start() {
        window.addEventListener('hashchange', () => this.handle());
        const prefetchFromEvent = (e) => {
            const link = e.target.closest?.('a[href^="#"]');
            if (link) this.prefetch(link.getAttribute('href'));
        };
        document.addEventListener('pointerover', prefetchFromEvent);
        document.addEventListener('focusin', prefetchFromEvent);
        this.handle();
    }

    parse(hash) {
        const [page, ...rest] = decodeURIComponent(hash || '').replace(/^#\/?/, '').split('/');
        return { page: page || 'home', sub: rest.join('/') };
    }

    loadPartial(page) {
        if (!this.partials.has(page)) {
            this.partials.set(page, fetch(`pages/${page}.html${this.query}`).then((res) => {
                if (!res.ok) throw new Error(`pages/${page}.html: HTTP ${res.status}`);
                return res.text();
            }).catch((err) => { this.partials.delete(page); throw err; }));
        }
        return this.partials.get(page);
    }

    loadModule(page) {
        if (!this.modules.has(page)) {
            this.modules.set(page, import(`./pages/${page}.js${this.query}`).catch((err) => {
                this.modules.delete(page);
                throw err;
            }));
        }
        return this.modules.get(page);
    }

    prefetch(href) {
        const { page } = this.parse(href);
        const route = this.routes[page];
        if (!route || this.prefetched.has(page)) return;
        this.prefetched.add(page);
        this.loadPartial(page).catch(() => {});
        this.loadModule(page).catch(() => {});
        this.ctx.data.prefetch(route.data);
    }

    async handle() {
        const token = ++this.token;
        const { page, sub } = this.parse(location.hash);
        const route = this.routes[page];
        const { t } = this.ctx;

        // Same page, different sub-section (e.g. #gallery -> #gallery/album-id)
        if (route && page === this.current) {
            if (this.currentModule?.update) await this.currentModule.update(sub);
            if (token === this.token) this.afterRender(page, sub, route);
            return;
        }

        this.ctx.media.stopAllVideos();
        this.currentModule?.destroy?.();
        this.currentModule = null;
        this.current = null;

        if (!route) {
            this.viewport.innerHTML = `
                <div class="container section page-message">
                    <h1 tabindex="-1">${t('page.notFound')}</h1>
                    <p>${t('notFound.text')}</p>
                    <p><a class="btn btn-primary" href="#home">${t('notFound.link')}</a></p>
                </div>`;
            this.afterRender(page, '', { title: 'page.notFound' });
            return;
        }

        // Start the data download at the same time as the page HTML and code.
        this.ctx.data.prefetch(route.data);
        this.viewport.setAttribute('aria-busy', 'true');
        try {
            const [html, module] = await Promise.all([this.loadPartial(page), this.loadModule(page)]);
            if (token !== this.token) return;
            // ctx.pageNote (e.g. "some content is English-only") is drawn together with the page,
            // so it never pushes content down after it has appeared.
            this.viewport.innerHTML = (this.ctx.pageNote || '') + html;
            this.ctx.i18n.apply(this.viewport, this.ctx.site);
            this.current = page;
            this.currentModule = module;
            await module.render(this.viewport, this.ctx, sub);
        } catch (err) {
            console.error(`[router] Failed to load page "${page}":`, err);
            if (token !== this.token) return;
            this.viewport.innerHTML = `
                <div class="container section page-message">
                    <h1 tabindex="-1">${t(route.title)}</h1>
                    <p class="notice notice-error" role="status">${t('error.page')}</p>
                </div>`;
        } finally {
            if (token === this.token) this.viewport.removeAttribute('aria-busy');
        }
        if (token === this.token) this.afterRender(page, sub, route);
    }

    afterRender(page, sub, route) {
        const { t, site } = this.ctx;
        document.title = page === 'home'
            ? `${site.shortName || 'Bedford 300'} · ${site.orgName || ''}`
            : `${t(route.title)} · ${site.shortName || 'Bedford 300'}`;

        document.querySelectorAll('[data-route]').forEach((link) => {
            if (link.dataset.route === page) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
        document.dispatchEvent(new CustomEvent('routechange', { detail: { page, sub } }));

        const target = sub && (document.getElementById(sub) || document.getElementById(`${page}-${sub}`));
        if (target) {
            if (!target.hasAttribute('tabindex') && !target.matches('a,button,input,select,textarea')) target.tabIndex = -1;
            target.scrollIntoView({ block: 'start' });
            target.focus({ preventScroll: true });
        } else {
            window.scrollTo(0, 0);
            // Don't steal focus on the very first page load; do it on every navigation after that.
            const h1 = this.viewport.querySelector('h1');
            if (h1 && !this.firstRender) {
                h1.tabIndex = -1;
                h1.focus({ preventScroll: true });
            }
        }
        this.firstRender = false;
    }
}
