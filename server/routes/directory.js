import { Router } from 'express';
import { getDb } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { validate, intParam } from '../lib/validate.js';
import { notFound } from '../lib/http.js';
import { mentorRows, mentorById, opportunityRows, opportunityById } from '../lib/repo.js';
import { matchCampus } from '../lib/match.js';

const router = Router();
router.use(requireAuth);

const includes = (hay, q) => hay.toLowerCase().includes(q);

router.get('/mentors', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const kind = String(req.query.kind || '');
  const savedOnly = req.query.saved === '1';
  let list = mentorRows({ userId: req.user.id });
  if (kind) list = list.filter((m) => m.kind === kind);
  if (savedOnly) list = list.filter((m) => m.saved);
  if (q) list = list.filter((m) => includes(`${m.name} ${m.kind} ${m.headline} ${m.department} ${m.tags.join(' ')} ${m.bio}`, q));
  res.json({ mentors: list });
});

router.get('/mentors/:id', (req, res) => {
  const m = mentorById(intParam(req.params.id), req.user.id);
  if (!m || (!m.isActive && req.user.role !== 'admin')) throw notFound('Mentor');
  const opportunities = opportunityRows().filter((o) => o.mentorId === m.id);
  res.json({ mentor: m, opportunities });
});

router.post('/mentors/:id/save', (req, res) => {
  const id = intParam(req.params.id);
  if (!mentorById(id)) throw notFound('Mentor');
  getDb().prepare('INSERT OR IGNORE INTO saved_mentors (user_id, mentor_id) VALUES (?,?)').run(req.user.id, id);
  res.json({ saved: true });
});

router.delete('/mentors/:id/save', (req, res) => {
  getDb().prepare('DELETE FROM saved_mentors WHERE user_id = ? AND mentor_id = ?').run(req.user.id, intParam(req.params.id));
  res.json({ saved: false });
});

router.get('/opportunities', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const type = String(req.query.type || '');
  let list = opportunityRows();
  if (type) list = list.filter((o) => o.type === type);
  if (q) list = list.filter((o) => includes(`${o.title} ${o.type} ${o.provider} ${o.tags.join(' ')} ${o.description}`, q));
  res.json({ opportunities: list });
});

router.get('/opportunities/:id', (req, res) => {
  const o = opportunityById(intParam(req.params.id));
  if (!o || (!o.isActive && req.user.role !== 'admin')) throw notFound('Opportunity');
  const applied = getDb().prepare(`SELECT id, status FROM requests WHERE opportunity_id = ? AND student_id = ?
    AND status NOT IN ('cancelled') ORDER BY id DESC LIMIT 1`).get(o.id, req.user.id);
  res.json({ opportunity: o, myApplication: applied || null });
});

router.post('/match', (req, res) => {
  const { query } = validate(req.body, {
    query: { type: 'string', required: true, min: 3, max: 300, label: 'Your question' },
  });
  const interests = (() => { try { return JSON.parse(req.user.interests || '[]'); } catch { return []; } })();
  const result = matchCampus(query, {
    mentors: mentorRows({ userId: req.user.id }),
    opportunities: opportunityRows(),
    interests,
  });
  res.json({ query, ...result });
});

export default router;
