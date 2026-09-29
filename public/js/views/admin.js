import { get, post, patch, qs } from '../api.js';
import {
  esc, icon, avatar, kindBadge, emptyState, errorState, loadingState, field, modal, toast, debounce, fmtDate, relTime, statusPill,
} from '../ui.js';
import { requestTable } from './requests.js';
import { bindRows } from '../components.js';

const STATUS_COLORS = { submitted: '#8A96AC', in_review: '#D69A1E', in_progress: '#2F63E8', resolved: '#0F8F63', declined: '#C23B3B', cancelled: '#B8C0CF' };
const stat = (ic, cls, v, k, hint = '') => `<div class="stat"><span class="ic ${cls}">${icon(ic, 20)}</span><div><div class="v">${v ?? '—'}</div><div class="k">${k}</div>${hint ? `<div class="hint">${hint}</div>` : ''}</div></div>`;
const hrs = (h) => (h === null || h === undefined ? '—' : h < 48 ? `${h} h` : `${Math.round(h / 24 * 10) / 10} d`);

// =============================================================
export async function adminOverview(ctx) {
  const { el } = ctx;
  const s = await get('/admin/stats');
  if (!ctx.isCurrent()) return;
  const t = s.totals;
  const maxDay = Math.max(1, ...s.daily.map((d) => d.count));
  const maxStatus = Math.max(1, ...s.byStatus.map((x) => x.count));
  const maxCat = Math.max(1, ...s.byCategory.map((c) => c.total));

  el.innerHTML = `
  <div class="page-head"><div><h1>Mentorship cell overview</h1><p>Live view of campus guidance demand, response times and mentor load. <span class="badge badge-demo">Demo data</span></p></div>
    <a class="btn btn-primary" href="#/admin/requests?status=submitted">${icon('inbox', 16)} Triage new requests</a></div>
  <div class="grid grid-4">
    ${stat('inbox', 'ic-amber', t.open, 'Open requests', `${t.all} total · ${t.resolved} resolved`)}
    ${stat('users', 'ic-red', t.unassigned, 'Unassigned & open', `${t.highOpen} high priority open`)}
    ${stat('clock', 'ic-blue', hrs(t.avgFirstActionHours), 'Avg. time to first action', `Avg. resolution ${hrs(t.avgResolutionHours)}`)}
    <a href="#/admin/verify" style="color:inherit;text-decoration:none">${stat('shield', 'ic-green', t.pendingSkills, 'Skills awaiting verification', `${t.verifiedSkills} verified · rating ${t.avgRating ?? '—'}★`)}</a>
  </div>

  <div class="grid grid-2" style="margin-top:22px">
    <section class="card"><div class="card-head"><div><h2>New requests · last 14 days</h2><div class="card-sub">Requests created per day</div></div></div>
      <div class="bars" role="img" aria-label="Bar chart of requests per day">${s.daily.map((d) => `<div class="b" title="${d.date}: ${d.count}"><em>${d.count || ''}</em><i style="height:${(d.count / maxDay) * 100}%"></i><span>${new Date(d.date).getDate()}</span></div>`).join('')}</div></section>
    <section class="card"><div class="card-head"><div><h2>Pipeline by status</h2><div class="card-sub">Where requests are right now</div></div></div>
      ${s.byStatus.map((x) => `<a class="hbar" href="#/admin/requests?status=${x.status}" style="color:inherit;text-decoration:none"><span>${esc(x.label)}</span><span class="track"><i style="width:${(x.count / maxStatus) * 100}%;background:${STATUS_COLORS[x.status]}"></i></span><b>${x.count}</b></a>`).join('')}</section>
  </div>

  <div class="grid grid-2" style="margin-top:22px">
      <section class="card"><div class="card-head"><h2>Demand by category</h2></div>
        ${s.byCategory.map((c) => `<a class="hbar" style="grid-template-columns:150px 1fr 50px;color:inherit;text-decoration:none" href="#/admin/requests?category=${encodeURIComponent(c.category)}"><span class="small">${esc(c.category)}</span><span class="track"><i style="width:${(c.total / maxCat) * 100}%;background:var(--accent-2)"></i></span><b class="small">${c.open}/${c.total}</b></a>`).join('')}
        <p class="small muted" style="margin:4px 0 0">open / total</p></section>
      <section class="card"><div class="card-head"><h2>Mentor load</h2><a class="btn btn-ghost btn-sm" href="#/admin/directory">Manage</a></div>
        ${s.mentorLoad.map((m) => `<div class="row" style="padding:8px 0;border-top:1px solid var(--line)">${avatar(m.name, m.hue, 'sm')}<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13.5px">${esc(m.name)}</div><div class="muted small">${m.resolved} resolved${m.avgRating ? ` · ★ ${m.avgRating}` : ''}</div></div>
          <span class="small ${m.openLoad >= m.capacity ? 'prio-high' : 'muted'}">${m.openLoad}/${m.capacity} active</span></div>`).join('')}</section>
    </div>
  <div style="margin-top:22px"><section class="card flush"><div class="card-head"><div><h2>Needs attention</h2><div class="card-sub">Submitted or in review — high priority and oldest first</div></div><a class="btn btn-ghost btn-sm" href="#/admin/requests?status=open">Full queue ${icon('chevR', 14)}</a></div>
      <div id="attn" style="margin-top:12px">${s.needsAttention.length ? requestTable(s.needsAttention, '#/admin/requests/') : emptyState('Queue is clear', 'Nothing is waiting for triage.', '', 'check')}</div></section></div>
`;
  bindRows(el.querySelector('#attn'));
}

