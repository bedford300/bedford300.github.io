/**
 * Events page: Timeline / Calendar / List views, category filter, "Add to calendar", promotions.
 * Categories: "main" (Kickoff & Finale), "community" (Year of Celebration),
 * "ongoing" (leading-up and year-round projects without a date).
 */

let state = null;

export async function render(root, ctx, sub) {
    const { data, t } = ctx;
    const panel = root.querySelector('#events-panel');
    state = { root, ctx, panel, events: [], ongoing: [], view: 'timeline', filter: 'all', month: null };

    setupTabs(root);
    root.querySelector('#events-filter').addEventListener('change', (e) => {
        state.filter = e.target.value;
        draw();
    });
    panel.addEventListener('click', onPanelClick);
    root.querySelector('#events-past').addEventListener('click', onPanelClick);

    const promotions = renderPromotions(root.querySelector('#promotions-body'), ctx);

    try {
        const { events = [], notice } = await data.getJSON('events.json');
        renderNotice(root.querySelector('#events-notice'), notice, ctx);
        state.ongoing = events
            .filter((e) => e.category === 'ongoing')
            .map((e) => ({ ...e, _past: false }));
        state.events = normalize(events.filter((e) => e.category !== 'ongoing'), ctx.util);
        state.month = initialMonth(state.events);
        draw();
        if (sub) revealEvent(sub);
    } catch {
        data.sectionError(panel, t);
    } finally {
        panel.removeAttribute('aria-busy');
    }
    await promotions;
}

/** #events/<id> while already on the Events page. */
export async function update(sub) {
    if (sub) revealEvent(sub);
}

export function destroy() {
    state?.detachScrubber?.();
    state = null;
}

/* ------------------------------------------------------------------ */

/** "Tentative schedule" box at the top (events.json -> notice). */
function renderNotice(el, notice, { util }) {
    if (!el || !notice?.text) return;
    el.innerHTML = `<aside class="notice notice-tentative" aria-label="${util.esc(notice.title || '')}">
        ${notice.title ? `<p class="notice-title">${util.esc(notice.title)}</p>` : ''}
        <p>${util.esc(notice.text)}</p></aside>`;
}

function normalize(events, util) {
    const today = util.startOfToday();
    return events
        .map((e) => {
            const start = util.parseLocal(e.start);
            const end = util.parseLocal(e.end) || start;
            if (!start) console.warn(`[events] "${e.id}" has an invalid start date:`, e.start);
            return { ...e, category: e.category === 'main' ? 'main' : 'community', _start: start, _end: end, _past: !!end && end < today };
        })
        .filter((e) => e._start)
        .sort((a, b) => a._start - b._start);
}

function initialMonth(events) {
    const now = new Date();
    const first = events.find((e) => !e._past) || events[0];
    const range = monthRange(events);
    const current = new Date(now.getFullYear(), now.getMonth(), 1);
    if (current >= range.min && current <= range.max) return current;
    return first ? new Date(first._start.getFullYear(), first._start.getMonth(), 1) : range.min;
}

/** Calendar covers Sep 2028 – Sep 2029, extended if events fall outside. */
function monthRange(events) {
    let min = new Date(2028, 8, 1);
    let max = new Date(2029, 8, 1);
    events.forEach((e) => {
        const m = new Date(e._start.getFullYear(), e._start.getMonth(), 1);
        if (m < min) min = m;
        if (m > max) max = m;
    });
    return { min, max };
}

const visible = () => state.events.filter((e) => state.filter === 'all' || e.category === state.filter);
const visibleOngoing = () => (['all', 'ongoing'].includes(state.filter) ? state.ongoing : []);

function setupTabs(root) {
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    const select = (tab, focus) => {
        tabs.forEach((x) => {
            const on = x === tab;
            x.setAttribute('aria-selected', String(on));
            x.tabIndex = on ? 0 : -1;
        });
        state.panel.setAttribute('aria-labelledby', tab.id);
        state.view = tab.dataset.view;
        if (focus) tab.focus();
        draw();
    };
    tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => select(tab));
        tab.addEventListener('keydown', (e) => {
            const move = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
            if (move) select(tabs[(i + move + tabs.length) % tabs.length], true);
            if (e.key === 'Home') select(tabs[0], true);
            if (e.key === 'End') select(tabs[tabs.length - 1], true);
        });
    });
    state.selectTab = (view) => select(tabs.find((x) => x.dataset.view === view));
}

