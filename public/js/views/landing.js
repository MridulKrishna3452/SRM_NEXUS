import { icon, brandMark, avatar, ring, statusPill } from '../ui.js';
import { session, homeFor } from '../main.js';
import { startTour } from '../tour.js';

export default async function landing({ el }) {
  const u = session.user;
  const demoBtn = session.meta?.demoMode ? '<button class="btn btn-demo btn-lg" data-demo>▶ Start demo mode <span style="opacity:.75;font-weight:500">· 30 sec</span></button>' : '';
  const cta = demoBtn + (u
    ? `<a class="btn btn-secondary btn-lg" href="${homeFor(u)}">Open my dashboard ${icon('arrowR', 16)}</a>`
    : `<a class="btn btn-secondary btn-lg" href="#/register">Create account</a><a class="btn btn-ghost btn-lg" href="#/login">Sign in</a>`);

  el.innerHTML = `<div class="landing">
  <header class="l-nav"><div class="in">
    <a class="brand" href="#/">${brandMark()}<span>SRM Nexus<small>Ask the Campus · SRMIST KTR</small></span></a>
    <nav aria-label="Page sections"><a href="#problem" data-scroll>Problem</a><a href="#solution" data-scroll>Solution</a><a href="#features" data-scroll>Features</a><a href="#roles" data-scroll>Who it’s for</a></nav>
    <div class="spacer"></div>
    ${session.meta?.demoMode ? '<button class="btn btn-ghost" data-demo>▶ Demo mode</button>' : ''}
    ${u ? `<a class="btn btn-primary" href="${homeFor(u)}">Dashboard</a>` : '<a class="btn btn-ghost" href="#/login">Sign in</a><a class="btn btn-primary" href="#/register">Get started</a>'}
  </div></header>

  <section class="hero"><div class="container">
    <div>
      <span class="eyebrow">${icon('spark', 14)} Institution Innovation · SRMIST KTR</span>
      <h1>The right mentor is on campus. <em>Finding them shouldn’t be luck.</em></h1>
      <p class="lead">SRM Nexus connects students with the seniors, faculty and alumni who can help with research, placements, higher studies and startups — and tracks every request from <strong>Submitted</strong> to <strong>Resolved</strong>.</p>
      <div class="hero-cta">${cta}</div>
      <p class="hero-note">Hackathon prototype · runs on a local database with clearly labelled sample data.</p>
    </div>
    <div class="hero-visual" aria-hidden="true">
      <div class="card" style="padding:20px">
        <div class="live-pill">Ask the Campus</div>
        <div class="ask-box" style="box-shadow:none"><input value="I want to do a computer vision UROP but don't know which professor to approach" readonly tabindex="-1"><span class="btn btn-primary btn-sm">${icon('send', 14)}</span></div>
        <div class="row wrap" style="margin:14px 0 6px"><span class="chip">🎯 Research + project guidance</span><span class="chip">Computer Vision</span><span class="chip">UROP</span></div>
        ${[['Faculty mentor (sample)', 'Vision & perception · UROP supervisor', '#5B37C9', 91], ['Senior student (sample)', 'Final year · CV projects', '#2F63E8', 86], ['UROP project (sample)', '4 slots · closes in 9 days', '#B4650D', 84]].map(([n, s, h, sc]) => `
          <div class="row" style="padding:12px 0;border-top:1px solid var(--line);gap:12px">${avatar(n, h, 'sm')}<div style="flex:1"><strong style="font-size:14px">${n}</strong><div class="muted small">${s}</div></div>${ring(sc)}</div>`).join('')}
      </div>
      <div class="hv-float" style="left:-28px;bottom:-22px">${statusPill('in_progress')}<span><strong>NX-1002</strong> · interview scheduled</span></div>
    </div>
  </div></section>

  <section class="l-section alt" id="problem"><div class="container">
    <span class="section-label">The campus problem</span>
    <h2>Guidance at a large campus is scattered and untracked</h2>
    <p class="lede">SRMIST Kattankulathur has thousands of students across many departments. The people who can help — seniors who just cleared an interview, faculty running research projects, alumni in industry — exist, but students rarely know who they are or how to reach them.</p>
    <div class="grid grid-3">
      <div class="card problem-card"><span class="num">01 · Discovery</span><h3>“Who do I even ask?”</h3><p>Expertise lives in word of mouth and group chats. A II-year student looking for a UROP supervisor or a GATE mentor has no searchable place to start.</p></div>
      <div class="card problem-card"><span class="num">02 · Follow-through</span><h3>Requests get lost</h3><p>Messages and emails have no status. Students don’t know if anyone is looking at their request, and mentors can’t see what’s pending across all channels.</p></div>
      <div class="card problem-card"><span class="num">03 · Visibility</span><h3>No institutional view</h3><p>Coordinators can’t see demand by topic, overloaded mentors, or how long students wait — so help can’t be routed or improved.</p></div>
    </div>
  </div></section>

  <section class="l-section" id="solution"><div class="container">
    <span class="section-label">The solution</span>
    <h2>Ask → Match → Request → Track</h2>
    <p class="lede">One place where a student describes a goal in plain words, gets explainable matches, raises a structured request, and follows it to resolution — while an admin routes and monitors everything.</p>
    <div class="flow">
      <div class="fstep"><div class="n">1</div><h3>Ask the Campus</h3><p>Describe your goal in your own words — “crack an SDE internship”, “start a CV research project”.</p></div>
      <div class="fstep"><div class="n">2</div><h3>Get explainable matches</h3><p>Mentors and opportunities ranked by expertise, your interests and current capacity — with the reasons shown.</p></div>
      <div class="fstep"><div class="n">3</div><h3>Raise a request</h3><p>Session request, opportunity application or open guidance query — with preferred day and time.</p></div>
      <div class="fstep"><div class="n">4</div><h3>Track to resolution</h3><p>Every status change, comment and assignment is recorded. You get notified at each step.</p></div>
    </div>
    <div class="workflow-strip" aria-label="Request workflow">${['submitted', 'in_review', 'in_progress', 'resolved'].map((s, i) => `${i ? `<span class="arrow">${icon('chevR', 16)}</span>` : ''}${statusPill(s)}`).join('')}<span class="muted small" style="margin-left:8px">(or Declined / Cancelled, always with a note)</span></div>
  </div></section>

  <section class="l-section alt" id="features"><div class="container">
    <span class="section-label">Features</span>
    <h2>Built around the problem, not around screens</h2>
    <p class="lede">Every feature exists to shorten the path from “I need help” to “I got help”.</p>
    <div class="grid grid-3">
      ${[
        ['spark', 'ic-blue', 'Ask the Campus matching', 'Plain-language goal search with transparent, rule-based scoring over expertise tags, interests and mentor capacity. No black box.'],
        ['users', 'ic-violet', 'Mentor & opportunity directory', 'Searchable profiles of seniors, faculty and alumni, plus UROP / project openings with slots and deadlines. Save mentors for later.'],
        ['inbox', 'ic-amber', 'Request workflow & tracking', 'Structured requests with a clear status pipeline, full history timeline, comments, scheduling and a rating once resolved.'],
        ['path', 'ic-green', 'Goal roadmaps', 'Turn a goal like “GATE CS” or “SDE internship” into steps, each with a suggested mentor and progress tracking.'],
        ['bell', 'ic-blue', 'In-app notifications', 'Students, mentors and admins are notified when a request is created, assigned, commented on or changes status.'],
        ['chart', 'ic-violet', 'Admin console', 'Queue with search & filters, assignment by mentor load, priority, resolution metrics, directory and role management.'],
      ].map(([ic, c, t, d]) => `<div class="card feature-card"><div class="fic ${c}">${icon(ic, 22)}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}
    </div>
  </div></section>

  <section class="l-section" id="roles"><div class="container">
    <span class="section-label">Who it’s for</span>
    <h2>Three roles, one workflow</h2>
    <p class="lede">Access is role-aware: each person sees exactly what they need.</p>
    <div class="grid grid-3">
      <div class="card role-card"><div class="fic ic-blue" style="width:46px;height:46px;border-radius:13px;display:grid;place-items:center">${icon('user', 22)}</div><h3 style="margin-top:12px">Students</h3><ul><li>Ask, discover and save mentors</li><li>Request sessions or apply to projects</li><li>Track status, comment, rate outcomes</li><li>Plan goals with step-by-step roadmaps</li></ul></div>
      <div class="card role-card"><div class="fic ic-violet" style="width:46px;height:46px;border-radius:13px;display:grid;place-items:center">${icon('briefcase', 22)}</div><h3 style="margin-top:12px">Mentors (faculty / seniors / alumni)</h3><ul><li>See requests assigned to them</li><li>Accept, schedule, comment and resolve</li><li>Decline with a reason so admin can reroute</li><li>See ratings from students</li></ul></div>
      <div class="card role-card"><div class="fic ic-green" style="width:46px;height:46px;border-radius:13px;display:grid;place-items:center">${icon('shield', 22)}</div><h3 style="margin-top:12px">Admin (mentorship cell)</h3><ul><li>Triage, assign and prioritise requests</li><li>Monitor response and resolution times</li><li>Manage mentors and opportunities</li><li>Manage user roles and access</li></ul></div>
    </div>
    <div class="cta-band" style="margin-top:48px">
      <div><h2>See it working</h2><p>Sign in with a demo account, or create a student account in under a minute.</p></div>
      <div class="row wrap">${u ? `<a class="btn btn-secondary btn-lg" href="${homeFor(u)}">Open dashboard</a>` : '<a class="btn btn-secondary btn-lg" href="#/login">Try the demo</a>'}</div>
    </div>
  </div></section>

  <footer class="l-foot"><div class="container"><span>SRM Nexus — hackathon prototype for SRMIST KTR (Institution Innovation).</span><span>Not an official SRMIST service. All people, projects and requests shown are fictional sample data.</span></div></footer>
  </div>`;

  el.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', () => startTour()));
  el.querySelectorAll('[data-scroll]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById(a.getAttribute('href').slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }));
}
