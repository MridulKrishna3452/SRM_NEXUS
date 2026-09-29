import { get, post, patch, qs } from '../api.js';
import {
  esc, icon, avatar, kindBadge, statusPill, miniSteps, fmtDate, relTime, emptyState, errorState, loadingState,
  field, formValues, clearErrors, showErrors, withBusy, toast, modal, debounce, capacity, FLOW, STATUS_LABEL,
} from '../ui.js';
import { bindRows, skillChip } from '../components.js';
import { refreshBell } from '../main.js';

// =============================================================
// List (student: mine · mentor: assigned to me)
// =============================================================
export async function requestList(ctx) {
  const { el, session, query } = ctx;
  const isMentor = session.user.role === 'mentor';
  const apps = ctx.route?.mode === 'applications';
  const state = { status: query.status || '', q: '', type: apps ? 'opportunity' : 'sessions', sort: '' };

  el.innerHTML = `
  <div class="page-head"><div><h1>${isMentor ? 'Session requests' : apps ? 'My applications' : 'My requests'}</h1>
    <p>${isMentor ? 'Mentorship sessions and guidance queries routed to you. Project applicants are under My projects.' : apps ? 'UROP, in-house project and alumni-circle applications, tracked to a decision.' : 'Mentorship sessions and guidance queries you’ve raised, with full history.'}</p></div>
    ${isMentor ? '' : apps ? `<a class="btn btn-primary" href="#/app/discover?tab=opportunities">${icon('target', 16)} Browse opportunities</a>` : `<a class="btn btn-primary" href="#/app/requests/new">${icon('plus', 16)} New request</a>`}</div>
  <div class="tabs" id="statusTabs" role="tablist"></div>
  <div class="toolbar">
    <div class="input-icon">${icon('search', 16)}<input class="input" id="rq" type="search" placeholder="Search title, description or NX-ref…" aria-label="Search requests"></div>
    <select class="input" id="rsort" aria-label="Sort"><option value="">Newest first</option><option value="updated">Recently updated</option><option value="oldest">Oldest first</option><option value="priority">Priority</option></select>
  </div>
  <section class="card flush"><div id="rlist"></div></section>`;

  const listEl = el.querySelector('#rlist');
  bindRows(listEl);
  const tabs = el.querySelector('#statusTabs');

  let seq = 0;
  async function load() {
    const my = ++seq;
    listEl.innerHTML = loadingState();
    try {
      const { requests, counts } = await get('/requests' + qs(state));
      if (my !== seq) return;
      const open = counts.submitted + counts.in_review + counts.in_progress;
      const all = Object.values(counts).reduce((a, b) => a + b, 0);
      tabs.innerHTML = [['', 'All', all], ['open', 'Open', open], ['submitted', 'Submitted', counts.submitted], ['in_review', 'In Review', counts.in_review], ['in_progress', 'In Progress', counts.in_progress], ['resolved', 'Resolved', counts.resolved], ['declined', 'Declined', counts.declined], ['cancelled', 'Cancelled', counts.cancelled]]
        .map(([k, l, n]) => `<button class="chip ${state.status === k ? 'active' : 'ghost'}" role="tab" aria-selected="${state.status === k}" data-status="${k}">${l} <span class="count">${n}</span></button>`).join('');
      listEl.innerHTML = requests.length ? requestTable(requests, '#/app/requests/', isMentor)
        : emptyState(all ? 'No requests match these filters' : isMentor ? 'Nothing assigned yet' : apps ? 'No applications yet' : 'You haven’t raised any requests',
          all ? 'Clear the search or pick another status.' : isMentor ? 'Requests routed to you will appear here.' : 'Ask the campus to find a mentor, or raise a request directly.',
          all || isMentor ? '' : apps ? '<a class="btn btn-primary" href="#/app/discover?tab=opportunities">Browse opportunities</a>' : '<a class="btn btn-primary" href="#/app/requests/new">Raise a request</a>');
    } catch (err) {
      listEl.innerHTML = `<div style="padding:20px">${errorState(err)}</div>`;
      listEl.querySelector('[data-action=retry]')?.addEventListener('click', load);
    }
  }
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-status]'); if (b) { state.status = b.dataset.status; load(); } });
  el.querySelector('#rq').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); load(); }));
  el.querySelector('#rsort').addEventListener('change', (e) => { state.sort = e.target.value; load(); });
  await load();
}

