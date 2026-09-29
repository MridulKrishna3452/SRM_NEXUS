import { post } from '../api.js';
import { esc, icon, ring, avatar, kindBadge, emptyState, errorState } from '../ui.js';
import { saveButton, bindCards } from '../components.js';

const SUGGESTIONS = ['I want to research computer vision and find a UROP', 'Crack a product-company SDE internship', 'How should I start GATE CS preparation?', 'Validate my startup idea', 'Find teammates for a drone hackathon'];
const FILTERS = ['All', 'Faculty', 'Senior', 'Alumni', 'Opportunities'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function ask(ctx) {
  const { el, query } = ctx;
  const q = (query.q || '').trim();
  el.innerHTML = `
  <section class="ask-hero">
    <span class="live-pill">Ask the Campus</span>
    <h2>Describe your goal in your own words</h2>
    <p>We read your goal, detect what kind of help you need, and rank campus mentors and open opportunities — showing exactly why each one matched.</p>
    <form class="ask-box" id="askPageForm" role="search" novalidate>
      <label for="askPageQ" class="sr-only">Your goal</label>
      <input id="askPageQ" name="q" value="${esc(q)}" maxlength="300" placeholder="e.g. I want to do research in NLP but I'm only in first year" autocomplete="off">
      <button class="btn btn-primary" type="submit">${icon('send', 16)} Find matches</button>
    </form>
    <div class="row wrap" style="margin-top:14px;position:relative;z-index:1">${SUGGESTIONS.map((s) => `<button type="button" class="chip ghost" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>
  </section>
  <div id="askResults" style="margin-top:24px" aria-live="polite"></div>`;

  const form = el.querySelector('#askPageForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = form.q.value.trim();
    if (v.length < 3) { form.q.focus(); form.q.setAttribute('aria-invalid', 'true'); return; }
    location.hash = `#/app/ask?q=${encodeURIComponent(v)}`;
  });
  el.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/app/ask?q=${encodeURIComponent(b.dataset.q)}`; }));

  const out = el.querySelector('#askResults');
  if (!q) {
    out.innerHTML = `<div class="card">${emptyState('Start with a goal', 'Try one of the suggestions above, or type anything — “I need help with my resume”, “who supervises NLP research?”', '', 'spark')}</div>`;
    form.q.focus();
    return;
  }

  // Short staged loader (mirrors the prototype) while the request runs
  out.innerHTML = `<div class="card"><div class="loading-steps" id="lsteps">${['Understanding your goal', 'Searching campus mentors', 'Checking opportunities & capacity', 'Ranking and explaining matches'].map((s) => `<div class="lstep"><span class="b">${icon('check', 12)}</span>${s}</div>`).join('')}</div></div>`;
  const steps = [...out.querySelectorAll('.lstep')];
  const anim = (async () => { for (const s of steps) { s.classList.add('on'); await wait(220); } })();
  let data;
  try {
    [data] = await Promise.all([post('/match', { query: q }), anim]);
  } catch (err) {
    out.innerHTML = errorState(err);
    out.querySelector('[data-action=retry]')?.addEventListener('click', () => ctx.rerender());
    return;
  }
  if (!ctx.isCurrent()) return;

  let filter = 'All';
  const counts = {
    All: data.results.length,
    Faculty: data.results.filter((r) => r.kind === 'mentor' && r.item.kind === 'Faculty').length,
    Senior: data.results.filter((r) => r.kind === 'mentor' && r.item.kind === 'Senior').length,
    Alumni: data.results.filter((r) => r.kind === 'mentor' && r.item.kind === 'Alumni').length,
    Opportunities: data.results.filter((r) => r.kind === 'opportunity').length,
  };
  const u = data.understood;

  out.innerHTML = `<div class="grid grid-side-main">
    <aside class="stack">
      <div class="card"><div class="section-label">What we understood</div>
        <div class="stack" style="margin-top:0">
          <div><div class="muted small">Goal</div><strong>${esc(u.goal)}</strong></div>
          <div><div class="muted small">Category</div><strong>${esc(u.category)}</strong></div>
          <div><div class="muted small">Related skills</div><div class="tags" style="margin-top:4px">${u.skills.map((s) => `<span class="tag">${esc(s)}</span>`).join('')}</div></div>
        </div>
        <hr style="border:none;border-top:1px solid var(--line);margin:16px 0">
        <p class="small muted" style="margin:0 0 10px">Didn’t find the right person? Send an open guidance query and the mentorship cell will route it.</p>
        <a class="btn btn-secondary btn-block" href="#/app/requests/new?type=guidance&category=${encodeURIComponent(u.category)}&title=${encodeURIComponent(q.slice(0, 120))}">${icon('send', 15)} Ask the mentorship cell</a>
      </div>
      <details class="card"><summary style="cursor:pointer;font-weight:600">How are scores calculated?</summary>
        <p class="small muted">Scores are rule-based and transparent — no external AI service is used:</p>
        <ul class="small" style="padding-left:18px;color:var(--ink-2)"><li>Expertise tags that match your words (strongest)</li><li>Skills related to the detected goal</li><li>Overlap with interests on your profile</li><li>Mentor capacity this week / open slots</li></ul>
      </details>
    </aside>
    <section>
      <div class="row wrap" style="justify-content:space-between;margin-bottom:14px">
        <h2 style="font-size:19px">${data.results.length} match${data.results.length === 1 ? '' : 'es'} for “${esc(q)}”</h2>
        <div class="tabs" role="tablist" style="margin:0">${FILTERS.map((f) => `<button class="chip ${f === 'All' ? 'active' : 'ghost'}" role="tab" aria-selected="${f === 'All'}" data-filter="${f}">${f} <span class="count">${counts[f]}</span></button>`).join('')}</div>
      </div>
      <div id="matchList"></div>
    </section></div>`;

  const list = out.querySelector('#matchList');
  const renderList = () => {
    const items = data.results.filter((r) => filter === 'All' || (filter === 'Opportunities' ? r.kind === 'opportunity' : r.kind === 'mentor' && r.item.kind === filter));
    list.innerHTML = items.length ? items.map(matchCard).join('') : `<div class="card">${emptyState('No matches in this filter', 'Try another filter or rephrase your goal with specific skills (e.g. “PyTorch”, “resume”, “GATE”).', '', 'search')}</div>`;
  };
  out.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    filter = b.dataset.filter;
    out.querySelectorAll('[data-filter]').forEach((x) => { const on = x === b; x.classList.toggle('active', on); x.classList.toggle('ghost', !on); x.setAttribute('aria-selected', on); });
    renderList();
  }));
  renderList();
  bindCards(list);

  function matchCard(r) {
    const reasons = `<ul class="reasons">${r.reasons.slice(0, 4).map((x) => `<li>${icon('check', 14)}<span>${esc(x)}</span></li>`).join('')}</ul>`;
    if (r.kind === 'opportunity') {
      const o = r.item;
      return `<article class="match-card"><span class="save-slot"></span>${ring(r.score)}
        <div style="min-width:0"><div class="row wrap" style="gap:8px"><h3>${esc(o.title)}</h3><span class="badge badge-opp">${esc(o.type)}</span></div>
          <div class="sub">${esc(o.provider)} · ${esc(o.duration || '')}</div>${reasons}
          <div class="tags">${o.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>
        <div class="match-actions"><a class="btn btn-primary btn-sm" href="#/app/requests/new?type=opportunity&opportunity=${o.id}">Apply</a><a class="btn btn-secondary btn-sm" href="#/app/opportunities/${o.id}">Details</a></div></article>`;
    }
    const m = r.item;
    return `<article class="match-card"><span class="save-slot">${saveButton(m)}</span>${ring(r.score)}
      <div style="min-width:0"><div class="row wrap" style="gap:8px">${avatar(m.name, m.hue, 'sm')}<h3>${esc(m.name)}</h3>${kindBadge(m.kind)}</div>
        <div class="sub">${esc(m.headline)} · ${esc(m.department)}</div>${reasons}
        <div class="tags">${m.tags.slice(0, 5).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>
      <div class="match-actions"><a class="btn btn-primary btn-sm" href="#/app/requests/new?type=mentorship&mentor=${m.id}&category=${encodeURIComponent(u.category)}">Request session</a><a class="btn btn-secondary btn-sm" href="#/app/mentors/${m.id}">View profile</a></div></article>`;
  }
}
