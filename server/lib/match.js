/**
 * "Ask the Campus" matching.
 *
 * Transparent, rule-based scoring (no external AI service):
 *   1. Detect the student's goal category from keywords in their question.
 *   2. Expand the question with that category's related skills.
 *   3. Score each mentor / opportunity by tag overlap with the question (strong),
 *      the category's skills (medium), the student's saved interests (light),
 *      and current mentoring capacity.
 * Every result carries human-readable reasons so the score is explainable.
 */

export const INTENTS = [
  {
    key: 'research', category: 'Research & UROP', goal: 'Research + project guidance',
    triggers: /vision|research|professor|urop|paper|publication|\bml\b|machine learning|deep learning|\bai\b|nlp|image/,
    skills: ['Research', 'UROP', 'Computer Vision', 'Deep Learning', 'Machine Learning', 'Python'],
  },
  {
    key: 'placement', category: 'Placements & Internships', goal: 'Placement preparation',
    triggers: /microsoft|google|amazon|\bsde\b|intern|placement|interview|faang|resume|\bcv review|dsa|leetcode|job|offer/,
    skills: ['DSA', 'Interviews', 'Resume', 'System Design', 'Placement'],
  },
  {
    key: 'gate', category: 'Higher Studies & GATE', goal: 'Competitive exam / higher studies',
    triggers: /gate|\bms\b|masters|gre|higher stud|\bexam|\biit\b|aptitude|phd/,
    skills: ['GATE', 'Exam Strategy', 'Algorithms', 'Aptitude', 'Higher Studies'],
  },
  {
    key: 'startup', category: 'Entrepreneurship', goal: 'Entrepreneurship guidance',
    triggers: /startup|entrepreneur|founder|business|fundrais|incubat|pitch|idea|product/,
    skills: ['Startup', 'Entrepreneurship', 'Product', 'Fundraising', 'Incubation'],
  },
  {
    key: 'team', category: 'Projects & Teams', goal: 'Project / team formation',
    triggers: /team|hackathon|drone|embedded|iot|hardware|robot|build|teammate/,
    skills: ['Embedded', 'IoT', 'Hardware', 'Robotics', 'Projects'],
  },
];

const STOP = new Set('i a an the to and or of for in on with my me want need help how do can get find about is am be into some any who someone from at this that'.split(' '));

export function detectIntent(query) {
  const s = query.toLowerCase();
  return INTENTS.find((i) => i.triggers.test(s)) || null;
}

function tokens(s) {
  return s.toLowerCase().split(/[^a-z0-9+#]+/).filter((t) => t.length > 1 && !STOP.has(t));
}

function tagHit(tag, text, toks) {
  const t = tag.toLowerCase();
  if (text.includes(t)) return true;
  const parts = tokens(t);
  return parts.length > 0 && parts.every((p) => toks.includes(p) || toks.some((q) => q.length > 3 && p.startsWith(q)));
}

function scoreItem({ tags, text }, query, intent, interests) {
  const q = query.toLowerCase();
  const toks = tokens(q);
  const direct = tags.filter((t) => tagHit(t, q, toks));
  const hay = (text + ' ' + tags.join(' ')).toLowerCase();
  const textHits = toks.filter((t) => t.length > 3 && hay.includes(t) && !direct.some((d) => d.toLowerCase().includes(t)));
  const related = intent ? tags.filter((t) => !direct.includes(t) && intent.skills.some((s) => s.toLowerCase() === t.toLowerCase())) : [];
  const interest = tags.filter((t) => interests.some((i) => i.toLowerCase() === t.toLowerCase()));
  const raw = direct.length * 14 + Math.min(textHits.length, 3) * 5 + related.length * 7 + interest.length * 3;
  return { raw, direct, related, interest, textHits };
}

// Smooth, saturating curve: more evidence → higher score, never a fake 100%.
const toScore = (raw) => Math.max(35, Math.min(97, Math.round(38 + 60 * (1 - Math.exp(-raw / 38)))));
const isStrong = (s) => s.direct.length > 0 || s.related.length > 0 || s.textHits.length > 0;

/**
 * @param {string} query
 * @param {{mentors: any[], opportunities: any[], interests: string[]}} data
 *   mentors: [{id,name,kind,headline,department,tags[],bio,openLoad,weekly_capacity}]
 */
export function matchCampus(query, { mentors, opportunities, interests = [] }) {
  const intent = detectIntent(query);
  const results = [];

  for (const m of mentors) {
    const s = scoreItem({ tags: m.tags, text: `${m.headline} ${m.bio} ${m.department}` }, query, intent, interests);
    if (s.raw === 0) continue;
    const spare = Math.max(0, m.weekly_capacity - m.openLoad);
    const raw = s.raw + (spare > 0 ? 6 : -8);
    const reasons = [];
    if (s.direct.length) reasons.push(`Expertise matches your question: ${s.direct.slice(0, 3).join(', ')}`);
    if (s.related.length) reasons.push(`Related skills for ${intent.goal.toLowerCase()}: ${s.related.slice(0, 3).join(', ')}`);
    if (s.interest.length) reasons.push(`Shares your listed interests: ${s.interest.slice(0, 2).join(', ')}`);
    if (!s.direct.length && s.textHits.length) reasons.push(`Profile mentions: ${s.textHits.slice(0, 3).join(', ')}`);
    reasons.push(spare > 0 ? `Has capacity this week (${spare} of ${m.weekly_capacity} slots free)` : 'Currently at full capacity — expect a slower reply');
    const kindReason = { Faculty: 'Faculty member — can supervise research and projects', Alumni: 'Alumni — brings an industry / outside view', Senior: 'Senior student — recently went through the same path' }[m.kind];
    reasons.push(kindReason);
    results.push({ kind: 'mentor', id: m.id, raw, strong: isStrong(s), score: toScore(raw), reasons, item: m });
  }

  for (const o of opportunities) {
    const s = scoreItem({ tags: o.tags, text: `${o.title} ${o.type} ${o.description}` }, query, intent, interests);
    if (s.raw === 0) continue;
    const reasons = [];
    if (s.direct.length) reasons.push(`Requires skills you asked about: ${s.direct.slice(0, 3).join(', ')}`);
    if (s.related.length) reasons.push(`Aligned with ${intent.goal.toLowerCase()}`);
    if (!s.direct.length && s.textHits.length) reasons.push(`Description mentions: ${s.textHits.slice(0, 3).join(', ')}`);
    if (o.slots_open > 0) reasons.push(`${o.slots_open} slot${o.slots_open > 1 ? 's' : ''} open`);
    if (o.deadline) reasons.push(`Apply by ${o.deadline}`);
    const raw = s.raw + (o.slots_open > 0 ? 4 : -10);
    results.push({ kind: 'opportunity', id: o.id, raw, strong: isStrong(s), score: toScore(raw), reasons, item: o });
  }

  results.sort((a, b) => b.raw - a.raw);
  // Interest-only matches are just padding once we have enough real matches.
  const strong = results.filter((r) => r.strong);
  const final = (strong.length >= 3 ? strong : results).map(({ raw, strong: _s, ...r }) => r);
  return {
    understood: {
      goal: intent?.goal || 'General guidance',
      category: intent?.category || 'Academics & Other',
      skills: intent ? intent.skills.slice(0, 4) : tokens(query).slice(0, 4),
    },
    results: final.slice(0, 12),
  };
}
