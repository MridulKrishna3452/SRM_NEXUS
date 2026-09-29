import path from 'node:path';
import express from 'express';
import { ROOT } from './config.js';
import { loadUser } from './lib/auth.js';
import { HttpError } from './lib/http.js';
import authRoutes from './routes/auth.js';
import directoryRoutes from './routes/directory.js';
import requestRoutes from './routes/requests.js';
import meRoutes from './routes/me.js';
import adminRoutes from './routes/admin.js';
import skillRoutes from './routes/skills.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    });
    next();
  });

  app.use(express.json({ limit: '100kb' }));
  app.use(loadUser);

  // Mutating API calls must be JSON — blocks simple cross-site form posts (CSRF).
  app.use('/api', (req, _res, next) => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && req.headers['content-length'] !== '0'
      && req.headers['content-length'] !== undefined && !req.is('application/json')) {
      return next(new HttpError(415, 'Requests must be sent as JSON'));
    }
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api', meRoutes);
  app.use('/api', directoryRoutes);
  app.use('/api/requests', requestRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', skillRoutes);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'API route not found')));

  app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'], maxAge: 0 }));
  // SPA fallback (hash routing is used, but serve index for any other path)
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(ROOT, 'public', 'index.html')) : next()));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'Something went wrong on the server' : err.message, details: err.details });
  });

  return app;
}
