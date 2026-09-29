# SRM Nexus — Ask the Campus

**Hackathon category:** Institution Innovation (Category 3) · SRMIST Kattankulathur (KTR)

A full-stack web app that helps SRMIST KTR students find the right **senior, faculty mentor, alumnus or open opportunity** for a goal, raise a **structured request**, and **track it to resolution**. A mentorship-cell **admin** triages, assigns and monitors every request.

> ⚠️ Hackathon prototype. **Not an official SRMIST service.** All people, projects, opportunities and requests in the seed data are **fictional samples**, labelled as demo data in the UI. There are no integrations with SRMIST systems (email, ERP, SSO, etc.).

---

## 1. The campus problem

At a campus the size of SRMIST KTR, help exists but is hard to reach:

1. **Discovery.** Students don't know which senior, faculty member or alumnus can help with a specific goal (UROP research, placements, GATE, startups, project teams). Knowledge spreads by word of mouth and group chats.
2. **Follow-through.** Requests sent by message or email have no status. Students don't know whether anyone is looking at them, and mentors can't see everything that's pending.
3. **Institutional visibility.** Coordinators can't see demand by topic, overloaded mentors or response times, so they can't route help or improve it.

## 2. The solution

**Ask → Match → Request → Track**

| Step | What happens |
|---|---|
| **Ask the Campus** | The student describes a goal in plain words. |
| **Explainable matching** | Mentors and opportunities are ranked by expertise tags, related skills, the student's interests and mentor capacity. The reasons are shown for every match. |
| **Structured request** | A mentorship session, an opportunity application or an open guidance query, with preferred day and time. |
| **Tracked workflow** | **Submitted → In Review → In Progress → Resolved** (or Declined / Cancelled, which require a note). Every change, comment and assignment goes into an audit timeline, and in-app notifications go out. |
| **Admin console** | Queue with search and filters, mentor assignment by load, priority, scheduling, metrics, directory and role management. |

## 3. Features and roles

**Main features (all tied to the problem):**
1. **Ask the Campus matching.** Rule-based and transparent. No external AI service is used, and the UI says so.
2. **Mentor and opportunity directory.** Search, filters, saved mentors, capacity indicators, and opportunities with slots and deadlines.
3. **Request workflow and status tracking.** Create, view, comment, change status with role-based transitions, full history, and a student rating once resolved.
4. **Skill verification pipeline.** Students claim skills with evidence (link and description). Faculty (for their applicants and mentees) or the admin verify them or send them back with a note. Verified skills weigh fully in project fit, and claimed skills weigh half.
5. **Faculty project workspace.** Each faculty mentor sees only their UROP and in-house projects, with applicants ranked by skill fit and a profile view with verified vs. claimed skills.
6. **Goal roadmaps ("My Path").** A goal becomes a set of steps, each with a suggested mentor and progress tracking.
7. **In-app notifications** for new requests, assignments, comments and status changes.
8. **Admin module.** Overview metrics and charts, request queue, assign/prioritise/schedule, directory CRUD with activate/deactivate, and user roles.

**Roles:**

| Role | Can do |
|---|---|
| **Student** | Register and sign in, ask, browse, save mentors, raise requests, comment, cancel (while Submitted or In Review), rate resolved requests, manage goals |
| **Mentor** (faculty / senior / alumni) | See their own projects with ranked applicants, verify applicants' skills, see session requests assigned to them, start review, accept (In Progress) with a schedule, resolve (note required), decline (reason required), comment |
| **Admin** (mentorship cell) | Everything above on all requests, plus assign mentors, set priority and schedule, reopen, manage the directory, change roles, deactivate accounts |

Self-registration always creates a **student**. Mentor and admin roles are granted by an admin (Users & roles page). A mentor account is linked to its directory profile there as well.

## 4. Tech stack and architecture

The original prototype was a single static HTML/CSS/JS file with no backend. This project keeps its plain HTML/CSS/JS approach, branding (SRM Nexus, blue palette, Space Grotesk and Inter) and core concept, and adds a real backend.

