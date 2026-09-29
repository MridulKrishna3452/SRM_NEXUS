import { get, post } from '../api.js';
import { esc, icon, avatar, ring, statusPill, emptyState, fmtDate, daysUntil, relTime, toast, withBusy } from '../ui.js';
import { fitSummary, fitLegend, skillChip } from '../components.js';
import { reviewSkill } from './skills.js';

// =============================================================
// Faculty: My Projects — UROP / in-house projects with ranked applicants
// =============================================================
export async function myProjects(ctx) {
  const { el } = ctx;
  const { projects } = await get('/faculty/projects');
  if (!ctx.isCurrent()) return;
  const total = projects.reduce((a, p) => a + p.applicants.length, 0);

  el.innerHTML = `
  <div class="page-head"><div><h1>My projects</h1><p>Your UROP and in-house projects. Applicants are ranked by skill fit, and <strong>verified</strong> skills count fully.</p></div>
    <span class="muted small">${projects.length} project${projects.length === 1 ? '' : 's'} · ${total} applicant${total === 1 ? '' : 's'}</span></div>
  ${fitLegend}
  <div class="stack" style="margin-top:16px" id="projList">
  ${projects.length ? projects.map((p) => {
    const d = p.deadline ? daysUntil(p.deadline) : null;
    return `<section class="card flush" data-project="${p.id}">
      <div class="project-head">
        <div style="min-width:0"><div class="row wrap" style="gap:8px"><span class="badge badge-opp">${esc(p.type)}</span>${p.isActive ? '' : '<span class="badge" style="background:#eee">Inactive</span>'}</div>
          <h2 style="font-size:19px;margin-top:6px">${esc(p.title)}</h2>
          <div class="muted small">${p.slots_open} of ${p.slots_total} slots open · ${esc(p.duration || '')}${d !== null ? ` · ${d < 0 ? 'closed' : `closes in ${d} days`}` : ''}</div></div>
        <div class="tags" style="max-width:360px">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      </div>
      ${p.applicants.length ? p.applicants.map((a, i) => `<div class="applicant">
        <span class="rank">#${i + 1}</span>${ring(a.fit.score)}
        <div style="min-width:0">
          <div class="row wrap" style="gap:8px"><a href="#/app/students/${a.request.student.id}"><strong>${esc(a.request.student.name)}</strong></a>
            <span class="muted small">${esc(a.request.student.department || '')}${a.request.student.year ? ' · ' + esc(a.request.student.year) + ' Year' : ''}</span>${statusPill(a.request.status, a.request.statusLabel)}</div>
          <div style="margin-top:8px">${fitSummary(a.fit)}</div>
          <div class="muted small" style="margin-top:6px">Applied ${relTime(a.request.createdAt)} · ${a.skills.filter((s) => s.status === 'verified').length} verified skill(s), ${a.skills.filter((s) => s.status === 'pending').length} awaiting your review</div>
        </div>
        <div class="app-actions row" style="flex-direction:column;align-items:stretch;gap:6px;min-width:140px">
          <a class="btn btn-primary btn-sm" href="#/app/students/${a.request.student.id}">View profile</a>
          <a class="btn btn-secondary btn-sm" href="#/app/requests/${a.request.id}">Open application</a>
        </div></div>`).join('') : `<div style="border-top:1px solid var(--line)">${emptyState('No applicants yet', 'Applications to this project will appear here, ranked by skill fit.')}</div>`}
    </section>`;
  }).join('') : `<div class="card">${emptyState('No projects linked to you', 'The admin can link UROP or in-house projects to your mentor profile in Directory management.')}</div>`}
  </div>`;
}

