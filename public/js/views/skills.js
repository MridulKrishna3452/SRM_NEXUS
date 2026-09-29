import { get, post, del } from '../api.js';
import { esc, icon, field, formValues, clearErrors, showErrors, withBusy, toast, emptyState, relTime, modal, avatar, loadingState, errorState } from '../ui.js';
import { skillChip, skillPipeline } from '../components.js';

// =============================================================
// Student: My Skills (claim → evidence → faculty review → verified)
// =============================================================
export async function mySkills(ctx) {
  const { el } = ctx;
  let { skills } = await get('/skills/mine');
  if (!ctx.isCurrent()) return;

  el.innerHTML = `
  <div class="page-head"><div><h1>My skills</h1><p>Claim a skill with evidence. Faculty verify it, and verified skills rank you higher when you apply to projects.</p></div></div>
  <div class="grid grid-main-side">
    <section class="card flush"><div class="card-head" style="padding-bottom:12px"><div><h2>Skill portfolio</h2><div class="card-sub" id="skSummary"></div></div></div><div id="skList"></div></section>
    <aside class="stack">
      <form class="card" id="skForm" novalidate><h2 style="font-size:16.5px;margin-bottom:12px">Add a skill for verification</h2><div class="form-error" hidden></div>
        ${field({ name: 'skill', label: 'Skill', required: true, placeholder: 'e.g. PyTorch, OpenCV, DSA', attrs: 'maxlength="40"' })}
        ${field({ name: 'level', label: 'Level', required: true, value: 'Intermediate', options: ['Beginner', 'Intermediate', 'Advanced'] })}
        ${field({ name: 'evidenceUrl', label: 'Evidence link', type: 'url', placeholder: 'https://github.com/… or certificate link', hint: 'Repository, certificate or publication' })}
        ${field({ name: 'evidenceNote', label: 'What does the evidence show?', type: 'textarea', rows: 3, required: true, placeholder: 'e.g. Trained a detector on a custom dataset; 0.71 mAP', attrs: 'maxlength="500"' })}
        <button class="btn btn-primary btn-block" type="submit">${icon('shield', 16)} Submit for verification</button>
      </form>
      <div class="card"><div class="section-label">How verification works</div>
        <ol class="small" style="padding-left:18px;margin:0;color:var(--ink-2);display:grid;gap:6px">
          <li><strong>Claim</strong> a skill and attach evidence.</li>
          <li>A <strong>faculty mentor</strong> you’ve applied to, or the admin, reviews it.</li>
          <li><strong>Verified</strong> ✓ skills count fully in project fit scores. Claimed skills count half.</li>
          <li>Rejected? Read the note, improve the evidence and resubmit.</li>
        </ol></div>
    </aside>
  </div>`;

  const list = el.querySelector('#skList');
  const render = () => {
    const v = skills.filter((s) => s.status === 'verified').length;
    const p = skills.filter((s) => s.status === 'pending').length;
    el.querySelector('#skSummary').textContent = `${v} verified · ${p} under review · ${skills.length - v - p} need evidence`;
    list.innerHTML = skills.length ? skills.map((s) => `<div class="skill-row">
      <div style="min-width:0"><h3>${skillChip(s)} <span class="muted small" style="font-weight:500">${esc(s.level)}</span></h3>
        <div style="margin-top:8px">${skillPipeline(s.status)}</div>
        <div class="small muted" style="margin-top:8px">${esc(s.evidenceNote)} ${s.evidenceUrl ? `· <a href="${esc(s.evidenceUrl)}" target="_blank" rel="noopener noreferrer">evidence link</a>` : ''}</div>
        ${s.verifierNote || s.verifierName ? `<div class="verifier-note"><strong>${esc(s.verifierName || 'Reviewer')}</strong>${s.reviewedAt ? ` · ${relTime(s.reviewedAt)}` : ''}${s.verifierNote ? `: ${esc(s.verifierNote)}` : ''}</div>` : ''}
      </div>
      <div class="row">${s.status === 'rejected' ? `<button class="btn btn-secondary btn-sm" data-resubmit="${s.id}">Resubmit</button>` : ''}
        ${s.status !== 'verified' ? `<button class="btn btn-ghost btn-sm" data-remove="${s.id}" aria-label="Remove ${esc(s.skill)}">${icon('x', 14)}</button>` : ''}</div>
    </div>`).join('') : emptyState('No skills yet', 'Add your first skill with evidence to get it verified.', '', 'shield');
  };
  render();

  const form = el.querySelector('#skForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const v = formValues(form);
    const errs = {};
    if (!v.skill || v.skill.length < 2) errs.skill = 'Name the skill';
    if (v.evidenceUrl && !/^https?:\/\/\S+$/i.test(v.evidenceUrl)) errs.evidenceUrl = 'Link must start with http:// or https://';
    if (!v.evidenceNote || v.evidenceNote.length < 10) errs.evidenceNote = 'Describe the evidence (at least 10 characters)';
    if (Object.keys(errs).length) return showErrors(form, { details: errs });
    await withBusy(form.querySelector('[type=submit]'), async () => {
      try {
        const res = await post('/skills', { ...v, evidenceUrl: v.evidenceUrl || undefined });
        skills = (await get('/skills/mine')).skills;
        render();
        form.reset();
        toast(res.unchanged ? `"${res.skill.skill}" is already ${res.skill.status === 'verified' ? 'verified' : 'under review'}` : `"${res.skill.skill}" submitted for verification`);
      } catch (err) { showErrors(form, err); }
    });
  });

  list.addEventListener('click', async (e) => {
    const rs = e.target.closest('[data-resubmit]');
    if (rs) {
      const s = skills.find((x) => x.id === Number(rs.dataset.resubmit));
      form.querySelector('[name=skill]').value = s.skill;
      form.querySelector('[name=level]').value = s.level;
      form.querySelector('[name=evidenceNote]').focus();
      toast('Add stronger evidence, then submit again');
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm && confirm('Remove this skill?')) {
      try { await del(`/skills/${rm.dataset.remove}`); skills = skills.filter((x) => x.id !== Number(rm.dataset.remove)); render(); toast('Skill removed'); }
      catch (err) { toast(err.message, 'error'); }
    }
  });
}

