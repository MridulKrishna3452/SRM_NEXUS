/**
 * Demo mode — auto-plays through every feature: it just switches roles, navigates, scrolls and types.
 * No overlays or captions. Read-only (never changes data). Keys: Esc stop · Space pause · → skip.
 */
import { session, loginAs, navigate } from './main.js';
import { toast } from './ui.js';

const STUDENT = 'student@nexus.demo';
const FACULTY = 'mentor@nexus.demo';
const ADMIN = 'admin@nexus.demo';

// wait: ms to dwell after the page is ready · scroll: px to glide down while dwelling
const STEPS = [
  { hash: '#/', ready: '.hero h1', wait: 1200 },
  { hash: '#/', ready: '#problem', scrollTo: '#problem', wait: 1400 },
  { hash: '#/', ready: '#solution', scrollTo: '#solution', wait: 1400 },
  { as: STUDENT, hash: '#/app', ready: '#main .grid-4', wait: 1600, scroll: 350 },
  { as: STUDENT, hash: '#/app/ask', type: { input: '#askPageQ', text: 'I want to do a computer vision UROP', form: '#askPageForm' }, ready: '#matchList .match-card', wait: 2200, scroll: 420 },
  { as: STUDENT, hash: '#/app/skills', ready: '#skList .skill-row', wait: 1800, scroll: 300 },
  { as: STUDENT, hash: '#/app/applications', ready: '#rlist table', wait: 1300 },
  { as: STUDENT, hash: '#/app/requests/2', ready: '#main .stepper', wait: 1800, scroll: 450 },
  { as: FACULTY, hash: '#/app/projects', ready: '#projList .applicant', wait: 2000, scroll: 450 },
  { as: FACULTY, hash: '#/app/students/2', ready: '#skillRows', wait: 1800, scroll: 400 },
  { as: FACULTY, hash: '#/app/verify', ready: '#vList', wait: 1300 },
  { as: ADMIN, hash: '#/admin', ready: '#main .grid-4', wait: 1800, scroll: 500 },
  { as: ADMIN, hash: '#/admin/requests?status=open', ready: '#qlist table', wait: 1500 },
  { as: ADMIN, hash: '#/admin/verify', ready: '#vList', wait: 1300 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let run = null;

async function waitFor(selector, timeout = 6000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const el = document.querySelector(selector);
    if (el && el.getBoundingClientRect().height > 0) return el;
    await sleep(60);
  }
  return null;
}

/** Sleep that honours pause / stop / skip. */
async function hold(ms, token) {
  let left = ms;
  while (left > 0) {
    if (token !== run?.token || run.skip) return;
    await sleep(50);
    if (!run?.paused) left -= 50;
  }
}

function glide(px, ms) {
  const start = scrollY;
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    window.scrollTo(0, start + px * (1 - (1 - k) ** 3));
    if (k < 1 && run) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function onKey(e) {
  if (!run) return;
  if (e.key === 'Escape') stopTour();
  else if (e.key === ' ' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { e.preventDefault(); run.paused = !run.paused; }
  else if (e.key === 'ArrowRight') run.skip = true;
}

export function stopTour() {
  if (!run) return;
  run = null;
  document.removeEventListener('keydown', onKey);
}

export async function startTour(from = 0) {
  if (!session.meta?.demoMode) { toast('Demo mode is turned off on this server', 'error'); return; }
  stopTour();
  const token = Symbol('tour');
  run = { token, paused: false, skip: false };
  document.addEventListener('keydown', onKey);

  for (let i = from; i < STEPS.length; i++) {
    if (token !== run?.token) return;
    run.skip = false;
    const s = STEPS[i];
    try {
      if (s.as && session.user?.email !== s.as) await loginAs(s.as);
      if (location.hash !== s.hash) { navigate(s.hash); await sleep(120); }
      if (s.type) {
        const input = await waitFor(s.type.input);
        if (input) {
          input.focus();
          input.value = '';
          for (const ch of s.type.text) { if (token !== run?.token) return; input.value += ch; await sleep(22); }
          await sleep(150);
          document.querySelector(s.type.form)?.requestSubmit();
          await sleep(120);
        }
      }
      await waitFor(s.ready);
      if (s.scrollTo) {
        const el = document.querySelector(s.scrollTo);
        if (el) glide(el.getBoundingClientRect().top - 70, 600);
      } else {
        window.scrollTo(0, 0);
      }
      if (s.scroll) { await hold(500, token); glide(s.scroll, Math.max(600, s.wait - 600)); }
      await hold(s.wait, token);
    } catch (err) {
      console.error('demo step failed', err);
    }
  }
  stopTour();
}
