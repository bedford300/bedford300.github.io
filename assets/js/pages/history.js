/** History page: facts timeline, trivia quiz, historic sites map (Leaflet, loaded on demand), Town Gift. */

let cleanup = [];

export async function render(root, ctx) {
    await Promise.all([
        renderFacts(root.querySelector('#facts-body'), ctx),
        renderQuiz(root.querySelector('#quiz-body'), ctx),
        renderMap(root, ctx),
        renderGift(root.querySelector('#gift-body'), ctx),
    ]);
}

export function destroy() {
    cleanup.forEach((fn) => fn());
    cleanup = [];
}

const draftBadge = (item, { site, t }) =>
    item.verified === false && site.showDraftBadges ? `<p class="badge badge-draft">${t('draft')}</p>` : '';

/* ---------- Facts ---------- */

async function renderFacts(el, ctx) {
    const { data, t, util, media } = ctx;
    const { esc } = util;
    try {
        const { intro, facts = [] } = await data.getJSON('history.json');
        el.innerHTML = `
            ${intro ? `<p class="lead">${esc(intro)}</p>` : ''}
            <ol class="history-timeline">${facts.map((f, i) => `
                <li class="history-item"${f.id ? ` id="history-${esc(f.id)}"` : ''}>
                    <p class="history-year">${esc(f.year)}</p>
                    <article class="history-card">
                        ${f.image ? `<div class="history-media${f.imageFit === 'contain' ? ' is-contain' : ''}">
                            <button type="button" class="history-zoom" data-index="${i}" aria-label="${esc(t('history.enlarge', { title: f.title }))}">
                                ${media.picture(f.image, { alt: f.imageAlt || '', sizes: '(min-width: 800px) 260px, 100vw', maxWidth: 800, cls: f.imageFit === 'contain' ? 'contain-img' : 'cover-img' })}
                            </button>
                        </div>` : ''}
                        <div class="history-body">
                            ${draftBadge(f, ctx)}
                            <h3>${esc(f.title)}</h3>
                            <p>${esc(f.text)}</p>
                            ${f.source ? `<p class="source">${t('history.source')}: ${esc(f.source)}</p>` : ''}
                            ${f.imageCredit ? `<p class="image-credit">${esc(f.imageCredit)}</p>` : ''}
                        </div>
                    </article>
                </li>`).join('')}
            </ol>`;
        // Tap a picture to see it full size (the large version downloads only then)
        el.querySelectorAll('.history-zoom').forEach((button) => button.addEventListener('click', () => {
            const f = facts[Number(button.dataset.index)];
            media.openLightbox([{ src: f.image, alt: f.imageAlt, caption: f.title, credit: f.imageCredit }], 0, button);
        }));
    } catch {
        data.sectionError(el, t);
    }
}

/* ---------- Quiz ---------- */

async function renderQuiz(el, ctx) {
    const { data, t, util } = ctx;
    const { esc } = util;
    let bank;
    try {
        const quiz = await data.getJSON('quiz.json');
        bank = (quiz.questions || []).filter((q) => Array.isArray(q.choices) && q.choices[q.answer] !== undefined);
        bank.perRound = quiz.questionsPerRound || 10;
        if (!bank.length) throw new Error('No valid questions');
    } catch {
        data.sectionError(el, t);
        return;
    }

    let round;
    let i;
    let score;

    const start = (focus) => {
        round = util.shuffle(bank).slice(0, bank.perRound);
        i = 0;
        score = 0;
        question(focus);
    };

    const question = (focus) => {
        const q = round[i];
        el.innerHTML = `
            <div class="quiz-card">
                <p class="quiz-progress" tabindex="-1">${t('history.quizProgress', { n: i + 1, total: round.length })}</p>
                <div class="progress"><div class="progress-bar" style="width:${(i / round.length) * 100}%"></div></div>
                <form class="quiz-form" novalidate>
                    <fieldset>
                        <legend class="quiz-question">${esc(q.question)}</legend>
                        ${draftBadge(q, ctx)}
                        ${q.choices.map((c, ci) => `
                            <label class="quiz-choice">
                                <input type="radio" name="answer" value="${ci}">
                                <span>${esc(c)}</span>
                            </label>`).join('')}
                    </fieldset>
                    <div class="quiz-feedback" aria-live="polite"></div>
                    <button type="submit" class="btn btn-primary quiz-submit">${t('btn.checkAnswer')}</button>
                </form>
            </div>`;
        if (focus) el.querySelector('.quiz-progress').focus();

        const form = el.querySelector('form');
        const feedback = el.querySelector('.quiz-feedback');
        const submit = el.querySelector('.quiz-submit');
        let answered = false;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (answered) {
                i += 1;
                if (i < round.length) question(true);
                else results();
                return;
            }
            const picked = form.querySelector('input[name="answer"]:checked');
            if (!picked) {
                feedback.innerHTML = `<p class="notice">${t('history.chooseAnswer')}</p>`;
                return;
            }
            answered = true;
            const correct = Number(picked.value) === q.answer;
            if (correct) score += 1;
            form.querySelectorAll('.quiz-choice').forEach((label, ci) => {
                label.querySelector('input').disabled = true;
                if (ci === q.answer) label.classList.add('is-correct');
                else if (label.querySelector('input') === picked) label.classList.add('is-wrong');
            });
            feedback.innerHTML = `
                <p class="quiz-result ${correct ? 'is-correct' : 'is-wrong'}"><strong>${correct ? t('history.correct') : esc(t('history.incorrect', { answer: q.choices[q.answer] }))}</strong></p>
                ${q.explanation ? `<p>${esc(q.explanation)}</p>` : ''}`;
            submit.textContent = i + 1 < round.length ? t('btn.next') : t('btn.seeResults');
            submit.focus();
        });
    };

    const results = () => {
        el.innerHTML = `
            <div class="quiz-card quiz-done">
                <p class="quiz-score" tabindex="-1" role="status">${t('history.score', { score, total: round.length })}</p>
                <button type="button" class="btn btn-primary">${t('btn.tryAgain')}</button>
            </div>`;
        el.querySelector('.quiz-score').focus();
        el.querySelector('button').addEventListener('click', () => start(true));
    };

    start(false);
}

