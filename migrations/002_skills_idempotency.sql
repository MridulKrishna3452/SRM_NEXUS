-- Student skills with a verification pipeline:
--   pending (claimed with evidence, awaiting review) → verified | rejected (→ resubmitted → pending)
CREATE TABLE student_skills (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill         TEXT    NOT NULL COLLATE NOCASE,
  level         TEXT    NOT NULL DEFAULT 'Intermediate' CHECK (level IN ('Beginner','Intermediate','Advanced')),
  evidence_url  TEXT,
  evidence_note TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  verifier_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  verifier_note TEXT,
  reviewed_at   TEXT,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, skill)
);
CREATE INDEX idx_skills_status ON student_skills(status);

-- Idempotent request creation: the client sends a key per form; retries/double-clicks return the same request.
ALTER TABLE requests ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX idx_requests_idem ON requests(student_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
