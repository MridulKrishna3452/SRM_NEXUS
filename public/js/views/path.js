import { get, post, patch, del } from '../api.js';
import { esc, icon, avatar, kindBadge, emptyState, toast, withBusy, showErrors, clearErrors, field } from '../ui.js';

const IDEAS = ['Product-company SDE internship', 'GATE CS preparation', 'Research / UROP in computer vision', 'Launch a student startup'];

export default async function pathView(ctx) {
  const { el, query } = ctx;
  let { goals } = await get('/goals');
  if (!ctx.isCurrent()) return;
  let activeId = Number(query.goal) || goals[0]?.id || null;

  el.innerHTML = `
  <div class="page-head"><div><h1>My path</h1><p>Turn a goal into concrete steps — each step suggests a campus mentor who can help.</p></div></div>
  <div class="grid grid-side-main">
    <aside class="stack">
      <form class="card" id="goalForm" novalidate><h2 style="font-size:16px;margin-bottom:12px">Add a goal</h2><div class="form-error" hidden></div>
        ${field({ name: 'title', label: 'Your goal', placeholder: 'e.g. Crack an SDE internship', attrs: 'maxlength="100"' })}
        <div class="row wrap" style="gap:6px;margin:-6px 0 14px">${IDEAS.map((i) => `<button type="button" class="chip ghost" data-idea="${esc(i)}" style="font-size:12px">${esc(i)}</button>`).join('')}</div>
        <button class="btn btn-primary btn-block" type="submit">${icon('plus', 16)} Build my roadmap</button></form>
      <div class="card"><div class="section-label">My goals</div><div id="goalList"></div></div>
    </aside>
    <section id="roadmap"></section>
  </div>`;

  const goalList = el.querySelector('#goalList');
  const roadmap = el.querySelector('#roadmap');

  const renderList = () => {
    goalList.innerHTML = goals.length ? goals.map((g) => `<button class="goal-item ${g.id === activeId ? 'active' : ''}" data-goal="${g.id}">
      <span style="flex:1;min-width:0"><strong style="display:block;font-size:14px">${esc(g.title)}</strong><span class="muted small">${esc(g.templateLabel)} · ${g.stepsDone.length}/${g.totalSteps} done</span>
      <span class="progress" style="display:block;margin-top:6px"><i style="width:${Math.round((g.stepsDone.length / g.totalSteps) * 100)}%"></i></span></span></button>`).join('')
      : '<p class="muted small" style="margin:0">No goals yet.</p>';
  };

  const renderRoadmap = () => {
    const g = goals.find((x) => x.id === activeId);
    if (!g) { roadmap.innerHTML = `<div class="card">${emptyState('Set your first goal', 'Add a goal on the left — we’ll build a roadmap and suggest a mentor for each step.', '', 'path')}</div>`; return; }
    roadmap.innerHTML = `<div class="card">
      <div class="card-head"><div><h2 style="font-size:20px">${esc(g.title)}</h2><div class="card-sub">${esc(g.templateLabel)} roadmap · ${g.stepsDone.length} of ${g.totalSteps} steps complete</div></div>
        <button class="btn btn-ghost btn-sm" data-remove="${g.id}">${icon('x', 14)} Remove</button></div>
      <div class="progress" style="margin-bottom:22px"><i style="width:${Math.round((g.stepsDone.length / g.totalSteps) * 100)}%"></i></div>
      <ol class="roadmap">${g.steps.map((s) => `<li class="rstep ${s.done ? 'done' : ''}">
        <button class="rcheck" data-step="${s.index}" data-done="${s.done ? 0 : 1}" aria-pressed="${s.done}" aria-label="${s.done ? 'Mark not done' : 'Mark done'}: ${esc(s.title)}">${s.done ? icon('check', 18) : s.index + 1}</button>
        <div class="rcard"><div class="t">${esc(s.title)}</div><div class="d">${esc(s.detail)}</div>
          ${s.suggestedMentor ? `<div class="row wrap" style="gap:10px;padding-top:10px;border-top:1px solid var(--line)">${avatar(s.suggestedMentor.name, s.suggestedMentor.hue, 'sm')}
            <div style="flex:1;min-width:0"><a href="#/app/mentors/${s.suggestedMentor.id}" style="font-weight:600;font-size:13.5px">${esc(s.suggestedMentor.name)}</a> ${kindBadge(s.suggestedMentor.kind)}<div class="muted small">Suggested · ${esc(s.suggestedMentor.headline)}</div></div>
            <a class="btn btn-secondary btn-sm" href="#/app/requests/new?type=mentorship&mentor=${s.suggestedMentor.id}&title=${encodeURIComponent(`${g.title}: ${s.title}`)}">Request</a>
            <a class="btn btn-ghost btn-sm" href="#/app/ask?q=${encodeURIComponent(s.query)}">More matches</a></div>`
            : `<a class="btn btn-ghost btn-sm" href="#/app/ask?q=${encodeURIComponent(s.query)}">Find a mentor ${icon('chevR', 14)}</a>`}
        </div></li>`).join('')}</ol></div>`;
  };

  goalList.addEventListener('click', (e) => {
    const b = e.target.closest('[data-goal]');
    if (b) { activeId = Number(b.dataset.goal); renderList(); renderRoadmap(); }
  });
  roadmap.addEventListener('click', async (e) => {
    const step = e.target.closest('[data-step]');
    if (step) {
      await withBusy(step, async () => {
        try {
          const { goal } = await patch(`/goals/${activeId}/steps/${step.dataset.step}`, { done: step.dataset.done === '1' });
          goals = goals.map((g) => (g.id === goal.id ? goal : g));
          renderList(); renderRoadmap();
          if (goal.stepsDone.length === goal.totalSteps) toast('Roadmap complete — great work! 🎉');
        } catch (err) { toast(err.message, 'error'); }
      });
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm && confirm('Remove this goal and its progress?')) {
      try {
        await del(`/goals/${rm.dataset.remove}`);
        goals = goals.filter((g) => g.id !== Number(rm.dataset.remove));
        activeId = goals[0]?.id || null;
        renderList(); renderRoadmap();
        toast('Goal removed');
      } catch (err) { toast(err.message, 'error'); }
    }
  });

  const form = el.querySelector('#goalForm');
  const titleInput = form.querySelector('[name=title]');
  form.querySelectorAll('[data-idea]').forEach((b) => b.addEventListener('click', () => { titleInput.value = b.dataset.idea; titleInput.focus(); }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const title = titleInput.value.trim();
    if (title.length < 3) return showErrors(form, { details: { title: 'Describe your goal in at least 3 characters' } });
    await withBusy(form.querySelector('[type=submit]'), async () => {
      try {
        const { goal } = await post('/goals', { title });
        goals = [goal, ...goals];
        activeId = goal.id;
        form.reset();
        renderList(); renderRoadmap();
        toast('Roadmap created');
      } catch (err) { showErrors(form, err); }
    });
  });

  renderList();
  renderRoadmap();
}