/* ---------- Map ---------- */

async function renderMap(root, ctx) {
    const { data, t, util } = ctx;
    const { esc } = util;
    const canvas = root.querySelector('#map-canvas');
    const listEl = root.querySelector('#site-list');
    let config;
    try {
        config = await data.getJSON('sites.json');
    } catch {
        data.sectionError(listEl.parentElement, t);
        canvas.hidden = true;
        return;
    }
    const sites = (config.sites || []).filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
    const directions = (s) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address || `${s.lat},${s.lng}`)}`;

    // The text list works without the map (keyboard, screen readers, slow connections).
    listEl.innerHTML = sites.map((s, i) => `
        <li class="site-item">
            <button type="button" class="site-button" data-index="${i}" aria-controls="map-canvas">
                <span class="site-name">${esc(s.name)}</span>
                <span class="site-year">${esc(s.year)}</span>
            </button>
            <p class="site-desc">${esc(s.description)}</p>
            ${draftBadge(s, ctx)}
            <a class="site-directions" href="${directions(s)}" target="_blank" rel="noopener">${t('btn.directions')}<span class="visually-hidden">: ${esc(s.name)} ${t('footer.newTab')}</span></a>
        </li>`).join('');

    let map = null;
    let markers = [];
    let loading = null;

    const loadMap = () => {
        loading ??= (async () => {
            const v = `?v=${ctx.version}`;
            await Promise.all([
                util.loadCSS(`assets/vendor/leaflet/leaflet.css${v}`),
                util.loadScript(`assets/vendor/leaflet/leaflet.js${v}`),
            ]);
            const L = window.L;
            L.Icon.Default.imagePath = 'assets/vendor/leaflet/images/';
            canvas.innerHTML = '';
            const c = config.center || { lat: 42.4906, lng: -71.276, zoom: 13 };
            map = L.map(canvas, { scrollWheelZoom: false }).setView([c.lat, c.lng], c.zoom || 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }).addTo(map);
            markers = sites.map((s) => L.marker([s.lat, s.lng], { title: s.name, alt: s.name })
                .addTo(map)
                .bindPopup(`${s.image ? ctx.media.picture(s.image, { alt: s.imageAlt || '', sizes: '120px', maxWidth: 400, cls: 'popup-img' }) : ''}
                    <strong>${esc(s.name)}</strong><br>${esc(s.year)}<p>${esc(s.description)}</p>
                    <a href="${directions(s)}" target="_blank" rel="noopener">${t('btn.directions')}</a>`));
            if (markers.length > 1) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.15));
        })().catch((err) => {
            console.error('[history] Map failed to load:', err);
            canvas.innerHTML = `<p class="notice notice-error">${t('error.section')}</p>`;
            loading = null;
        });
        return loading;
    };

    cleanup.push(util.onVisible(canvas, loadMap, '200px'));
    cleanup.push(() => { map?.remove(); map = null; });

    listEl.addEventListener('click', async (e) => {
        const button = e.target.closest('.site-button');
        if (!button) return;
        const i = Number(button.dataset.index);
        listEl.querySelectorAll('.site-button').forEach((b) => b.classList.toggle('is-active', b === button));
        await loadMap();
        if (!map) return;
        map.setView([sites[i].lat, sites[i].lng], 16, { animate: false });
        markers[i].openPopup();
    });
}

/* ---------- Town Gift ---------- */

async function renderGift(el, ctx) {
    const { data, t, util, media, site } = ctx;
    const { esc } = util;
    try {
        const g = await data.getJSON('town-gift.json');
        const goal = Number(g.goal) || 0;
        const raised = Number(g.raised) || 0;
        const pct = goal ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
        const label = t('history.giftRaised', { raised: util.money(raised), goal: util.money(goal) });
        el.innerHTML = `
            <article class="gift-card">
                <div class="gift-media">${media.picture(g.image, { alt: g.imageAlt || '', sizes: '(min-width: 900px) 440px, 100vw', maxWidth: 800, cls: 'cover-img' })}</div>
                <div class="gift-body">
                    <h3>${esc(g.name)}</h3>
                    <p>${esc(g.description)}</p>
                    <div class="progress progress-lg" role="progressbar" aria-label="${esc(g.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-valuetext="${esc(label)}">
                        <div class="progress-bar" style="width:${pct}%"></div>
                    </div>
                    <p class="gift-amount"><strong>${esc(label)}</strong> (${pct}%)</p>
                    <a class="btn btn-gold" href="${esc(util.safeUrl(site.townGiftDonateUrl || site.donateUrl))}" target="_blank" rel="noopener">${t('history.giftDonate')}<span class="visually-hidden"> ${t('footer.newTab')}</span></a>
                </div>
            </article>`;
    } catch {
        data.sectionError(el, t);
    }
}
