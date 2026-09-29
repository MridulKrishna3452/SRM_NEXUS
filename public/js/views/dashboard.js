import { get } from '../api.js';
import { esc, icon, emptyState, ring, avatar, kindBadge, daysUntil } from '../ui.js';
import { requestRows, activityFeed, bindRows, bindCards } from '../components.js';

const stat = (ic, cls, v, k, hint = '') => `<div class="stat"><span class="ic ${cls}">${icon(ic, 20)}</span><div><div class="v">${v ?? '—'}</div><div class="k">${k}</div>${hint ? `<div class="hint">${hint}</div>` : ''}</div></div>`;

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

export default async function dashboard(ctx) {
  const { el, session } = ctx;
  const data = await get('/dashboard');
  if (!ctx.isCurrent()) return;
  if (data.role === 'mentor') return mentorDashboard(ctx, data);

  const u = session.user;
  const s = data.stats;
  el.innerHTML = `
  <div class="page-head"><div><h1>${greeting()}, ${esc(u.name.split(' ')[0])} 👋</h1><p>${esc(u.yearOfStudy ? u.yearOfStudy + ' Year · ' : '')}${esc(u.department || '')}</p></div>
    <a class="btn btn-primary" href="#/app/requests/new">${icon('plus', 16)} New request</a></div>

  <section class="ask-hero" aria-labelledby="askTitle">
    <span class="live-pill">Ask the Campus</span>
    <h2 id="askTitle">What are you trying to achieve?</h2>
    <p>Describe your goal in your own words. Nexus finds the right senior, faculty mentor, alumnus or open project — and explains why.</p>
    <form class="ask-box" id="askForm" role="search">
      <label for="askQ" class="sr-only">Your goal</label>
      <input id="askQ" name="q" placeholder="e.g. I want to research computer vision and don't know which professor to approach" autocomplete="off">
      <button class="btn btn-primary" type="submit">${icon('send', 16)} Ask</button>
    </form>
    <div class="row wrap" style="margin-top:14px;position:relative;z-index:1">${['Research a CV project', 'Crack an SDE internship', 'GATE CS prep', 'Startup mentorship', 'Build a hackathon team'].map((q) => `<a class="chip ghost" href="#/app/ask?q=${encodeURIComponent(q)}">${esc(q)}</a>`).join('')}</div>
  </section>

  <div class="grid grid-4" style="margin-top:22px">
    ${stat('clock', 'ic-amber', s.open, 'Awaiting action', 'Submitted or in review')}
    ${stat('refresh', 'ic-blue', s.inProgress, 'In progress', 'Scheduled or underway')}
    ${stat('check', 'ic-green', s.resolved, 'Resolved')}
    <a href="#/app/skills" style="color:inherit;text-decoration:none">${stat('shield', 'ic-violet', `${s.skillsVerified}/${s.skillsTotal}`, 'Skills verified', `${s.skillsPending} under faculty review`)}</a>
  </div>

  <div class="grid grid-main-side" style="margin-top:22px">
    <div class="stack">
      <section class="card flush" aria-labelledby="recentH">
        <div class="card-head"><div><h2 id="recentH">My recent requests</h2><div class="card-sub">Latest updates first</div></div><a class="btn btn-ghost btn-sm" href="#/app/requests">View all ${icon('chevR', 14)}</a></div>
        <div id="recentRows" style="margin-top:12px">${data.recent.length ? requestRows(data.recent) : emptyState('No requests yet', 'Ask the campus or browse the directory, then raise your first request.', '<a class="btn btn-primary" href="#/app/requests/new">Raise a request</a>')}</div>
      </section>
      <section class="card" aria-labelledby="recH">
        <div class="card-head"><div><h2 id="recH">Recommended for you</h2><div class="card-sub">Based on your interests: ${esc(u.interests.join(', ') || 'add some on your profile')}</div></div><a class="btn btn-ghost btn-sm" href="#/app/discover">Directory ${icon('chevR', 14)}</a></div>
        <div class="grid grid-3" id="recGrid">${data.recommended.map((r) => `<div class="card clickable" data-href="#/app/mentors/${r.item.id}" tabindex="0" style="padding:16px">
          <div class="row">${avatar(r.item.name, r.item.hue)}<span class="spacer"></span>${ring(r.score)}</div>
          <h3 style="font-size:15px;margin-top:10px">${esc(r.item.name)}</h3><div class="muted small">${esc(r.item.headline)}</div>
          <div style="margin-top:8px">${kindBadge(r.item.kind)}</div></div>`).join('') || '<p class="muted">Add interests on your profile to get recommendations.</p>'}</div>
      </section>
    </div>
    <div class="stack">
      <section class="card" aria-labelledby="actH"><div class="card-head"><h2 id="actH">Recent activity</h2></div>${activityFeed(data.activity)}</section>
      <section class="card" aria-labelledby="dlH"><div class="card-head"><h2 id="dlH">Closing soon</h2><a class="btn btn-ghost btn-sm" href="#/app/discover?tab=opportunities">All</a></div>
        ${data.deadlines.length ? data.deadlines.map((o) => `<a href="#/app/opportunities/${o.id}" class="row" style="padding:10px 0;border-top:1px solid var(--line);color:inherit;text-decoration:none">
          <span class="avatar sm opp">${icon('target', 14)}</span><span style="flex:1;min-width:0"><strong style="font-size:13.5px;display:block">${esc(o.title)}</strong><span class="muted small">${esc(o.type)} · ${o.slots_open} slots</span></span>
          <span class="small ${daysUntil(o.deadline) <= 7 ? 'prio-high' : 'muted'} nowrap">${daysUntil(o.deadline)} days</span></a>`).join('') : '<p class="muted">No open deadlines.</p>'}
      </section>
      <section class="card" aria-labelledby="goalH"><div class="card-head"><h2 id="goalH">My path</h2><a class="btn btn-ghost btn-sm" href="#/app/path">Open</a></div>
        ${data.goals.length ? data.goals.map((g) => `<div style="margin-bottom:12px"><div class="row" style="justify-content:space-between"><strong style="font-size:13.5px">${esc(g.title)}</strong><span class="muted small">${g.stepsDone.length}/${g.totalSteps}</span></div>
          <div class="progress" style="margin-top:6px"><i style="width:${Math.round((g.stepsDone.length / g.totalSteps) * 100)}%"></i></div></div>`).join('') : '<p class="muted">Set a goal to get a step-by-step roadmap.</p><a class="btn btn-secondary btn-sm" href="#/app/path">Create a goal</a>'}
      </section>
    </div>
  </div>`;

  el.querySelector('#askForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = e.target.q.value.trim();
    if (q.length < 3) { e.target.q.focus(); return; }
    location.hash = `#/app/ask?q=${encodeURIComponent(q)}`;
  });
  bindRows(el.querySelector('#recentRows'));
  bindCards(el.querySelector('#recGrid'));
}

