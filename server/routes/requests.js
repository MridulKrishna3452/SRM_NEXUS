import { Router } from 'express';
import { getDb, tx, nowIso } from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { validate, intParam } from '../lib/validate.js';
import { badRequest, forbidden, notFound } from '../lib/http.js';
import {
  CATEGORIES, DAYS, SLOTS, PRIORITIES, STATUSES, STATUS_LABELS, OPEN_STATUSES, NOTE_REQUIRED,
  relationTo, allowedTransitions,
} from '../lib/workflow.js';
import { skillsOf } from './skills.js';
import {
  REQUEST_SELECT, mapRequest, requestRow, requestEvents, notify, adminIds, refCode,
  mentorById, opportunityById, mentorRows,
} from '../lib/repo.js';

const router = Router();
router.use(requireAuth);

const MAX_OPEN_PER_STUDENT = 10;

/** Notify everyone involved in a request except the actor. */
function notifyParties(r, actorId, message, { student = true, mentor = true, admins = false } = {}) {
  const targets = new Set();
  if (student) targets.add(r.student_id);
  if (mentor && r.mentor_user_id) targets.add(r.mentor_user_id);
  if (admins) adminIds().forEach((id) => targets.add(id));
  targets.delete(actorId);
  for (const uid of targets) notify(uid, r.id, message);
}

function addEvent(requestId, actorId, kind, { from = null, to = null, note = null } = {}) {
  getDb().prepare(`INSERT INTO request_events (request_id, actor_id, kind, from_status, to_status, note, created_at)
    VALUES (?,?,?,?,?,?,?)`).run(requestId, actorId, kind, from, to, note, nowIso());
}

function loadAccessible(req) {
  const id = intParam(req.params.id, 'request id');
  const r = requestRow(id);
  if (!r) throw notFound('Request');
  const rel = relationTo(r, req.user);
  if (!rel) throw forbidden('You can only view your own requests');
  return { r, rel };
}

// ---------- List ----------
router.get('/', (req, res) => {
  const where = [];
  const params = [];
  const u = req.user;
  if (u.role === 'student') { where.push('r.student_id = ?'); params.push(u.id); }
  else if (u.role === 'mentor') { where.push('r.mentor_id = ?'); params.push(u.mentor_id ?? -1); }

  const { q, status, type, category, priority, mentor, sort } = req.query;
  if (type === 'sessions') where.push("r.type IN ('mentorship','guidance')");
  else if (type) { where.push('r.type = ?'); params.push(String(type)); }
  const scopeWhere = [...where];
  const scopeParams = [...params];

  if (status === 'open') where.push(`r.status IN (${OPEN_STATUSES.map(() => '?').join(',')})`), params.push(...OPEN_STATUSES);
  else if (status && STATUSES.includes(status)) { where.push('r.status = ?'); params.push(status); }
  if (category) { where.push('r.category = ?'); params.push(String(category)); }
  if (priority && PRIORITIES.includes(priority)) { where.push('r.priority = ?'); params.push(priority); }
  if (mentor === 'unassigned') where.push('r.mentor_id IS NULL');
  else if (mentor) { where.push('r.mentor_id = ?'); params.push(intParam(mentor, 'mentor')); }
  if (q && String(q).trim()) {
    const term = `%${String(q).trim().toLowerCase()}%`;
    const refMatch = /^nx-?(\d+)$/i.exec(String(q).trim());
    where.push(`(lower(r.title) LIKE ? OR lower(r.description) LIKE ? OR lower(s.name) LIKE ? OR lower(coalesce(m.name,'')) LIKE ?${refMatch ? ' OR r.id = ?' : ''})`);
    params.push(term, term, term, term);
    if (refMatch) params.push(Number(refMatch[1]) - 1000);
  }
  const order = {
    oldest: 'r.created_at ASC',
    updated: 'r.updated_at DESC',
    priority: "CASE r.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, r.created_at ASC",
  }[sort] || 'r.created_at DESC';

  const db = getDb();
  const rows = db.prepare(`${REQUEST_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT 500`).all(...params);
  const countRows = db.prepare(`SELECT r.status, COUNT(*) AS n FROM requests r ${scopeWhere.length ? 'WHERE ' + scopeWhere.join(' AND ') : ''} GROUP BY r.status`).all(...scopeParams);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  countRows.forEach((c) => { counts[c.status] = c.n; });
  res.json({ requests: rows.map(mapRequest), counts });
});

