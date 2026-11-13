// Builds the extension and packs it for the Chrome Web Store:
//   npm run package -- https://api.example.com
// (or DEBRIEF_SERVER=https://api.example.com npm run package). Writes release/debrief-<version>.zip.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { forStore, packageName, serverOrigin } from './release.ts';
import { zip, unzip } from './zip.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

try {
  const origin = serverOrigin(process.argv[2] || process.env.DEBRIEF_SERVER);
  const build = spawnSync(process.execPath, [join(root, 'build.ts')], { stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);

  const files = new Map<string, Buffer>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.set(relative(dist, path).split(sep).join('/'), readFileSync(path));
    }
  };
  walk(dist);

  const packed = forStore(files, origin);
  const archive = zip(packed);
  if (unzip(archive).size !== packed.size) throw new Error('The ZIP didn’t read back: nothing written');
  mkdirSync(join(root, 'release'), { recursive: true });
  const out = join(root, 'release', packageName(packed));
  writeFileSync(out, archive);
  console.log(`Packed ${packed.size} files for ${origin} into ${relative(root, out)} (${Math.round(archive.length / 1024)} KB).`);
  console.log('Upload it at https://chrome.google.com/webstore/devconsole. Listing text: docs/store-listing.md.');
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