// =============================================================
// Faculty / admin: applicant profile with verified skills
// =============================================================
export async function studentProfile(ctx) {
  const { el, params, session } = ctx;
  const data = await get(`/students/${encodeURIComponent(params.id)}`);
  if (!ctx.isCurrent()) return;
  const { student: s, skills, fits, requests } = data;
  ctx.setTitle(s.name);
  const back = session.user.role === 'admin' ? '#/admin/verify' : '#/app/projects';
  const v = skills.filter((k) => k.status === 'verified').length;

  el.innerHTML = `
  <a href="${back}" class="small muted">${icon('chevL', 14)} Back</a>
  <div class="grid grid-main-side" style="margin-top:14px">
    <div class="stack">
      <section class="card"><div class="detail-hero">${avatar(s.name, '#2F63E8', 'lg')}
        <div><h1>${esc(s.name)}</h1><div class="muted">${esc(s.department || '')}${s.yearOfStudy ? ' · ' + esc(s.yearOfStudy) + ' Year' : ''} · ${esc(s.email)}</div>
          <div class="row wrap" style="margin-top:10px;gap:6px"><span class="skill-chip sk-verified">✓ ${v} verified</span><span class="skill-chip sk-pending">◷ ${skills.filter((k) => k.status === 'pending').length} under review</span>
          ${s.interests.map((i) => `<span class="tag">${esc(i)}</span>`).join('')}</div></div></div></section>

      ${fits.length ? `<section class="card"><h2 style="font-size:16.5px;margin-bottom:4px">Fit for ${session.user.role === 'admin' ? 'applied projects' : 'your projects'}</h2>${fitLegend}
        ${fits.map((f) => `<div class="row" style="gap:16px;padding:14px 0;border-top:1px solid var(--line);margin-top:10px;align-items:flex-start">${ring(f.fit.score)}
          <div style="min-width:0"><strong>${esc(f.opportunity.title)}</strong> <span class="badge badge-opp">${esc(f.opportunity.type)}</span><div style="margin-top:8px">${fitSummary(f.fit)}</div></div></div>`).join('')}</section>` : ''}

      <section class="card flush"><div class="card-head" style="padding-bottom:10px"><div><h2>Skills & evidence</h2><div class="card-sub">Verify claims directly from here</div></div></div>
        <div id="skillRows">${skills.length ? skills.map((k) => `<div class="skill-row"><div style="min-width:0"><h3>${skillChip(k)} <span class="muted small" style="font-weight:500">${esc(k.level)}</span></h3>
          <div class="small muted" style="margin-top:6px">${esc(k.evidenceNote)} ${k.evidenceUrl ? `· <a href="${esc(k.evidenceUrl)}" target="_blank" rel="noopener noreferrer">evidence</a>` : ''}</div>
          ${k.verifierName ? `<div class="small" style="margin-top:4px">${k.status === 'verified' ? 'Verified' : 'Reviewed'} by <strong>${esc(k.verifierName)}</strong>${k.verifierNote ? ` — “${esc(k.verifierNote)}”` : ''}</div>` : ''}</div>
          <div class="row">${k.status === 'pending' ? `<button class="btn btn-success btn-sm" data-quick="${k.id}">✓ Verify</button><button class="btn btn-ghost btn-sm" data-review="${k.id}">Review…</button>` : ''}</div></div>`).join('')
          : emptyState('No skills claimed yet', 'This student has not added any skills.', '', 'shield')}</div></section>
    </div>
    <aside class="card"><div class="section-label">${session.user.role === 'admin' ? 'All requests' : 'Requests with you'}</div>
      ${requests.length ? requests.map((r) => `<a href="${session.user.role === 'admin' ? '#/admin/requests/' : '#/app/requests/'}${r.id}" style="display:block;padding:10px 0;border-top:1px solid var(--line);color:inherit;text-decoration:none">
        <div class="row" style="justify-content:space-between;gap:8px"><span class="ref small">${esc(r.ref)}</span>${statusPill(r.status, r.statusLabel)}</div>
        <div style="font-weight:600;font-size:13.5px;margin-top:4px">${esc(r.title)}</div><div class="muted small">${esc(r.typeLabel)} · ${fmtDate(r.createdAt)}</div></a>`).join('') : '<p class="muted">None.</p>'}
    </aside>
  </div>`;

  const rows = el.querySelector('#skillRows');
  rows.addEventListener('click', async (e) => {
    const q = e.target.closest('[data-quick]');
    if (q) {
      const k = skills.find((x) => x.id === Number(q.dataset.quick));
      await withBusy(q, async () => {
        try { await post(`/skills/${k.id}/review`, { decision: 'verified' }); toast(`✓ ${k.skill} verified — ${s.name} notified`); ctx.rerender(); }
        catch (err) { toast(err.message, 'error'); }
      });
      return;
    }
    const r = e.target.closest('[data-review]');
    if (r) {
      const k = skills.find((x) => x.id === Number(r.dataset.review));
      reviewSkill({ ...k, student: { name: s.name } }, () => ctx.rerender());
    }
  });
}
