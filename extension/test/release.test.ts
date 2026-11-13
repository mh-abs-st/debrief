import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zip, unzip } from '../scripts/zip.ts';
import { forStore, serverOrigin, packageName, DEV_SERVER } from '../scripts/release.ts';

const text = (s: string) => Buffer.from(s, 'utf8');

function devBuild() {
  return new Map<string, Buffer>([
    ['manifest.json', text(JSON.stringify({ version: '0.2.0', host_permissions: [`${DEV_SERVER}/*`, 'https://api.deepgram.com/*'] }))],
    ['data.js', text(`const DEFAULT = { serverUrl: '${DEV_SERVER}' };`)],
    ['panel.html', text(`<input placeholder="${DEV_SERVER}">`)],
    ['settings-view.js', text("toast('should start with https:// (or http://localhost).')")],
    ['icons/icon-16.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])],
    ['ui.ts', text('source')],
    ['.DS_Store', text('x')],
  ]);
}

test('zip and unzip round-trip, and the same files give the same bytes', () => {
  const files = new Map([
    ['b.txt', text('hello '.repeat(200))], // compressed
    ['a/tiny.bin', Buffer.from([1, 2, 3])], // stored
    ['ünïcode.json', text('{"ok":true}')],
    ['empty.txt', Buffer.alloc(0)],
  ]);
  const archive = zip(files);
  assert.deepEqual(unzip(archive), files);
  assert.deepEqual(zip(new Map([...files].reverse())), archive);
  assert.ok(archive.length < 600);
});

test('unzip refuses damaged files', () => {
  assert.throws(() => unzip(text('not a zip')), /Not a ZIP/);
  const archive = zip(new Map([['a.txt', text('hello world, hello world')]]));
  const broken = Buffer.from(archive);
  broken[40] ^= 0xff; // inside the data
  assert.throws(() => unzip(broken));
});

test('the server address must be an https origin', () => {
  assert.equal(serverOrigin('https://api.debrief.app'), 'https://api.debrief.app');
  assert.equal(serverOrigin('https://api.debrief.app/'), 'https://api.debrief.app');
  for (const bad of [undefined, '', 'api.debrief.app', 'http://api.debrief.app', 'https://localhost', 'https://api.debrief.app/v1']) {
    assert.throws(() => serverOrigin(bad));
  }
});

test('the store package uses the production server and leaves out development files', () => {
  const out = forStore(devBuild(), 'https://api.debrief.app');
  const manifest = JSON.parse(out.get('manifest.json')!.toString());
  assert.deepEqual(manifest.host_permissions, ['https://api.debrief.app/*', 'https://api.deepgram.com/*']);
  assert.equal(out.get('data.js')!.toString(), "const DEFAULT = { serverUrl: 'https://api.debrief.app' };");
  assert.equal(out.get('panel.html')!.toString(), '<input placeholder="https://api.debrief.app">');
  assert.deepEqual([...out.keys()].sort(), ['data.js', 'icons/icon-16.png', 'manifest.json', 'panel.html', 'settings-view.js']);
  assert.equal(packageName(out), 'debrief-0.2.0.zip');
});

test('packaging refuses when a development address would be left', () => {
  const files = devBuild();
  files.set('api.js', text("fetch('http://localhost:3000/x')"));
  assert.throws(() => forStore(files, 'https://api.debrief.app'), /Development addresses left in: api\.js/);
  const noDefault = devBuild();
  noDefault.set('data.js', text("const DEFAULT = { serverUrl: '' };"));
  assert.throws(() => forStore(noDefault, 'https://api.debrief.app'), /data\.js doesn’t mention/);
});
