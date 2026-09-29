import { esc, icon, avatar, kindBadge, capacity, statusPill, miniSteps, relTime, fmtDate, daysUntil, STATUS_LABEL } from './ui.js';
import { post, del } from './api.js';
import { toast } from './ui.js';

export function mentorCard(m) {
  return `<article class="card clickable person-card" data-href="#/app/mentors/${m.id}" tabindex="0" aria-label="${esc(m.name)}">
    <div class="top">${avatar(m.name, m.hue)}
      <div style="flex:1;min-width:0"><h3>${esc(m.name)}</h3><div class="sub">${esc(m.headline)}</div></div>
      ${saveButton(m)}
    </div>
    <div class="row wrap" style="gap:6px">${kindBadge(m.kind)}<span class="muted small">${esc(m.department)}</span></div>
    <p class="bio">${esc(m.bio)}</p>
    <div class="tags">${m.tags.slice(0, 4).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    <div class="foot">${capacity(m)}<span>${m.avgRating ? `★ ${m.avgRating}` : ''} ${m.resolvedCount ? `· ${m.resolvedCount} resolved` : ''}</span></div>
  </article>`;
}

export function opportunityCard(o) {
  const d = o.deadline ? daysUntil(o.deadline) : null;
  return `<article class="card clickable person-card" data-href="#/app/opportunities/${o.id}" tabindex="0" aria-label="${esc(o.title)}">
    <div class="top"><span class="avatar opp" aria-hidden="true">${icon('target', 20)}</span>
      <div style="flex:1;min-width:0"><h3>${esc(o.title)}</h3><div class="sub">${esc(o.provider)}</div></div></div>
    <div class="row wrap" style="gap:6px"><span class="badge badge-opp">${esc(o.type)}</span>${o.duration ? `<span class="muted small">${esc(o.duration)}</span>` : ''}</div>
    <p class="bio">${esc(o.description)}</p>
    <div class="tags">${o.tags.slice(0, 4).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    <div class="foot"><span>${o.slots_open} of ${o.slots_total} slots open</span><span class="${d !== null && d <= 7 ? 'prio-high' : ''}">${d === null ? 'Rolling' : d < 0 ? 'Closed' : `Closes in ${d} day${d === 1 ? '' : 's'}`}</span></div>
  </article>`;
}

export const saveButton = (m) => `<button class="save-btn ${m.saved ? 'saved' : ''}" data-save="${m.id}" aria-pressed="${m.saved}" aria-label="${m.saved ? 'Remove from saved' : 'Save mentor'}" title="${m.saved ? 'Saved' : 'Save'}">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="${m.saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg></button>`;

/** Wire clickable cards (data-href) and save buttons inside root. */
export function bindCards(root, onChange) {
  root.addEventListener('click', async (e) => {
    const save = e.target.closest('[data-save]');
    if (save) {
      e.stopPropagation();
      const on = save.getAttribute('aria-pressed') !== 'true';
      try {
        if (on) await post(`/mentors/${save.dataset.save}/save`); else await del(`/mentors/${save.dataset.save}/save`);
        save.classList.toggle('saved', on);
        save.setAttribute('aria-pressed', String(on));
        save.querySelector('svg').setAttribute('fill', on ? 'currentColor' : 'none');
        toast(on ? 'Saved to your profile' : 'Removed from saved');
        onChange?.();
      } catch (err) { toast(err.message, 'error'); }
      return;
    }
    const card = e.target.closest('[data-href]');
    if (card && !e.target.closest('a,button')) location.hash = card.dataset.href;
  });
  root.addEventListener('keydown', (e) => {
    const card = e.target.closest?.('[data-href]');
    if (card && e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); location.hash = card.dataset.href; }
  });
}

export function requestRows(requests, base = '#/app/requests/') {
  return requests.map((r) => `<div class="req-row" data-href="${base}${r.id}" tabindex="0" role="link" aria-label="${esc(r.ref)} ${esc(r.title)}">
    <div style="min-width:0"><strong>${esc(r.title)}</strong><span class="muted small"><span class="ref">${esc(r.ref)}</span> · ${esc(r.typeLabel)}${r.mentor ? ' · ' + esc(r.mentor.name) : ''} · updated ${relTime(r.updatedAt)}</span></div>
    <span class="hide-sm">${miniSteps(r.status)}</span>
    ${statusPill(r.status, r.statusLabel)}
  </div>`).join('');
}

