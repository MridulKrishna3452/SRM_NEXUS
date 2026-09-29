export const STATUSES = ['submitted', 'in_review', 'in_progress', 'resolved', 'declined', 'cancelled'];
export const OPEN_STATUSES = ['submitted', 'in_review', 'in_progress'];

export const STATUS_LABELS = {
  submitted: 'Submitted',
  in_review: 'In Review',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

export const REQUEST_TYPES = {
  mentorship: 'Mentorship session',
  opportunity: 'Opportunity application',
  guidance: 'Guidance query',
};

export const CATEGORIES = [
  'Research & UROP',
  'Placements & Internships',
  'Higher Studies & GATE',
  'Entrepreneurship',
  'Projects & Teams',
  'Academics & Other',
];

export const PRIORITIES = ['low', 'normal', 'high'];
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const SLOTS = ['Morning', 'Afternoon', 'Evening'];

// Transitions each role may perform. Notes are mandatory where marked.
const ADMIN = {
  submitted: ['in_review', 'in_progress', 'declined'],
  in_review: ['in_progress', 'declined'],
  in_progress: ['resolved', 'declined'],
  resolved: ['in_review'],   // reopen
  declined: ['in_review'],   // reopen
  cancelled: [],
};
const MENTOR = {
  submitted: ['in_review', 'declined'],
  in_review: ['in_progress', 'declined'],
  in_progress: ['resolved'],
  resolved: [], declined: [], cancelled: [],
};
const STUDENT = {
  submitted: ['cancelled'],
  in_review: ['cancelled'],
  in_progress: [], resolved: [], declined: [], cancelled: [],
};

export const NOTE_REQUIRED = new Set(['resolved', 'declined']);

/** Which roles can see/act on a request (returns relation or null). */
export function relationTo(request, user) {
  if (!user) return null;
  if (user.role === 'admin') return 'admin';
  if (user.role === 'mentor' && user.mentor_id && request.mentor_id === user.mentor_id) return 'mentor';
  if (request.student_id === user.id) return 'student';
  return null;
}

export function allowedTransitions(request, user) {
  const rel = relationTo(request, user);
  const table = rel === 'admin' ? ADMIN : rel === 'mentor' ? MENTOR : rel === 'student' ? STUDENT : null;
  return table ? table[request.status] || [] : [];
}
