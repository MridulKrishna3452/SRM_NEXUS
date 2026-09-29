import { get, post } from './api.js';
import { esc, icon, brandMark, avatar, relTime, toast, errorState, loadingState } from './ui.js';
import landing from './views/landing.js';
import { loginView, registerView } from './views/auth.js';
import dashboard from './views/dashboard.js';
import ask from './views/ask.js';
import discover from './views/discover.js';
import { mentorDetail, opportunityDetail } from './views/detail.js';
import { requestList, newRequest, requestDetail } from './views/requests.js';
import pathView from './views/path.js';
import profile from './views/profile.js';
import { adminOverview, adminQueue, adminDirectory, adminUsers } from './views/admin.js';
import { mySkills, verifyQueue } from './views/skills.js';
import { myProjects, studentProfile } from './views/faculty.js';
import { startTour } from './tour.js';

export const session = { user: null, meta: null };

// ---------- Routes ----------
const S = ['student'];
const M = ['mentor'];
const A = ['admin'];
const ALL = ['student', 'mentor', 'admin'];

const ROUTES = [
  { path: '/', view: landing, public: true, bare: true },
  { path: '/login', view: loginView, public: true, bare: true },
  { path: '/register', view: registerView, public: true, bare: true },
  { path: '/app', view: dashboard, roles: [...S, ...M], title: 'Dashboard', nav: 'dashboard' },
  { path: '/app/ask', view: ask, roles: S, title: 'Ask the Campus', nav: 'ask' },
  { path: '/app/discover', view: discover, roles: ALL, title: 'Directory', nav: 'discover' },
  { path: '/app/mentors/:id', view: mentorDetail, roles: ALL, title: 'Mentor profile', nav: 'discover' },
  { path: '/app/opportunities/:id', view: opportunityDetail, roles: ALL, title: 'Opportunity', nav: 'discover' },
  { path: '/demo', view: async (ctx) => { await landing(ctx); startTour(); }, public: true, bare: true },
  { path: '/app/requests', view: requestList, roles: [...S, ...M], title: 'Requests', nav: 'requests', mode: 'sessions' },
  { path: '/app/applications', view: requestList, roles: S, title: 'My applications', nav: 'applications', mode: 'applications' },
  { path: '/app/skills', view: mySkills, roles: S, title: 'My skills', nav: 'skills' },
  { path: '/app/projects', view: myProjects, roles: M, title: 'My projects', nav: 'projects' },
  { path: '/app/verify', view: verifyQueue, roles: M, title: 'Skill verification', nav: 'verify' },
  { path: '/app/students/:id', view: studentProfile, roles: [...M, ...A], title: 'Student profile', nav: 'projects' },
  { path: '/admin/verify', view: verifyQueue, roles: A, title: 'Skill verification', nav: 'verify' },
  { path: '/app/requests/new', view: newRequest, roles: S, title: 'New request', nav: 'requests' },
  { path: '/app/requests/:id', view: requestDetail, roles: ALL, title: 'Request', nav: 'requests' },
  { path: '/app/path', view: pathView, roles: S, title: 'My Path', nav: 'path' },
  { path: '/app/profile', view: profile, roles: ALL, title: 'Profile', nav: 'profile' },
  { path: '/admin', view: adminOverview, roles: A, title: 'Admin overview', nav: 'overview' },
  { path: '/admin/requests', view: adminQueue, roles: A, title: 'Request queue', nav: 'queue' },
  { path: '/admin/requests/:id', view: requestDetail, roles: A, title: 'Request', nav: 'queue' },
  { path: '/admin/directory', view: adminDirectory, roles: A, title: 'Directory management', nav: 'directory' },
  { path: '/admin/users', view: adminUsers, roles: A, title: 'Users & roles', nav: 'users' },
];

const NAV = {
  student: [
    { key: 'dashboard', href: '#/app', label: 'Dashboard', icon: 'home' },
    { key: 'ask', href: '#/app/ask', label: 'Ask the Campus', icon: 'spark' },
    { key: 'discover', href: '#/app/discover', label: 'Directory', icon: 'users' },
    { key: 'requests', href: '#/app/requests', label: 'My requests', icon: 'inbox' },
    { key: 'applications', href: '#/app/applications', label: 'My applications', icon: 'target' },
    { key: 'skills', href: '#/app/skills', label: 'My skills', icon: 'shield' },
    { key: 'path', href: '#/app/path', label: 'My path', icon: 'path' },
  ],
  mentor: [
    { key: 'dashboard', href: '#/app', label: 'Dashboard', icon: 'home' },
    { key: 'projects', href: '#/app/projects', label: 'My projects', icon: 'target' },
    { key: 'requests', href: '#/app/requests', label: 'Session requests', icon: 'inbox' },
    { key: 'verify', href: '#/app/verify', label: 'Skill verification', icon: 'shield' },
  ],
  admin: [
    { key: 'overview', href: '#/admin', label: 'Overview', icon: 'chart' },
    { key: 'queue', href: '#/admin/requests', label: 'Request queue', icon: 'inbox' },
    { key: 'verify', href: '#/admin/verify', label: 'Skill verification', icon: 'shield' },
    { key: 'directory', href: '#/admin/directory', label: 'Directory', icon: 'layers' },
    { key: 'users', href: '#/admin/users', label: 'Users & roles', icon: 'users' },
  ],
};

