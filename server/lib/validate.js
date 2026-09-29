import { badRequest } from './http.js';

/**
 * Tiny declarative validator. Each rule: { type, required, min, max, oneOf, pattern, label }.
 * Returns a clean object with only the declared keys; throws 400 with per-field errors.
 */
export function validate(body, schema) {
  const src = body && typeof body === 'object' ? body : {};
  const out = {};
  const errors = {};
  for (const [key, rule] of Object.entries(schema)) {
    const label = rule.label || key;
    let v = src[key];
    if (typeof v === 'string') v = v.trim();
    const empty = v === undefined || v === null || v === '';
    if (empty) {
      if (rule.required) errors[key] = rule.type === 'tags' ? `Add at least one entry for ${label.toLowerCase()}` : `${label} is required`;
      else if (rule.default !== undefined) out[key] = rule.default;
      continue;
    }
    switch (rule.type) {
      case 'string':
        if (typeof v !== 'string') { errors[key] = `${label} must be text`; continue; }
        if (rule.min && v.length < rule.min) { errors[key] = `${label} must be at least ${rule.min} characters`; continue; }
        if (rule.max && v.length > rule.max) { errors[key] = `${label} must be at most ${rule.max} characters`; continue; }
        if (rule.pattern && !rule.pattern.test(v)) { errors[key] = rule.message || `${label} is invalid`; continue; }
        break;
      case 'int': {
        const n = Number(v);
        if (!Number.isInteger(n)) { errors[key] = `${label} must be a whole number`; continue; }
        if (rule.min !== undefined && n < rule.min) { errors[key] = `${label} must be ≥ ${rule.min}`; continue; }
        if (rule.max !== undefined && n > rule.max) { errors[key] = `${label} must be ≤ ${rule.max}`; continue; }
        v = n;
        break;
      }
      case 'bool':
        v = v === true || v === 'true' || v === 1 || v === '1';
        break;
      case 'tags': {
        const arr = Array.isArray(v) ? v : String(v).split(',');
        v = [...new Set(arr.map((t) => String(t).trim()).filter(Boolean))].slice(0, rule.maxItems || 12);
        if (v.some((t) => t.length > 40)) { errors[key] = `Each ${label} item must be ≤ 40 characters`; continue; }
        if (rule.required && v.length === 0) { errors[key] = `${label} is required`; continue; }
        break;
      }
      default:
        break;
    }
    if (rule.oneOf && !rule.oneOf.includes(v)) { errors[key] = `${label} must be one of: ${rule.oneOf.join(', ')}`; continue; }
    out[key] = v;
  }
  if (Object.keys(errors).length) throw badRequest('Please fix the highlighted fields', errors);
  return out;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function intParam(v, what = 'id') {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw badRequest(`Invalid ${what}`);
  return n;
}
