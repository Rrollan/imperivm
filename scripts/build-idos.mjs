import {build} from 'vite';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.IDOS_ASSET_BASE || './';
if (base !== './' && base !== 'http://127.0.0.1:3113/' && !/^https:\/\/static\.idos\.games\/drive\/app\/SI4IPS8B\/v\/[a-z0-9]+\/$/.test(base)) throw new Error('Expected the SI4IPS8B asset base returned by begin_build_upload.');
// An optional existing iDos version can supply unchanged public artwork.
// Code chunks still belong to this build. Keep that artwork version in storage.
// The Title origin mirrors /v/<build>/ files; images use that route so canvas
// artwork works in both PROD and DEV, without depending on CDN CORS caching.
const version = base.match(/^https:\/\/static\.idos\.games\/drive\/app\/SI4IPS8B\/v\/(bld[a-z0-9]+)\/$/)?.[1];
const ownPublicBase = version ? `/v/${version}/` : base;
const publicBase = process.env.IDOS_PUBLIC_ASSET_BASE || ownPublicBase;
const reuseAssets = publicBase !== ownPublicBase && publicBase !== base;
if (reuseAssets && !/^https:\/\/static\.idos\.games\/drive\/app\/SI4IPS8B\/v\/[a-z0-9]+\/$/.test(publicBase) && !/^\/v\/bld[a-z0-9]+\/$/.test(publicBase)) throw new Error('Shared artwork must belong to an existing SI4IPS8B build on the iDos CDN or this Title origin.');
// CSS URLs resolve against the stylesheet's CDN origin, not the HTML origin.
const cssPublicBase = publicBase.startsWith('/v/') ? `https://static.idos.games/drive/app/SI4IPS8B${publicBase}` : publicBase;
function publicPrefix(css = false) { const value = css ? cssPublicBase : publicBase; return value === './' && css ? '../' : value; }
const outDir = path.join(root, 'dist', 'idos');
const publicValues = {
  NEXT_PUBLIC_IDOS_TITLE_ID: 'SI4IPS8B', NEXT_PUBLIC_IDOS_SOLANA_NETWORK_ID: 'solana',
  NEXT_PUBLIC_IDOS_CURRENCY_ID: 'Main', NEXT_PUBLIC_IDOS_CURRENCY_TYPE: 'CryptoCurrency',
  NEXT_PUBLIC_IDOS_RULER_CASE_ENABLED: 'true', NEXT_PUBLIC_IDOS_COMMERCE_ENABLED: 'false',
  NEXT_PUBLIC_IDOS_STATIC_BUILD: 'true', NEXT_PUBLIC_WS_URL: 'wss://imperivm-ws.onrender.com',
};
// Only public config enters this bundle. Never copy .env files, keys or sessions.
const references = new Set();
for (const dir of ['app', 'components', 'lib']) {
  const files = execFileSync('rg', ['--files', dir], {cwd: root, encoding: 'utf8'}).trim().split('\n');
  for (const file of files.filter(file => /\.[cm]?[jt]sx?$/.test(file))) {
    for (const match of readFileSync(path.join(root, file), 'utf8').matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)) references.add(match[1]);
  }
}
const define = Object.fromEntries([...references].map(key => [`process.env.${key}`, key in publicValues ? JSON.stringify(publicValues[key]) : 'undefined']));
const roots = execFileSync('git', ['ls-files', 'public'], {cwd: root, encoding: 'utf8'}).trim().split('\n');
const directories = [...new Set(roots.map(file => file.split('/')[1]))].filter(dir => !dir.includes('.'));
const pattern = new RegExp(`([\x22\x27\x60(])/(?:${directories.join('|')})/`, 'g');
function publicUrls(source, css = false) {const prefix = publicPrefix(css); return source.replace(pattern, match => `${match[0]}${prefix}${match.slice(2)}`);}
await build({
  root: path.join(root, 'platform/idos'), base, publicDir: false,
  define: {...define, global: 'globalThis'}, esbuild: {jsx: 'automatic'},
  resolve: {alias: {'node-fetch': path.join(root, 'platform/idos/fetch.ts'), 'next/link': path.join(root, 'platform/idos/navigation.tsx'), 'next/navigation': path.join(root, 'platform/idos/navigation.tsx'), 'next/dynamic': path.join(root, 'platform/idos/dynamic.tsx')}},
  plugins: [{name: 'imperivm-public-assets', enforce: 'pre', transform(source, id) {
    if (id.startsWith(root) && !id.includes('/node_modules/') && /\.(tsx?|css)$/.test(id)) return {code: publicUrls(source, id.endsWith('.css')), map: null};
  }}],
  build: {outDir, emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 1600},
});
// Copy the artwork actually referenced by the built client, including every
// variant of template paths (cards/${id}, hero portraits, effect atlases).
// Source renders and unused legacy models stay in the repository, not in ZIP.
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const referencesInBundle = new Set();
for (const file of readdirSync(path.join(outDir, 'assets')).filter(file => /\.(js|css)$/.test(file))) {
  const prefix = publicPrefix(file.endsWith('.css'));
  const matcher = new RegExp(escape(prefix)+`(?:${directories.join('|')})/`, 'g');
  const source = readFileSync(path.join(outDir, 'assets', file), 'utf8');
  for (const match of source.matchAll(matcher)) {
    const start = match.index+prefix.length;
    let end = start, depth = 0;
    while (end < source.length) {
      const char = source[end];
      if (depth) {if (char === '{') depth++; if (char === '}') depth--; end++; continue;}
      if (char === '$' && source[end+1] === '{') {depth = 1; end += 2; continue;}
      if (/[\x22\x27\x60\s<>]/.test(char) || (file.endsWith('.css') && char === ')')) break;
      end++;
    }
    referencesInBundle.add(source.slice(start, end));
  }
}
const selectedAssets = new Set();
for (const reference of referencesInBundle) {
  const matcher = new RegExp('^'+reference.split(/\$\{[^}]+\}/).map(escape).join('[^/]+')+'$');
  const files = roots.filter(file => matcher.test(file.slice('public/'.length)));
  if (!files.length) throw new Error(`Unresolved public asset in static bundle: ${reference}`);
  files.forEach(file => selectedAssets.add(file));
}
// Include only versioned artwork, never user-supplied unfinished Flow directories.
for (const file of selectedAssets) {
  if (!existsSync(path.join(root, file)) || /\.(zip|txt|md|html|blend|psd)$/i.test(file)) throw new Error(`Unsupported public asset: ${file}`);
  if (!reuseAssets) {
    const destination = path.join(outDir, file.slice('public/'.length));
    mkdirSync(path.dirname(destination), {recursive: true}); copyFileSync(path.join(root, file), destination);
  }
}
writeFileSync(path.join(outDir, 'models-availability.json'), JSON.stringify({}));
console.log(`Static iDos game ready: ${outDir} (${selectedAssets.size} referenced public assets${reuseAssets ? ` reused from ${publicBase}` : ''}; Title SI4IPS8B, paid actions validate the token binding).`);
