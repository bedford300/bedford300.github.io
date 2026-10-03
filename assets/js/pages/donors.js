/** Donors page: donors grouped by tier (no dollar amounts), with search. */

export async function render(root, ctx) {
    const { data, t, util } = ctx;
    const { esc } = util;
    const body = root.querySelector('#donors-body');
    const status = root.querySelector('#donor-status');
    const search = root.querySelector('#donor-search');

    let tiers;
    let donors;
    try {
        const d = await data.getJSON('donors.json');
        tiers = [...(d.tiers || [])].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
        donors = d.donors || [];
        const ids = new Set(tiers.map((x) => x.id));
        donors.forEach((x) => { if (!ids.has(x.tier)) console.warn(`[donors] "${x.name}" has unknown tier "${x.tier}".`); });
    } catch {
        data.sectionError(body, t);
        search.disabled = true;
        return;
    } finally {
        body.removeAttribute('aria-busy');
    }

    const displayName = (x) => (x.anonymous ? t('donors.anonymous') : x.name);

    const draw = (query) => {
        const q = query.trim().toLowerCase();
        const matches = (x) => !q || displayName(x).toLowerCase().includes(q) || String(x.inHonorOf || '').toLowerCase().includes(q);
        body.innerHTML = '';
        let total = 0;
        tiers.forEach((tier) => {
            const list = donors.filter((x) => x.tier === tier.id && matches(x));
            if (!list.length) return;
            total += list.length;
            const section = document.createElement('section');
            section.className = 'tier';
            section.style.setProperty('--tier-color', tier.color || 'var(--navy)');
            section.innerHTML = `
                <h3 class="tier-title"><span class="tier-name">${esc(tier.name)}</span>
                    <span class="tier-count">${t('donors.count', { count: list.length })}</span></h3>
                ${tier.threshold ? `<p class="tier-threshold">${esc(tier.threshold)}</p>` : ''}
                <ul class="donor-list"></ul>`;
            body.appendChild(section);
            util.showMore(section.querySelector('.donor-list'), list, (x) => `
                <li class="donor${x.type === 'business' ? ' donor-business' : ''}">
                    <span class="donor-name">${esc(displayName(x))}</span>
                    ${x.inHonorOf ? `<span class="donor-honor">${esc(t('donors.inHonorOf', { name: x.inHonorOf }))}</span>` : ''}
                </li>`, { label: t('btn.showMore') });
        });
        if (!total) body.innerHTML = `<p class="notice">${t('donors.noMatch')}</p>`;
        status.textContent = q ? t('donors.count', { count: total }) : '';
    };

    search.addEventListener('input', util.debounce(() => draw(search.value), 200));
    draw('');
}