function mentorDashboard({ el, session }, data) {
  const s = data.stats;
  el.innerHTML = `
  <div class="page-head"><div><h1>${greeting()}, ${esc(session.user.name)}</h1><p>Your projects, applicants, session requests and skill verifications — nothing else.</p></div>
    <a class="btn btn-primary" href="#/app/projects">${icon('target', 16)} Review applicants</a></div>
  <div class="grid grid-4">
    <a href="#/app/projects" style="color:inherit;text-decoration:none">${stat('target', 'ic-amber', s.openApplicants, 'Open applicants', `across ${s.projects} project${s.projects === 1 ? '' : 's'}`)}</a>
    <a href="#/app/requests" style="color:inherit;text-decoration:none">${stat('inbox', 'ic-blue', s.openSessions, 'Open session requests')}</a>
    <a href="#/app/verify" style="color:inherit;text-decoration:none">${stat('shield', 'ic-violet', s.pendingSkills, 'Skills to verify', 'From your applicants & mentees')}</a>
    ${stat('star', 'ic-green', s.avgRating ?? '—', 'Average rating', s.ratingCount ? `${s.ratingCount} rating${s.ratingCount > 1 ? 's' : ''}` : 'No ratings yet')}
  </div>
  <div class="grid grid-2" style="margin-top:22px">
    <section class="card flush"><div class="card-head"><div><h2>Project applicants</h2><div class="card-sub">UROP & in-house applications awaiting a decision</div></div><a class="btn btn-ghost btn-sm" href="#/app/projects">Ranked view ${icon('chevR', 14)}</a></div>
      <div class="rows" style="margin-top:12px">${data.applicants.length ? requestRows(data.applicants) : emptyState('No open applicants', 'New applications to your projects appear here.')}</div></section>
    <section class="card flush"><div class="card-head"><div><h2>Session requests</h2><div class="card-sub">Mentorship sessions & guidance routed to you</div></div><a class="btn btn-ghost btn-sm" href="#/app/requests">All ${icon('chevR', 14)}</a></div>
      <div class="rows" style="margin-top:12px">${data.sessions.length ? requestRows(data.sessions) : emptyState('Nothing waiting', 'Session requests assigned to you will appear here.')}</div></section>
  </div>
  <section class="card" style="margin-top:22px"><div class="card-head"><h2>Recent activity</h2></div>${activityFeed(data.activity)}</section>`;
  el.querySelectorAll('.rows').forEach(bindRows);
}
