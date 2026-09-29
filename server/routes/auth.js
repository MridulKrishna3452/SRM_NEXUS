import { Router } from 'express';
import { getDb } from '../db.js';
import { config } from '../config.js';
import { validate, EMAIL_RE } from '../lib/validate.js';
import { badRequest, HttpError } from '../lib/http.js';
import {
  hashPassword, verifyPassword, createSession, destroySession, publicUser,
  checkThrottle, recordFailure, clearFailures, requireAuth,
} from '../lib/auth.js';

const router = Router();

const DEPARTMENTS_HINT = 'e.g. CSE, ECE, Mechanical';

router.post('/register', (req, res) => {
  const body = validate(req.body, {
    name: { type: 'string', required: true, min: 2, max: 80, label: 'Full name' },
    email: { type: 'string', required: true, max: 120, pattern: EMAIL_RE, message: 'Enter a valid email address', label: 'Email' },
    password: { type: 'string', required: true, min: 8, max: 128, label: 'Password' },
    department: { type: 'string', required: true, min: 2, max: 60, label: `Department (${DEPARTMENTS_HINT})` },
    yearOfStudy: { type: 'string', required: true, oneOf: ['I', 'II', 'III', 'IV', 'V', 'PG'], label: 'Year of study' },
    interests: { type: 'tags', maxItems: 8, label: 'Interests', default: [] },
  });
  if (!/[A-Za-z]/.test(body.password) || !/\d/.test(body.password)) {
    throw badRequest('Please fix the highlighted fields', { password: 'Password must contain letters and at least one number' });
  }
  const email = body.email.toLowerCase();
  if (config.allowedEmailDomain && !email.endsWith('@' + config.allowedEmailDomain)) {
    throw badRequest('Please fix the highlighted fields', { email: `Use your @${config.allowedEmailDomain} email address` });
  }
  const db = getDb();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    throw badRequest('Please fix the highlighted fields', { email: 'An account with this email already exists' });
  }
  // Self-registration always creates a student. Mentor/admin roles are granted by an admin.
  const info = db.prepare(`INSERT INTO users (name, email, password_hash, role, department, year_of_study, interests)
    VALUES (?,?,?,?,?,?,?)`).run(body.name, email, hashPassword(body.password), 'student',
    body.department, body.yearOfStudy, JSON.stringify(body.interests));
  createSession(res, Number(info.lastInsertRowid));
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const body = validate(req.body, {
    email: { type: 'string', required: true, max: 120, label: 'Email' },
    password: { type: 'string', required: true, max: 128, label: 'Password' },
  });
  const key = `${body.email.toLowerCase()}|${req.ip}`;
  checkThrottle(key);
  const user = getDb().prepare(`SELECT u.*, m.id AS mentor_id FROM users u LEFT JOIN mentors m ON m.user_id = u.id
    WHERE u.email = ?`).get(body.email.toLowerCase());
  if (!user || !verifyPassword(body.password, user.password_hash)) {
    recordFailure(key);
    throw new HttpError(401, 'Incorrect email or password');
  }
  if (!user.is_active) throw new HttpError(403, 'This account has been deactivated. Contact the admin.');
  clearFailures(key);
  createSession(res, user.id);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.patch('/me', requireAuth, (req, res) => {
  const body = validate(req.body, {
    name: { type: 'string', required: true, min: 2, max: 80, label: 'Full name' },
    department: { type: 'string', max: 60, label: 'Department' },
    yearOfStudy: { type: 'string', oneOf: ['I', 'II', 'III', 'IV', 'V', 'PG'], label: 'Year of study' },
    interests: { type: 'tags', maxItems: 8, label: 'Interests', default: [] },
  });
  const db = getDb();
  db.prepare('UPDATE users SET name = ?, department = ?, year_of_study = ?, interests = ? WHERE id = ?')
    .run(body.name, body.department ?? null, body.yearOfStudy ?? null, JSON.stringify(body.interests), req.user.id);
  const user = db.prepare('SELECT u.*, m.id AS mentor_id FROM users u LEFT JOIN mentors m ON m.user_id = u.id WHERE u.id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

export default router;
