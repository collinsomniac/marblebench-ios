import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const html = readFileSync(new URL('../site/diagnostics/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
assert.equal(scripts.length, 1, 'Diagnostic must remain self-contained with exactly one inline script');
new Script(scripts[0], { filename: 'site/diagnostics/index.html:inline.js' });
for (const id of ['idle', 'canvas', 'webgl', 'fps', 'p50', 'p95', 'misses', 'graph', 'env', 'copy', 'reset', 'status']) {
  assert.match(html, new RegExp(`id="${id}"`), `Missing diagnostic control ${id}`);
}
assert.match(scripts[0], /requestAnimationFrame\s*\(/);
assert.match(scripts[0], /document\.hidden/);
assert.match(scripts[0], /webgl2/);
assert.doesNotMatch(scripts[0], /\b(?:XMLHttpRequest|sendBeacon)\s*\(|\bfetch\s*\(/, 'Diagnostic must not send telemetry');
console.log('PASS diagnostic embedded JavaScript syntax, control IDs, and no telemetry calls');
