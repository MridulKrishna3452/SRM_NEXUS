// Vercel serverless entry: the Express app handles every /api/* request.
// Static pages in public/ are served by Vercel's CDN.
// The SQLite database lives in /tmp (ephemeral) and is seeded with demo data on cold start.
// If startup fails (e.g. a missing env var), the reason is returned as JSON instead of a bare crash.
let appPromise = null;

async function init() {
  const { getDb } = await import('../server/db.js');
  const { seed } = await import('../server/seed.js');
  const { createApp } = await import('../server/app.js');
  seed(getDb()); // no-op when the database already has data
  return createApp();
}

export default async function handler(req, res) {
  try {
    appPromise ??= init();
    const app = await appPromise;
    return app(req, res);
  } catch (err) {
    appPromise = null;
    console.error('SRM Nexus API failed to start:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    const hint = /SESSION_SECRET/.test(err.message)
      ? 'Add SESSION_SECRET in Vercel → Project → Settings → Environment Variables, then redeploy.'
      : `Running on Node ${process.version}; this app needs Node 22.13+ (built-in node:sqlite).`;
    res.end(JSON.stringify({ error: `The API failed to start: ${err.message} — ${hint}` }));
  }
}
