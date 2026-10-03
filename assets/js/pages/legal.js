/** Legal & Transparency page: list of PDF documents and the tax-deductibility statement. */

export async function render(root, ctx) {
    const { data, t, util, site } = ctx;
    const { esc } = util;
    root.querySelector('#legal-tax').textContent = t('legal.tax', { ein: site.ein || '' });

    const list = root.querySelector('#legal-list');
    try {
        const { documents = [] } = await data.getJSON('legal.json');
        list.innerHTML = documents.map((d) => {
            const date = util.parseLocal(d.date);
            const file = util.safeUrl(d.file);
            return `
                <li class="doc">
                    <div>
                        <h2 class="doc-title">${esc(d.title)}</h2>
                        <p>${esc(d.description)}</p>
                        ${date ? `<p class="doc-date">${util.formatDate(date)}</p>` : ''}
                    </div>
                    ${d.available && file
                        ? `<a class="btn btn-secondary" href="${esc(file)}" target="_blank" rel="noopener">${t('legal.download')}<span class="visually-hidden">: ${esc(d.title)} ${t('footer.newTab')}</span></a>`
                        : `<span class="badge badge-muted">${t('legal.comingSoon')}</span>`}
                </li>`;
        }).join('');
    } catch {
        data.sectionError(list, t);
    } finally {
        list.removeAttribute('aria-busy');
    }
}