// ---------- Create (students) ----------
router.post('/', requireRole('student'), (req, res) => {
  const body = validate(req.body, {
    type: { type: 'string', required: true, oneOf: ['mentorship', 'opportunity', 'guidance'], label: 'Request type' },
    category: { type: 'string', required: true, oneOf: CATEGORIES, label: 'Category' },
    title: { type: 'string', required: true, min: 5, max: 120, label: 'Title' },
    description: { type: 'string', required: true, min: 20, max: 2000, label: 'Description' },
    preferredDay: { type: 'string', oneOf: DAYS, label: 'Preferred day' },
    preferredSlot: { type: 'string', oneOf: SLOTS, label: 'Preferred time' },
    mentorId: { type: 'int', min: 1, label: 'Mentor' },
    opportunityId: { type: 'int', min: 1, label: 'Opportunity' },
    idempotencyKey: { type: 'string', max: 64, pattern: /^[\w-]+$/, label: 'Idempotency key' },
  });
  const db = getDb();
  if (body.idempotencyKey) {
    const prior = db.prepare('SELECT id FROM requests WHERE student_id = ? AND idempotency_key = ?').get(req.user.id, body.idempotencyKey);
    if (prior) return res.status(200).json({ request: mapRequest(requestRow(prior.id)), duplicate: true });
  }
  let mentorId = body.mentorId ?? null;
  let opportunityId = null;

  if (body.type === 'opportunity') {
    if (!body.opportunityId) throw badRequest('Please fix the highlighted fields', { opportunityId: 'Choose the opportunity you are applying to' });
    const o = opportunityById(body.opportunityId);
    if (!o || !o.isActive) throw badRequest('Please fix the highlighted fields', { opportunityId: 'This opportunity is not open' });
    const dup = db.prepare(`SELECT id FROM requests WHERE student_id = ? AND opportunity_id = ? AND status NOT IN ('cancelled','declined')`).get(req.user.id, o.id);
    if (dup) throw badRequest(`You already applied to this opportunity (${refCode(dup.id)})`);
    opportunityId = o.id;
    mentorId = o.mentorId ?? mentorId;
  } else if (body.type === 'mentorship' && !mentorId) {
    throw badRequest('Please fix the highlighted fields', { mentorId: 'Choose a mentor for a session request' });
  }
  if (mentorId) {
    const m = mentorById(mentorId);
    if (!m || !m.isActive) throw badRequest('Please fix the highlighted fields', { mentorId: 'This mentor is not available' });
  }
  const open = db.prepare(`SELECT COUNT(*) AS n FROM requests WHERE student_id = ? AND status IN ('submitted','in_review','in_progress')`).get(req.user.id).n;
  if (open >= MAX_OPEN_PER_STUDENT) throw badRequest(`You have ${open} open requests. Please wait for some to be resolved or cancel ones you no longer need.`);

  const id = tx(() => {
    const now = nowIso();
    const info = db.prepare(`INSERT INTO requests (student_id, type, category, title, description, preferred_day, preferred_slot,
        mentor_id, opportunity_id, status, created_at, updated_at, idempotency_key)
      VALUES (?,?,?,?,?,?,?,?,?, 'submitted', ?, ?, ?)`).run(req.user.id, body.type, body.category, body.title, body.description,
      body.preferredDay ?? null, body.preferredSlot ?? null, mentorId, opportunityId, now, now, body.idempotencyKey ?? null);
    const newId = Number(info.lastInsertRowid);
    addEvent(newId, req.user.id, 'status', { to: 'submitted', note: 'Request submitted' });
    const r = requestRow(newId);
    notifyParties(r, req.user.id, `New request ${refCode(newId)}: ${body.title}`, { student: false, mentor: true, admins: true });
    return newId;
  });
  res.status(201).json({ request: mapRequest(requestRow(id)) });
});