// =============================================================
// Faculty / admin: verification queue
// =============================================================
export function reviewSkill(s, onDone) {
  modal({
    title: `Review “${s.skill}” — ${s.student?.name || ''}`,
    submitLabel: 'Submit review',
    body: `<p class="muted" style="margin-top:0">${esc(s.level)} · ${esc(s.evidenceNote)} ${s.evidenceUrl ? `· <a href="${esc(s.evidenceUrl)}" target="_blank" rel="noopener noreferrer">open evidence</a>` : ''}</p>
      <div class="field" data-field="decision"><span class="label">Decision <span class="req">*</span></span><div class="choice-group">
        <label><input type="radio" name="decision" value="verified" checked><span class="chip ghost">✓ Verify</span></label>
        <label><input type="radio" name="decision" value="rejected"><span class="chip ghost">Needs more evidence</span></label></div><span class="err"></span></div>
      ${field({ name: 'note', label: 'Note to the student', type: 'textarea', rows: 3, hint: 'Required when asking for more evidence.', attrs: 'maxlength="500"' })}`,
    onSubmit: async (v, form) => {
      if (v.decision === 'rejected' && !v.note) { const err = { details: { note: 'Tell the student what evidence is missing' } }; showErrors(form, err); throw err; }
      await post(`/skills/${s.id}/review`, { decision: v.decision, note: v.note || undefined });
      toast(v.decision === 'verified' ? `✓ ${s.skill} verified — student notified` : 'Sent back to the student with your note');
      onDone?.();
    },
  });
}

export async function verifyQueue(ctx) {
  const { el, session } = ctx;
  const isAdmin = session.user.role === 'admin';
  let status = 'pending';
  el.innerHTML = `
  <div class="page-head"><div><h1>Skill verification</h1><p>${isAdmin ? 'All student skill claims awaiting review.' : 'Skill claims from students who applied to your projects or requested you.'}</p></div></div>
  <div class="tabs" id="vTabs" role="tablist"></div>
  <section class="card flush"><div id="vList"></div></section>`;
  const list = el.querySelector('#vList');
  let rows = [];
  async function load() {
    list.innerHTML = loadingState();
    try {
      const data = await get(`/skills/queue?status=${status}`);
      rows = data.skills;
      el.querySelector('#vTabs').innerHTML = [['pending', 'Awaiting review'], ['verified', 'Verified'], ['rejected', 'Needs evidence']]
        .map(([k, l]) => `<button class="chip ${status === k ? 'active' : 'ghost'}" role="tab" aria-selected="${status === k}" data-st="${k}">${l} <span class="count">${data.counts[k]}</span></button>`).join('');
      list.innerHTML = rows.length ? `<div class="table-wrap"><table class="table dir-table"><thead><tr><th>Student</th><th>Skill</th><th class="hide-sm">Evidence</th><th>${status === 'pending' ? 'Submitted' : 'Reviewed'}</th><th></th></tr></thead><tbody>
        ${rows.map((s) => `<tr>
          <td><div class="row">${avatar(s.student.name, '#2F63E8', 'sm')}<div><a href="#/app/students/${s.userId}"><strong>${esc(s.student.name)}</strong></a><div class="muted small">${esc(s.student.department || '')}${s.student.year ? ' · ' + esc(s.student.year) : ''}</div></div></div></td>
          <td>${skillChip(s)}<div class="muted small">${esc(s.level)}</div></td>
          <td class="hide-sm small" style="max-width:340px">${esc(s.evidenceNote)} ${s.evidenceUrl ? `<a href="${esc(s.evidenceUrl)}" target="_blank" rel="noopener noreferrer">link</a>` : ''}${s.verifierNote ? `<div class="muted">“${esc(s.verifierNote)}” — ${esc(s.verifierName || '')}</div>` : ''}</td>
          <td class="small muted nowrap">${relTime(s.reviewedAt || s.updatedAt)}</td>
          <td class="nowrap">${s.status === 'pending' ? `<button class="btn btn-success btn-sm" data-quick="${s.id}">✓ Verify</button> <button class="btn btn-ghost btn-sm" data-review="${s.id}">Review…</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
        : emptyState(status === 'pending' ? 'Nothing awaiting review' : 'Nothing here yet', status === 'pending' ? 'New skill claims will appear here.' : '', '', 'shield');
    } catch (err) { list.innerHTML = `<div style="padding:20px">${errorState(err)}</div>`; }
  }
  el.querySelector('#vTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-st]'); if (b) { status = b.dataset.st; load(); } });
  list.addEventListener('click', async (e) => {
    const q = e.target.closest('[data-quick]');
    if (q) {
      const s = rows.find((x) => x.id === Number(q.dataset.quick));
      await withBusy(q, async () => {
        try { await post(`/skills/${s.id}/review`, { decision: 'verified' }); toast(`✓ ${s.skill} verified for ${s.student.name}`); load(); }
        catch (err) { toast(err.message, 'error'); }
      });
      return;
    }
    const r = e.target.closest('[data-review]');
    if (r) reviewSkill(rows.find((x) => x.id === Number(r.dataset.review)), load);
  });
  await load();
}
