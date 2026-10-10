import {createServer} from 'node:http';
import {WebSocketServer, WebSocket} from 'ws';
import {RoomAuthority} from './rooms';
import {parseMessage, ProtocolError} from './validation';
import {authorizeCollectionDeck} from '../../lib/collection/authority';
import type {PlayerRegistration} from '../../lib/net/protocol';
import {createImpBalanceReader, type ImpBalance} from './impBalance';
import {validSolanaAddress} from '../../lib/solana/tokenBalance';
import {createWalletRpcRelay, parseWalletRpc, type WalletRpcRequest} from './walletRpc';
import {impPvpReadiness} from './impPvpReadiness';
import {createCardMarketPriceReader} from './cardMarketPrices';
import {parseCollectionAuth} from '../../lib/collection/access';

export interface ServiceOptions {
  port?: number; host?: string; origins?: string[]; clock?: () => number;
  tickIntervalMs?: number; log?: (line: string) => void;
  maxMessagesPerWindow?: number;
  authorizeDeck?: (registration: PlayerRegistration) => Promise<void>;
  readImpBalance?: (owner: string) => Promise<ImpBalance>;
  callWalletRpc?: (request: WalletRpcRequest) => Promise<unknown>;
  cardMarketPrices?: Pick<ReturnType<typeof createCardMarketPriceReader>,'read'|'sync'>;
}
export function startServer(options: ServiceOptions = {}) {
  const origins = new Set(options.origins ?? ['http://localhost:3101', 'http://127.0.0.1:3101', 'http://localhost:3000', 'http://127.0.0.1:3000']);
  const rooms = new RoomAuthority(options.clock, options.log);
  const readImpBalance = options.readImpBalance ?? createImpBalanceReader();
  const callWalletRpc = options.callWalletRpc ?? createWalletRpcRelay();
  const cardPrices=options.cardMarketPrices??createCardMarketPriceReader({path:process.env.IMPERIVM_MARKET_HISTORY_PATH,supabaseUrl:process.env.SUPABASE_URL,supabaseKey:process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY});
  const marketLimits=new Map<string,{start:number;count:number}>();let marketRequests=0;
  const rpcLimits = new Map<string, {start: number; count: number}>();
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'GET' && request.url === '/health') {response.end(JSON.stringify({status: 'ok', rooms: rooms.size, queued: rooms.queued, capabilities: ['random-pvp', 'imp-balance', 'wallet-rpc', 'imp-pvp-readiness','card-market-prices'], paidPvp: impPvpReadiness(), version: process.env.RENDER_GIT_COMMIT?.slice(0, 12) ?? 'local'})); return;}
    if(request.url?.startsWith('/market/prices')) {
      const origin=request.headers.origin;
      if(origin&&!origins.has(origin)||request.method==='POST'&&!origin){response.statusCode=403;response.end(JSON.stringify({error:'Origin not allowed'}));return;}
      if(origin){response.setHeader('Access-Control-Allow-Origin',origin);response.setHeader('Vary','Origin');}
      response.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');response.setHeader('Access-Control-Allow-Headers','Content-Type');
      if(request.url!=='/market/prices'){response.statusCode=400;response.end(JSON.stringify({error:'Unexpected parameters'}));return;}
      if(request.method==='OPTIONS'){response.statusCode=204;response.end();return;}
      if(!['GET','POST'].includes(request.method??'')){response.statusCode=405;response.end(JSON.stringify({error:'GET or POST required'}));return;}
      const now=Date.now(),ip=request.socket.remoteAddress??'unknown';
      for(const [key,value] of marketLimits)if(now-value.start>=60000)marketLimits.delete(key);
      const quota=marketLimits.get(ip)??{start:now,count:0};marketLimits.set(ip,quota);
      if(++quota.count>30||marketLimits.size>1024||marketRequests>=16){response.statusCode=429;response.setHeader('Retry-After','60');response.end(JSON.stringify({error:'Please wait before refreshing market prices'}));return;}
      marketRequests++;
      try {
        if(request.method==='GET'){response.end(JSON.stringify(await cardPrices.read()));return;}
        let size=0;const parts:Buffer[]=[];
        if(Number(request.headers['content-length']??0)>16384){response.statusCode=413;response.end(JSON.stringify({error:'Request too large'}));return;}
        let input:unknown;
        try{for await(const chunk of request){size+=chunk.length;if(size>16384)throw new Error();parts.push(chunk);}input=JSON.parse(Buffer.concat(parts).toString('utf8'));}
        catch{response.statusCode=400;response.end(JSON.stringify({error:'Invalid market history request'}));return;}
        if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['owner','collectionAuth'].includes(k))||typeof (input as any).owner!=='string'||!validSolanaAddress((input as any).owner)||!parseCollectionAuth((input as any).collectionAuth)){response.statusCode=400;response.end(JSON.stringify({error:'Invalid market history request'}));return;}
        response.end(JSON.stringify(await cardPrices.sync((input as any).owner,(input as any).collectionAuth)));
      }catch{response.statusCode=503;response.setHeader('Retry-After','10');response.end(JSON.stringify({error:'Verified market history temporarily unavailable'}));}
      finally{marketRequests--;}
      return;
    }
    if (request.url?.startsWith('/pvp/imp/readiness')) {
      const origin = request.headers.origin;
      if (origin && !origins.has(origin)) {response.statusCode = 403; response.end(JSON.stringify({error: 'Origin not allowed'})); return;}
      if (origin) {response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin');}
      if (request.url !== '/pvp/imp/readiness') {response.statusCode = 400; response.end(JSON.stringify({error: 'Readiness takes no parameters'})); return;}
      if (request.method !== 'GET') {response.statusCode = 405; response.end(JSON.stringify({error: 'GET required'})); return;}
      response.end(JSON.stringify(impPvpReadiness())); return;
    }
    if (request.url === '/wallet/rpc') {
      const origin = request.headers.origin;
      if (!origin || !origins.has(origin)) {response.statusCode = 403; response.end(JSON.stringify({error: 'Origin not allowed'})); return;}
      response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin');
      // web3.js always adds solana-client; browsers preflight both headers before any RPC read.
      response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Solana-Client');
      if (request.method === 'OPTIONS') {response.statusCode = 204; response.end(); return;}
      if (request.method !== 'POST') {response.statusCode = 405; response.end(JSON.stringify({error: 'POST required'})); return;}
      const ip = request.socket.remoteAddress ?? 'unknown', now = Date.now();
      for (const [key, item] of rpcLimits) if (now - item.start >= 60_000) rpcLimits.delete(key);
      const quota = rpcLimits.get(ip) ?? {start: now, count: 0}; rpcLimits.set(ip, quota);
      if (++quota.count > 150 || rpcLimits.size > 1024) {response.statusCode = 429; response.setHeader('Retry-After', '60'); response.end(JSON.stringify({error: 'RPC rate limit'})); return;}
      if (Number(request.headers['content-length'] ?? 0) > 8192) {response.statusCode = 413; response.end(JSON.stringify({error: 'Request too large'})); return;}
      let rpc: WalletRpcRequest;
      try {
        let size = 0; const parts: Buffer[] = [];
        for await (const chunk of request) {size += chunk.length; if (size > 8192) throw new Error('Request too large'); parts.push(chunk);}
        rpc = parseWalletRpc(JSON.parse(Buffer.concat(parts).toString('utf8')));
      } catch {response.statusCode = 400; response.end(JSON.stringify({error: 'Invalid wallet RPC request'})); return;}
      try {response.end(JSON.stringify(await callWalletRpc(rpc)));}
      catch {response.statusCode = 503; response.setHeader('Retry-After', '10'); response.end(JSON.stringify({jsonrpc: '2.0', id: rpc.id, error: {code: -32000, message: 'Wallet RPC temporarily unavailable'}}));}
      return;
    }
    if (request.url?.startsWith('/wallet/imp')) {
      const origin = request.headers.origin;
      if (origin && !origins.has(origin)) {response.statusCode = 403; response.end(JSON.stringify({error: 'Origin not allowed'})); return;}
      if (origin) {response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin');}
      const url = new URL(request.url, 'http://authority.local');
      if (url.pathname !== '/wallet/imp' || request.method !== 'GET') {response.statusCode = 405; response.end(JSON.stringify({error: 'GET required'})); return;}
      const owner = url.searchParams.get('owner');
      if (!owner || !validSolanaAddress(owner) || [...url.searchParams.keys()].some(key => key !== 'owner') || url.searchParams.getAll('owner').length !== 1) {response.statusCode = 400; response.end(JSON.stringify({error: 'Invalid wallet address'})); return;}
      try {response.end(JSON.stringify(await readImpBalance(owner)));}
      catch {response.statusCode = 503; response.setHeader('Retry-After', '10'); response.end(JSON.stringify({error: 'Wallet balance temporarily unavailable'}));}
      return;
    }
    response.statusCode = 404; response.end(JSON.stringify({error: 'Not found'}));
  });
  const wss = new WebSocketServer({noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false});
  server.on('upgrade', (request, socket, head) => {
    const origin = request.headers.origin;
    // No cookies authenticate this service. Browser origins must match exactly;
    // native clients without an Origin still need the same secret to resume.
    if ((origin && !origins.has(origin)) || (request.url !== '/' && request.url !== '/ws')) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
    }
    if (wss.clients.size >= 1000) {socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'); return;}
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
  });
  const alive = new WeakMap<WebSocket, boolean>();
  let checkingCollections = 0;
  wss.on('connection', socket => {
    alive.set(socket, true);
    let windowStart = Date.now(), messages = 0;
    let registrationPending = false;
    let registrationGeneration = 0;
    socket.on('pong', () => alive.set(socket, true));
    socket.on('message', async (data, binary) => {
      try {
        const now = Date.now();
        if (now - windowStart >= 10_000) {windowStart = now; messages = 0;}
        if (++messages > (options.maxMessagesPerWindow ?? 100)) throw new ProtocolError('rate-limit', 'Слишком много сообщений. Подождите несколько секунд.');
        if (binary) throw new ProtocolError('bad-message', 'Ожидается текстовый JSON.');
        const raw = data instanceof ArrayBuffer ? Buffer.from(data).toString('utf8') : Array.isArray(data) ? Buffer.concat(data).toString('utf8') : data.toString('utf8');
        const message = parseMessage(raw);
        if (message.type === 'leave') registrationGeneration++;
        if ((message.type === 'create' || message.type === 'join' || message.type === 'queue') && !(message.type === 'join' && message.resumeToken)) {
          if (registrationPending || checkingCollections >= 32) throw new ProtocolError('collection-busy', 'Коллекция проверяется. Подождите несколько секунд.');
          registrationPending = true; checkingCollections++;
          const generation = registrationGeneration;
          try {await (options.authorizeDeck ? options.authorizeDeck(message) : authorizeCollectionDeck(message.deckList, message.collectionAuth,fetch,message.heroId??'builder'));}
          catch {throw new ProtocolError('collection-access', 'Не удалось подтвердить карты колоды или правителя в iDos. Войдите в iDos или выберите бесплатную колоду.');}
          finally {registrationPending = false; checkingCollections--;}
          if (generation !== registrationGeneration) return;
        }
        if (socket.readyState === WebSocket.OPEN) rooms.handle(socket, message);
      } catch (error: unknown) {rooms.rejected(socket, error);}
    });
    socket.on('close', code => {
      (options.log ?? console.info)(`[ws] connection closed: ${code}`);
      rooms.disconnect(socket);
    });
    socket.on('error', () => { /* close handles seat presence; protocol errors are logged above */ });
  });
  const tick = setInterval(() => rooms.tick(), options.tickIntervalMs ?? 250);
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!alive.get(socket)) {socket.terminate(); continue;}
      alive.set(socket, false); socket.ping();
    }
  }, 15_000);
  server.listen(options.port ?? 3102, options.host ?? '0.0.0.0');
  const close = async (): Promise<void> => {
    clearInterval(tick); clearInterval(heartbeat);
    for (const socket of wss.clients) socket.terminate();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await new Promise<void>(resolve => wss.close(() => resolve()));
  };
  return {server, wss, rooms, close};
}
