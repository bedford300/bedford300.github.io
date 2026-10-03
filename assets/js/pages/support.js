/** Support Us page: community partners, sponsors by group, become a sponsor, volunteer roles. */

export async function render(root, ctx) {
    const { data, t, util, site } = ctx;
    const { esc } = util;

    const contact = root.querySelector('#sponsor-contact');
    if (site.contactEmail) {
        contact.innerHTML = `${t('support.contact')}: <a href="mailto:${esc(site.contactEmail)}">${esc(site.contactEmail)}</a>`;
    }

    const targets = ['#partners-body', '#sponsors-body', '#volunteer-body'].map((s) => root.querySelector(s));
    try {
        const s = await data.getJSON('sponsors.json');
        targets[0].innerHTML = (s.partners || []).map((p) => partnerCard(p, ctx)).join('');
        targets[1].innerHTML = sponsorGroups(s, ctx);
        targets[2].innerHTML = s.volunteer ? `
            <p class="lead">${esc(s.volunteer.intro)}</p>
            <ul class="check-list check-list-columns">${(s.volunteer.roles || []).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : '';
    } catch {
        targets.forEach((el) => data.sectionError(el, t));
    }
}

function logoOrName(item, { media, util }) {
    return item.logo
        ? media.picture(item.logo, { alt: item.name, sizes: '200px', maxWidth: 400, cls: 'logo-img' })
        : `<span class="logo-text">${util.esc(item.name)}</span>`;
}

function partnerCard(p, ctx) {
    const { t, util } = ctx;
    const { esc } = util;
    const url = util.safeUrl(p.url);
    return `
        <article class="partner-card">
            <div class="partner-logo">${logoOrName(p, ctx)}</div>
            <h3>${esc(p.name)}</h3>
            <p>${esc(p.description)}</p>
            ${p.contact && p.showContact ? `<p><strong>${t('support.contact')}:</strong> ${esc(p.contact)}</p>` : ''}
            ${url ? `<a class="btn btn-primary" href="${esc(url)}" target="_blank" rel="noopener">${t('support.visit')}<span class="visually-hidden">: ${esc(p.name)} ${t('footer.newTab')}</span></a>` : ''}
        </article>`;
}

function sponsorGroups(s, ctx) {
    const { util } = ctx;
    const { esc } = util;
    const known = new Set((s.groups || []).map((g) => g.id));
    (s.sponsors || []).forEach((x) => {
        if (!known.has(x.type)) console.warn(`[support] Sponsor "${x.name}" has unknown type "${x.type}".`);
    });
    return (s.groups || []).map((g) => {
        const list = (s.sponsors || []).filter((x) => x.type === g.id);
        if (!list.length) return '';
        return `
            <h3 class="group-title">${esc(g.title)}</h3>
            <ul class="logo-grid">${list.map((x) => {
                const url = util.safeUrl(x.url);
                const inner = logoOrName(x, ctx);
                return `<li class="logo-tile">${url
                    ? `<a href="${esc(url)}" target="_blank" rel="noopener">${inner}<span class="visually-hidden"> ${ctx.t('footer.newTab')}</span></a>`
                    : inner}</li>`;
            }).join('')}</ul>`;
    }).join('');
}
