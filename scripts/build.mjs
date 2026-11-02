import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'src');
const output = resolve(root, 'public');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of ['index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'sw.js', '_headers', '_routes.json', 'data', 'icons']) {
  await cp(resolve(source, entry), resolve(output, entry), { recursive: true });
}
console.log(`Built static Pages output in ${output}`);
