import { Router } from 'express';
import { getDb, tx, nowIso, parseJson } from '../db.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { validate, intParam } from '../lib/validate.js';
import { badRequest, forbidden, notFound } from '../lib/http.js';
import { notify, adminIds, opportunityRows, REQUEST_SELECT, mapRequest } from '../lib/repo.js';
import { skillFit } from '../lib/fit.js';

const router = Router();
router.use(requireAuth);

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export function mapSkill(s) {
  return {
    id: s.id, userId: s.user_id, skill: s.skill, level: s.level, evidenceUrl: s.evidence_url, evidenceNote: s.evidence_note,
    status: s.status, verifierName: s.verifier_name ?? null, verifierNote: s.verifier_note, reviewedAt: s.reviewed_at,
    createdAt: s.created_at, updatedAt: s.updated_at,
    student: s.student_name ? { id: s.user_id, name: s.student_name, department: s.student_department, year: s.student_year } : undefined,
  };
}

export function skillsOf(userId) {
  return getDb().prepare(`SELECT k.*, v.name AS verifier_name FROM student_skills k LEFT JOIN users v ON v.id = k.verifier_id
    WHERE k.user_id = ? ORDER BY CASE k.status WHEN 'verified' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, k.skill`).all(userId).map(mapSkill);
}

/** A mentor may review / view students who applied to their projects or requested them. */
export function mentorConnectedTo(mentorId, studentId) {
  if (!mentorId) return false;
  return !!getDb().prepare(`SELECT 1 FROM requests r LEFT JOIN opportunities o ON o.id = r.opportunity_id
    WHERE r.student_id = ? AND (r.mentor_id = ? OR o.mentor_id = ?) LIMIT 1`).get(studentId, mentorId, mentorId);
}

// ---------- Student: my skills ----------
router.get('/skills/mine', requireRole('student'), (req, res) => {
  res.json({ skills: skillsOf(req.user.id) });
});

router.post('/skills', requireRole('student'), (req, res) => {
  const b = validate(req.body, {
    skill: { type: 'string', required: true, min: 2, max: 40, label: 'Skill' },
    level: { type: 'string', required: true, oneOf: LEVELS, label: 'Level' },
    evidenceUrl: { type: 'string', max: 300, pattern: /^https?:\/\/\S+$/i, message: 'Evidence link must start with http:// or https://', label: 'Evidence link' },
    evidenceNote: { type: 'string', required: true, min: 10, max: 500, label: 'Evidence description' },
  });
  const db = getDb();
  const existing = db.prepare('SELECT * FROM student_skills WHERE user_id = ? AND skill = ?').get(req.user.id, b.skill);
  if (existing && existing.status !== 'rejected') {
    // Idempotent: re-adding an already claimed/verified skill returns it unchanged.
    return res.status(200).json({ skill: skillsOf(req.user.id).find((s) => s.id === existing.id), unchanged: true });
  }
  const id = tx(() => {
    const now = nowIso();
    let skillId;
    if (existing) {
      db.prepare(`UPDATE student_skills SET level=?, evidence_url=?, evidence_note=?, status='pending', verifier_id=NULL, verifier_note=NULL,
        reviewed_at=NULL, updated_at=? WHERE id=?`).run(b.level, b.evidenceUrl ?? null, b.evidenceNote, now, existing.id);
      skillId = existing.id;
    } else {
      skillId = Number(db.prepare(`INSERT INTO student_skills (user_id, skill, level, evidence_url, evidence_note, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?)`).run(req.user.id, b.skill, b.level, b.evidenceUrl ?? null, b.evidenceNote, now, now).lastInsertRowid);
    }
    adminIds().forEach((a) => notify(a, null, `${req.user.name} submitted "${b.skill}" for verification`));
    return skillId;
  });
  res.status(201).json({ skill: skillsOf(req.user.id).find((s) => s.id === id) });
});

router.delete('/skills/:id', requireRole('student'), (req, res) => {
  const info = getDb().prepare('DELETE FROM student_skills WHERE id = ? AND user_id = ?').run(intParam(req.params.id), req.user.id);
  if (!info.changes) throw notFound('Skill');
  res.json({ ok: true });
});

