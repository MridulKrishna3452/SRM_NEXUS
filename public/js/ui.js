// ---------- Escaping ----------
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => (v === null || v === undefined ? '' : String(v).replace(/[&<>"']/g, (c) => ESC[c]));

// ---------- Icons (inline SVG, stroke = currentColor) ----------
const svg = (d, size = 18, extra = '') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const P = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>',
  path: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M9 6h6a3 3 0 013 3v6M6 9v6a3 3 0 003 3h6"/>',
  user: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  bell: '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  chevR: '<path d="M9 18l6-6-6-6"/>',
  chevL: '<path d="M15 18l-6-6 6-6"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  message: '<path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>',
  star: '<polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  arrowR: '<path d="M5 12h14M13 5l7 7-7 7"/>',
  refresh: '<path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>',
};
export const icon = (name, size) => svg(P[name] || P.spark, size);
export const brandMark = (size = 17) => `<span class="brand-mark"><svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="2.6" fill="#fff"/><circle cx="18" cy="6" r="2.6" fill="#fff"/><circle cx="12" cy="18" r="2.6" fill="#fff"/><path d="M8.2 7.2L11 16M15.8 7.2L13 16M8.6 6H15.4" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></svg></span>`;

// ---------- Formatting ----------
export const initials = (name = '') => name.replace(/^Dr\.?\s+/i, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export function avatar(name, hue = '#2F63E8', size = '') {
  return `<span class="avatar ${size}" style="background:${esc(hue)}" aria-hidden="true">${esc(initials(name))}</span>`;
}

export function fmtDate(iso, withTime = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  const opts = { day: 'numeric', month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined };
  if (withTime) Object.assign(opts, { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleString('en-IN', opts);
}

export function relTime(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(iso);
}

export const daysUntil = (dateStr) => Math.ceil((new Date(dateStr + 'T23:59:59') - Date.now()) / 864e5);

export const statusPill = (status, label) => `<span class="status status-${esc(status)}">${esc(label || STATUS_LABEL[status] || status)}</span>`;
export const STATUS_LABEL = { submitted: 'Submitted', in_review: 'In Review', in_progress: 'In Progress', resolved: 'Resolved', declined: 'Declined', cancelled: 'Cancelled' };
export const FLOW = ['submitted', 'in_review', 'in_progress', 'resolved'];

export function miniSteps(status) {
  const idx = FLOW.indexOf(status);
  const halted = status === 'declined' || status === 'cancelled';
  const on = halted ? 1 : idx + 1;
  return `<span class="mini-steps ${status === 'resolved' ? 'resolved' : ''} ${halted ? 'halted' : ''}" aria-hidden="true">${FLOW.map((_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</span>`;
}

export const kindBadge = (kind) => `<span class="badge badge-${esc(kind)}">${esc(kind)}</span>`;
export const ring = (score, size = '') => `<div class="ring ${size}" style="--p:${Number(score) || 0}" role="img" aria-label="Match score ${Number(score)}%"><span>${Number(score)}%</span></div>`;

export function capacity(m) {
  const pct = m.weekly_capacity ? Math.min(100, Math.round((m.openLoad / m.weekly_capacity) * 100)) : 100;
  const full = m.openLoad >= m.weekly_capacity;
  return `<span class="row" style="gap:8px" title="${m.openLoad} active of ${m.weekly_capacity} weekly slots"><span class="cap-bar ${full ? 'full' : ''}"><i style="width:${pct}%"></i></span>${full ? 'Full this week' : `${m.weekly_capacity - m.openLoad} slot${m.weekly_capacity - m.openLoad === 1 ? '' : 's'} free`}</span>`;
}

// ---------- States ----------
export const loadingState = (msg = 'Loading…') => `<div class="loading"><span class="spinner dark"></span>${esc(msg)}</div>`;
export const emptyState = (title, text, action = '', ic = 'inbox') => `<div class="empty"><div class="ic">${icon(ic, 24)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
export const errorState = (err, retry = true) => `<div class="error-box" role="alert">${icon('alert', 22)}<div><strong>Couldn’t load this.</strong><div>${esc(err?.message || err)}</div></div>${retry ? '<button class="btn btn-secondary btn-sm" data-action="retry" style="margin-left:auto">Try again</button>' : ''}</div>`;

// ---------- Toasts ----------
export function toast(msg, type = 'success') {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(type === 'error' ? 'alert' : 'check', 18)}<span>${esc(msg)}</span>`;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 3200);
  setTimeout(() => el.remove(), 3600);
}

// ---------- Modal ----------
export function modal({ title, body, submitLabel = 'Save', onSubmit, wide = false }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" style="${wide ? 'max-width:720px' : ''}">
    <form novalidate>
      <div class="modal-head"><h2 id="modal-title">${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="modal-body"><div class="form-error" hidden></div>${body}</div>
      <div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="submit" class="btn btn-primary">${esc(submitLabel)}</button></div>
    </form></div>`;
  const prevFocus = document.activeElement;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); prevFocus?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  const form = wrap.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    await withBusy(btn, async () => {
      try {
        clearErrors(form);
        await onSubmit(formValues(form), form);
        close();
      } catch (err) { showErrors(form, err); }
    });
  });
  document.body.appendChild(wrap);
  (wrap.querySelector('input,select,textarea') || wrap.querySelector('button'))?.focus();
  return { close, el: wrap };
}

// ---------- Forms ----------
export function field({ name, label, type = 'text', value = '', required = false, hint = '', placeholder = '', options = null, rows = 4, attrs = '' }) {
  const id = `f-${name}-${Math.random().toString(36).slice(2, 7)}`;
  let control;
  if (options) {
    control = `<select class="input" id="${id}" name="${esc(name)}" ${required ? 'required' : ''} ${attrs}>${options.map((o) => {
      const [v, l] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
    }).join('')}</select>`;
  } else if (type === 'textarea') {
    control = `<textarea class="input" id="${id}" name="${esc(name)}" rows="${rows}" placeholder="${esc(placeholder)}" ${required ? 'required' : ''} ${attrs}>${esc(value)}</textarea>`;
  } else {
    control = `<input class="input" id="${id}" name="${esc(name)}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${required ? 'required' : ''} ${attrs}>`;
  }
  return `<div class="field" data-field="${esc(name)}"><label for="${id}">${esc(label)}${required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>${control}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}<span class="err" id="${id}-err" aria-live="polite"></span></div>`;
}

export function formValues(form) {
  const out = {};
  new FormData(form).forEach((v, k) => { out[k] = typeof v === 'string' ? v.trim() : v; });
  form.querySelectorAll('input[type=checkbox][name]').forEach((c) => { if (!c.closest('.choice-group')) out[c.name] = c.checked; });
  return out;
}

export function clearErrors(form) {
  form.querySelectorAll('.field.invalid').forEach((f) => { f.classList.remove('invalid'); f.querySelector('.input')?.removeAttribute('aria-invalid'); });
  const fe = form.querySelector('.form-error');
  if (fe) { fe.hidden = true; fe.textContent = ''; }
}

export function showErrors(form, err) {
  const details = err?.details || {};
  let first = null;
  for (const [name, msg] of Object.entries(details)) {
    const f = form.querySelector(`[data-field="${CSS.escape(name)}"]`);
    if (!f) continue;
    f.classList.add('invalid');
    const input = f.querySelector('.input');
    input?.setAttribute('aria-invalid', 'true');
    const e = f.querySelector('.err');
    if (e) e.textContent = msg;
    first = first || input;
  }
  const fe = form.querySelector('.form-error');
  const unmatched = Object.keys(details).some((k) => !form.querySelector(`[data-field="${CSS.escape(k)}"]`));
  if (fe && (!first || unmatched)) { fe.hidden = false; fe.textContent = unmatched ? Object.values(details).join(' · ') : (err?.message || 'Something went wrong'); }
  else if (!fe && !first) toast(err?.message || 'Something went wrong', 'error');
  first?.focus();
}

export async function withBusy(btn, fn) {
  if (!btn) return fn();
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner ${btn.classList.contains('btn-primary') || btn.classList.contains('btn-success') ? '' : 'dark'}"></span>${btn.textContent.trim() ? ' Working…' : ''}`;
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = html; }
}

export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/** Delegate clicks on [data-action] inside root to handlers map. */
export function onActions(root, handlers) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    const fn = handlers[el.dataset.action];
    if (fn) { e.preventDefault(); e.stopPropagation(); fn(el, e); }
  });
}
