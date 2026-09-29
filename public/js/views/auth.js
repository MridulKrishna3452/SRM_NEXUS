import { post } from '../api.js';
import { esc, icon, brandMark, field, formValues, clearErrors, showErrors, withBusy, toast } from '../ui.js';
import { session, afterLogin } from '../main.js';
import { startTour } from '../tour.js';

const side = (title, text) => `<aside class="auth-side">
  <a class="brand" href="#/">${brandMark()}<span>SRM Nexus<small>Ask the Campus · SRMIST KTR</small></span></a>
  <h2>${title}</h2><p>${text}</p>
  <ul>
    <li>${icon('check')} Find the right senior, faculty mentor or alumnus</li>
    <li>${icon('check')} Raise structured requests instead of scattered messages</li>
    <li>${icon('check')} Track every request: Submitted → In Review → In Progress → Resolved</li>
  </ul>
</aside>`;

export async function loginView({ el }) {
  const meta = session.meta || {};
  el.innerHTML = `<div class="auth">${side('Welcome back.', 'Pick up where you left off — your requests, matches and roadmap are waiting.')}
  <main class="auth-main" id="main"><div class="auth-form">
    <a href="#/" class="small muted">${icon('chevL', 14)} Back to home</a>
    <h1 style="margin-top:16px">Sign in</h1>
    <p>Use your SRM Nexus account.</p>
    <form id="loginForm" novalidate>
      <div class="form-error" hidden></div>
      ${field({ name: 'email', label: 'Email', type: 'email', required: true, attrs: 'autocomplete="username"' })}
      ${field({ name: 'password', label: 'Password', type: 'password', required: true, attrs: 'autocomplete="current-password"' })}
      <button class="btn btn-primary btn-lg btn-block" type="submit">Sign in</button>
    </form>
    <p class="small muted" style="margin-top:16px">New here? <a href="#/register">Create a student account</a></p>
    ${meta.demoMode && meta.demoAccounts?.length ? `<div class="demo-box">
      <h3>Demo accounts (local demo only)</h3>
      <div class="small muted">Password for all: <code>${esc(meta.demoPassword)}</code>. Click to sign in, or <button type="button" class="btn btn-ghost btn-sm" id="tourBtn" style="padding:0 2px;color:var(--accent)">▶ play the guided demo</button>.</div>
      ${meta.demoAccounts.map((a) => `<button type="button" class="demo-acct" data-email="${esc(a.email)}"><span style="flex:1"><b>${esc(a.role)}</b><span>${esc(a.email)} · ${esc(a.note)}</span></span>${icon('chevR', 16)}</button>`).join('')}
    </div>` : ''}
  </div></main></div>`;

  const form = el.querySelector('#loginForm');
  const submit = async () => {
    clearErrors(form);
    const v = formValues(form);
    const errs = {};
    if (!v.email) errs.email = 'Email is required';
    if (!v.password) errs.password = 'Password is required';
    if (Object.keys(errs).length) return showErrors(form, { details: errs });
    await withBusy(form.querySelector('[type=submit]'), async () => {
      try {
        const { user } = await post('/auth/login', v);
        toast(`Welcome, ${user.name.split(' ')[0]}!`);
        afterLogin(user);
      } catch (err) { showErrors(form, err); }
    });
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  el.querySelectorAll('.demo-acct').forEach((b) => b.addEventListener('click', () => {
    form.email.value = b.dataset.email;
    form.password.value = meta.demoPassword;
    submit();
  }));
  el.querySelector('#tourBtn')?.addEventListener('click', () => startTour());
  form.email.focus();
}

export async function registerView({ el }) {
  const domain = session.meta?.allowedEmailDomain;
  el.innerHTML = `<div class="auth">${side('Join your campus network.', 'Create a student account to ask, request and track guidance. Mentor and admin access is granted by the mentorship cell.')}
  <main class="auth-main" id="main"><div class="auth-form" style="max-width:480px">
    <a href="#/" class="small muted">${icon('chevL', 14)} Back to home</a>
    <h1 style="margin-top:16px">Create your account</h1>
    <p>Student registration · takes under a minute.</p>
    <form id="regForm" novalidate>
      <div class="form-error" hidden></div>
      ${field({ name: 'name', label: 'Full name', required: true, attrs: 'autocomplete="name"' })}
      ${field({ name: 'email', label: 'Email', type: 'email', required: true, hint: domain ? `Use your @${domain} address` : '', attrs: 'autocomplete="email"' })}
      <div class="form-row">
        ${field({ name: 'department', label: 'Department', required: true, placeholder: 'e.g. CSE, ECE, Mechanical' })}
        ${field({ name: 'yearOfStudy', label: 'Year of study', required: true, options: [['', 'Select…'], ['I', 'I Year'], ['II', 'II Year'], ['III', 'III Year'], ['IV', 'IV Year'], ['V', 'V Year'], ['PG', 'Postgraduate']] })}
      </div>
      ${field({ name: 'interests', label: 'Interests', placeholder: 'e.g. Computer Vision, DSA, GATE', hint: 'Comma-separated. Used to personalise your matches.' })}
      ${field({ name: 'password', label: 'Password', type: 'password', required: true, hint: 'At least 8 characters, with letters and a number.', attrs: 'autocomplete="new-password"' })}
      <button class="btn btn-primary btn-lg btn-block" type="submit">Create account</button>
    </form>
    <p class="small muted" style="margin-top:16px">Already have an account? <a href="#/login">Sign in</a></p>
  </div></main></div>`;

  const form = el.querySelector('#regForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const v = formValues(form);
    const errs = {};
    if (!v.name || v.name.length < 2) errs.name = 'Enter your full name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) errs.email = 'Enter a valid email address';
    if (!v.department) errs.department = 'Department is required';
    if (!v.yearOfStudy) errs.yearOfStudy = 'Select your year';
    if (!v.password || v.password.length < 8 || !/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) errs.password = 'At least 8 characters, with letters and a number';
    if (Object.keys(errs).length) return showErrors(form, { details: errs });
    v.interests = v.interests ? v.interests.split(',').map((s) => s.trim()).filter(Boolean) : [];
    await withBusy(form.querySelector('[type=submit]'), async () => {
      try {
        const { user } = await post('/auth/register', v);
        toast('Account created — welcome to SRM Nexus!');
        afterLogin(user);
      } catch (err) { showErrors(form, err); }
    });
  });
  form.querySelector('[name=name]').focus();
}
