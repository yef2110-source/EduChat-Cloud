import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(([, attrs, body]) => !/\bsrc\s*=/.test(attrs) && body.trim());
if (!scripts.length) throw new Error('No inline JavaScript scripts found in index.html');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'educhat-inline-js-'));
try {
  for (const [index, [, , source]] of scripts.entries()) {
    const file = path.join(tempDir, 'inline-' + (index + 1) + '.mjs');
    fs.writeFileSync(file, source, 'utf8');
    execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  }
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
console.log('Validated syntax of ' + scripts.length + ' inline script(s) in index.html');