export function requestTable(requests, base, showStudent = true) {
  return `<div class="table-wrap"><table class="table"><thead><tr>
    <th>Ref</th><th>Request</th>${showStudent ? '<th class="hide-sm">Student</th>' : ''}<th class="hide-sm">Mentor</th><th>Status</th><th class="hide-sm">Updated</th></tr></thead>
    <tbody>${requests.map((r) => `<tr class="link" data-href="${base}${r.id}" tabindex="0">
      <td class="ref">${esc(r.ref)}</td>
      <td class="title-cell"><strong>${esc(r.title)}</strong><span class="muted small">${r.priority !== 'normal' ? `<span class="prio prio-${r.priority}">● ${esc(r.priority)}</span> · ` : ''}${esc(r.typeLabel)} · ${esc(r.category)}</span></td>
      ${showStudent ? `<td class="hide-sm"><span class="nowrap">${esc(r.student.name)}</span><div class="muted small">${esc(r.student.department || '')}${r.student.year ? ' · ' + esc(r.student.year) : ''}</div></td>` : ''}
      <td class="hide-sm">${r.mentor ? `<span class="row" style="gap:8px">${avatar(r.mentor.name, r.mentor.hue, 'sm')}<span class="nowrap">${esc(r.mentor.name)}</span></span>` : '<span class="muted">Unassigned</span>'}</td>
      <td><div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start">${statusPill(r.status, r.statusLabel)}${miniSteps(r.status)}</div></td>
      <td class="hide-sm muted small nowrap">${relTime(r.updatedAt)}</td></tr>`).join('')}</tbody></table></div>`;
}