export const homeFor = (user) => (user?.role === 'admin' ? '#/admin' : '#/app');
export const navigate = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

function matchRoute(path) {
  for (const r of ROUTES) {
    const keys = [];
    const re = new RegExp('^' + r.path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    const m = re.exec(path);
    if (m) return { route: r, params: Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, q = ''] = raw.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(q)) };
}

// ---------- Shell ----------
function shellHtml(route) {
  const u = session.user;
  const items = NAV[u.role] || [];
  return `<div class="shell" id="shell">
    <aside class="sidebar" aria-label="Main navigation">
      <a class="brand" href="${homeFor(u)}">${brandMark()}<span>SRM Nexus<small>Ask the Campus · KTR</small></span></a>
      <div class="nav-section">${u.role === 'admin' ? 'Administration' : u.role === 'mentor' ? 'Mentor workspace' : 'Student'}</div>
      <nav class="nav">${items.map((it) => `<a href="${it.href}" class="${route.nav === it.key ? 'active' : ''}" ${route.nav === it.key ? 'aria-current="page"' : ''}>${icon(it.icon)}<span>${it.label}</span></a>`).join('')}</nav>
      ${u.role === 'student' ? `<div style="padding:14px 4px 0"><a class="btn btn-primary btn-block" href="#/app/requests/new">${icon('plus', 16)} New request</a></div>` : ''}
      <div class="sidebar-foot">
        <div class="user-card">${avatar(u.name, u.role === 'admin' ? '#17357A' : u.role === 'mentor' ? '#5B37C9' : '#2F63E8', 'sm')}
          <a href="#/app/profile" style="min-width:0;color:inherit;text-decoration:none" title="My profile"><div class="nm">${esc(u.name)}</div><div class="rl">${esc(u.role === 'mentor' ? 'faculty mentor' : u.role)}${u.department ? ' · ' + esc(u.department) : ''}</div></a>
          <button class="icon-btn" style="margin-left:auto;width:34px;height:34px" id="logoutBtn" title="Sign out" aria-label="Sign out">${icon('logout', 16)}</button>
        </div>
        ${session.meta?.demoMode ? '<div class="demo-note"><strong>Demo data.</strong> People, projects and requests are fictional samples. <button class="btn btn-ghost btn-sm" id="replayTour" style="padding:4px 0;color:var(--accent)">▶ Play demo tour</button></div>' : ''}
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-btn" id="menuBtn" aria-label="Open navigation">${icon('menu')}</button>
        <div><div class="page-title" id="pageTitle">${esc(route.title || '')}</div></div>
        ${u.role === 'student' ? `<form class="ask-mini" id="askMini" role="search"><div class="input-icon">${icon('spark', 16)}<input class="input" name="q" placeholder="Ask the campus… e.g. “find a UROP in computer vision”" aria-label="Ask the campus"></div></form>` : '<div class="spacer"></div>'}
        <div style="position:relative">
          <button class="icon-btn" id="bellBtn" aria-label="Notifications" aria-haspopup="true" aria-expanded="false">${icon('bell')}<span class="dot-badge" id="bellCount" hidden></span></button>
          <div class="popover" id="notifPop" hidden></div>
        </div>
      </header>
      <main class="content" id="main" tabindex="-1"></main>
    </div>
  </div>`;
}

function bindShell() {
  const shell = document.getElementById('shell');
  document.getElementById('menuBtn').onclick = () => shell.classList.toggle('nav-open');
  shell.addEventListener('click', (e) => { if (shell.classList.contains('nav-open') && (e.target === shell || e.target.closest('.nav a'))) shell.classList.remove('nav-open'); });
  document.getElementById('logoutBtn').onclick = async () => {
    try { await post('/auth/logout'); } catch { /* ignore */ }
    session.user = null;
    toast('Signed out');
    navigate('#/login');
  };
  document.getElementById('replayTour')?.addEventListener('click', () => startTour());
  const askMini = document.getElementById('askMini');
  if (askMini) askMini.onsubmit = (e) => {
    e.preventDefault();
    const q = askMini.q.value.trim();
    if (q.length >= 3) { askMini.q.value = ''; navigate(`#/app/ask?q=${encodeURIComponent(q)}`); }
  };
  const bell = document.getElementById('bellBtn');
  const pop = document.getElementById('notifPop');
  bell.onclick = async (e) => {
    e.stopPropagation();
    if (!pop.hidden) { pop.hidden = true; bell.setAttribute('aria-expanded', 'false'); return; }
    pop.hidden = false;
    bell.setAttribute('aria-expanded', 'true');
    pop.innerHTML = loadingState();
    await renderNotifications(pop);
  };
  document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target)) { pop.hidden = true; bell.setAttribute('aria-expanded', 'false'); } });
  refreshBell();
}