function draw() {
    if (!state) return;
    const { panel, ctx } = state;
    const list = visible();
    const upcoming = list.filter((e) => !e._past);
    const past = list.filter((e) => e._past).reverse();

    const ongoing = visibleOngoing();
    state.detachScrubber?.();
    state.detachScrubber = null;
    if (state.view === 'calendar') panel.innerHTML = calendarView(list, ctx);
    else if (state.view === 'list') panel.innerHTML = listView(upcoming, ongoing, ctx);
    else {
        panel.innerHTML = timelineView(upcoming, ongoing, ctx);
        state.detachScrubber = setupScrubber(panel, ctx);
    }

    // Past events: separate group with "Show more"
    const pastEl = state.root.querySelector('#events-past');
    pastEl.innerHTML = '';
    if (past.length && state.view !== 'calendar') {
        pastEl.innerHTML = `<h2 class="section-title">${ctx.t('events.past')}</h2><div class="event-list event-list-past"></div>`;
        ctx.util.showMore(pastEl.querySelector('.event-list'), past, (e) => eventCard(e, ctx), { label: ctx.t('btn.showMore') });
    }
}

/* ---------- Views ---------- */

function whenText(e, { util, t }) {
    if (e.category === 'ongoing') return util.esc(e.dateLabel || t('events.ongoingWhen'));
    if (e.dateTBD) return util.esc(e.dateLabel || t('events.tbd'));
    const sameDay = e._end && e._end.toDateString() === e._start.toDateString();
    let s = util.formatDate(e._start);
    if (util.hasTime(e.start)) {
        s += ` · ${util.formatTime(e._start)}`;
        if (sameDay && util.hasTime(e.end)) s += `–${util.formatTime(e._end)}`;
    }
    if (!sameDay && e._end) s += ` – ${util.formatDate(e._end)}`;
    return s;
}

function eventCard(e, ctx) {
    const { util, t, media } = ctx;
    const { esc } = util;
    const link = util.safeUrl(e.link);
    const photos = (e.photos || []).filter((p) => p.src);
    const proposed = e.status === 'proposed';
    // Internal links (e.g. #history/town-gift) open in the same tab
    const internal = link.startsWith('#');
    return `
        <article class="event-card${e._past ? ' is-past' : ''}${e.image ? '' : ' no-media'}${proposed ? ' is-proposed' : ''}" id="events-${esc(e.id)}">
            ${e.image ? `<div class="event-media">${media.picture(e.image, { alt: e.imageAlt || '', sizes: '(min-width: 800px) 280px, 100vw', maxWidth: 800, cls: 'cover-img' })}</div>` : ''}
            <div class="event-body">
                <p class="event-badges">
                    <span class="badge badge-${e.category}">${t(`events.category.${e.category}`)}</span>
                    ${proposed ? `<span class="badge badge-proposed" title="${esc(t('events.proposedHint'))}">${t('events.status.proposed')}</span>` : ''}
                </p>
                <h3 class="event-title">${esc(e.title)}</h3>
                <p class="event-when"><strong>${whenText(e, ctx)}</strong></p>
                ${e.location ? `<p class="event-where">${esc(e.location)}</p>` : ''}
                ${e.host ? `<p class="event-host">${esc(t('events.hostedBy', { host: e.host }))}</p>` : ''}
                <p>${esc(e.description)}</p>
                ${photos.length ? `<ul class="thumb-grid thumb-grid-small">${photos.map((p, i) => `
                    <li><button type="button" class="thumb" data-event="${esc(e.id)}" data-index="${i}">
                        ${media.picture(p.src, { alt: p.alt || p.caption || '', sizes: '120px', maxWidth: 400, cls: 'thumb-img' })}
                    </button></li>`).join('')}</ul>` : ''}
                ${(e.videos || []).length ? `<div class="video-grid video-grid-small">${e.videos.map((v) => media.videoCard(v)).join('')}</div>` : ''}
                <div class="event-actions">
                    ${e.category === 'ongoing' ? ''
                        : !e.dateTBD && !e._past
                            ? `<button type="button" class="btn btn-secondary" data-ics="${esc(e.id)}">${t('btn.addToCalendar')}<span class="visually-hidden">: ${esc(e.title)}</span></button>`
                            : (!e._past ? `<p class="hint">${t('events.calendarTbdNote')}</p>` : '')}
                    ${link && internal ? `<a class="btn btn-primary" href="${esc(link)}">${t('btn.details')}<span class="visually-hidden">: ${esc(e.title)}</span></a>` : ''}
                    ${link && !internal ? `<a class="btn btn-primary" href="${esc(link)}" target="_blank" rel="noopener">${t('btn.details')}<span class="visually-hidden">: ${esc(e.title)} ${t('footer.newTab')}</span></a>` : ''}
                </div>
            </div>
        </article>`;
}

