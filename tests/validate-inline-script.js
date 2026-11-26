import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi)]
  .filter(([, attrs, body]) => !/\\bsrc\\s*=/.test(attrs) && body.trim());
if (!scripts.length) throw new Error('No inline JavaScript scripts found in index.html');
for (const [index, [, , source]] of scripts.entries()) {
  new vm.Script(source, { filename: `index.html:inline-script-${index + 1}` });
}
console.log(`Validated syntax of ${scripts.length} inline script(s) in index.html`);