export function activityFeed(items, base = '#/app/requests/') {
  if (!items.length) return '<p class="muted">No activity yet.</p>';
  return `<ul class="feed">${items.map((a) => {
    const [ic, cls, text] = a.kind === 'comment' ? ['message', 'ic-violet', `<strong>${esc(a.actorName)}</strong> commented`]
      : a.kind === 'assign' ? ['users', 'ic-blue', `<strong>${esc(a.actorName)}</strong> ${esc(a.note)}`]
      : a.kind === 'feedback' ? ['star', 'ic-amber', `<strong>${esc(a.actorName)}</strong> left a rating`]
      : a.kind === 'update' ? ['edit', 'ic-blue', `<strong>${esc(a.actorName)}</strong> ${esc(a.note)}`]
      : a.toStatus === 'submitted' ? ['send', 'ic-blue', `<strong>${esc(a.actorName)}</strong> submitted`]
      : ['flag', a.toStatus === 'resolved' ? 'ic-green' : a.toStatus === 'declined' ? 'ic-red' : 'ic-amber', `Moved to <strong>${esc(STATUS_LABEL[a.toStatus])}</strong> by ${esc(a.actorName)}`];
    return `<li><span class="fi ${cls}">${icon(ic, 15)}</span><div style="min-width:0"><div class="ft">${text} · <a href="${base}${a.requestId}">${esc(a.ref)}</a></div><div class="fw">${esc(a.title)} · ${relTime(a.createdAt)}</div></div></li>`;
  }).join('')}</ul>`;
}

export function bindRows(root) {
  root.addEventListener('click', (e) => {
    const row = e.target.closest('[data-href]');
    if (row && !e.target.closest('a,button')) location.hash = row.dataset.href;
  });
  root.addEventListener('keydown', (e) => {
    const row = e.target.closest?.('[data-href]');
    if (row && e.target === row && e.key === 'Enter') location.hash = row.dataset.href;
  });
}

export { fmtDate };

// ---------- Skills & verification ----------
const SKILL_STATE = {
  verified: { cls: 'sk-verified', label: 'Verified', mark: '✓' },
  pending: { cls: 'sk-pending', label: 'Under review', mark: '◷' },
  rejected: { cls: 'sk-rejected', label: 'Needs evidence', mark: '!' },
};

export function skillChip(s) {
  const st = SKILL_STATE[s.status] || SKILL_STATE.pending;
  return `<span class="skill-chip ${st.cls}" title="${esc(s.skill)} · ${esc(s.level)} · ${st.label}${s.verifierName ? ' by ' + esc(s.verifierName) : ''}">${st.mark} ${esc(s.skill)}</span>`;
}

/** Verification pipeline stepper: Claimed → Evidence → Faculty review → Verified */
export function skillPipeline(status) {
  const steps = ['Claimed', 'Evidence attached', 'Faculty review', status === 'rejected' ? 'Needs evidence' : 'Verified'];
  const reached = status === 'verified' ? 4 : status === 'rejected' ? 4 : 3;
  return `<span class="sk-pipe ${status}" aria-label="Verification: ${esc(SKILL_STATE[status]?.label)}">${steps.map((t, i) =>
    `<span class="${i < reached ? 'on' : ''} ${i === reached - 1 ? 'cur' : ''}">${esc(t)}</span>`).join('<i></i>')}</span>`;
}

export function fitSummary(fit) {
  return `<div class="fit-tags">
    ${fit.verified.map((t) => `<span class="skill-chip sk-verified">✓ ${esc(t)}</span>`).join('')}
    ${fit.claimed.map((t) => `<span class="skill-chip sk-pending">◷ ${esc(t)}</span>`).join('')}
    ${fit.interest.map((t) => `<span class="skill-chip sk-interest">♡ ${esc(t)}</span>`).join('')}
    ${fit.missing.map((t) => `<span class="skill-chip sk-missing">${esc(t)}</span>`).join('')}
  </div>`;
}

export const fitLegend = '<div class="fit-legend small muted"><span class="skill-chip sk-verified">✓ verified</span> <span class="skill-chip sk-pending">◷ claimed, under review</span> <span class="skill-chip sk-interest">♡ interest only</span> <span class="skill-chip sk-missing">missing</span></div>';