function timelineView(events, ongoing, ctx) {
    if (!events.length && !ongoing.length) return `<p class="notice">${ctx.t('events.empty')}</p>`;
    const { esc } = ctx.util;
    const groups = new Map();
    if (ongoing.length) groups.set('ongoing', { label: ctx.t('events.ongoingTitle'), short: ctx.t('events.ongoingShort'), list: ongoing });
    events.forEach((e) => {
        const key = ctx.util.formatMonth(e._start);
        if (!groups.has(key)) groups.set(key, { label: key, short: ctx.util.formatMonthShort(e._start), list: [] });
        groups.get(key).list.push(e);
    });
    if (state && events.some((e) => (e.videos || []).length)) ctx.media.warmUpVideos();
    const all = [...groups.values()];
    return `${scrubberHtml(all, ctx)}
        <ol class="timeline">${all.map((g, i) => `
        <li class="timeline-group" id="tl-group-${i}" data-label="${esc(g.label)}">
            <h2 class="timeline-month">${esc(g.label)}</h2>
            <div class="event-list">${g.list.map((e) => eventCard(e, ctx)).join('')}</div>
        </li>`).join('')}</ol>`;
}

/* ---------- Timeline slider ("jump to a month") ---------- */

/**
 * A slider that stays under the header while the timeline scrolls. Each stop is one
 * timeline group (Leading Up, then each month). Dragging it (or using the arrow keys, or
 * clicking a month label) brings that month to the top; scrolling moves the slider along.
 */
function scrubberHtml(groups, { util, t }) {
    if (groups.length < 2) return '';
    const { esc } = util;
    const last = groups.length - 1;
    return `
        <div class="tl-scrubber" role="group" aria-labelledby="tl-range-label">
            <div class="tl-scrubber-top">
                <label id="tl-range-label" for="tl-range" class="tl-range-label">${t('events.jumpTo')}</label>
                <output class="tl-current" for="tl-range" aria-hidden="true">${esc(groups[0].label)}</output>
            </div>
            <input type="range" id="tl-range" class="tl-range" min="0" max="${last}" step="1" value="0"
                aria-valuetext="${esc(groups[0].label)}">
            <div class="tl-ticks" aria-hidden="true">
                ${groups.map((g, i) => `<button type="button" class="tl-tick" tabindex="-1" data-index="${i}"
                    style="--pos:${i / last}" title="${esc(g.label)}">${esc(g.short)}</button>`).join('')}
            </div>
        </div>`;
}

