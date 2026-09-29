import { get, patch } from '../api.js';
import { esc, avatar, field, formValues, clearErrors, showErrors, withBusy, toast, fmtDate } from '../ui.js';
import { mentorCard, bindCards } from '../components.js';

export default async function profile(ctx) {
  const { el, session } = ctx;
  const u = session.user;
  const saved = u.role === 'student' ? (await get('/mentors?saved=1')).mentors : [];
  if (!ctx.isCurrent()) return;

  el.innerHTML = `
  <div class="page-head"><div><h1>Profile</h1><p>Your account details and preferences.</p></div></div>
  <div class="grid grid-main-side">
    <form class="card" id="profForm" novalidate>
      <div class="row" style="margin-bottom:20px">${avatar(u.name, '#2F63E8', 'lg')}<div><h2 style="font-size:20px">${esc(u.name)}</h2><div class="muted">${esc(u.email)} · <span style="text-transform:capitalize">${esc(u.role)}</span></div></div></div>
      <div class="form-error" hidden></div>
      ${field({ name: 'name', label: 'Full name', required: true, value: u.name })}
      <div class="form-row">
        ${field({ name: 'department', label: 'Department', value: u.department || '' })}
        ${field({ name: 'yearOfStudy', label: 'Year of study', value: u.yearOfStudy || '', options: [['', 'Not applicable'], ['I', 'I Year'], ['II', 'II Year'], ['III', 'III Year'], ['IV', 'IV Year'], ['V', 'V Year'], ['PG', 'Postgraduate']] })}
      </div>
      ${u.role === 'student' ? field({ name: 'interests', label: 'Interests', value: u.interests.join(', '), hint: 'Comma-separated. Used to personalise Ask the Campus and dashboard recommendations.' }) : ''}
      <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" type="submit">Save changes</button></div>
    </form>
    <aside class="card"><div class="section-label">Account</div>
      <dl class="kv" style="grid-template-columns:100px 1fr"><dt>Email</dt><dd>${esc(u.email)}</dd><dt>Role</dt><dd style="text-transform:capitalize">${esc(u.role)}</dd><dt>Joined</dt><dd>${fmtDate(u.createdAt)}</dd></dl>
      <p class="small muted" style="margin-bottom:0">Role changes are handled by the mentorship cell admin.</p></aside>
  </div>
  ${u.role === 'student' ? `<section style="margin-top:26px"><h2 style="font-size:19px;margin-bottom:14px">Saved mentors</h2>
    <div id="savedGrid">${saved.length ? `<div class="grid grid-3">${saved.map(mentorCard).join('')}</div>` : '<div class="card"><p class="muted" style="margin:0">No saved mentors yet — use the bookmark icon in the directory or Ask results.</p></div>'}</div></section>` : ''}`;

  const sg = el.querySelector('#savedGrid');
  if (sg) bindCards(sg);

  const form = el.querySelector('#profForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const v = formValues(form);
    if (!v.name || v.name.length < 2) return showErrors(form, { details: { name: 'Enter your full name' } });
    v.interests = v.interests ? v.interests.split(',').map((s) => s.trim()).filter(Boolean) : [];
    await withBusy(form.querySelector('[type=submit]'), async () => {
      try {
        const { user } = await patch('/auth/me', v);
        session.user = user;
        toast('Profile updated');
      } catch (err) { showErrors(form, err); }
    });
  });
}
