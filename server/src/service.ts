import {createServer} from 'node:http';
import {WebSocketServer, WebSocket} from 'ws';
import {RoomAuthority} from './rooms';
import {parseMessage, ProtocolError} from './validation';

export interface ServiceOptions {
  port?: number; host?: string; origins?: string[]; clock?: () => number;
  tickIntervalMs?: number; log?: (line: string) => void;
  maxMessagesPerWindow?: number;
}
export function startServer(options: ServiceOptions = {}) {
  const origins = new Set(options.origins ?? ['http://localhost:3101', 'http://127.0.0.1:3101', 'http://localhost:3000', 'http://127.0.0.1:3000']);
  const rooms = new RoomAuthority(options.clock, options.log);
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'GET' && request.url === '/health') {response.end(JSON.stringify({status: 'ok', rooms: rooms.size})); return;}
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
  wss.on('connection', socket => {
    alive.set(socket, true);
    let windowStart = Date.now(), messages = 0;
    socket.on('pong', () => alive.set(socket, true));
    socket.on('message', (data, binary) => {
      try {
        const now = Date.now();
        if (now - windowStart >= 10_000) {windowStart = now; messages = 0;}
        if (++messages > (options.maxMessagesPerWindow ?? 100)) throw new ProtocolError('rate-limit', 'Слишком много сообщений. Подождите несколько секунд.');
        if (binary) throw new ProtocolError('bad-message', 'Ожидается текстовый JSON.');
        const raw = data instanceof ArrayBuffer ? Buffer.from(data).toString('utf8') : Array.isArray(data) ? Buffer.concat(data).toString('utf8') : data.toString('utf8');
        rooms.handle(socket, parseMessage(raw));
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
