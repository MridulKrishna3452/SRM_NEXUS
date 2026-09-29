import { get } from '../api.js';
import { esc, icon, avatar, kindBadge, capacity, statusPill, daysUntil, fmtDate } from '../ui.js';
import { saveButton, bindCards, opportunityCard } from '../components.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export async function mentorDetail(ctx) {
  const { el, params, session } = ctx;
  const { mentor: m, opportunities } = await get(`/mentors/${encodeURIComponent(params.id)}`);
  if (!ctx.isCurrent()) return;
  ctx.setTitle(m.name);
  const isStudent = session.user.role === 'student';
  el.innerHTML = `
  <a href="#/app/discover" class="small muted">${icon('chevL', 14)} Back to directory</a>
  <div class="grid grid-main-side" style="margin-top:14px">
    <div class="stack">
      <section class="card">
        <div class="detail-hero">${avatar(m.name, m.hue, 'lg')}
          <div style="flex:1"><div class="row wrap" style="gap:8px">${kindBadge(m.kind)}${m.isActive ? '' : '<span class="badge" style="background:#eee">Inactive</span>'}<span class="badge badge-demo">Sample profile</span></div>
            <h1 style="margin-top:8px">${esc(m.name)}</h1><div class="muted">${esc(m.headline)} · ${esc(m.department)}</div></div>
          <div id="saveSlot">${isStudent ? saveButton(m) : ''}</div>
        </div>
        <h3 class="section-label" style="margin-top:24px">About</h3><p style="margin:0">${esc(m.bio)}</p>
        <h3 class="section-label" style="margin-top:22px">Expertise</h3><div class="tags">${m.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <h3 class="section-label" style="margin-top:22px">Usually available</h3><div class="avail">${DAYS.map((d) => `<span class="${m.availability.includes(d) ? 'on' : ''}">${d}</span>`).join('')}</div>
      </section>
      ${opportunities.length ? `<section><h2 style="font-size:18px;margin-bottom:12px">Linked opportunities</h2><div class="grid grid-2" id="oppGrid">${opportunities.map(opportunityCard).join('')}</div></section>` : ''}
    </div>
    <aside class="stack">
      <section class="card">
        <h2 style="font-size:17px;margin-bottom:14px">Request a session</h2>
        <dl class="kv" style="grid-template-columns:120px 1fr"><dt>Capacity</dt><dd>${capacity(m)}</dd><dt>Resolved</dt><dd>${m.resolvedCount} request${m.resolvedCount === 1 ? '' : 's'}</dd><dt>Rating</dt><dd>${m.avgRating ? `★ ${m.avgRating} / 5` : 'No ratings yet'}</dd></dl>
        ${isStudent ? `<a class="btn btn-primary btn-block" style="margin-top:18px" href="#/app/requests/new?type=mentorship&mentor=${m.id}">${icon('send', 16)} Request a session</a>
          <p class="small muted" style="margin:10px 0 0">Your request goes to the mentor and the mentorship cell. You can track it under My Requests.</p>` : '<p class="small muted">Only students can raise requests.</p>'}
      </section>
    </aside>
  </div>`;
  bindCards(el);
}

export async function opportunityDetail(ctx) {
  const { el, params, session } = ctx;
  const { opportunity: o, myApplication } = await get(`/opportunities/${encodeURIComponent(params.id)}`);
  if (!ctx.isCurrent()) return;
  ctx.setTitle(o.title);
  const d = o.deadline ? daysUntil(o.deadline) : null;
  const closed = !o.isActive || (d !== null && d < 0);
  const isStudent = session.user.role === 'student';
  let action;
  if (!isStudent) action = '<p class="small muted">Only students can apply.</p>';
  else if (myApplication) action = `<div class="row" style="justify-content:space-between"><span>Your application</span>${statusPill(myApplication.status)}</div><a class="btn btn-secondary btn-block" style="margin-top:14px" href="#/app/requests/${myApplication.id}">Track application</a>`;
  else if (closed) action = '<p class="muted">Applications are closed.</p>';
  else action = `<a class="btn btn-primary btn-block" href="#/app/requests/new?type=opportunity&opportunity=${o.id}">${icon('send', 16)} Apply now</a><p class="small muted" style="margin:10px 0 0">Tracked as an application under My Requests.</p>`;

  el.innerHTML = `
  <a href="#/app/discover?tab=opportunities" class="small muted">${icon('chevL', 14)} Back to opportunities</a>
  <div class="grid grid-main-side" style="margin-top:14px">
    <section class="card">
      <div class="detail-hero"><span class="avatar lg opp">${icon('target', 30)}</span>
        <div><div class="row wrap" style="gap:8px"><span class="badge badge-opp">${esc(o.type)}</span><span class="badge badge-demo">Sample opportunity</span></div>
          <h1 style="margin-top:8px">${esc(o.title)}</h1><div class="muted">${esc(o.provider)}</div></div></div>
      <h3 class="section-label" style="margin-top:24px">Details</h3><p style="margin:0">${esc(o.description)}</p>
      <h3 class="section-label" style="margin-top:22px">Skills involved</h3><div class="tags">${o.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      ${o.mentorId ? `<h3 class="section-label" style="margin-top:22px">Point of contact</h3><a href="#/app/mentors/${o.mentorId}">${esc(o.mentorName)}</a>` : ''}
    </section>
    <aside class="card">
      <dl class="kv" style="grid-template-columns:110px 1fr">
        <dt>Slots</dt><dd>${o.slots_open} of ${o.slots_total} open</dd>
        <dt>Applicants</dt><dd>${o.applicants}</dd>
        <dt>Duration</dt><dd>${esc(o.duration || '—')}</dd>
        <dt>Deadline</dt><dd>${o.deadline ? `${fmtDate(o.deadline)} <span class="small ${d <= 7 ? 'prio-high' : 'muted'}">(${d < 0 ? 'closed' : d + ' days left'})</span>` : 'Rolling'}</dd>
      </dl>
      <div style="margin-top:18px">${action}</div>
    </aside>
  </div>`;
}
