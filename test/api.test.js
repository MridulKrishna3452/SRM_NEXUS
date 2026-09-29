// End-to-end API tests against a throwaway database. Run: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '.tmp');
fs.mkdirSync(dir, { recursive: true });
const dbFile = path.join(dir, `test-${process.pid}.db`);
process.env.DATABASE_PATH = dbFile;
process.env.SEED_DEMO_PASSWORD = 'Demo@1234';
process.env.DEMO_MODE = 'true';

const { getDb, closeDb } = await import('../server/db.js');
const { seed } = await import('../server/seed.js');
const { createApp } = await import('../server/app.js');

let server;
let base;

before(async () => {
  seed(getDb(), { reset: true, password: 'Demo@1234' });
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => {
  server?.close();
  closeDb();
  for (const f of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) fs.rmSync(f, { force: true });
});

/** Minimal cookie-keeping client. */
function client() {
  let cookie = '';
  return async (method, p, body) => {
    const res = await fetch(base + p, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    let data = null;
    try { data = await res.json(); } catch { /* empty */ }
    return { status: res.status, data };
  };
}

async function login(email) {
  const c = client();
  const r = await c('POST', '/auth/login', { email, password: 'Demo@1234' });
  assert.equal(r.status, 200, `login ${email}`);
  return c;
}

test('health and public meta', async () => {
  const c = client();
  assert.equal((await c('GET', '/health')).data.ok, true);
  const meta = (await c('GET', '/meta')).data;
  assert.ok(meta.categories.length >= 5);
  assert.equal(meta.demoAccounts.length, 3);
});

test('registration validates input and creates a student session', async () => {
  const c = client();
  const bad = await c('POST', '/auth/register', { name: 'A', email: 'nope', password: 'short' });
  assert.equal(bad.status, 400);
  assert.ok(bad.data.details.email && bad.data.details.password && bad.data.details.name);

  const ok = await c('POST', '/auth/register', {
    name: 'Test Student', email: 'new.student@example.com', password: 'Secret123', department: 'CSE', yearOfStudy: 'II', interests: ['GATE'],
  });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.user.role, 'student');
  assert.equal((await c('GET', '/auth/me')).data.user.email, 'new.student@example.com');

  const dup = await client()('POST', '/auth/register', { name: 'Again', email: 'NEW.student@example.com', password: 'Secret123', department: 'CSE', yearOfStudy: 'I' });
  assert.equal(dup.status, 400);
  assert.match(dup.data.details.email, /already exists/);

  await c('POST', '/auth/logout');
  assert.equal((await c('GET', '/auth/me')).data.user, null);
});

test('login rejects wrong password', async () => {
  const r = await client()('POST', '/auth/login', { email: 'student@nexus.demo', password: 'wrong-pass1' });
  assert.equal(r.status, 401);
});

test('role-based access control', async () => {
  assert.equal((await client()('GET', '/requests')).status, 401);
  const student = await login('student@nexus.demo');
  assert.equal((await student('GET', '/admin/stats')).status, 403);
  const mentor = await login('mentor@nexus.demo');
  assert.equal((await mentor('POST', '/requests', { type: 'guidance', category: 'Academics & Other', title: 'Hello there', description: 'x'.repeat(30) })).status, 403);
  const admin = await login('admin@nexus.demo');
  assert.equal((await admin('GET', '/admin/stats')).status, 200);
});

test('Ask the Campus returns explainable, relevant matches', async () => {
  const student = await login('student@nexus.demo');
  const r = await student('POST', '/match', { query: 'I want to prepare for GATE CS' });
  assert.equal(r.status, 200);
  assert.equal(r.data.understood.category, 'Higher Studies & GATE');
  const top = r.data.results.slice(0, 3).map((x) => x.item.name);
  assert.ok(top.some((n) => /Aakash|Suresh|Meera/.test(n)), `unexpected top matches: ${top}`);
  assert.ok(r.data.results[0].reasons.length > 0);
  assert.equal((await student('POST', '/match', { query: 'x' })).status, 400);
});

test('full request workflow: submit → review → progress → resolve → feedback', async () => {
  const student = await login('student@nexus.demo');
  const admin = await login('admin@nexus.demo');
  const mentor = await login('mentor@nexus.demo'); // Dr. Kavitha Rao, mentor profile id 1

  const invalid = await student('POST', '/requests', { type: 'mentorship', category: 'Research & UROP', title: 'Hi', description: 'too short' });
  assert.equal(invalid.status, 400);
  assert.ok(invalid.data.details.title && invalid.data.details.description);

  const created = await student('POST', '/requests', {
    type: 'mentorship', category: 'Research & UROP', title: 'Help scoping a segmentation project',
    description: 'I would like advice on scoping a medical image segmentation project for my UROP.', mentorId: 1, preferredDay: 'Wed', preferredSlot: 'Afternoon',
  });
  assert.equal(created.status, 201);
  const id = created.data.request.id;
  assert.equal(created.data.request.status, 'submitted');
  assert.match(created.data.request.ref, /^NX-\d+$/);

  // Student cannot resolve their own request
  assert.equal((await student('POST', `/requests/${id}/status`, { status: 'resolved', note: 'done' })).status, 400);

  // Admin reviews and sets priority
  assert.equal((await admin('POST', `/requests/${id}/status`, { status: 'in_review', note: 'Routing to faculty' })).status, 200);
  assert.equal((await admin('PATCH', `/requests/${id}`, { priority: 'high' })).data.request.priority, 'high');

  // Assigned mentor accepts and schedules
  const mine = await mentor('GET', '/requests?status=in_review');
  assert.ok(mine.data.requests.some((r) => r.id === id));
  const prog = await mentor('POST', `/requests/${id}/status`, { status: 'in_progress', scheduledFor: 'Wed 3 PM' });
  assert.equal(prog.data.request.status, 'in_progress');
  assert.equal(prog.data.request.scheduledFor, 'Wed 3 PM');

  // Comment thread
  assert.equal((await mentor('POST', `/requests/${id}/comments`, { note: 'Please bring your dataset shortlist.' })).status, 201);

  // Resolve requires a note
  const noNote = await mentor('POST', `/requests/${id}/status`, { status: 'resolved' });
  assert.equal(noNote.status, 400);
  assert.ok(noNote.data.details.note);
  const done = await mentor('POST', `/requests/${id}/status`, { status: 'resolved', note: 'Scoped to a 6-week plan.' });
  assert.equal(done.data.request.status, 'resolved');
  assert.ok(done.data.request.resolvedAt);

  // Feedback once
  assert.equal((await student('POST', `/requests/${id}/feedback`, { rating: 5, comment: 'Great' })).status, 200);
  assert.equal((await student('POST', `/requests/${id}/feedback`, { rating: 4 })).status, 400);

  // Full history recorded
  const detail = await student('GET', `/requests/${id}`);
  const kinds = detail.data.events.map((e) => e.kind === 'status' ? e.toStatus : e.kind);
  assert.deepEqual(kinds, ['submitted', 'in_review', 'update', 'in_progress', 'comment', 'resolved', 'feedback']);

  // Student got notified
  const notes = await student('GET', '/notifications');
  assert.ok(notes.data.notifications.some((n) => n.requestId === id && /Resolved/.test(n.message)));
});

test('students cannot see other students’ requests; cancel works', async () => {
  const other = await login('rahul@nexus.demo');
  const student = await login('student@nexus.demo');
  const r = await other('POST', '/requests', { type: 'guidance', category: 'Academics & Other', title: 'Private question', description: 'This is a private guidance question for the cell.' });
  assert.equal((await student('GET', `/requests/${r.data.request.id}`)).status, 403);
  const cancel = await other('POST', `/requests/${r.data.request.id}/status`, { status: 'cancelled' });
  assert.equal(cancel.data.request.status, 'cancelled');
});

test('duplicate opportunity applications are rejected', async () => {
  const s = await login('nisha@nexus.demo');
  const body = { type: 'opportunity', category: 'Research & UROP', title: 'Application: code-mixed NLP', description: 'I have taken an NLP elective and built a sentiment classifier.', opportunityId: 2 };
  assert.equal((await s('POST', '/requests', body)).status, 201);
  const dup = await s('POST', '/requests', body);
  assert.equal(dup.status, 400);
  assert.match(dup.data.error, /already applied/);
});

test('admin can filter the queue, manage directory and roles', async () => {
  const admin = await login('admin@nexus.demo');
  const unassigned = await admin('GET', '/requests?mentor=unassigned&status=open');
  assert.ok(unassigned.data.requests.every((r) => r.mentor === null));
  const search = await admin('GET', '/requests?q=NX-1001');
  assert.equal(search.data.requests[0].ref, 'NX-1001');

  const m = await admin('POST', '/admin/mentors', { name: 'Test Mentor', kind: 'Senior', headline: 'Final year', department: 'CSE', tags: ['Rust'] });
  assert.equal(m.status, 201);
  const off = await admin('PATCH', `/admin/mentors/${m.data.mentor.id}`, { isActive: false });
  assert.equal(off.data.mentor.isActive, false);

  const users = (await admin('GET', '/admin/users?role=student')).data.users;
  const target = users.find((u) => u.email === 'sanjay@nexus.demo');
  assert.equal((await admin('PATCH', `/admin/users/${target.id}`, { role: 'mentor' })).status, 200);
  const me = users.length && (await admin('GET', '/auth/me')).data.user;
  assert.equal((await admin('PATCH', `/admin/users/${me.id}`, { role: 'student' })).status, 400);
});

test('goal roadmap: create, suggest mentors, toggle steps', async () => {
  const s = await login('divya@nexus.demo');
  const g = await s('POST', '/goals', { title: 'Crack an SDE internship' });
  assert.equal(g.status, 201);
  assert.equal(g.data.goal.templateKey, 'placement');
  assert.ok(g.data.goal.steps.some((st) => st.suggestedMentor));
  const t = await s('PATCH', `/goals/${g.data.goal.id}/steps/0`, { done: true });
  assert.deepEqual(t.data.goal.stepsDone, [0]);
});

test('skill verification pipeline: claim → review → verified / rejected → resubmit (idempotent)', async () => {
  const s = await login('farhan@nexus.demo');
  const admin = await login('admin@nexus.demo');
  const bad = await s('POST', '/skills', { skill: 'Rust', level: 'Beginner', evidenceNote: 'short' });
  assert.equal(bad.status, 400);
  const c = await s('POST', '/skills', { skill: 'Rust', level: 'Beginner', evidenceNote: 'Wrote a CLI tool in Rust for club tasks', evidenceUrl: 'https://example.com/rust' });
  assert.equal(c.status, 201);
  assert.equal(c.data.skill.status, 'pending');
  const again = await s('POST', '/skills', { skill: 'rust', level: 'Advanced', evidenceNote: 'Same skill submitted twice by mistake' });
  assert.equal(again.status, 200);
  assert.equal(again.data.unchanged, true);
  assert.equal(again.data.skill.id, c.data.skill.id);

  const noNote = await admin('POST', `/skills/${c.data.skill.id}/review`, { decision: 'rejected' });
  assert.equal(noNote.status, 400);
  assert.equal((await admin('POST', `/skills/${c.data.skill.id}/review`, { decision: 'rejected', note: 'Add a link to the repo' })).data.skill.status, 'rejected');
  const re = await s('POST', '/skills', { skill: 'Rust', level: 'Beginner', evidenceNote: 'Now with the repository link attached', evidenceUrl: 'https://example.com/rust2' });
  assert.equal(re.data.skill.status, 'pending');
  assert.equal((await admin('POST', `/skills/${c.data.skill.id}/review`, { decision: 'verified' })).data.skill.status, 'verified');
  const dup = await admin('POST', `/skills/${c.data.skill.id}/review`, { decision: 'verified' });
  assert.equal(dup.data.unchanged, true);
  const notes = (await s('GET', '/notifications')).data.notifications;
  assert.ok(notes.some((n) => /Rust.*verified/.test(n.message)));
});

test('faculty see only their projects, ranked applicants and connected students', async () => {
  const fac = await login('mentor@nexus.demo');
  const { projects } = (await fac('GET', '/faculty/projects')).data;
  assert.ok(projects.length >= 2);
  assert.ok(projects.every((p) => p.mentorName === 'Dr. Kavitha Rao'));
  const urop = projects.find((p) => /Traffic/.test(p.title));
  assert.ok(urop.applicants.length >= 2);
  const scores = urop.applicants.map((a) => a.fit.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  assert.ok(urop.applicants[0].fit.verified.length > 0);

  const users = (await (await login('admin@nexus.demo'))('GET', '/admin/users?role=student')).data.users;
  const divya = users.find((u) => u.email === 'divya@nexus.demo');
  assert.equal((await fac('GET', `/students/${divya.id}`)).status, 403);
  const aditi = users.find((u) => u.email === 'student@nexus.demo');
  const prof = await fac('GET', `/students/${aditi.id}`);
  assert.equal(prof.status, 200);
  assert.ok(prof.data.skills.some((k) => k.status === 'verified'));
  const q = (await fac('GET', '/skills/queue')).data;
  assert.ok(q.skills.every((k) => k.status === 'pending'));
  // Faculty cannot verify a student not connected to them
  const divyaSkills = (await (await login('divya@nexus.demo'))('POST', '/skills', { skill: 'Go', level: 'Beginner', evidenceNote: 'Built a small HTTP service in Go' })).data.skill;
  assert.equal((await fac('POST', `/skills/${divyaSkills.id}/review`, { decision: 'verified' })).status, 403);
});

test('sections are separated and request creation is idempotent', async () => {
  const s = await login('student@nexus.demo');
  const sessions = (await s('GET', '/requests?type=sessions')).data.requests;
  const apps = (await s('GET', '/requests?type=opportunity')).data.requests;
  assert.ok(sessions.length && sessions.every((r) => r.type !== 'opportunity'));
  assert.ok(apps.length && apps.every((r) => r.type === 'opportunity'));

  const body = { type: 'guidance', category: 'Academics & Other', title: 'Idempotent request', description: 'Clicking submit twice must not create two requests.', idempotencyKey: 'demo-key-123' };
  const a = await s('POST', '/requests', body);
  const b = await s('POST', '/requests', body);
  assert.equal(a.status, 201);
  assert.equal(b.status, 200);
  assert.equal(a.data.request.id, b.data.request.id);
  // Same-status transition is a no-op, not an error
  const c = await s('POST', `/requests/${a.data.request.id}/status`, { status: 'submitted' });
  assert.equal(c.status, 200);
  assert.equal(c.data.unchanged, true);

  const fac = await login('mentor@nexus.demo');
  const facSessions = (await fac('GET', '/requests?type=sessions')).data.requests;
  assert.ok(facSessions.every((r) => r.type !== 'opportunity'));
});