function setupScrubber(panel, { util }) {
    const box = panel.querySelector('.tl-scrubber');
    if (!box) return null;
    const range = box.querySelector('.tl-range');
    const current = box.querySelector('.tl-current');
    const groups = [...panel.querySelectorAll('.timeline-group')];
    const ticks = [...box.querySelectorAll('.tl-tick')];
    let dragging = false;
    let frame = 0;

    // Space taken at the top of the screen by the sticky header + this slider
    const topOffset = () => box.getBoundingClientRect().bottom + 12;

    const show = (i) => {
        const label = groups[i]?.dataset.label || '';
        range.value = String(i);
        range.setAttribute('aria-valuetext', label);
        current.textContent = label;
        ticks.forEach((tk, n) => tk.classList.toggle('is-current', n === i));
    };

    const jumpTo = (i, smooth) => {
        const group = groups[i];
        if (!group) return;
        show(i);
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const y = group.getBoundingClientRect().top + window.scrollY - topOffset();
        window.scrollTo({ top: Math.max(0, y), behavior: smooth && !reduce ? 'smooth' : 'auto' });
    };

    // Dragging / arrow keys: follow the slider immediately
    range.addEventListener('input', () => jumpTo(Number(range.value), false));
    range.addEventListener('pointerdown', () => { dragging = true; });
    const stopDrag = () => { dragging = false; };
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);

    // Month labels under the slider: click to jump there
    ticks.forEach((tk) => tk.addEventListener('click', () => jumpTo(Number(tk.dataset.index), true)));

    // Normal scrolling: move the slider to the month currently at the top
    const sync = () => {
        frame = 0;
        if (dragging) return;
        const line = topOffset() + 1;
        let i = 0;
        groups.forEach((g, n) => { if (g.getBoundingClientRect().top <= line) i = n; });
        if (String(i) !== range.value) show(i);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(sync); };
    window.addEventListener('scroll', onScroll, { passive: true });
    show(0);
    sync();

    return () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('pointerup', stopDrag);
        window.removeEventListener('pointercancel', stopDrag);
        if (frame) cancelAnimationFrame(frame);
    };
}

function listView(upcoming, ongoing, { util, t }) {
    const events = [...ongoing, ...upcoming];
    if (!events.length) return `<p class="notice">${t('events.empty')}</p>`;
    const { esc } = util;
    return `<div class="table-wrap"><table class="events-table">
        <thead><tr><th scope="col">${t('events.col.date')}</th><th scope="col">${t('events.col.event')}</th><th scope="col">${t('events.col.location')}</th><th scope="col">${t('events.col.type')}</th></tr></thead>
        <tbody>${events.map((e) => `<tr>
            <td>${whenText(e, { util, t })}</td>
            <td><a href="#events/${encodeURIComponent(e.id)}">${esc(e.title)}</a></td>
            <td>${esc(e.location)}</td>
            <td>${t(`events.category.${e.category}`)}${e.status === 'proposed' ? ` <span class="badge badge-proposed">${t('events.status.proposed')}</span>` : ''}</td>
        </tr>`).join('')}</tbody></table></div>`;
}

/**
 * Calendar month grid.
 * - Events with a date go in their day's cell (each day of a multi-day event).
 *   "tentativeDate": true = a planned day that isn't final yet (dashed, marked "tentative").
 * - Events known only by month (dateTBD without tentativeDate) go in a
 *   "Date to be announced" row at the top of that month's grid.
 */