// =============================================================
export async function adminQueue(ctx) {
  const { el, query, session } = ctx;
  const meta = session.meta;
  const { mentors } = await get('/admin/mentors');
  if (!ctx.isCurrent()) return;
  const state = { status: query.status || '', q: query.q || '', type: '', category: query.category || '', priority: '', mentor: '', sort: '' };

  el.innerHTML = `
  <div class="page-head"><div><h1>Request queue</h1><p>Search, filter, assign and resolve every request on campus.</p></div></div>
  <div class="tabs" id="qTabs" role="tablist"></div>
  <div class="toolbar">
    <div class="input-icon">${icon('search', 16)}<input class="input" id="qq" type="search" value="${esc(state.q)}" placeholder="Search title, student, mentor or NX-ref…" aria-label="Search requests"></div>
    <select class="input" data-f="type" aria-label="Type"><option value="">All types</option><option value="mentorship">Mentorship</option><option value="opportunity">Applications</option><option value="guidance">Guidance</option></select>
    <select class="input" data-f="category" aria-label="Category"><option value="">All categories</option>${meta.categories.map((c) => `<option ${state.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
    <select class="input" data-f="priority" aria-label="Priority"><option value="">Any priority</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select>
    <select class="input" data-f="mentor" aria-label="Mentor"><option value="">Any mentor</option><option value="unassigned">Unassigned</option>${mentors.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select>
    <select class="input" data-f="sort" aria-label="Sort"><option value="">Newest</option><option value="oldest">Oldest</option><option value="updated">Recently updated</option><option value="priority">Priority</option></select>
    <button class="btn btn-ghost btn-sm" id="clearF">Clear filters</button>
  </div>
  <section class="card flush"><div id="qlist"></div></section>`;

  const list = el.querySelector('#qlist');
  const tabs = el.querySelector('#qTabs');
  bindRows(list);
  let seq = 0;
  async function load() {
    const my = ++seq;
    list.innerHTML = loadingState();
    try {
      const { requests, counts } = await get('/requests' + qs(state));
      if (my !== seq) return;
      const open = counts.submitted + counts.in_review + counts.in_progress;
      const all = Object.values(counts).reduce((a, b) => a + b, 0);
      tabs.innerHTML = [['', 'All', all], ['open', 'Open', open], ['submitted', 'Submitted', counts.submitted], ['in_review', 'In Review', counts.in_review], ['in_progress', 'In Progress', counts.in_progress], ['resolved', 'Resolved', counts.resolved], ['declined', 'Declined', counts.declined], ['cancelled', 'Cancelled', counts.cancelled]]
        .map(([k, l, n]) => `<button class="chip ${state.status === k ? 'active' : 'ghost'}" role="tab" aria-selected="${state.status === k}" data-status="${k}">${l} <span class="count">${n}</span></button>`).join('');
      list.innerHTML = requests.length ? `<div class="muted small" style="padding:12px 16px 0">${requests.length} result${requests.length === 1 ? '' : 's'}</div>${requestTable(requests, '#/admin/requests/')}`
        : emptyState('No requests match', 'Try clearing filters or searching for something else.', '', 'search');
    } catch (err) {
      list.innerHTML = `<div style="padding:20px">${errorState(err)}</div>`;
      list.querySelector('[data-action=retry]')?.addEventListener('click', load);
    }
  }
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-status]'); if (b) { state.status = b.dataset.status; load(); } });
  el.querySelector('#qq').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); load(); }));
  el.querySelectorAll('[data-f]').forEach((s) => s.addEventListener('change', () => { state[s.dataset.f] = s.value; load(); }));
  el.querySelector('#clearF').addEventListener('click', () => {
    Object.keys(state).forEach((k) => { state[k] = ''; });
    el.querySelector('#qq').value = '';
    el.querySelectorAll('[data-f]').forEach((s) => { s.value = ''; });
    load();
  });
  await load();
}

// =============================================================
export async function adminDirectory(ctx) {
  const { el, query } = ctx;
  let tab = query.tab === 'opportunities' ? 'opportunities' : 'mentors';
  el.innerHTML = `
  <div class="page-head"><div><h1>Directory management</h1><p>Add, edit and deactivate mentors and opportunities shown to students.</p></div>
    <button class="btn btn-primary" id="addBtn">${icon('plus', 16)} Add</button></div>
  <div class="tabs" role="tablist"><button class="chip" data-tab="mentors" role="tab">${icon('users', 15)} Mentors</button><button class="chip" data-tab="opportunities" role="tab">${icon('target', 15)} Opportunities</button></div>
  <section class="card flush"><div id="dlist"></div></section>`;
  const list = el.querySelector('#dlist');
  let rows = [];
  let mentorsForSelect = [];

  const syncTabs = () => {
    el.querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle('active', on); b.classList.toggle('ghost', !on); b.setAttribute('aria-selected', on); });
    el.querySelector('#addBtn').innerHTML = `${icon('plus', 16)} Add ${tab === 'mentors' ? 'mentor' : 'opportunity'}`;
  };

  async function load() {
    list.innerHTML = loadingState();
    try {
      if (tab === 'mentors') {
        rows = (await get('/admin/mentors')).mentors;
        mentorsForSelect = rows;
        list.innerHTML = `<div class="table-wrap"><table class="table dir-table"><thead><tr><th>Mentor</th><th class="hide-sm">Expertise</th><th class="hide-sm">Load</th><th>Linked account</th><th>Status</th><th></th></tr></thead><tbody>
          ${rows.map((m) => `<tr><td><div class="row">${avatar(m.name, m.hue, 'sm')}<div><strong>${esc(m.name)}</strong> ${kindBadge(m.kind)}<div class="muted small">${esc(m.headline)}</div></div></div></td>
            <td class="hide-sm"><div class="tags">${m.tags.slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></td>
            <td class="hide-sm small nowrap">${m.openLoad}/${m.weekly_capacity} active<div class="muted">${m.resolvedCount} resolved</div></td>
            <td class="small">${m.userId ? '<span class="status status-resolved">Has login</span>' : '<span class="muted">Directory only</span>'}</td>
            <td>${m.isActive ? '<span class="status status-in_progress">Active</span>' : '<span class="status status-cancelled">Inactive</span>'}</td>
            <td class="nowrap"><button class="btn btn-ghost btn-sm" data-edit="${m.id}">${icon('edit', 14)} Edit</button><button class="btn btn-ghost btn-sm" data-toggle="${m.id}">${m.isActive ? 'Deactivate' : 'Activate'}</button></td></tr>`).join('')}</tbody></table></div>`;
      } else {
        rows = (await get('/admin/opportunities')).opportunities;
        if (!mentorsForSelect.length) mentorsForSelect = (await get('/admin/mentors')).mentors;
        list.innerHTML = rows.length ? `<div class="table-wrap"><table class="table dir-table"><thead><tr><th>Opportunity</th><th class="hide-sm">Owner</th><th>Slots</th><th class="hide-sm">Deadline</th><th>Status</th><th></th></tr></thead><tbody>
          ${rows.map((o) => `<tr><td><strong>${esc(o.title)}</strong> <span class="badge badge-opp">${esc(o.type)}</span><div class="muted small">${esc(o.provider)}</div></td>
            <td class="hide-sm small">${esc(o.mentorName || '—')}</td><td class="small">${o.slots_open}/${o.slots_total} open · ${o.applicants} applied</td>
            <td class="hide-sm small">${o.deadline ? fmtDate(o.deadline) : 'Rolling'}</td>
            <td>${o.isActive ? '<span class="status status-in_progress">Active</span>' : '<span class="status status-cancelled">Inactive</span>'}</td>
            <td class="nowrap"><button class="btn btn-ghost btn-sm" data-edit="${o.id}">${icon('edit', 14)} Edit</button><button class="btn btn-ghost btn-sm" data-toggle="${o.id}">${o.isActive ? 'Deactivate' : 'Activate'}</button></td></tr>`).join('')}</tbody></table></div>`
          : emptyState('No opportunities yet', 'Add a UROP, project or alumni circle for students to apply to.');
      }
    } catch (err) {
      list.innerHTML = `<div style="padding:20px">${errorState(err)}</div>`;
      list.querySelector('[data-action=retry]')?.addEventListener('click', load);
    }
  }

  const mentorForm = (m = {}) => `
    <div class="form-row">${field({ name: 'name', label: 'Name', required: true, value: m.name || '' })}${field({ name: 'kind', label: 'Type', required: true, value: m.kind || 'Senior', options: ['Senior', 'Faculty', 'Alumni'] })}</div>
    ${field({ name: 'headline', label: 'Headline', required: true, value: m.headline || '', placeholder: 'e.g. Final year · ML projects' })}
    ${field({ name: 'department', label: 'Department', required: true, value: m.department || '' })}
    ${field({ name: 'tags', label: 'Expertise tags', required: true, value: (m.tags || []).join(', '), hint: 'Comma-separated — these drive Ask the Campus matching.' })}
    ${field({ name: 'bio', label: 'Bio', type: 'textarea', rows: 3, value: m.bio || '' })}
    <div class="form-row">${field({ name: 'availability', label: 'Available days', value: (m.availability || []).join(', '), placeholder: 'Mon, Wed' })}${field({ name: 'weeklyCapacity', label: 'Weekly capacity', type: 'number', value: m.weekly_capacity ?? 3, attrs: 'min="0" max="30"' })}</div>`;
  const oppForm = (o = {}) => `
    <div class="form-row">${field({ name: 'title', label: 'Title', required: true, value: o.title || '' })}${field({ name: 'type', label: 'Type', required: true, value: o.type || 'UROP', options: ['UROP', 'In-house Project', 'Alumni Circle', 'Entrepreneurship'] })}</div>
    <div class="form-row">${field({ name: 'provider', label: 'Provider', required: true, value: o.provider || '' })}${field({ name: 'mentorId', label: 'Owner mentor', value: o.mentorId || 'none', options: [['none', 'None'], ...mentorsForSelect.map((m) => [m.id, m.name])] })}</div>
    ${field({ name: 'description', label: 'Description', type: 'textarea', required: true, rows: 3, value: o.description || '' })}
    ${field({ name: 'tags', label: 'Skills / tags', value: (o.tags || []).join(', '), hint: 'Comma-separated' })}
    <div class="form-row">${field({ name: 'slotsTotal', label: 'Total slots', type: 'number', value: o.slots_total ?? 4, attrs: 'min="0"' })}${field({ name: 'deadline', label: 'Deadline', type: 'date', value: o.deadline || '' })}</div>
    ${field({ name: 'duration', label: 'Duration', value: o.duration || '', placeholder: 'e.g. 8 weeks' })}`;

  const toBody = (v) => {
    const b = { ...v };
    ['tags', 'availability'].forEach((k) => { if (k in b) b[k] = b[k] ? b[k].split(',').map((s) => s.trim()).filter(Boolean) : []; });
    ['weeklyCapacity', 'slotsTotal'].forEach((k) => { if (k in b && b[k] !== '') b[k] = Number(b[k]); });
    return b;
  };

  const openForm = (item) => {
    const isM = tab === 'mentors';
    modal({
      title: `${item ? 'Edit' : 'Add'} ${isM ? 'mentor' : 'opportunity'}`,
      body: isM ? mentorForm(item || {}) : oppForm(item || {}),
      submitLabel: item ? 'Save changes' : 'Add',
      wide: true,
      onSubmit: async (v) => {
        const path = `/admin/${isM ? 'mentors' : 'opportunities'}${item ? '/' + item.id : ''}`;
        if (item) await patch(path, toBody(v)); else await post(path, toBody(v));
        toast(item ? 'Saved' : 'Added to the directory');
        load();
      },
    });
  };

  el.querySelector('#addBtn').addEventListener('click', () => openForm(null));
  list.addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]');
    if (ed) return openForm(rows.find((r) => r.id === Number(ed.dataset.edit)));
    const tg = e.target.closest('[data-toggle]');
    if (tg) {
      const item = rows.find((r) => r.id === Number(tg.dataset.toggle));
      try {
        await patch(`/admin/${tab}/${item.id}`, { isActive: !item.isActive });
        toast(`${item.name || item.title} ${item.isActive ? 'deactivated' : 'activated'}`);
        load();
      } catch (err) { toast(err.message, 'error'); }
    }
  });
  el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; syncTabs(); load(); }));
  syncTabs();
  await load();
}

// =============================================================
export async function adminUsers(ctx) {
  const { el, session } = ctx;
  const state = { q: '', role: '' };
  const { mentors } = await get('/admin/mentors');
  if (!ctx.isCurrent()) return;
  el.innerHTML = `
  <div class="page-head"><div><h1>Users & roles</h1><p>Grant mentor or admin access, link mentor accounts to directory profiles, and deactivate accounts.</p></div></div>
  <div class="toolbar">
    <div class="input-icon">${icon('search', 16)}<input class="input" id="uq" type="search" placeholder="Search name, email or department…" aria-label="Search users"></div>
    <select class="input" id="urole" aria-label="Role"><option value="">All roles</option><option value="student">Students</option><option value="mentor">Mentors</option><option value="admin">Admins</option></select>
  </div>
  <section class="card flush"><div id="ulist"></div></section>`;
  const list = el.querySelector('#ulist');
  let users = [];
  let seq = 0;
  async function load() {
    const my = ++seq;
    list.innerHTML = loadingState();
    try {
      users = (await get('/admin/users' + qs(state))).users;
      if (my !== seq) return;
      list.innerHTML = users.length ? `<div class="table-wrap"><table class="table dir-table"><thead><tr><th>User</th><th class="hide-sm">Department</th><th>Role</th><th class="hide-sm">Directory profile</th><th class="hide-sm">Requests</th><th>Status</th></tr></thead><tbody>
        ${users.map((u) => {
          const self = u.id === session.user.id;
          return `<tr><td><strong>${esc(u.name)}</strong><div class="muted small">${esc(u.email)} · joined ${relTime(u.createdAt)}</div></td>
          <td class="hide-sm small">${esc(u.department || '—')}${u.yearOfStudy ? ' · ' + esc(u.yearOfStudy) : ''}</td>
          <td><select class="input" style="padding:6px 30px 6px 10px;width:auto" data-role="${u.id}" ${self ? 'disabled title="You cannot change your own role"' : ''} aria-label="Role for ${esc(u.name)}">${['student', 'mentor', 'admin'].map((r) => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r[0].toUpperCase() + r.slice(1)}</option>`).join('')}</select></td>
          <td class="hide-sm">${u.role === 'mentor' ? `<select class="input" style="padding:6px 30px 6px 10px;width:auto;max-width:200px" data-link="${u.id}" aria-label="Directory profile for ${esc(u.name)}"><option value="none">Not linked</option>${mentors.map((m) => `<option value="${m.id}" ${u.mentorId === m.id ? 'selected' : ''} ${m.userId && m.userId !== u.id ? 'disabled' : ''}>${esc(m.name)}</option>`).join('')}</select>` : '<span class="muted small">—</span>'}</td>
          <td class="hide-sm small">${u.requestCount}</td>
          <td>${self ? '<span class="muted small">You</span>' : `<button class="btn btn-sm ${u.isActive ? 'btn-ghost' : 'btn-secondary'}" data-active="${u.id}">${u.isActive ? 'Deactivate' : 'Reactivate'}</button>`}</td></tr>`;
        }).join('')}</tbody></table></div>` : emptyState('No users found', 'Try another search.');
    } catch (err) {
      list.innerHTML = `<div style="padding:20px">${errorState(err)}</div>`;
      list.querySelector('[data-action=retry]')?.addEventListener('click', load);
    }
  }
  const update = async (id, body, msg) => {
    try { await patch(`/admin/users/${id}`, body); toast(msg); } catch (err) { toast(err.message, 'error'); }
    load();
  };
  list.addEventListener('change', (e) => {
    const r = e.target.closest('[data-role]');
    if (r) update(r.dataset.role, { role: r.value }, `Role updated to ${r.value}`);
    const l = e.target.closest('[data-link]');
    if (l) update(l.dataset.link, { mentorId: l.value }, l.value === 'none' ? 'Profile unlinked' : 'Directory profile linked');
  });
  list.addEventListener('click', (e) => {
    const a = e.target.closest('[data-active]');
    if (!a) return;
    const u = users.find((x) => x.id === Number(a.dataset.active));
    if (u.isActive && !confirm(`Deactivate ${u.name}? They will be signed out and unable to log in.`)) return;
    update(u.id, { isActive: !u.isActive }, u.isActive ? 'Account deactivated' : 'Account reactivated');
  });
  el.querySelector('#uq').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); load(); }));
  el.querySelector('#urole').addEventListener('change', (e) => { state.role = e.target.value; load(); });
  await load();
}

export { statusPill };
