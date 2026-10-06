import {startServer} from './service';

const port = Number(process.env.PORT ?? 3102);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');
const origins = process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()).filter(Boolean);
if (process.env.NODE_ENV === 'production' && !origins?.length) throw new Error('ALLOWED_ORIGINS is required in production');
if (origins?.some(origin => {try {const url = new URL(origin); return !['https:', 'http:'].includes(url.protocol) || url.origin !== origin;} catch {return true;}})) {
  throw new Error('ALLOWED_ORIGINS must contain exact http(s) origins without paths or trailing slashes');
}
const service = startServer({port, origins});
service.server.on('listening', () => console.log(`[ws] IMPERIVM room authority listening on 0.0.0.0:${port}`));
service.server.on('error', error => {console.error('[ws] Cannot start service:', error.message); process.exitCode = 1; void service.close().catch(() => {});});
let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const socket of service.wss.clients) socket.close(1012, 'Service restarting');
  void service.close().then(() => {process.exitCode = 0;});
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
