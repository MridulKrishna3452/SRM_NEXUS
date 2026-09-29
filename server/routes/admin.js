import { Router } from 'express';
import { getDb, tx } from '../db.js';
import { requireRole } from '../lib/auth.js';
import { validate, intParam } from '../lib/validate.js';
import { badRequest, notFound } from '../lib/http.js';
import { CATEGORIES, STATUSES, STATUS_LABELS, OPEN_STATUSES } from '../lib/workflow.js';
import { mentorRows, mentorById, opportunityRows, opportunityById, REQUEST_SELECT, mapRequest } from '../lib/repo.js';

const router = Router();
router.use(requireRole('admin'));

const hours = (a, b) => (new Date(b) - new Date(a)) / 36e5;

router.get('/stats', (_req, res) => {
  const db = getDb();
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  db.prepare('SELECT status, COUNT(*) n FROM requests GROUP BY status').all().forEach((r) => { byStatus[r.status] = r.n; });
  const byCategory = CATEGORIES.map((c) => ({
    category: c,
    total: db.prepare('SELECT COUNT(*) n FROM requests WHERE category = ?').get(c).n,
    open: db.prepare(`SELECT COUNT(*) n FROM requests WHERE category = ? AND status IN ('submitted','in_review','in_progress')`).get(c).n,
  }));

  // Requests created per day over the last 14 days
  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    daily.push({ date: d, count: db.prepare('SELECT COUNT(*) n FROM requests WHERE substr(created_at,1,10) = ?').get(d).n });
  }

  // Time to first action (first transition out of "submitted") and time to resolution
  const firstAction = db.prepare(`SELECT r.created_at, MIN(e.created_at) AS first_at FROM requests r
    JOIN request_events e ON e.request_id = r.id AND e.kind IN ('status','assign') AND coalesce(e.from_status,'x') <> 'x'
    GROUP BY r.id`).all();
  const resolved = db.prepare(`SELECT created_at, resolved_at FROM requests WHERE status = 'resolved' AND resolved_at IS NOT NULL`).all();
  const avg = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);

  const unassigned = db.prepare(`SELECT COUNT(*) n FROM requests WHERE mentor_id IS NULL AND status IN ('submitted','in_review','in_progress')`).get().n;
  const highOpen = db.prepare(`SELECT COUNT(*) n FROM requests WHERE priority = 'high' AND status IN ('submitted','in_review','in_progress')`).get().n;
  const rating = db.prepare('SELECT ROUND(AVG(feedback_rating),1) avg, COUNT(feedback_rating) n FROM requests').get();
  const pendingSkills = db.prepare("SELECT COUNT(*) n FROM student_skills WHERE status = 'pending'").get().n;
  const verifiedSkills = db.prepare("SELECT COUNT(*) n FROM student_skills WHERE status = 'verified'").get().n;

  const mentorLoad = mentorRows().map((m) => ({
    id: m.id, name: m.name, kind: m.kind, hue: m.hue, openLoad: m.openLoad, capacity: m.weekly_capacity,
    resolved: m.resolvedCount, avgRating: m.avgRating,
  })).sort((a, b) => b.openLoad - a.openLoad || b.resolved - a.resolved).slice(0, 8);

  const needsAttention = db.prepare(`${REQUEST_SELECT} WHERE r.status IN ('submitted','in_review')
    ORDER BY CASE r.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, r.created_at LIMIT 6`).all().map(mapRequest);

  res.json({
    totals: {
      all: Object.values(byStatus).reduce((a, b) => a + b, 0),
      open: OPEN_STATUSES.reduce((a, s) => a + byStatus[s], 0),
      resolved: byStatus.resolved,
      unassigned, highOpen,
      users: db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'student'").get().n,
      mentors: db.prepare('SELECT COUNT(*) n FROM mentors WHERE is_active = 1').get().n,
      avgFirstActionHours: avg(firstAction.map((r) => hours(r.created_at, r.first_at))),
      avgResolutionHours: avg(resolved.map((r) => hours(r.created_at, r.resolved_at))),
      avgRating: rating.avg, ratingCount: rating.n, pendingSkills, verifiedSkills,
    },
    byStatus: STATUSES.map((s) => ({ status: s, label: STATUS_LABELS[s], count: byStatus[s] })),
    byCategory, daily, mentorLoad, needsAttention,
  });
});

