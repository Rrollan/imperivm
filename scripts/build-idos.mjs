import {build} from 'vite';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.IDOS_ASSET_BASE || './';
if (base !== './' && base !== 'http://127.0.0.1:3113/' && !/^https:\/\/static\.idos\.games\/drive\/app\/SI4IPS8B\/v\/[a-z0-9]+\/$/.test(base)) throw new Error('Expected the SI4IPS8B asset base returned by begin_build_upload.');
// An optional existing iDos version can supply unchanged public artwork.
// Changed code belongs to this build; exact-hash reuse is optional below.
// Keep the versions supplying shared artwork and code in storage.
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
const sharedManifest = reuseAssets ? JSON.parse(readFileSync(process.env.IDOS_SHARED_ASSET_MANIFEST || path.join(root,'platform/idos/shared-assets.v4.json'),'utf8')) : null;
if (sharedManifest && !publicBase.endsWith(`/v/${sharedManifest.buildId}/`)) throw new Error('Shared artwork manifest must match IDOS_PUBLIC_ASSET_BASE.');
const hash = file => createHash('sha256').update(readFileSync(path.join(root,file))).digest('hex');
const ownPrefix = css => css ? base === './' ? '../' : base : ownPublicBase;
const outDir = path.join(root, 'dist', 'idos');
const publicValues = {
  NEXT_PUBLIC_IDOS_TITLE_ID: 'SI4IPS8B', NEXT_PUBLIC_IDOS_SOLANA_NETWORK_ID: 'solana',
  NEXT_PUBLIC_IDOS_CURRENCY_ID: 'Main', NEXT_PUBLIC_IDOS_CURRENCY_TYPE: 'CryptoCurrency',
  NEXT_PUBLIC_IDOS_RULER_CASE_ENABLED: 'true', NEXT_PUBLIC_IDOS_COMMERCE_ENABLED: 'false',
  NEXT_PUBLIC_IDOS_STATIC_BUILD: 'true', NEXT_PUBLIC_WS_URL: 'wss://imperivm-ws.onrender.com',
  NEXT_PUBLIC_PLAY_PROOF_ENABLED: 'false',
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
const selectedAssets = new Set(), copiedAssets = new Set();
for (const file of readdirSync(path.join(outDir, 'assets')).filter(file => /\.(js|css)$/.test(file))) {
  const prefix = publicPrefix(file.endsWith('.css'));
  const matcher = new RegExp(escape(prefix)+`(?:${directories.join('|')})/`, 'g');
  const source = readFileSync(path.join(outDir, 'assets', file), 'utf8'), replacements = new Map();
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
    const reference=source.slice(start,end);
    const pathMatcher = new RegExp('^'+reference.split(/\$\{[^}]+\}/).map(escape).join('[^/]+')+'$');
    const files = roots.filter(file => pathMatcher.test(file.slice('public/'.length)));
    if (!files.length) throw new Error(`Unresolved public asset in static bundle: ${reference}`);
    files.forEach(file => selectedAssets.add(file));
    // Share a dynamic path only when EVERY possible file is present and unchanged.
    // New/changed groups are packaged with this version and use its own origin.
    const shared = sharedManifest && files.every(file => sharedManifest.assets[file.slice('public/'.length)] === hash(file));
    if (!shared) {
      files.forEach(file => copiedAssets.add(file));
      if (reuseAssets) replacements.set(prefix+reference,ownPrefix(file.endsWith('.css'))+reference);
    }
  }
  let output = source;
  for (const [from,to] of replacements) output = output.split(from).join(to);
  if (output !== source) writeFileSync(path.join(outDir,'assets',file),output);
}
// Include only versioned artwork, never user-supplied unfinished Flow directories.
const cardAssets=JSON.parse(execFileSync(process.execPath,['--import','tsx',path.join(root,'scripts/idos-card-assets.ts')],{cwd:root,encoding:'utf8'}));
for (const asset of cardAssets) if (!selectedAssets.has(`public${asset}`)) throw new Error(`Card artwork omitted from iDos build: ${asset}`);
for (const file of selectedAssets) {
  if (!existsSync(path.join(root, file)) || /\.(zip|txt|md|html|blend|psd)$/i.test(file)) throw new Error(`Unsupported public asset: ${file}`);
  if (copiedAssets.has(file)) {
    const destination = path.join(outDir, file.slice('public/'.length));
    mkdirSync(path.dirname(destination), {recursive: true}); copyFileSync(path.join(root, file), destination);
  }
}
// Optional exact-hash reuse of independent, unchanged generated code/CSS.
// Keep this version too; changed chunks always stay in the new ZIP.
const codeManifestPath=process.env.IDOS_SHARED_CODE_MANIFEST;
let sharedCode=[];
if(codeManifestPath){
  if(!version && base !== './')throw new Error('Code reuse requires an iDos upload AssetBase or a relative build.');
  const manifest=JSON.parse(readFileSync(path.resolve(root,codeManifestPath),'utf8'));
  if(!/^bld[a-z0-9]+$/.test(manifest.buildId))throw new Error('Invalid shared code version.');
  sharedCode=readdirSync(path.join(outDir,'assets')).filter(name=>{
    const digest=createHash('sha256').update(readFileSync(path.join(outDir,'assets',name))).digest('hex');
    return manifest.assets[`assets/${name}`]===digest;
  });
  const sharedBase=`https://static.idos.games/drive/app/SI4IPS8B/v/${manifest.buildId}/`;
  for(const file of ['index.html',...readdirSync(path.join(outDir,'assets')).filter(name=>/\.(js|css)$/.test(name)).map(name=>`assets/${name}`)]){
    let source=readFileSync(path.join(outDir,file),'utf8');
    for(const name of sharedCode){
      // Module imports resolve against their chunk; preload lists against base.
      source=source.split(`"./${name}"`).join(JSON.stringify(`${sharedBase}assets/${name}`));
      source=source.split(`"assets/${name}"`).join(JSON.stringify(`../${manifest.buildId}/assets/${name}`));
      source=source.split(`${base}assets/${name}`).join(`${sharedBase}assets/${name}`);
    }
    writeFileSync(path.join(outDir,file),source);
  }
  for(const name of sharedCode)rmSync(path.join(outDir,'assets',name));
  console.log(`Reused ${sharedCode.length} exact-hash code/CSS assets from ${manifest.buildId}.`);
}
writeFileSync(path.join(outDir, 'models-availability.json'), JSON.stringify({}));
writeFileSync(path.join(root,'dist/idos-assets-report.json'),JSON.stringify({base,sharedBase:reuseAssets?publicBase:null,assets:[...selectedAssets].sort().map(file=>({path:file.slice('public/'.length),packaged:copiedAssets.has(file),sha256:hash(file)}))},null,2));
console.log(`Static iDos game ready: ${outDir} (${selectedAssets.size} referenced public assets; ${copiedAssets.size} packaged${reuseAssets ? `, ${selectedAssets.size-copiedAssets.size} verified unchanged in ${publicBase}` : ''}; Title SI4IPS8B, paid actions validate the token binding).`);