// =============================================================
// New request (students)
// =============================================================
export async function newRequest(ctx) {
  const { el, query, session } = ctx;
  const meta = session.meta;
  const [{ mentors }, { opportunities }] = await Promise.all([get('/mentors'), get('/opportunities')]);
  if (!ctx.isCurrent()) return;

  const type = ['mentorship', 'opportunity', 'guidance'].includes(query.type) ? query.type : 'mentorship';
  const pre = { mentor: query.mentor || '', opportunity: query.opportunity || '', category: meta.categories.includes(query.category) ? query.category : '', title: query.title || '' };
  const preOpp = opportunities.find((o) => String(o.id) === pre.opportunity);
  if (preOpp && !pre.title) pre.title = `Application: ${preOpp.title}`;
  if (preOpp && !pre.category) pre.category = /UROP/.test(preOpp.type) ? 'Research & UROP' : preOpp.type === 'Entrepreneurship' ? 'Entrepreneurship' : preOpp.type === 'Alumni Circle' ? 'Placements & Internships' : 'Projects & Teams';

  const mentorOpts = [['', type === 'guidance' ? 'Let the mentorship cell choose' : 'Select a mentor…'], ...mentors.map((m) => [m.id, `${m.name} — ${m.kind} · ${m.headline}${m.openLoad >= m.weekly_capacity ? ' (full this week)' : ''}`])];

  el.innerHTML = `
  <div class="page-head"><div><h1>Raise a request</h1><p>Be specific — clear requests get routed and answered faster.</p></div></div>
  <div class="grid grid-main-side">
    <form class="card" id="reqForm" novalidate>
      <div class="form-error" hidden></div>
      <fieldset style="border:none;padding:0;margin:0 0 18px"><legend class="label" style="margin-bottom:8px">What do you need? <span class="req">*</span></legend>
        <div class="type-cards">
          ${[['mentorship', 'user', 'Mentorship session', '1:1 time with a specific mentor'], ['opportunity', 'target', 'Apply to opportunity', 'UROP, project or alumni circle'], ['guidance', 'message', 'Guidance query', 'Not sure who to ask? We’ll route it']]
            .map(([v, ic, t, d]) => `<label class="type-card"><input type="radio" name="type" value="${v}" ${type === v ? 'checked' : ''}><span class="ic-blue" style="width:32px;height:32px;border-radius:9px;display:grid;place-items:center">${icon(ic, 16)}</span><strong>${t}</strong><span>${d}</span></label>`).join('')}
        </div></fieldset>
      <div id="mentorField">${field({ name: 'mentorId', label: 'Mentor', options: mentorOpts, value: pre.mentor })}</div>
      <div id="oppField">${field({ name: 'opportunityId', label: 'Opportunity', required: true, options: [['', 'Select an opportunity…'], ...opportunities.map((o) => [o.id, `${o.title} — ${o.type} · ${o.slots_open} slots open`])], value: pre.opportunity })}</div>
      ${field({ name: 'category', label: 'Category', required: true, options: [['', 'Select a category…'], ...meta.categories], value: pre.category })}
      ${field({ name: 'title', label: 'Title', required: true, value: pre.title, placeholder: 'e.g. Mock DSA round before internship season', attrs: 'maxlength="120"' })}
      ${field({ name: 'description', label: 'Describe what you need', type: 'textarea', required: true, rows: 6, placeholder: 'Your background, what you’ve tried, and what a good outcome looks like (min. 20 characters).', attrs: 'maxlength="2000"' })}
      <div class="char-count" id="descCount">0 / 2000</div>
      <div id="timeFields">
        <div class="field" data-field="preferredDay"><span class="label">Preferred day</span><div class="choice-group" role="radiogroup" aria-label="Preferred day">${meta.days.map((d) => `<label><input type="radio" name="preferredDay" value="${d}"><span class="chip ghost">${d}</span></label>`).join('')}</div><span class="err"></span></div>
        <div class="field" data-field="preferredSlot"><span class="label">Preferred time</span><div class="choice-group" role="radiogroup" aria-label="Preferred time">${meta.slots.map((s) => `<label><input type="radio" name="preferredSlot" value="${s}"><span class="chip ghost">${s}</span></label>`).join('')}</div><span class="err"></span></div>
      </div>
      <div class="row" style="justify-content:flex-end;margin-top:8px"><a class="btn btn-ghost" href="#/app/requests">Cancel</a><button class="btn btn-primary btn-lg" type="submit">${icon('send', 16)} Submit request</button></div>
    </form>
    <aside class="stack">
      <div class="card" id="preview" hidden></div>
      <div class="card"><h2 style="font-size:16.5px;margin-bottom:12px">What happens next</h2>
        <ul class="timeline">
          ${[['submitted', 'Submitted', 'Your request is logged with a reference number (NX-…).'], ['in_review', 'In Review', 'The mentorship cell or mentor reviews and routes it.'], ['in_progress', 'In Progress', 'A session is scheduled or your application is being processed.'], ['resolved', 'Resolved', 'Outcome recorded — you can rate how it went.']]
            .map(([s, t, d]) => `<li><span class="tdot">${icon('check', 12)}</span><div class="thead"><strong>${t}</strong></div><div class="muted small">${d}</div></li>`).join('')}
        </ul>
        <p class="small muted" style="margin:0">You’ll get a notification at every step.</p>
      </div>
    </aside>
  </div>`;

  const idempotencyKey = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const form = el.querySelector('#reqForm');
  const desc = form.querySelector('[name=description]');
  const counter = el.querySelector('#descCount');
  desc.addEventListener('input', () => { counter.textContent = `${desc.value.length} / 2000`; });

  const preview = el.querySelector('#preview');
  const showPreview = () => {
    const t = form.querySelector('[name=type]:checked').value;
    if (t === 'opportunity') {
      const o = opportunities.find((x) => String(x.id) === form.opportunityId.value);
      preview.hidden = !o;
      if (o) preview.innerHTML = `<div class="section-label">Applying to</div><strong>${esc(o.title)}</strong><div class="muted small">${esc(o.provider)} · ${esc(o.type)}</div><div class="small" style="margin-top:8px">${o.slots_open} of ${o.slots_total} slots open${o.deadline ? ` · closes ${fmtDate(o.deadline)}` : ''}</div>`;
    } else {
      const m = mentors.find((x) => String(x.id) === form.mentorId.value);
      preview.hidden = !m;
      if (m) preview.innerHTML = `<div class="section-label">Requesting</div><div class="row">${avatar(m.name, m.hue)}<div><strong>${esc(m.name)}</strong><div class="muted small">${esc(m.headline)}</div></div></div><div style="margin-top:10px" class="small">${kindBadge(m.kind)} · Available ${esc(m.availability.join(', ') || '—')}</div><div class="small" style="margin-top:8px">${capacity(m)}</div>`;
    }
  };
  const syncType = () => {
    const t = form.querySelector('[name=type]:checked').value;
    el.querySelector('#oppField').hidden = t !== 'opportunity';
    el.querySelector('#mentorField').hidden = t === 'opportunity';
    el.querySelector('#timeFields').hidden = t === 'opportunity';
    const ms = form.mentorId;
    ms.options[0].textContent = t === 'guidance' ? 'Let the mentorship cell choose' : 'Select a mentor…';
    const lab = el.querySelector('#mentorField label');
    lab.innerHTML = t === 'mentorship' ? 'Mentor <span class="req" aria-hidden="true">*</span>' : 'Mentor (optional)';
    showPreview();
  };
  form.addEventListener('change', (e) => {
    if (e.target.name === 'type') syncType();
    if (e.target.name === 'mentorId' || e.target.name === 'opportunityId') showPreview();
    if (e.target.name === 'opportunityId') {
      const o = opportunities.find((x) => String(x.id) === e.target.value);
      if (o && !form.elements.title.value) form.elements.title.value = `Application: ${o.title}`;
    }
  });
  syncType();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const v = formValues(form);
    const errs = {};
    if (v.type === 'mentorship' && !v.mentorId) errs.mentorId = 'Choose a mentor for a session request';
    if (v.type === 'opportunity' && !v.opportunityId) errs.opportunityId = 'Choose the opportunity you are applying to';
    if (!v.category) errs.category = 'Choose a category';
    if (!v.title || v.title.length < 5) errs.title = 'Title must be at least 5 characters';
    if (!v.description || v.description.length < 20) errs.description = 'Please describe your request in at least 20 characters';
    if (Object.keys(errs).length) return showErrors(form, { details: errs });
    const body = { type: v.type, category: v.category, title: v.title, description: v.description, idempotencyKey };
    if (v.type !== 'opportunity') { if (v.mentorId) body.mentorId = Number(v.mentorId); if (v.preferredDay) body.preferredDay = v.preferredDay; if (v.preferredSlot) body.preferredSlot = v.preferredSlot; }
    else body.opportunityId = Number(v.opportunityId);
    await withBusy(form.querySelector('[type=submit]'), async () => {
      try {
        const { request } = await post('/requests', body);
        toast(`Request ${request.ref} submitted — you can track it here`);
        location.hash = request.type === 'opportunity' ? `#/app/requests/${request.id}` : `#/app/requests/${request.id}`;
      } catch (err) { showErrors(form, err); }
    });
  });
}