// ---------- Users ----------
router.get('/users', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const role = String(req.query.role || '');
  const rows = getDb().prepare(`SELECT u.id, u.name, u.email, u.role, u.department, u.year_of_study, u.is_active, u.created_at,
      m.id AS mentor_id, m.name AS mentor_name,
      (SELECT COUNT(*) FROM requests r WHERE r.student_id = u.id) AS request_count
    FROM users u LEFT JOIN mentors m ON m.user_id = u.id ORDER BY u.created_at DESC`).all();
  let users = rows.map((u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role, department: u.department, yearOfStudy: u.year_of_study,
    isActive: !!u.is_active, createdAt: u.created_at, mentorId: u.mentor_id, mentorName: u.mentor_name, requestCount: u.request_count,
  }));
  if (role) users = users.filter((u) => u.role === role);
  if (q) users = users.filter((u) => `${u.name} ${u.email} ${u.department || ''}`.toLowerCase().includes(q));
  res.json({ users });
});

router.patch('/users/:id', (req, res) => {
  const id = intParam(req.params.id);
  if (id === req.user.id) throw badRequest('You cannot change your own role or status');
  const body = validate(req.body, {
    role: { type: 'string', oneOf: ['student', 'mentor', 'admin'], label: 'Role' },
    isActive: { type: 'bool', label: 'Active' },
    mentorId: { type: 'string', label: 'Directory profile' },   // link mentor user to a directory profile
  });
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) throw notFound('User');
  tx(() => {
    if (body.role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(body.role, id);
    if (body.isActive !== undefined) {
      db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(body.isActive ? 1 : 0, id);
      if (!body.isActive) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    }
    if (body.mentorId !== undefined) {
      db.prepare('UPDATE mentors SET user_id = NULL WHERE user_id = ?').run(id);
      if (body.mentorId && body.mentorId !== 'none') {
        const mid = intParam(body.mentorId, 'mentor');
        const m = mentorById(mid);
        if (!m) throw notFound('Mentor profile');
        if (m.userId && m.userId !== id) throw badRequest('That directory profile is already linked to another account');
        db.prepare('UPDATE mentors SET user_id = ? WHERE id = ?').run(id, mid);
      }
    }
  });
  res.json({ ok: true });
});

// ---------- Directory management ----------
const mentorSchema = (partial) => ({
  name: { type: 'string', required: !partial, min: 2, max: 80, label: 'Name' },
  kind: { type: 'string', required: !partial, oneOf: ['Senior', 'Faculty', 'Alumni'], label: 'Type' },
  headline: { type: 'string', required: !partial, min: 3, max: 100, label: 'Headline' },
  department: { type: 'string', required: !partial, min: 2, max: 80, label: 'Department' },
  tags: { type: 'tags', required: !partial, maxItems: 10, label: 'Expertise tags' },
  bio: { type: 'string', max: 800, label: 'Bio' },
  availability: { type: 'tags', maxItems: 7, label: 'Availability' },
  weeklyCapacity: { type: 'int', min: 0, max: 30, label: 'Weekly capacity' },
  isActive: { type: 'bool', label: 'Active' },
});
const HUES = { Senior: '#2F63E8', Faculty: '#5B37C9', Alumni: '#0F8F63' };

router.get('/mentors', (_req, res) => res.json({ mentors: mentorRows({ includeInactive: true }) }));