async function renderNotifications(pop) {
  try {
    const { notifications, unread } = await get('/notifications');
    pop.innerHTML = `<div class="popover-head"><strong>Notifications</strong>${unread ? '<button class="btn btn-ghost btn-sm" id="readAll">Mark all read</button>' : ''}</div>
      <div class="notif-list">${notifications.length ? notifications.map((n) => `<button class="notif ${n.isRead ? '' : 'unread'}" data-id="${n.id}" data-req="${n.requestId || ''}">
        <span class="dot"></span><span><div class="msg">${esc(n.message)}</div><div class="when">${relTime(n.createdAt)}</div></span></button>`).join('')
        : '<div class="empty" style="padding:30px"><p>You’re all caught up.</p></div>'}</div>`;
    pop.querySelector('#readAll')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await post('/notifications/read-all');
      await renderNotifications(pop);
      refreshBell();
    });
    pop.querySelectorAll('.notif').forEach((b) => b.addEventListener('click', async () => {
      pop.hidden = true;
      try { await post(`/notifications/${b.dataset.id}/read`); } catch { /* ignore */ }
      refreshBell();
      if (b.dataset.req) navigate(`${session.user.role === 'admin' ? '#/admin/requests/' : '#/app/requests/'}${b.dataset.req}`);
      else navigate({ student: '#/app/skills', mentor: '#/app/verify', admin: '#/admin/verify' }[session.user.role]);
    }));
  } catch (err) { pop.innerHTML = `<div style="padding:16px">${errorState(err, false)}</div>`; }
}

export async function refreshBell() {
  const badge = document.getElementById('bellCount');
  if (!badge || !session.user) return;
  try {
    const { unread } = await get('/notifications');
    badge.hidden = !unread;
    badge.textContent = unread > 9 ? '9+' : unread;
  } catch { /* ignore */ }
}

// ---------- Render ----------
let renderSeq = 0;
let currentShellRole = null;

async function render() {
  const seq = ++renderSeq;
  const { path, query } = parseHash();
  const found = matchRoute(path);
  const app = document.getElementById('app');

  if (!found) { navigate(session.user ? homeFor(session.user) : '#/'); return; }
  const { route, params } = found;

  if (!route.public && !session.user) { sessionStorage.setItem('nexus:after-login', location.hash); navigate('#/login'); return; }
  if ((path === '/login' || path === '/register') && session.user) { navigate(homeFor(session.user)); return; }
  if (route.roles && !route.roles.includes(session.user.role)) {
    toast('That page isn’t available for your role', 'error');
    navigate(homeFor(session.user));
    return;
  }

  let el;
  if (route.bare) {
    currentShellRole = null;
    app.innerHTML = '';
    el = app;
  } else {
    if (currentShellRole !== session.user.role + route.nav || !document.getElementById('main')) {
      app.innerHTML = shellHtml(route);
      bindShell();
      currentShellRole = session.user.role + route.nav;
    }
    el = document.getElementById('main');
    document.getElementById('pageTitle').textContent = route.title || '';
    el.innerHTML = loadingState();
  }
  document.title = `${route.title ? route.title + ' · ' : ''}SRM Nexus`;
  window.scrollTo(0, 0);

  const ctx = {
    el, params, query, session, navigate, route,
    isCurrent: () => seq === renderSeq,
    setTitle: (t) => { const pt = document.getElementById('pageTitle'); if (pt) pt.textContent = t; document.title = `${t} · SRM Nexus`; },
    rerender: () => render(),
  };
  try {
    await route.view(ctx);
  } catch (err) {
    console.error(err);
    if (seq === renderSeq) {
      const final = err?.status === 403 || err?.status === 404;
      el.innerHTML = errorState(err, !final) + (final ? `<p style="margin-top:16px"><a class="btn btn-secondary" href="${homeFor(session.user)}">Go to my dashboard</a></p>` : '');
      el.querySelector('[data-action=retry]')?.addEventListener('click', () => render());
    }
  }
  if (!route.bare && seq === renderSeq) el.focus({ preventScroll: true });
}

window.addEventListener('hashchange', render);
window.addEventListener('nexus:unauthorized', () => {
  if (session.user) { session.user = null; toast('Your session expired — please sign in again', 'error'); navigate('#/login'); }
});

async function boot() {
  try {
    const [meta, me] = await Promise.all([get('/meta'), get('/auth/me')]);
    session.meta = meta;
    session.user = me.user;
  } catch (err) {
    document.getElementById('app').innerHTML = `<div style="max-width:560px;margin:80px auto;padding:0 16px">${errorState(err, false)}</div>`;
    return;
  }
  render();
  setInterval(refreshBell, 30000);
}

/** Switch the signed-in account (used by the demo tour). */
export async function loginAs(email) {
  try { await post('/auth/logout'); } catch { /* ignore */ }
  const { user } = await post('/auth/login', { email, password: session.meta.demoPassword });
  session.user = user;
  currentShellRole = null;
  return user;
}

export function afterLogin(user) {
  session.user = user;
  const back = sessionStorage.getItem('nexus:after-login');
  sessionStorage.removeItem('nexus:after-login');
  navigate(back && back !== '#/login' ? back : homeFor(user));
}

boot();
