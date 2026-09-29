import crypto from 'node:crypto';
import { getDb } from '../db.js';
import { config } from '../config.js';
import { HttpError, forbidden } from './http.js';

export const COOKIE_NAME = 'nexus_session';

// ---- Passwords (scrypt, no native deps) ----
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

// ---- Sessions: stateless signed cookie "<payload>.<hmac>" ----
// The user is re-loaded from the DB on every request, so deactivated accounts are rejected immediately.
// Stateless tokens keep users signed in across serverless instances (e.g. on Vercel).
const sign = (data) => crypto.createHmac('sha256', config.sessionSecret).update(data).digest('base64url');

export function createSession(res, userId) {
  const expires = new Date(Date.now() + config.sessionTtlHours * 3600 * 1000);
  const payload = Buffer.from(JSON.stringify({ u: userId, e: expires.getTime(), n: crypto.randomBytes(8).toString('hex') })).toString('base64url');
  res.cookie(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    expires,
    path: '/',
  });
}

export function destroySession(_req, res) {
  res.clearCookie(COOKIE_NAME, { path: '/', httpOnly: true, sameSite: 'lax', secure: config.cookieSecure });
}

function readSession(token) {
  const [payload, mac] = String(token).split('.');
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isInteger(data.u) && data.e > Date.now() ? data.u : null;
  } catch { return null; }
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1 && part.slice(0, idx).trim() === name) {
      try { return decodeURIComponent(part.slice(idx + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

/** Middleware: attach req.user (or null) from the session cookie. */
export function loadUser(req, _res, next) {
  req.user = null;
  const token = readCookie(req, COOKIE_NAME);
  const userId = token ? readSession(token) : null;
  if (userId) {
    const row = getDb().prepare(`
      SELECT u.id, u.name, u.email, u.role, u.department, u.year_of_study, u.interests, u.is_active, u.created_at,
             m.id AS mentor_id
      FROM users u LEFT JOIN mentors m ON m.user_id = u.id
      WHERE u.id = ?`).get(userId);
    if (row && row.is_active) req.user = row;
  }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in to continue'));
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Please sign in to continue'));
  if (!roles.includes(req.user.role)) return next(forbidden());
  next();
};

// ---- Simple in-memory login throttle (per email+IP) ----
const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function checkThrottle(key) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (rec && now - rec.first < WINDOW_MS && rec.count >= MAX_ATTEMPTS) {
    throw new HttpError(429, 'Too many sign-in attempts. Please wait a few minutes and try again.');
  }
}
export function recordFailure(key) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.first >= WINDOW_MS) attempts.set(key, { first: now, count: 1 });
  else rec.count += 1;
}
export const clearFailures = (key) => attempts.delete(key);

export function publicUser(u) {
  if (!u) return null;
  let interests = [];
  try { interests = JSON.parse(u.interests || '[]'); } catch { /* ignore */ }
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    department: u.department, yearOfStudy: u.year_of_study, interests,
    mentorId: u.mentor_id ?? null, createdAt: u.created_at,
  };
}