function calendarView(events, { util, t }) {
    const { esc } = util;
    if (state.filter === 'ongoing') return `<p class="notice">${t('events.empty')}</p>`;
    const range = monthRange(state.events);
    const month = state.month;
    const y = month.getFullYear();
    const m = month.getMonth();
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 0);
    const placed = (e) => !e.dateTBD || e.tentativeDate;
    // Events touching this month (multi-day events can start in an earlier month)
    const inMonth = events.filter((e) => {
        const end = e._end && e._end > e._start ? e._end : e._start;
        return placed(e) ? e._start <= monthEnd && end >= monthStart
            : e._start.getFullYear() === y && e._start.getMonth() === m;
    });
    const onDays = inMonth.filter(placed);
    const tba = inMonth.filter((e) => !placed(e));

    const chip = (e) => {
        const tentative = e.dateTBD && e.tentativeDate;
        const proposed = e.status === 'proposed';
        const note = [tentative ? t('events.tentative') : '', proposed ? t('events.status.proposed') : ''].filter(Boolean).join(', ');
        return `<a class="cal-event cal-${e.category}${tentative ? ' is-tentative' : ''}${proposed ? ' is-proposed' : ''}"
            href="#events/${encodeURIComponent(e.id)}" title="${esc(e.title)}${note ? ` (${esc(note)})` : ''}">${esc(e.title)}${
            note ? `<span class="cal-note"> (${esc(note)})</span>` : ''}</a>`;
    };
    const onDay = (d) => {
        const day = new Date(y, m, d);
        return onDays.filter((e) => {
            const s = new Date(e._start.getFullYear(), e._start.getMonth(), e._start.getDate());
            const endRaw = e._end && e._end > e._start ? e._end : e._start;
            const en = new Date(endRaw.getFullYear(), endRaw.getMonth(), endRaw.getDate());
            return day >= s && day <= en;
        });
    };

    const firstDay = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push('<td class="cal-empty"></td>');
    for (let d = 1; d <= daysInMonth; d++) {
        const todays = onDay(d);
        cells.push(`<td class="${todays.length ? 'cal-has-events' : ''}">
            <span class="cal-day">${d}</span>
            ${todays.map(chip).join('')}
        </td>`);
    }
    while (cells.length % 7) cells.push('<td class="cal-empty"></td>');
    const rows = [];
    // Month-only events: a full-width row at the top of the grid
    if (tba.length) {
        rows.push(`<tr class="cal-tba-row"><td colspan="7">
            <span class="cal-tba-label">${t('events.calendarTbaRow')}</span>
            <span class="cal-tba-events">${tba.map(chip).join('')}</span>
        </td></tr>`);
    }
    for (let i = 0; i < cells.length; i += 7) rows.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);

    const atStart = month <= range.min;
    const atEnd = month >= range.max;
    const days = util.weekdays();
    const monthList = [...onDays, ...tba];

    return `
        <div class="calendar">
            <div class="cal-header">
                <button type="button" class="btn btn-secondary" data-month="-1" ${atStart ? 'disabled' : ''}>‹ <span class="visually-hidden">${t('events.prevMonth')}</span></button>
                <h2 class="cal-title" aria-live="polite" tabindex="-1">${esc(util.formatMonth(month))}</h2>
                <button type="button" class="btn btn-secondary" data-month="1" ${atEnd ? 'disabled' : ''}><span class="visually-hidden">${t('events.nextMonth')}</span> ›</button>
            </div>
            <div class="table-wrap">
                <table class="cal-grid">
                    <caption class="visually-hidden">${esc(util.formatMonth(month))}</caption>
                    <thead><tr>${days.map((d) => `<th scope="col"><abbr title="${esc(d.long)}">${esc(d.short)}</abbr></th>`).join('')}</tr></thead>
                    <tbody>${rows.join('')}</tbody>
                </table>
            </div>
            <h3 class="cal-list-title">${esc(util.formatMonth(month))}</h3>
            ${monthList.length
                ? `<ul class="cal-list">${monthList.map((e) => `<li>
                    <a href="#events/${encodeURIComponent(e.id)}">${esc(e.title)}</a>
                    <span class="cal-list-when">${whenText(e, { util, t })}</span>
                    ${e.status === 'proposed' ? `<span class="badge badge-proposed">${t('events.status.proposed')}</span>` : ''}</li>`).join('')}</ul>`
                : `<p class="notice">${t('events.noneThisMonth')}</p>`}
        </div>`;
}

/* ---------- Interactions ---------- */

function onPanelClick(e) {
    if (!state) return;
    const monthBtn = e.target.closest('[data-month]');
    if (monthBtn) {
        const step = Number(monthBtn.dataset.month);
        state.month = new Date(state.month.getFullYear(), state.month.getMonth() + step, 1);
        draw();
        state.panel.querySelector(`[data-month="${step}"]:not([disabled])`)?.focus()
            || state.panel.querySelector('.cal-title')?.focus();
        return;
    }
    const icsBtn = e.target.closest('[data-ics]');
    if (icsBtn) {
        const ev = state.events.find((x) => x.id === icsBtn.dataset.ics);
        if (ev) downloadIcs(ev, state.ctx);
        return;
    }
    const thumb = e.target.closest('.thumb[data-event]');
    if (thumb) {
        const ev = state.events.find((x) => x.id === thumb.dataset.event);
        const photos = (ev?.photos || []).filter((p) => p.src);
        state.ctx.media.openLightbox(photos, Number(thumb.dataset.index), thumb);
    }
}

/** Make sure the event's card is on screen (switching to the timeline if needed). */
function revealEvent(id) {
    if (!state) return;
    const ev = state.events.find((x) => x.id === id) || state.ongoing.find((x) => x.id === id);
    if (!ev) return;
    if (state.filter !== 'all' && ev.category !== state.filter) {
        state.filter = 'all';
        state.root.querySelector('#events-filter').value = 'all';
    }
    if (state.view !== 'timeline' && !ev._past) state.selectTab('timeline');
    else if (ev._past) draw();
    // Past event hidden behind "Show more"? Keep clicking until it's rendered.
    let guard = 20;
    while (!document.getElementById(`events-${id}`) && guard--) {
        const more = state.root.querySelector('#events-past .show-more');
        if (!more) break;
        more.click();
    }
}

