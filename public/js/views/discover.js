import { get, qs } from '../api.js';
import { esc, icon, emptyState, errorState, loadingState, debounce } from '../ui.js';
import { mentorCard, opportunityCard, bindCards } from '../components.js';

export default async function discover(ctx) {
  const { el, query } = ctx;
  const state = { tab: query.tab === 'opportunities' ? 'opportunities' : 'people', q: query.q || '', kind: '', type: '', saved: query.saved === '1' };

  el.innerHTML = `
  <div class="page-head"><div><h1>Campus directory</h1><p>Seniors, faculty and alumni who mentor — plus open UROP, project and alumni opportunities. <span class="badge badge-demo">Sample profiles</span></p></div></div>
  <div class="tabs" role="tablist">
    <button class="chip" role="tab" data-tab="people">${icon('users', 15)} People</button>
    <button class="chip" role="tab" data-tab="opportunities">${icon('target', 15)} Opportunities</button>
  </div>
  <div class="toolbar">
    <div class="input-icon">${icon('search', 16)}<input class="input" id="dq" type="search" placeholder="Search by name, skill or topic…" value="${esc(state.q)}" aria-label="Search directory"></div>
    <select class="input" id="kindSel" aria-label="Filter by type"></select>
    <label class="row small" id="savedWrap" style="gap:6px;cursor:pointer"><input type="checkbox" id="savedOnly" ${state.saved ? 'checked' : ''}> Saved only</label>
  </div>
  <div id="dirGrid"></div>`;

  const grid = el.querySelector('#dirGrid');
  const kindSel = el.querySelector('#kindSel');
  bindCards(grid, () => { if (state.saved) load(); });

  const syncTabs = () => {
    el.querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === state.tab; b.classList.toggle('active', on); b.classList.toggle('ghost', !on); b.setAttribute('aria-selected', on); });
    kindSel.innerHTML = state.tab === 'people'
      ? [['', 'All people'], ['Faculty', 'Faculty'], ['Senior', 'Seniors'], ['Alumni', 'Alumni']].map(([v, l]) => `<option value="${v}" ${state.kind === v ? 'selected' : ''}>${l}</option>`).join('')
      : [['', 'All types'], ['UROP', 'UROP'], ['In-house Project', 'In-house projects'], ['Alumni Circle', 'Alumni circles'], ['Entrepreneurship', 'Entrepreneurship']].map(([v, l]) => `<option value="${v}" ${state.type === v ? 'selected' : ''}>${l}</option>`).join('');
    el.querySelector('#savedWrap').hidden = state.tab !== 'people';
  };

  let seq = 0;
  async function load() {
    const my = ++seq;
    grid.innerHTML = loadingState();
    try {
      if (state.tab === 'people') {
        const { mentors } = await get('/mentors' + qs({ q: state.q, kind: state.kind, saved: state.saved ? '1' : '' }));
        if (my !== seq) return;
        grid.innerHTML = mentors.length ? `<p class="muted small">${mentors.length} ${mentors.length === 1 ? 'person' : 'people'}</p><div class="grid grid-3">${mentors.map(mentorCard).join('')}</div>`
          : `<div class="card">${emptyState(state.saved ? 'No saved mentors yet' : 'No one matches that search', state.saved ? 'Use the bookmark on any profile to save it here.' : 'Try a broader skill like “Python”, “GATE”, “Startup” or “Research”.', '', 'search')}</div>`;
      } else {
        const { opportunities } = await get('/opportunities' + qs({ q: state.q, type: state.type }));
        if (my !== seq) return;
        grid.innerHTML = opportunities.length ? `<p class="muted small">${opportunities.length} open opportunit${opportunities.length === 1 ? 'y' : 'ies'}</p><div class="grid grid-3">${opportunities.map(opportunityCard).join('')}</div>`
          : `<div class="card">${emptyState('No opportunities match', 'Try another search or type.', '', 'search')}</div>`;
      }
    } catch (err) {
      grid.innerHTML = errorState(err);
      grid.querySelector('[data-action=retry]')?.addEventListener('click', load);
    }
  }

  el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; syncTabs(); load(); }));
  el.querySelector('#dq').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); load(); }, 250));
  kindSel.addEventListener('change', () => { if (state.tab === 'people') state.kind = kindSel.value; else state.type = kindSel.value; load(); });
  el.querySelector('#savedOnly').addEventListener('change', (e) => { state.saved = e.target.checked; load(); });
  syncTabs();
  await load();
}
