import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Load .env if present (Node >= 21.7 built-in). Existing env vars win.
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* no .env file — use defaults */ }

const bool = (v, d) => (v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(v));

const DEV_SECRET = 'dev-only-insecure-secret-change-me';

export const config = {
  port: Number(process.env.PORT) || 3000,
  databasePath: path.resolve(ROOT, process.env.DATABASE_PATH || './data/nexus.db'),
  sessionSecret: process.env.SESSION_SECRET || DEV_SECRET,
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS) || 72,
  cookieSecure: bool(process.env.COOKIE_SECURE, false),
  demoMode: bool(process.env.DEMO_MODE, true),
  seedPassword: process.env.SEED_DEMO_PASSWORD || 'Demo@1234',
  allowedEmailDomain: (process.env.ALLOWED_EMAIL_DOMAIN || '').trim().toLowerCase(),
};

if (config.sessionSecret === DEV_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET must be set in production');
}
