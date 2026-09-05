import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
const failures = [];
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') return [];
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory() ? walk(path) : [path];
  });
}
let count = 0;
for (const file of walk('.').filter(path => extname(path) === '.html')) {
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    const url = match[1];
    if (/^(?:[a-z]+:|\/\/)/i.test(url)) continue;
    const [path, fragment] = url.split('#');
    let target = resolve(dirname(file), decodeURIComponent(path.split('?')[0]) || '.');
    if (!path) target = resolve(file);
    if (existsSync(target) && statSync(target).isDirectory()) target = resolve(target, 'index.html');
    count++;
    if (!existsSync(target)) failures.push(`${file}: missing ${url}`);
    else if (fragment && extname(target) === '.html' && !readFileSync(target, 'utf8').includes(`id="${fragment}"`)) failures.push(`${file}: missing anchor ${url}`);
  }
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`Checked ${count} local links and assets; no missing targets.`);
