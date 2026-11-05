// Builds the extension into dist/: compiles src/*.ts with tsc and copies everything else (HTML, CSS,
// manifest, icons) as is. Load dist/ unpacked in Chrome.
//   node build.ts           one build
//   node build.ts --watch   rebuild on every change (reload the extension in chrome://extensions after)
import { spawn } from 'node:child_process';
import { cpSync, rmSync, watch } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const dist = join(root, 'dist');
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const watching = process.argv.includes('--watch');

const copyStatic = () => cpSync(src, dist, { recursive: true, filter: (from) => !from.endsWith('.ts') });

rmSync(dist, { recursive: true, force: true });
copyStatic();

const args = [tsc, '-p', join(root, 'tsconfig.build.json'), ...(watching ? ['--watch', '--preserveWatchOutput'] : [])];
const child = spawn(process.execPath, args, { stdio: 'inherit' });

if (watching) {
  watch(src, { recursive: true }, (_event, file) => {
    if (file && !file.endsWith('.ts')) copyStatic();
  });
} else {
  child.on('exit', (code) => {
    if (code === 0) console.log('Built extension into dist/. Load that folder unpacked in Chrome.');
    process.exit(code ?? 1);
  });
}