// ---------- Faculty / admin: verification queue ----------
router.get('/skills/queue', requireRole('mentor', 'admin'), (req, res) => {
  const status = ['pending', 'verified', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const params = [status];
  let scope = '';
  if (req.user.role === 'mentor') {
    scope = `AND k.user_id IN (SELECT r.student_id FROM requests r LEFT JOIN opportunities o ON o.id = r.opportunity_id
      WHERE r.mentor_id = ? OR o.mentor_id = ?)`;
    params.push(req.user.mentor_id ?? -1, req.user.mentor_id ?? -1);
  }
  const rows = getDb().prepare(`SELECT k.*, v.name AS verifier_name, s.name AS student_name, s.department AS student_department, s.year_of_study AS student_year
    FROM student_skills k JOIN users s ON s.id = k.user_id LEFT JOIN users v ON v.id = k.verifier_id
    WHERE k.status = ? ${scope} ORDER BY k.updated_at ${status === 'pending' ? 'ASC' : 'DESC'} LIMIT 300`).all(...params);
  const counts = Object.fromEntries(['pending', 'verified', 'rejected'].map((s) => [s,
    getDb().prepare(`SELECT COUNT(*) n FROM student_skills k WHERE k.status = ? ${scope}`).get(s, ...params.slice(1)).n]));
  res.json({ skills: rows.map(mapSkill), counts });
});

router.post('/skills/:id/review', requireRole('mentor', 'admin'), (req, res) => {
  const id = intParam(req.params.id);
  const b = validate(req.body, {
    decision: { type: 'string', required: true, oneOf: ['verified', 'rejected'], label: 'Decision' },
    note: { type: 'string', max: 500, label: 'Note' },
  });
  const db = getDb();
  const s = db.prepare('SELECT * FROM student_skills WHERE id = ?').get(id);
  if (!s) throw notFound('Skill');
  if (req.user.role === 'mentor' && !mentorConnectedTo(req.user.mentor_id, s.user_id)) {
    throw forbidden('You can only verify skills of students who applied to your projects or requested you');
  }
  if (s.status === b.decision) return res.json({ skill: mapSkill(s), unchanged: true }); // idempotent
  if (s.status !== 'pending') throw badRequest(`This skill was already ${s.status}. The student must resubmit it first.`);
  if (b.decision === 'rejected' && !b.note) throw badRequest('Please fix the highlighted fields', { note: 'Tell the student why, so they can resubmit' });
  tx(() => {
    const now = nowIso();
    db.prepare('UPDATE student_skills SET status=?, verifier_id=?, verifier_note=?, reviewed_at=?, updated_at=? WHERE id=?')
      .run(b.decision, req.user.id, b.note ?? null, now, now, id);
    notify(s.user_id, null, b.decision === 'verified'
      ? `✓ "${s.skill}" was verified by ${req.user.name}`
      : `"${s.skill}" needs more evidence — see the note from ${req.user.name}`);
  });
  const row = db.prepare(`SELECT k.*, v.name AS verifier_name FROM student_skills k LEFT JOIN users v ON v.id = k.verifier_id WHERE k.id = ?`).get(id);
  res.json({ skill: mapSkill(row) });
});

// ---------- Faculty: my projects with ranked applicants ----------
router.get('/faculty/projects', requireRole('mentor'), (req, res) => {
  const mid = req.user.mentor_id ?? -1;
  const db = getDb();
  const projects = opportunityRows({ includeInactive: true }).filter((o) => o.mentorId === mid).map((o) => {
    const apps = db.prepare(`${REQUEST_SELECT} WHERE r.opportunity_id = ? AND r.status <> 'cancelled' ORDER BY r.created_at`).all(o.id).map(mapRequest);
    const applicants = apps.map((r) => {
      const u = db.prepare('SELECT interests FROM users WHERE id = ?').get(r.student.id);
      const skills = skillsOf(r.student.id);
      return { request: r, skills, fit: skillFit(o.tags, skills, parseJson(u?.interests)) };
    }).sort((a, b) => b.fit.score - a.fit.score);
    return { ...o, applicants };
  });
  res.json({ projects });
});

// ---------- Student profile (for connected faculty / admin) ----------
router.get('/students/:id', requireRole('mentor', 'admin'), (req, res) => {
  const id = intParam(req.params.id);
  const db = getDb();
  const u = db.prepare("SELECT id, name, email, department, year_of_study, interests, created_at FROM users WHERE id = ? AND role = 'student'").get(id);
  if (!u) throw notFound('Student');
  const isMentor = req.user.role === 'mentor';
  if (isMentor && !mentorConnectedTo(req.user.mentor_id, id)) throw forbidden('This student has not applied to your projects or requested you');
  const skills = skillsOf(id);
  const interests = parseJson(u.interests);
  const mid = req.user.mentor_id ?? -1;
  const requests = db.prepare(`${REQUEST_SELECT} WHERE r.student_id = ? ${isMentor ? 'AND (r.mentor_id = ? OR o.mentor_id = ?)' : ''} ORDER BY r.created_at DESC`)
    .all(...(isMentor ? [id, mid, mid] : [id])).map(mapRequest);
  const projects = opportunityRows({ includeInactive: true }).filter((o) => (isMentor ? o.mentorId === mid : requests.some((r) => r.opportunity?.id === o.id)));
  res.json({
    student: { id: u.id, name: u.name, email: u.email, department: u.department, yearOfStudy: u.year_of_study, interests, createdAt: u.created_at },
    skills,
    fits: projects.map((o) => ({ opportunity: { id: o.id, title: o.title, type: o.type, tags: o.tags }, fit: skillFit(o.tags, skills, interests) })),
    requests,
    canVerify: true,
  });
});

export default router;
