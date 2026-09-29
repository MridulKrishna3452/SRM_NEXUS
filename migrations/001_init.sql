-- SRM Nexus — initial schema

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'student' CHECK (role IN ('student','mentor','admin')),
  department    TEXT,
  year_of_study TEXT,
  interests     TEXT    NOT NULL DEFAULT '[]',   -- JSON array of strings
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Directory of people who can help (seniors, faculty, alumni).
-- user_id links a directory profile to a login account with the "mentor" role.
CREATE TABLE mentors (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  name         TEXT    NOT NULL,
  kind         TEXT    NOT NULL CHECK (kind IN ('Senior','Faculty','Alumni')),
  headline     TEXT    NOT NULL,
  department   TEXT    NOT NULL,
  tags         TEXT    NOT NULL DEFAULT '[]',   -- JSON array
  bio          TEXT    NOT NULL DEFAULT '',
  availability TEXT    NOT NULL DEFAULT '[]',   -- JSON array of weekday codes
  weekly_capacity INTEGER NOT NULL DEFAULT 3,
  hue          TEXT    NOT NULL DEFAULT '#2F63E8',
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE opportunities (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT    NOT NULL,                  -- UROP, In-house Project, Alumni Circle, Entrepreneurship
  title       TEXT    NOT NULL,
  provider    TEXT    NOT NULL,
  mentor_id   INTEGER REFERENCES mentors(id) ON DELETE SET NULL,
  description TEXT    NOT NULL DEFAULT '',
  tags        TEXT    NOT NULL DEFAULT '[]',
  slots_total INTEGER NOT NULL DEFAULT 0,
  duration    TEXT,
  deadline    TEXT,                              -- ISO date
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE requests (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT    NOT NULL CHECK (type IN ('mentorship','opportunity','guidance')),
  category        TEXT    NOT NULL,
  title           TEXT    NOT NULL,
  description     TEXT    NOT NULL,
  preferred_day   TEXT,
  preferred_slot  TEXT,
  mentor_id       INTEGER REFERENCES mentors(id) ON DELETE SET NULL,      -- requested or assigned mentor
  opportunity_id  INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
  priority        TEXT    NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  status          TEXT    NOT NULL DEFAULT 'submitted'
                  CHECK (status IN ('submitted','in_review','in_progress','resolved','declined','cancelled')),
  scheduled_for   TEXT,
  resolution_note TEXT,
  feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5),
  feedback_comment TEXT,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  resolved_at     TEXT
);
CREATE INDEX idx_requests_student ON requests(student_id);
CREATE INDEX idx_requests_mentor  ON requests(mentor_id);
CREATE INDEX idx_requests_status  ON requests(status);

-- Full audit trail: status changes, assignments, comments.
CREATE TABLE request_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id  INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind        TEXT    NOT NULL CHECK (kind IN ('status','comment','assign','update','feedback')),
  from_status TEXT,
  to_status   TEXT,
  note        TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_events_request ON request_events(request_id);

CREATE TABLE saved_mentors (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentor_id  INTEGER NOT NULL REFERENCES mentors(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, mentor_id)
);

CREATE TABLE notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  message    TEXT    NOT NULL,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- Goal roadmaps ("Path" feature)
CREATE TABLE goals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT    NOT NULL,
  template_key TEXT    NOT NULL,
  steps_done   TEXT    NOT NULL DEFAULT '[]',     -- JSON array of completed step indexes
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
