import { getDb, parseJson } from '../db.js';
import { STATUS_LABELS, REQUEST_TYPES } from './workflow.js';

export function mentorRows({ includeInactive = false, userId = null } = {}) {
  const rows = getDb().prepare(`
    SELECT m.*,
      (SELECT COUNT(*) FROM requests r WHERE r.mentor_id = m.id AND r.status IN ('in_review','in_progress')) AS open_load,
      (SELECT COUNT(*) FROM requests r WHERE r.mentor_id = m.id AND r.status = 'resolved') AS resolved_count,
      (SELECT ROUND(AVG(r.feedback_rating),1) FROM requests r WHERE r.mentor_id = m.id AND r.feedback_rating IS NOT NULL) AS avg_rating,
      ${userId ? '(SELECT 1 FROM saved_mentors s WHERE s.mentor_id = m.id AND s.user_id = ' + Number(userId) + ')' : 'NULL'} AS saved
    FROM mentors m
    ${includeInactive ? '' : 'WHERE m.is_active = 1'}
    ORDER BY m.kind, m.name`).all();
  return rows.map(mapMentor);
}

export function mentorById(id, userId = null) {
  return mentorRows({ includeInactive: true, userId }).find((m) => m.id === id) || null;
}

export function mapMentor(m) {
  return {
    id: m.id,
    userId: m.user_id,
    name: m.name,
    kind: m.kind,
    headline: m.headline,
    department: m.department,
    tags: parseJson(m.tags),
    bio: m.bio,
    availability: parseJson(m.availability),
    weekly_capacity: m.weekly_capacity,
    openLoad: m.open_load ?? 0,
    resolvedCount: m.resolved_count ?? 0,
    avgRating: m.avg_rating ?? null,
    hue: m.hue,
    isActive: !!m.is_active,
    saved: !!m.saved,
  };
}

export function opportunityRows({ includeInactive = false } = {}) {
  const rows = getDb().prepare(`
    SELECT o.*, m.name AS mentor_name,
      (SELECT COUNT(*) FROM requests r WHERE r.opportunity_id = o.id AND r.status IN ('in_progress','resolved')) AS taken,
      (SELECT COUNT(*) FROM requests r WHERE r.opportunity_id = o.id AND r.status NOT IN ('cancelled','declined')) AS applicants
    FROM opportunities o LEFT JOIN mentors m ON m.id = o.mentor_id
    ${includeInactive ? '' : 'WHERE o.is_active = 1'}
    ORDER BY o.deadline IS NULL, o.deadline`).all();
  return rows.map((o) => ({
    id: o.id,
    type: o.type,
    title: o.title,
    provider: o.provider,
    mentorId: o.mentor_id,
    mentorName: o.mentor_name,
    description: o.description,
    tags: parseJson(o.tags),
    slots_total: o.slots_total,
    slots_open: Math.max(0, o.slots_total - o.taken),
    applicants: o.applicants,
    duration: o.duration,
    deadline: o.deadline,
    isActive: !!o.is_active,
  }));
}

export const opportunityById = (id) => opportunityRows({ includeInactive: true }).find((o) => o.id === id) || null;

export const REQUEST_SELECT = `
  SELECT r.*, s.name AS student_name, s.email AS student_email, s.department AS student_department,
         s.year_of_study AS student_year,
         m.name AS mentor_name, m.kind AS mentor_kind, m.hue AS mentor_hue, m.headline AS mentor_headline,
         m.user_id AS mentor_user_id,
         o.title AS opportunity_title, o.type AS opportunity_type
  FROM requests r
  JOIN users s ON s.id = r.student_id
  LEFT JOIN mentors m ON m.id = r.mentor_id
  LEFT JOIN opportunities o ON o.id = r.opportunity_id`;

export const refCode = (id) => `NX-${String(1000 + id)}`;

export function mapRequest(r) {
  return {
    id: r.id,
    ref: refCode(r.id),
    type: r.type,
    typeLabel: REQUEST_TYPES[r.type],
    category: r.category,
    title: r.title,
    description: r.description,
    preferredDay: r.preferred_day,
    preferredSlot: r.preferred_slot,
    priority: r.priority,
    status: r.status,
    statusLabel: STATUS_LABELS[r.status],
    scheduledFor: r.scheduled_for,
    resolutionNote: r.resolution_note,
    feedbackRating: r.feedback_rating,
    feedbackComment: r.feedback_comment,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    resolvedAt: r.resolved_at,
    student: { id: r.student_id, name: r.student_name, email: r.student_email, department: r.student_department, year: r.student_year },
    mentor: r.mentor_id ? { id: r.mentor_id, name: r.mentor_name, kind: r.mentor_kind, hue: r.mentor_hue, headline: r.mentor_headline } : null,
    opportunity: r.opportunity_id ? { id: r.opportunity_id, title: r.opportunity_title, type: r.opportunity_type } : null,
  };
}

export function requestRow(id) {
  return getDb().prepare(`${REQUEST_SELECT} WHERE r.id = ?`).get(id) || null;
}

export function requestEvents(id) {
  return getDb().prepare(`
    SELECT e.*, u.name AS actor_name, u.role AS actor_role
    FROM request_events e LEFT JOIN users u ON u.id = e.actor_id
    WHERE e.request_id = ? ORDER BY e.created_at, e.id`).all(id).map((e) => ({
    id: e.id,
    kind: e.kind,
    fromStatus: e.from_status,
    toStatus: e.to_status,
    note: e.note,
    createdAt: e.created_at,
    actor: e.actor_id ? { id: e.actor_id, name: e.actor_name, role: e.actor_role } : null,
  }));
}

export function notify(userId, requestId, message) {
  if (!userId) return;
  getDb().prepare('INSERT INTO notifications (user_id, request_id, message) VALUES (?,?,?)').run(userId, requestId, message);
}

export function adminIds() {
  return getDb().prepare("SELECT id FROM users WHERE role = 'admin' AND is_active = 1").all().map((r) => r.id);
}