- **Runtime:** Node.js **≥ 22.13** (uses the built-in `node:sqlite` module, so there are no native builds and no database server).
- **Backend:** Express 5 JSON API (`server/`).
- **Database:** SQLite file (`data/nexus.db`), SQL migrations in `migrations/`, seed script in `server/seed.js`.
- **Auth:** scrypt password hashing. A random session token goes in an **HttpOnly, SameSite=Lax** cookie, and only its HMAC is stored in the DB. There's role-based middleware and a login throttle.
- **Frontend:** a no-build vanilla-JS single-page app (`public/`) with a hash router and ES modules. It is desktop-first (sidebar + top bar + multi-column grids) and collapses to a drawer layout on mobile.
- **Security basics:** server-side validation on every endpoint, HTML escaping for all rendered data, JSON-only mutating requests (CSRF mitigation), and CSP and security headers.

```
server/
  index.js          start the HTTP server
  app.js            express app, middleware, error handling
  config.js         env config (.env)
  db.js             SQLite connection + migration runner
  seed.js           demo data (npm run db:reset)
  lib/              auth, validation, workflow rules, matching, roadmap templates, queries
  routes/           auth, directory+match, requests, me (dashboard/notifications/goals), admin
migrations/001_init.sql   schema
public/             index.html, css/app.css, js/ (main.js router+shell, views/*)
test/api.test.js    end-to-end API tests (throwaway DB)
```

## 5. Run it locally

**Requirements:** Node.js 22.13 or newer (`node -v`).

```bash
npm install
```

```bash
cp .env.example .env
```

(On Windows PowerShell: `Copy-Item .env.example .env`.) Then set `SESSION_SECRET` in `.env` to a long random string:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Create the schema and load demo data:

```bash
npm run db:reset
```

Start the app:

```bash
npm start
```

Open **http://localhost:3000**. Set `PORT` in `.env` if 3000 is taken. `npm run dev` restarts automatically when server files change.

### Database commands

| Command | What it does |
|---|---|
| `npm run db:migrate` | Apply pending migrations (the server also does this on start) |
| `npm run db:seed` | Load demo data **only if the DB is empty** |
| `npm run db:reset` | **Wipe all data** and reload demo data. Safe to run while the server is running, and handy right before presenting |

### Environment variables (`.env.example`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 3000 | HTTP port |
| `DATABASE_PATH` | ./data/nexus.db | SQLite file |
| `SESSION_SECRET` | *(dev fallback)* | HMAC key for session tokens. **Required** when `NODE_ENV=production` |
| `SESSION_TTL_HOURS` | 72 | Session lifetime |
| `COOKIE_SECURE` | false | Set to true behind HTTPS |
| `DEMO_MODE` | true | Shows the demo accounts on the sign-in page |
| `SEED_DEMO_PASSWORD` | Demo@1234 | Password for all seeded accounts |
| `ALLOWED_EMAIL_DOMAIN` | *(empty)* | Optionally restrict registration to one domain |

## 6. Demo accounts (local demo only)

After `npm run db:reset`, every seeded account uses the password from `SEED_DEMO_PASSWORD` (default **`Demo@1234`**). With `DEMO_MODE=true`, the sign-in page lists them as one-click buttons.

| Role | Email | Notes |
|---|---|---|
| Student | `student@nexus.demo` | Aditi Sharma, II Year CSE. Has requests in every stage |
| Mentor (faculty) | `mentor@nexus.demo` | Dr. Kavitha Rao (sample). Has a queue of assigned requests |
| Mentor (senior) | `rohit@nexus.demo` | Rohit Verma (sample) |
| Admin | `admin@nexus.demo` | Mentorship cell coordinator |
| Other students | `rahul@`, `nisha@`, `farhan@`, `divya@`, `sanjay@nexus.demo` | Background data |