// ---------- Detail ----------
router.get('/:id', (req, res) => {
  const { r, rel } = loadAccessible(req);
  const payload = {
    request: mapRequest(r),
    events: requestEvents(r.id),
    relation: rel,
    allowedTransitions: allowedTransitions(r, req.user).map((s) => ({ status: s, label: STATUS_LABELS[s], noteRequired: NOTE_REQUIRED.has(s) })),
    canComment: r.status !== 'cancelled',
    canFeedback: rel === 'student' && r.status === 'resolved' && !r.feedback_rating,
  };
  if (rel !== 'student') payload.studentSkills = skillsOf(r.student_id);
  if (rel === 'admin') {
    payload.mentorOptions = mentorRows().map((m) => ({ id: m.id, name: m.name, kind: m.kind, openLoad: m.openLoad, capacity: m.weekly_capacity }));
  }
  res.json(payload);
});

// ---------- Status change ----------
router.post('/:id/status', (req, res) => {
  const { r } = loadAccessible(req);
  const body = validate(req.body, {
    status: { type: 'string', required: true, oneOf: STATUSES, label: 'Status' },
    note: { type: 'string', max: 1000, label: 'Note' },
    scheduledFor: { type: 'string', max: 80, label: 'Scheduled for' },
  });
  if (body.status === r.status) return res.json({ request: mapRequest(r), unchanged: true }); // idempotent retry
  const allowed = allowedTransitions(r, req.user);
  if (!allowed.includes(body.status)) {
    throw badRequest(`Cannot move a request from ${STATUS_LABELS[r.status]} to ${STATUS_LABELS[body.status]}`);
  }
  if (NOTE_REQUIRED.has(body.status) && !body.note) {
    throw badRequest('Please fix the highlighted fields', { note: `A note is required when marking a request ${STATUS_LABELS[body.status]}` });
  }
  tx(() => {
    const now = nowIso();
    const closing = body.status === 'resolved' || body.status === 'declined';
    const reopening = body.status === 'in_review' && (r.status === 'resolved' || r.status === 'declined');
    getDb().prepare(`UPDATE requests SET status = ?, updated_at = ?,
        resolved_at = CASE WHEN ? THEN ? WHEN ? THEN NULL ELSE resolved_at END,
        resolution_note = CASE WHEN ? THEN ? ELSE resolution_note END,
        scheduled_for = coalesce(?, scheduled_for)
      WHERE id = ?`).run(body.status, now, closing ? 1 : 0, now, reopening ? 1 : 0, closing ? 1 : 0, body.note ?? null,
      body.scheduledFor ?? null, r.id);
    const note = [body.note, body.scheduledFor ? `Scheduled: ${body.scheduledFor}` : null].filter(Boolean).join(' — ') || null;
    addEvent(r.id, req.user.id, 'status', { from: r.status, to: body.status, note });
    notifyParties(r, req.user.id, `${refCode(r.id)} moved to ${STATUS_LABELS[body.status]}: ${r.title}`,
      { admins: body.status === 'cancelled' });
  });
  res.json({ request: mapRequest(requestRow(r.id)) });
});

// ---------- Comments ----------
router.post('/:id/comments', (req, res) => {
  const { r } = loadAccessible(req);
  if (r.status === 'cancelled') throw badRequest('This request was cancelled');
  const { note } = validate(req.body, { note: { type: 'string', required: true, min: 2, max: 1000, label: 'Comment' } });
  tx(() => {
    addEvent(r.id, req.user.id, 'comment', { note });
    getDb().prepare('UPDATE requests SET updated_at = ? WHERE id = ?').run(nowIso(), r.id);
    notifyParties(r, req.user.id, `New comment on ${refCode(r.id)} from ${req.user.name}`, { admins: req.user.role === 'student' && !r.mentor_user_id });
  });
  res.status(201).json({ events: requestEvents(r.id) });
});