router.post('/mentors', (req, res) => {
  const b = validate(req.body, mentorSchema(false));
  const info = getDb().prepare(`INSERT INTO mentors (name, kind, headline, department, tags, bio, availability, weekly_capacity, hue)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(b.name, b.kind, b.headline, b.department, JSON.stringify(b.tags), b.bio || '',
    JSON.stringify(b.availability || []), b.weeklyCapacity ?? 3, HUES[b.kind]);
  res.status(201).json({ mentor: mentorById(Number(info.lastInsertRowid)) });
});

router.patch('/mentors/:id', (req, res) => {
  const id = intParam(req.params.id);
  const m = mentorById(id);
  if (!m) throw notFound('Mentor');
  const b = validate(req.body, mentorSchema(true));
  const merged = {
    name: b.name ?? m.name, kind: b.kind ?? m.kind, headline: b.headline ?? m.headline, department: b.department ?? m.department,
    tags: b.tags ?? m.tags, bio: b.bio ?? m.bio, availability: b.availability ?? m.availability,
    weeklyCapacity: b.weeklyCapacity ?? m.weekly_capacity, isActive: b.isActive ?? m.isActive,
  };
  getDb().prepare(`UPDATE mentors SET name=?, kind=?, headline=?, department=?, tags=?, bio=?, availability=?, weekly_capacity=?, hue=?, is_active=? WHERE id=?`)
    .run(merged.name, merged.kind, merged.headline, merged.department, JSON.stringify(merged.tags), merged.bio,
      JSON.stringify(merged.availability), merged.weeklyCapacity, HUES[merged.kind], merged.isActive ? 1 : 0, id);
  res.json({ mentor: mentorById(id) });
});

const oppSchema = (partial) => ({
  type: { type: 'string', required: !partial, oneOf: ['UROP', 'In-house Project', 'Alumni Circle', 'Entrepreneurship'], label: 'Type' },
  title: { type: 'string', required: !partial, min: 4, max: 120, label: 'Title' },
  provider: { type: 'string', required: !partial, min: 2, max: 100, label: 'Provider' },
  mentorId: { type: 'string', label: 'Owner mentor' },
  description: { type: 'string', required: !partial, min: 10, max: 1200, label: 'Description' },
  tags: { type: 'tags', maxItems: 10, label: 'Tags' },
  slotsTotal: { type: 'int', min: 0, max: 500, label: 'Slots' },
  duration: { type: 'string', max: 60, label: 'Duration' },
  deadline: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, message: 'Deadline must be a date (YYYY-MM-DD)', label: 'Deadline' },
  isActive: { type: 'bool', label: 'Active' },
});
const mentorIdOrNull = (v) => (v === undefined ? undefined : !v || v === 'none' ? null : intParam(v, 'mentor'));

router.get('/opportunities', (_req, res) => res.json({ opportunities: opportunityRows({ includeInactive: true }) }));

router.post('/opportunities', (req, res) => {
  const b = validate(req.body, oppSchema(false));
  const info = getDb().prepare(`INSERT INTO opportunities (type, title, provider, mentor_id, description, tags, slots_total, duration, deadline)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(b.type, b.title, b.provider, mentorIdOrNull(b.mentorId) ?? null, b.description,
    JSON.stringify(b.tags || []), b.slotsTotal ?? 0, b.duration ?? null, b.deadline ?? null);
  res.status(201).json({ opportunity: opportunityById(Number(info.lastInsertRowid)) });
});

router.patch('/opportunities/:id', (req, res) => {
  const id = intParam(req.params.id);
  const o = opportunityById(id);
  if (!o) throw notFound('Opportunity');
  const b = validate(req.body, oppSchema(true));
  const mid = mentorIdOrNull(b.mentorId);
  getDb().prepare(`UPDATE opportunities SET type=?, title=?, provider=?, mentor_id=?, description=?, tags=?, slots_total=?, duration=?, deadline=?, is_active=? WHERE id=?`)
    .run(b.type ?? o.type, b.title ?? o.title, b.provider ?? o.provider, mid === undefined ? o.mentorId : mid,
      b.description ?? o.description, JSON.stringify(b.tags ?? o.tags), b.slotsTotal ?? o.slots_total, b.duration ?? o.duration,
      b.deadline ?? o.deadline, (b.isActive ?? o.isActive) ? 1 : 0, id);
  res.json({ opportunity: opportunityById(id) });
});

export default router;
