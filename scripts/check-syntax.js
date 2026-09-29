// Syntax-checks every server and browser JS module (node --check), no extra deps.
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const roots = ['server', 'public/js', 'scripts', 'test'];
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => {
  const p = path.join(d, f);
  if (statSync(p).isDirectory()) { if (f !== '.tmp') walk(p); } else if (p.endsWith('.js')) files.push(p);
});
roots.forEach(walk);
let failed = 0;
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { failed++; console.error(`✗ ${f}\n${e.stderr}`); }
}
console.log(failed ? `${failed} file(s) failed syntax check` : `✓ ${files.length} files passed syntax check`);
process.exit(failed ? 1 : 0);
