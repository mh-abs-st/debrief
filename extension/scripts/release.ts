// Turns a development build (dist/) into what goes to the Chrome Web Store: the production server in place of
// localhost, nothing development-only left. Pure, so the tests can run it on made-up files.

export const DEV_SERVER = 'http://localhost:8789';

// The production server's origin: https, no path. Throws a plain message otherwise.
export function serverOrigin(value: string | undefined): string {
  if (!value) throw new Error('Give the production server address: npm run package -- https://api.example.com');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Not a web address: ${value}`);
  }
  if (url.protocol !== 'https:') throw new Error('The production server must use https://');
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') throw new Error('The production server can’t be localhost');
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('Give only the server’s origin, like https://api.example.com (no path)');
  return url.origin;
}

const SKIP = [/(^|\/)\.DS_Store$/, /\.map$/, /\.ts$/];
const TEXT = /\.(js|html|css|json|svg|txt)$/;

export function forStore(files: Map<string, Buffer>, server: string): Map<string, Buffer> {
  const origin = serverOrigin(server);
  const out = new Map<string, Buffer>();
  for (const [name, data] of files) {
    if (SKIP.some((re) => re.test(name))) continue;
    out.set(name, data);
  }

  // The manifest: our server instead of localhost in host_permissions.
  const manifestFile = out.get('manifest.json');
  if (!manifestFile) throw new Error('manifest.json is missing: run the build first');
  const manifest = JSON.parse(manifestFile.toString('utf8')) as { host_permissions?: string[]; version?: string };
  const hosts = manifest.host_permissions || [];
  if (!hosts.includes(`${DEV_SERVER}/*`)) throw new Error(`manifest.json has no ${DEV_SERVER}/* to replace`);
  manifest.host_permissions = hosts.map((h) => (h === `${DEV_SERVER}/*` ? `${origin}/*` : h));
  out.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));

  // The default server address in Settings, and the placeholder that shows it.
  const swap = (name: string, atLeast: number) => {
    const text = out.get(name)?.toString('utf8');
    if (text === undefined) throw new Error(`${name} is missing: run the build first`);
    const count = text.split(DEV_SERVER).length - 1;
    if (count < atLeast) throw new Error(`${name} doesn’t mention ${DEV_SERVER}: has the default server moved?`);
    out.set(name, Buffer.from(text.split(DEV_SERVER).join(origin)));
  };
  swap('data.js', 1);
  swap('panel.html', 1);

  // Nothing pointing at a development server may be left.
  const left = [...out].filter(([name, data]) => TEXT.test(name) && /localhost:\d|127\.0\.0\.1/.test(data.toString('utf8'))).map(([name]) => name);
  if (left.length) throw new Error(`Development addresses left in: ${left.join(', ')}`);
  return out;
}

export const packageName = (files: Map<string, Buffer>): string => {
  const manifest = JSON.parse(files.get('manifest.json')!.toString('utf8')) as { version: string };
  return `debrief-${manifest.version}.zip`;
};
