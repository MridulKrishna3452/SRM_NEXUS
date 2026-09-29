/**
 * Applicant ↔ project skill fit, weighted by verification status:
 *   verified skill = 1.0 · pending (claimed, under review) = 0.5 · listed interest = 0.25
 * Score = 35 + 65 × (weighted coverage of the project's required tags).
 */
const norm = (s) => String(s).trim().toLowerCase();

function has(list, tag) {
  const t = norm(tag);
  return list.find((x) => norm(x) === t || norm(x).includes(t) || t.includes(norm(x)));
}

export function skillFit(tags, skills, interests = []) {
  const verified = skills.filter((s) => s.status === 'verified').map((s) => s.skill);
  const pending = skills.filter((s) => s.status === 'pending').map((s) => s.skill);
  const out = { verified: [], claimed: [], interest: [], missing: [] };
  let sum = 0;
  for (const tag of tags) {
    if (has(verified, tag)) { out.verified.push(tag); sum += 1; }
    else if (has(pending, tag)) { out.claimed.push(tag); sum += 0.5; }
    else if (has(interests, tag)) { out.interest.push(tag); sum += 0.25; }
    else out.missing.push(tag);
  }
  const score = tags.length ? Math.round(35 + 65 * (sum / tags.length)) : 50;
  return { score, ...out };
}