/* ---------- Add to calendar (.ics) ---------- */

const ICS_TZ = [
    'BEGIN:VTIMEZONE', 'TZID:America/New_York',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400', 'TZNAME:EDT', 'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'TZNAME:EST', 'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
    'END:VTIMEZONE',
];

const pad = (n) => String(n).padStart(2, '0');
const icsDate = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const icsDateTime = (d) => `${icsDate(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const icsText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

export function buildIcs(e, site = {}) {
    const timed = /T\d{2}:\d{2}/.test(e.start);
    const now = new Date();
    const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Friends of Tricentennial//Bedford 300//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    if (timed) lines.push(...ICS_TZ);
    lines.push('BEGIN:VEVENT', `UID:${e.id}@bedford300`, `DTSTAMP:${stamp}`);
    if (timed) {
        const end = e._end && e._end > e._start ? e._end : new Date(e._start.getTime() + 36e5);
        lines.push(`DTSTART;TZID=America/New_York:${icsDateTime(e._start)}`, `DTEND;TZID=America/New_York:${icsDateTime(end)}`);
    } else {
        const endExclusive = new Date(e._end.getFullYear(), e._end.getMonth(), e._end.getDate() + 1);
        lines.push(`DTSTART;VALUE=DATE:${icsDate(e._start)}`, `DTEND;VALUE=DATE:${icsDate(endExclusive)}`);
    }
    lines.push(`SUMMARY:${icsText(e.title)}`, `LOCATION:${icsText(e.location)}`, `DESCRIPTION:${icsText(e.description)}`);
    if (site.siteUrl) lines.push(`URL:${site.siteUrl}#events/${e.id}`);
    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
}

function downloadIcs(e, { site }) {
    const blob = new Blob([buildIcs(e, site)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${e.id}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- Promotions ---------- */

async function renderPromotions(el, ctx) {
    const { data, t, util, media, site } = ctx;
    const { esc } = util;
    try {
        const p = await data.getJSON('promotions.json');
        const merchUrl = util.safeUrl(p.merch?.url);
        el.innerHTML = `
            <article class="promo-card">
                <h3>${esc(p.easyWays?.title)}</h3>
                <ul class="check-list">${(p.easyWays?.items || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
            </article>
            <article class="promo-card">
                ${media.picture(p.merch?.image, { alt: p.merch?.imageAlt || '', sizes: '(min-width: 900px) 320px, 100vw', maxWidth: 800, cls: 'promo-img' })}
                <h3>${esc(p.merch?.title)}</h3>
                <p>${esc(p.merch?.description)}</p>
                ${merchUrl ? `<a class="btn btn-primary" href="${esc(merchUrl)}" target="_blank" rel="noopener">${esc(p.merch?.linkLabel)}<span class="visually-hidden"> ${t('footer.newTab')}</span></a>` : ''}
            </article>
            <article class="promo-card">
                <h3>${esc(p.flags?.title)}</h3>
                <p>${esc(p.flags?.description)}</p>
                <div class="qr" id="qr-code" data-label="${esc(p.flags?.qrLabel)}"><span class="hint">${t('loading')}</span></div>
            </article>`;

        // The QR library is only downloaded when this box scrolls into view.
        const qr = el.querySelector('#qr-code');
        util.onVisible(qr, async () => {
            try {
                await util.loadScript(`assets/vendor/qrcode/qrcode.js?v=${ctx.version}`);
                const code = window.qrcode(0, 'M');
                code.addData(site.siteUrl || location.href.split('#')[0]);
                code.make();
                qr.innerHTML = code.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
                const svg = qr.querySelector('svg');
                svg.setAttribute('role', 'img');
                svg.setAttribute('aria-label', qr.dataset.label);
            } catch (err) {
                console.error('[events] QR code failed:', err);
                qr.innerHTML = '';
            }
        });
    } catch {
        data.sectionError(el, t);
    }
}