// ---------- Admin: assign / prioritise / schedule ----------
router.patch('/:id', requireRole('admin'), (req, res) => {
  const { r } = loadAccessible(req);
  const body = validate(req.body, {
    mentorId: { type: 'string', label: 'Mentor' },   // '' / 'none' / numeric id
    priority: { type: 'string', oneOf: PRIORITIES, label: 'Priority' },
    scheduledFor: { type: 'string', max: 80, label: 'Scheduled for' },
  });
  tx(() => {
    const db = getDb();
    const now = nowIso();
    if (body.mentorId !== undefined) {
      const newMentor = body.mentorId === 'none' ? null : intParam(body.mentorId, 'mentor');
      if (newMentor !== r.mentor_id) {
        const m = newMentor ? mentorById(newMentor) : null;
        if (newMentor && (!m || !m.isActive)) throw badRequest('That mentor is not available');
        db.prepare('UPDATE requests SET mentor_id = ?, updated_at = ? WHERE id = ?').run(newMentor, now, r.id);
        addEvent(r.id, req.user.id, 'assign', { note: m ? `Assigned to ${m.name}` : 'Unassigned' });
        const updated = requestRow(r.id);
        if (m) {
          notify(updated.mentor_user_id, r.id, `${refCode(r.id)} was assigned to you: ${r.title}`);
          notify(r.student_id, r.id, `${refCode(r.id)} is now with ${m.name}`);
        }
      }
    }
    if (body.priority && body.priority !== r.priority) {
      db.prepare('UPDATE requests SET priority = ?, updated_at = ? WHERE id = ?').run(body.priority, now, r.id);
      addEvent(r.id, req.user.id, 'update', { note: `Priority set to ${body.priority}` });
    }
    if (body.scheduledFor !== undefined && body.scheduledFor !== r.scheduled_for) {
      db.prepare('UPDATE requests SET scheduled_for = ?, updated_at = ? WHERE id = ?').run(body.scheduledFor || null, now, r.id);
      addEvent(r.id, req.user.id, 'update', { note: body.scheduledFor ? `Scheduled: ${body.scheduledFor}` : 'Schedule cleared' });
      if (body.scheduledFor) notify(r.student_id, r.id, `${refCode(r.id)} scheduled: ${body.scheduledFor}`);
    }
  });
  res.json({ request: mapRequest(requestRow(r.id)) });
});

// ---------- Student feedback on resolved requests ----------
router.post('/:id/feedback', (req, res) => {
  const { r, rel } = loadAccessible(req);
  if (rel !== 'student') throw forbidden('Only the student who raised this request can rate it');
  if (r.status !== 'resolved') throw badRequest('You can rate a request once it is resolved');
  if (r.feedback_rating) throw badRequest('You already rated this request');
  const body = validate(req.body, {
    rating: { type: 'int', required: true, min: 1, max: 5, label: 'Rating' },
    comment: { type: 'string', max: 500, label: 'Comment' },
  });
  tx(() => {
    getDb().prepare('UPDATE requests SET feedback_rating = ?, feedback_comment = ?, updated_at = ? WHERE id = ?')
      .run(body.rating, body.comment ?? null, nowIso(), r.id);
    addEvent(r.id, req.user.id, 'feedback', { note: `Rated ${body.rating}/5${body.comment ? ' — ' + body.comment : ''}` });
    notifyParties(r, req.user.id, `${req.user.name} rated ${refCode(r.id)} ${body.rating}/5`, { admins: true });
  });
  res.json({ request: mapRequest(requestRow(r.id)) });
});

export default router;
