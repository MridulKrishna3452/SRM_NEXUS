import { Router } from 'express';
import { getDb, parseJson } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../lib/auth.js';
import { validate, intParam } from '../lib/validate.js';
import { notFound, badRequest } from '../lib/http.js';
import { CATEGORIES, DAYS, SLOTS, PRIORITIES, STATUSES, STATUS_LABELS, REQUEST_TYPES } from '../lib/workflow.js';
import { REQUEST_SELECT, mapRequest, mentorRows, opportunityRows, refCode } from '../lib/repo.js';
import { matchCampus } from '../lib/match.js';
import { PATH_TEMPLATES, templateFor } from '../lib/paths.js';

const router = Router();

// Public metadata used by the client (no auth needed).
router.get('/meta', (_req, res) => {
  res.json({
    demoMode: config.demoMode,
    demoAccounts: config.demoMode ? [
      { role: 'Student', email: 'student@nexus.demo', note: 'Aditi Sharma — II Year CSE' },
      { role: 'Mentor (Faculty)', email: 'mentor@nexus.demo', note: 'Dr. Kavitha Rao — sample faculty mentor' },
      { role: 'Admin', email: 'admin@nexus.demo', note: 'Mentorship cell coordinator' },
    ] : [],
    demoPassword: config.demoMode ? config.seedPassword : null,
    allowedEmailDomain: config.allowedEmailDomain || null,
    categories: CATEGORIES, days: DAYS, slots: SLOTS, priorities: PRIORITIES,
    statuses: STATUSES.map((s) => ({ key: s, label: STATUS_LABELS[s] })),
    requestTypes: REQUEST_TYPES,
  });
});

router.use(requireAuth);

function recentActivity(whereSql, params, limit = 8) {
  return getDb().prepare(`
    SELECT e.id, e.kind, e.from_status, e.to_status, e.note, e.created_at, u.name AS actor_name,
           r.id AS request_id, r.title
    FROM request_events e JOIN requests r ON r.id = e.request_id
    LEFT JOIN users u ON u.id = e.actor_id
    WHERE ${whereSql} ORDER BY e.created_at DESC, e.id DESC LIMIT ${limit}`).all(...params).map((e) => ({
    id: e.id, kind: e.kind, fromStatus: e.from_status, toStatus: e.to_status, note: e.note, createdAt: e.created_at,
    actorName: e.actor_name, requestId: e.request_id, ref: refCode(e.request_id), title: e.title,
  }));
}

router.get('/dashboard', (req, res) => {
  const db = getDb();
  const u = req.user;
  if (u.role === 'student') {
    const counts = Object.fromEntries(db.prepare('SELECT status, COUNT(*) n FROM requests WHERE student_id = ? GROUP BY status').all(u.id).map((r) => [r.status, r.n]));
    const recent = db.prepare(`${REQUEST_SELECT} WHERE r.student_id = ? ORDER BY r.updated_at DESC LIMIT 5`).all(u.id).map(mapRequest);
    const interests = parseJson(u.interests);
    const recommended = matchCampus(interests.join(' ') || 'mentorship guidance', {
      mentors: mentorRows({ userId: u.id }), opportunities: [], interests,
    }).results.slice(0, 3);
    const deadlines = opportunityRows().filter((o) => o.deadline && o.slots_open > 0).slice(0, 3);
    const saved = db.prepare('SELECT COUNT(*) n FROM saved_mentors WHERE user_id = ?').get(u.id).n;
    const sk = db.prepare("SELECT SUM(status='verified') v, SUM(status='pending') p, COUNT(*) n FROM student_skills WHERE user_id = ?").get(u.id);
    const goals = db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY id DESC LIMIT 3').all(u.id).map(mapGoal);
    return res.json({
      role: 'student',
      stats: {
        open: (counts.submitted || 0) + (counts.in_review || 0),
        inProgress: counts.in_progress || 0,
        resolved: counts.resolved || 0,
        saved,
        skillsVerified: sk.v || 0, skillsPending: sk.p || 0, skillsTotal: sk.n || 0,
      },
      recent,
      activity: recentActivity('r.student_id = ?', [u.id]),
      recommended,
      deadlines,
      goals,
    });
  }
  if (u.role === 'mentor') {
    const mid = u.mentor_id ?? -1;
    const OPEN = "('submitted','in_review','in_progress')";
    const sessions = db.prepare(`${REQUEST_SELECT} WHERE r.mentor_id = ? AND r.type IN ('mentorship','guidance') AND r.status IN ${OPEN}
      ORDER BY CASE r.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, r.created_at LIMIT 6`).all(mid).map(mapRequest);
    const applicants = db.prepare(`${REQUEST_SELECT} WHERE o.mentor_id = ? AND r.type = 'opportunity' AND r.status IN ${OPEN}
      ORDER BY r.created_at LIMIT 6`).all(mid).map(mapRequest);
    const projects = db.prepare('SELECT COUNT(*) n FROM opportunities WHERE mentor_id = ? AND is_active = 1').get(mid).n;
    const pendingSkills = db.prepare(`SELECT COUNT(*) n FROM student_skills WHERE status = 'pending' AND user_id IN
      (SELECT r.student_id FROM requests r LEFT JOIN opportunities o ON o.id = r.opportunity_id WHERE r.mentor_id = ? OR o.mentor_id = ?)`).get(mid, mid).n;
    const rating = db.prepare('SELECT ROUND(AVG(feedback_rating),1) avg, COUNT(feedback_rating) n FROM requests WHERE mentor_id = ?').get(mid);
    const openSessions = db.prepare(`SELECT COUNT(*) n FROM requests WHERE mentor_id = ? AND type IN ('mentorship','guidance') AND status IN ${OPEN}`).get(mid).n;
    const openApplicants = db.prepare(`SELECT COUNT(*) n FROM requests r JOIN opportunities o ON o.id = r.opportunity_id WHERE o.mentor_id = ? AND r.status IN ${OPEN}`).get(mid).n;
    return res.json({
      role: 'mentor',
      stats: { openSessions, openApplicants, projects, pendingSkills, avgRating: rating.avg, ratingCount: rating.n },
      sessions, applicants,
      activity: recentActivity('(r.mentor_id = ? OR r.opportunity_id IN (SELECT id FROM opportunities WHERE mentor_id = ?))', [mid, mid]),
    });
  }
  // admin — the admin overview lives at /api/admin/stats
  res.json({ role: 'admin' });
});