// =============================================================
// Detail (all roles)
// =============================================================
function stepper(r, events) {
  const halted = r.status === 'declined' || r.status === 'cancelled';
  const reachedAt = {};
  for (const e of events) if (e.kind === 'status' && FLOW.includes(e.toStatus)) reachedAt[e.toStatus] = e.createdAt;
  let current = FLOW.indexOf(r.status);
  if (halted) {
    const prevIdx = Math.max(...Object.keys(reachedAt).map((s) => FLOW.indexOf(s)), 0);
    current = Math.min(prevIdx + 1, 3);
  }
  const haltedAt = halted ? events.filter((e) => e.toStatus === r.status).at(-1)?.createdAt : null;
  return `<div class="stepper ${halted ? 'halted' : ''}" role="list" aria-label="Request progress">${FLOW.map((s, i) => {
    const cls = i < current || (!halted && r.status === 'resolved' && i === current) ? 'done' : i === current ? 'current' : '';
    const label = halted && i === current ? STATUS_LABEL[r.status] : STATUS_LABEL[s];
    const when = halted && i === current ? haltedAt : i <= current ? reachedAt[s] : null;
    return `<div class="st ${cls}" role="listitem"><span class="dot">${cls === 'done' ? icon('check', 14) : halted && i === current ? icon('x', 14) : i + 1}</span><span class="lbl">${esc(label)}</span><span class="when">${when ? fmtDate(when, true) : ''}</span></div>`;
  }).join('')}</div>`;
}

