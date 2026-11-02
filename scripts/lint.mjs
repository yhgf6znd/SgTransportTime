import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const roots = ['src', 'functions', 'scripts', 'tests'];
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (path.endsWith('.js') || path.endsWith('.mjs')) files.push(path);
  }
}
for (const root of roots) await walk(root);
for (const file of files) await run(process.execPath, ['--check', file]);
console.log(`Syntax checked ${files.length} JavaScript files`);