Seed contents: 9 users, 12 mentor profiles, 7 opportunities (2 owned by the demo faculty), 19 requests, 17 student skills in every verification state, with full status histories spread over the last ~3 weeks, notifications, saved mentors and a goal roadmap.

**Turn `DEMO_MODE` off and change the passwords for anything beyond a local demo.**

## 7. Presentation: Demo mode (≈ 30 seconds, auto-play)

Run `npm run db:reset`, start the app and click **▶ Start demo mode** on the landing page (or open `/#/demo`). With no overlays or captions, it switches roles, moves through every screen, scrolls and types on its own while you talk:

Landing (problem → solution) → **Student**: dashboard → Ask the Campus (types a query) → My skills → My applications → request tracking → **Faculty**: My projects (ranked applicants) → applicant profile → skill verification → **Admin**: overview → request queue → verification queue.

Keys: **Esc** stop · **Space** pause · **→** skip ahead. It is read-only and never changes data. You can replay it from the sidebar or the login page.

**Live follow-up (optional, 2 min):** as Student, add a skill with evidence in *My skills*. As Faculty, open *Skill verification* and click **✓ Verify**. The student is notified, and their applicant ranking in *My projects* goes up.

### What each role sees (separated data)
- **Student:** Dashboard, Ask the Campus, Directory, **My requests** (sessions and guidance only), **My applications** (projects only), **My skills**, My path.
- **Faculty mentor:** Dashboard, **My projects** (their own UROP and in-house projects with ranked applicants), **Session requests** (sessions routed to them only), **Skill verification** (only students who applied to or requested them).
- **Admin:** Overview, Request queue, Skill verification (all), Directory, Users and roles.

### Idempotency
- Request creation carries a client idempotency key. A double-click or retry returns the same request (`NX-…`) instead of creating a duplicate.
- Re-adding an already claimed skill, re-verifying a verified skill, or re-applying the current status all return the existing record without changes.
- `npm run db:reset` always produces the same demo state.

## Deploying to Vercel (shareable demo link)

The repo is Vercel-ready: `vercel.json` serves `public/` from the CDN and routes `/api/*` to the Express app in `api/index.js`.

1. Import the GitHub repo in Vercel. Set **Application Preset: Other** and leave the build, output and install fields at their defaults (`vercel.json` sets them).
2. Add these **Environment Variables**:
   - `SESSION_SECRET`: a long random string (**required**; the API refuses to start without it in production)
   - `DEMO_MODE`: `true` (shows the one-click demo accounts and the demo tour)
3. Deploy.

**How data behaves on Vercel:** serverless functions have no permanent disk, so the SQLite database lives in `/tmp` and is **re-seeded with the demo data on every cold start**. The demo accounts, the demo tour and browsing always work. Anything created on the live site (new accounts, requests, skill verifications) is temporary and can disappear when Vercel starts a new instance. For a live walk-through that creates data, the local server (`npm start`) is the most reliable. For permanent hosted data, use a server host with a disk (e.g. Render or Railway) or move to a hosted database.

## 8. Checks

```bash
npm run check
```

This runs a syntax check of every JS file (server and browser) plus 13 end-to-end API tests on a throwaway database. The tests cover registration and login, RBAC (401/403), matching relevance, the full status workflow with required notes, comments and feedback, notifications, privacy between students, duplicate-application protection, the skill verification pipeline, faculty data scoping, idempotent create/transition, the admin queue filters, directory CRUD, role changes, and goal roadmaps.

## 9. Known limitations

- The matching is **keyword and tag based** (explainable rules), not an ML or LLM model.
- Notifications are **in-app only**. No email or SMS is sent.
- There is no SRMIST SSO or ERP integration. Accounts are local to this app.
- Scheduling is free text (e.g. "Sat, 5 PM · Tech Park"). There is no calendar integration.
- There's no password reset or email verification flow.
- SQLite with one server process is ideal for a demo or pilot. A multi-instance deployment would need Postgres and a shared session store.
- `node:sqlite` is marked experimental in Node 22 (the warning is suppressed in the npm scripts). It works reliably for this use.