function timeline(events) {
  return `<ul class="timeline">${events.map((e) => {
    const who = e.actor ? `<strong>${esc(e.actor.name)}</strong> <span class="muted small">(${esc(e.actor.role)})</span>` : '<strong>System</strong>';
    let head; let cls = ''; let ic = 'flag';
    if (e.kind === 'comment') { head = `${who} commented`; cls = 'comment'; ic = 'message'; }
    else if (e.kind === 'feedback') { head = `${who} rated the outcome`; cls = 'feedback'; ic = 'star'; }
    else if (e.kind === 'assign') { head = `${who} updated assignment`; ic = 'users'; }
    else if (e.kind === 'update') { head = `${who} updated details`; ic = 'edit'; }
    else if (!e.fromStatus) { head = `${who} submitted the request`; ic = 'send'; }
    else head = `${who} moved it ${statusPill(e.fromStatus)} → ${statusPill(e.toStatus)}`;
    const showNote = e.note && !(e.kind === 'status' && !e.fromStatus && e.note === 'Request submitted');
    return `<li><span class="tdot ${cls}">${icon(ic, 12)}</span><div class="thead">${head}</div><div class="twhen">${fmtDate(e.createdAt, true)} · ${relTime(e.createdAt)}</div>${showNote ? `<div class="tnote">${esc(e.note)}</div>` : ''}</li>`;
  }).join('')}</ul>`;
}

const stars = (n) => `<span aria-label="${n} out of 5" style="color:#E5A21A;letter-spacing:2px">${'★'.repeat(n)}<span style="color:var(--line-2)">${'★'.repeat(5 - n)}</span></span>`;