// ---------- Notifications ----------
router.get('/notifications', (req, res) => {
  const rows = getDb().prepare(`SELECT id, request_id, message, is_read, created_at FROM notifications
    WHERE user_id = ? ORDER BY id DESC LIMIT 30`).all(req.user.id);
  const unread = getDb().prepare('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).n;
  res.json({
    unread,
    notifications: rows.map((n) => ({ id: n.id, requestId: n.request_id, message: n.message, isRead: !!n.is_read, createdAt: n.created_at })),
  });
});

router.post('/notifications/read-all', (req, res) => {
  getDb().prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

router.post('/notifications/:id/read', (req, res) => {
  getDb().prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(intParam(req.params.id), req.user.id);
  res.json({ ok: true });
});

// ---------- Goals / Path ----------
function mapGoal(g) {
  const tpl = PATH_TEMPLATES[g.template_key] || PATH_TEMPLATES.general;
  const done = parseJson(g.steps_done);
  return {
    id: g.id, title: g.title, templateKey: g.template_key, templateLabel: tpl.label,
    stepsDone: done, totalSteps: tpl.steps.length, createdAt: g.created_at,
  };
}

function goalWithSteps(g, userId) {
  const base = mapGoal(g);
  const tpl = PATH_TEMPLATES[g.template_key] || PATH_TEMPLATES.general;
  const mentors = mentorRows({ userId });
  const used = new Set();
  base.steps = tpl.steps.map((s, i) => {
    const top = matchCampus(s.query, { mentors, opportunities: [], interests: [] }).results.find((r) => !used.has(r.id)) || null;
    if (top) used.add(top.id);
    return {
      index: i, title: s.title, detail: s.detail, query: s.query, done: base.stepsDone.includes(i),
      suggestedMentor: top ? { id: top.item.id, name: top.item.name, kind: top.item.kind, headline: top.item.headline, hue: top.item.hue, score: top.score } : null,
    };
  });
  return base;
}

router.get('/goals', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  res.json({ goals: rows.map((g) => goalWithSteps(g, req.user.id)) });
});

router.post('/goals', (req, res) => {
  const { title } = validate(req.body, { title: { type: 'string', required: true, min: 3, max: 100, label: 'Goal' } });
  const db = getDb();
  const n = db.prepare('SELECT COUNT(*) n FROM goals WHERE user_id = ?').get(req.user.id).n;
  if (n >= 6) throw badRequest('You can track up to 6 goals. Remove one to add another.');
  const info = db.prepare('INSERT INTO goals (user_id, title, template_key) VALUES (?,?,?)').run(req.user.id, title, templateFor(title));
  const g = db.prepare('SELECT * FROM goals WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ goal: goalWithSteps(g, req.user.id) });
});

router.patch('/goals/:id/steps/:index', (req, res) => {
  const db = getDb();
  const g = db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(intParam(req.params.id), req.user.id);
  if (!g) throw notFound('Goal');
  const idx = Number(req.params.index);
  const tpl = PATH_TEMPLATES[g.template_key] || PATH_TEMPLATES.general;
  if (!Number.isInteger(idx) || idx < 0 || idx >= tpl.steps.length) throw badRequest('Invalid step');
  const { done } = validate(req.body, { done: { type: 'bool', required: true, label: 'Done' } });
  const set = new Set(parseJson(g.steps_done));
  if (done) set.add(idx); else set.delete(idx);
  db.prepare('UPDATE goals SET steps_done = ? WHERE id = ?').run(JSON.stringify([...set].sort()), g.id);
  const updated = db.prepare('SELECT * FROM goals WHERE id = ?').get(g.id);
  res.json({ goal: goalWithSteps(updated, req.user.id) });
});

router.delete('/goals/:id', (req, res) => {
  const info = getDb().prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').run(intParam(req.params.id), req.user.id);
  if (!info.changes) throw notFound('Goal');
  res.json({ ok: true });
});

export default router;