export async function requestDetail(ctx) {
  const { el, params, session } = ctx;
  const data = await get(`/requests/${encodeURIComponent(params.id)}`);
  if (!ctx.isCurrent()) return;
  const { request: r, events, relation, allowedTransitions, canComment, canFeedback } = data;
  ctx.setTitle(`${r.ref} · ${r.title}`);
  const isAdmin = relation === 'admin';
  const back = isAdmin ? '#/admin/requests' : '#/app/requests';

  const transitionBtn = (t) => {
    const style = t.status === 'resolved' ? 'btn-success' : t.status === 'declined' || t.status === 'cancelled' ? 'btn-danger' : 'btn-primary';
    const label = { in_review: r.status === 'resolved' || r.status === 'declined' ? 'Reopen (In Review)' : 'Start review', in_progress: 'Accept & move to In Progress', resolved: 'Mark resolved', declined: 'Decline', cancelled: 'Cancel request' }[t.status] || t.label;
    return `<button class="btn ${style} btn-block" data-action="transition" data-status="${t.status}" data-note="${t.noteRequired ? 1 : 0}">${esc(label)}</button>`;
  };

  el.innerHTML = `
  <a href="${back}" class="small muted">${icon('chevL', 14)} Back to ${isAdmin ? 'queue' : 'requests'}</a>
  <section class="card" style="margin-top:14px">
    <div class="row wrap" style="justify-content:space-between;gap:16px">
      <div style="min-width:0"><div class="row wrap" style="gap:8px"><span class="ref">${esc(r.ref)}</span><span class="tag">${esc(r.typeLabel)}</span><span class="tag">${esc(r.category)}</span>${isAdmin || relation === 'mentor' ? `<span class="prio prio-${r.priority}">● ${esc(r.priority)} priority</span>` : ''}</div>
        <h1 style="font-size:24px;margin-top:8px">${esc(r.title)}</h1>
        <div class="muted small" style="margin-top:4px">Raised ${fmtDate(r.createdAt, true)} by ${esc(r.student.name)} · last updated ${relTime(r.updatedAt)}</div></div>
      ${statusPill(r.status, r.statusLabel)}
    </div>
    <div style="margin-top:26px">${stepper(r, events)}</div>
  </section>

  <div class="grid grid-main-side" style="margin-top:20px">
    <div class="stack">
      <section class="card"><h2 style="font-size:16.5px;margin-bottom:12px">Details</h2>
        <p style="white-space:pre-wrap;margin:0 0 18px">${esc(r.description)}</p>
        <dl class="kv">
          ${relation !== 'student' ? `<dt>Student</dt><dd><a href="#/app/students/${r.student.id}">${esc(r.student.name)}</a> <span class="muted small">· ${esc(r.student.email)}${r.student.department ? ' · ' + esc(r.student.department) : ''}${r.student.year ? ' · ' + esc(r.student.year) + ' Year' : ''}</span></dd>` : ''}
          ${data.studentSkills ? `<dt>Student skills</dt><dd><div class="fit-tags">${data.studentSkills.map(skillChip).join('') || '<span class="muted">None claimed</span>'}</div></dd>` : ''}
          <dt>Mentor</dt><dd>${r.mentor ? `<a href="#/app/mentors/${r.mentor.id}">${esc(r.mentor.name)}</a> <span class="muted small">· ${esc(r.mentor.kind)}</span>` : '<span class="muted">Not assigned yet</span>'}</dd>
          ${r.opportunity ? `<dt>Opportunity</dt><dd><a href="#/app/opportunities/${r.opportunity.id}">${esc(r.opportunity.title)}</a></dd>` : ''}
          ${r.preferredDay || r.preferredSlot ? `<dt>Preferred time</dt><dd>${esc([r.preferredDay, r.preferredSlot].filter(Boolean).join(' · '))}</dd>` : ''}
          <dt>Scheduled for</dt><dd>${r.scheduledFor ? esc(r.scheduledFor) : '<span class="muted">Not scheduled</span>'}</dd>
          ${r.resolvedAt ? `<dt>Closed on</dt><dd>${fmtDate(r.resolvedAt, true)}</dd>` : ''}
        </dl>
      </section>
      ${r.resolutionNote && (r.status === 'resolved' || r.status === 'declined') ? `<section class="card" style="border-color:${r.status === 'resolved' ? '#BFE8D6' : '#F2C7C7'};background:${r.status === 'resolved' ? '#F7FDFA' : '#FFFAFA'}"><div class="section-label">${r.status === 'resolved' ? 'Resolution' : 'Reason for decline'}</div><p style="margin:0;white-space:pre-wrap">${esc(r.resolutionNote)}</p></section>` : ''}
      ${r.feedbackRating ? `<section class="card"><div class="section-label">Student feedback</div><div style="font-size:20px">${stars(r.feedbackRating)}</div>${r.feedbackComment ? `<p style="margin:8px 0 0">“${esc(r.feedbackComment)}”</p>` : ''}</section>` : ''}
      ${canFeedback ? `<section class="card"><h2 style="font-size:16.5px">How did it go?</h2><p class="muted small">Your rating helps the mentorship cell match future students better.</p>
        <form id="fbForm" novalidate><div class="form-error" hidden></div>
          <div class="field" data-field="rating"><span class="label">Rating <span class="req">*</span></span><div class="choice-group" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="rating" value="${n}"><span class="chip ghost">${'★'.repeat(n)}</span></label>`).join('')}</div><span class="err"></span></div>
          ${field({ name: 'comment', label: 'Comment (optional)', type: 'textarea', rows: 2, attrs: 'maxlength="500"' })}
          <button class="btn btn-primary" type="submit">Submit feedback</button></form></section>` : ''}
      <section class="card"><h2 style="font-size:16.5px;margin-bottom:16px">History & conversation</h2>
        <div id="timeline">${timeline(events)}</div>
        ${canComment ? `<form id="commentForm" novalidate style="margin-top:6px"><div class="form-error" hidden></div>
          ${field({ name: 'note', label: 'Add a comment', type: 'textarea', rows: 3, placeholder: relation === 'student' ? 'Share an update or answer a question…' : 'Ask for details or share next steps with the student…', attrs: 'maxlength="1000"' })}
          <div class="row" style="justify-content:flex-end"><button class="btn btn-secondary" type="submit">${icon('message', 15)} Post comment</button></div></form>` : ''}
      </section>
    </div>

    <aside class="stack">
      <section class="card"><h2 style="font-size:16.5px;margin-bottom:6px">Actions</h2>
        <p class="small muted" style="margin:0 0 14px">${allowedTransitions.length ? `Current status: <strong>${esc(r.statusLabel)}</strong>` : r.status === 'resolved' || r.status === 'declined' || r.status === 'cancelled' ? 'This request is closed.' : relation === 'student' ? 'Waiting on the mentor / mentorship cell. You’ll be notified of changes.' : 'No status changes available for you right now.'}</p>
        <div class="stack" style="--gap:8px">${allowedTransitions.map(transitionBtn).join('')}</div>
      </section>
      ${isAdmin ? `<section class="card"><h2 style="font-size:16.5px;margin-bottom:14px">Routing</h2>
        <form id="adminForm" novalidate><div class="form-error" hidden></div>
          ${field({ name: 'mentorId', label: 'Assigned mentor', options: [['none', 'Unassigned'], ...data.mentorOptions.map((m) => [m.id, `${m.name} (${m.kind}) — ${m.openLoad}/${m.capacity} active`])], value: r.mentor ? r.mentor.id : 'none', hint: 'Numbers show current active requests / weekly capacity.' })}
          ${field({ name: 'priority', label: 'Priority', options: [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']], value: r.priority })}
          ${field({ name: 'scheduledFor', label: 'Scheduled for', value: r.scheduledFor || '', placeholder: 'e.g. Sat, 5:00 PM · Tech Park', attrs: 'maxlength="80"' })}
          <button class="btn btn-primary btn-block" type="submit">Save routing</button></form></section>` : ''}
      <section class="card"><div class="section-label">Reference</div><div class="ref" style="font-size:15px">${esc(r.ref)}</div><p class="small muted" style="margin:6px 0 0">Quote this reference when following up.</p></section>
    </aside>
  </div>`;

  const reload = () => ctx.rerender();

  el.querySelectorAll('[data-action=transition]').forEach((b) => b.addEventListener('click', () => {
    const status = b.dataset.status;
    const needsNote = b.dataset.note === '1';
    const schedule = status === 'in_progress';
    modal({
      title: `${STATUS_LABEL[status]} — ${r.ref}`,
      submitLabel: `Confirm: ${STATUS_LABEL[status]}`,
      body: `<p class="muted" style="margin-top:0">Moving from <strong>${esc(r.statusLabel)}</strong> to <strong>${esc(STATUS_LABEL[status])}</strong>. ${relation === 'student' ? '' : 'The student will be notified.'}</p>
        ${schedule ? field({ name: 'scheduledFor', label: 'Scheduled for (optional)', value: r.scheduledFor || '', placeholder: 'e.g. Sat, 5:00 PM · Tech Park', attrs: 'maxlength="80"' }) : ''}
        ${field({ name: 'note', label: needsNote ? (status === 'resolved' ? 'Resolution note' : 'Reason') : 'Note (optional)', type: 'textarea', rows: 3, required: needsNote, placeholder: status === 'resolved' ? 'What was the outcome?' : status === 'declined' ? 'Why is this being declined? Suggest an alternative if possible.' : '', attrs: 'maxlength="1000"' })}`,
      onSubmit: async (v, form) => {
        if (needsNote && !v.note) { const err = { details: { note: 'A note is required for this step' } }; showErrors(form, err); throw err; }
        await post(`/requests/${r.id}/status`, { status, note: v.note || undefined, scheduledFor: v.scheduledFor || undefined });
        toast(`${r.ref} moved to ${STATUS_LABEL[status]}`);
        refreshBell();
        reload();
      },
    });
  }));

  const cf = el.querySelector('#commentForm');
  cf?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(cf);
    const { note } = formValues(cf);
    if (!note || note.length < 2) return showErrors(cf, { details: { note: 'Write a comment first' } });
    await withBusy(cf.querySelector('[type=submit]'), async () => {
      try {
        const { events: ev } = await post(`/requests/${r.id}/comments`, { note });
        el.querySelector('#timeline').innerHTML = timeline(ev);
        cf.reset();
        toast('Comment posted');
      } catch (err) { showErrors(cf, err); }
    });
  });

  const fb = el.querySelector('#fbForm');
  fb?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(fb);
    const v = formValues(fb);
    if (!v.rating) return showErrors(fb, { details: { rating: 'Pick a rating from 1 to 5' } });
    await withBusy(fb.querySelector('[type=submit]'), async () => {
      try {
        await post(`/requests/${r.id}/feedback`, { rating: Number(v.rating), comment: v.comment || undefined });
        toast('Thanks for your feedback!');
        reload();
      } catch (err) { showErrors(fb, err); }
    });
  });

  const af = el.querySelector('#adminForm');
  af?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(af);
    await withBusy(af.querySelector('[type=submit]'), async () => {
      try {
        await patch(`/requests/${r.id}`, formValues(af));
        toast('Routing updated');
        reload();
      } catch (err) { showErrors(af, err); }
    });
  });
}

export { errorState };
