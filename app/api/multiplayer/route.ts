import {NextRequest, NextResponse} from 'next/server';
import {multiplayer, OnlineError} from '../../../lib/multiplayer/store';
import {parseCommand} from '../../../lib/multiplayer/validation';
import {multiplayerOrigin} from '../../../lib/multiplayer/origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const COOKIE = 'imperivm_guest';
const headers = {'Cache-Control': 'no-store, private', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff'};
function errorResponse(error: unknown) {
  return error instanceof OnlineError
    ? NextResponse.json({error: error.message, code: error.code}, {status: error.status, headers})
    : NextResponse.json({error: 'Не удалось обработать запрос. Попробуйте ещё раз.', code: 'server'}, {status: 500, headers});
}
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE)?.value;
    if (!token || !multiplayer.validSession(token)) throw new OnlineError(401, 'session-expired', 'Подключитесь к игре заново.');
    return NextResponse.json(multiplayer.status(token), {headers});
  } catch (error) {return errorResponse(error);}
}
export async function POST(request: NextRequest) {
  try {
    // SameSite alone is not sufficient for sibling hosts. Only our exact origin can mutate a session.
    const allowedOrigin = multiplayerOrigin(request.url, request.headers.get('host'), process.env.MULTIPLAYER_PUBLIC_ORIGIN);
    if (request.headers.get('origin') !== allowedOrigin) throw new OnlineError(403, 'origin', 'Запрос должен прийти со страницы игры.');
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new OnlineError(415, 'content-type', 'Требуется JSON.');
    if (Number(request.headers.get('content-length') || 0) > 8192) throw new OnlineError(413, 'payload-size', 'Слишком большой запрос.');
    // Bound chunked bodies too: never request an unbounded request.text() allocation.
    const reader = request.body?.getReader();
    if (!reader) throw new OnlineError(400, 'payload', 'Пустой запрос.');
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {const {done, value} = await reader.read(); if (done) break; size += value.byteLength;
      if (size > 8192) {await reader.cancel(); throw new OnlineError(413, 'payload-size', 'Слишком большой запрос.');} chunks.push(value);}
    let input: unknown;
    try {input = JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {throw new OnlineError(400, 'payload', 'Некорректный JSON.');}
    const command = parseCommand(input);
    let token = request.cookies.get(COOKIE)?.value, fresh = false;
    if (!token || !multiplayer.validSession(token)) {
      if (command.type !== 'session') throw new OnlineError(401, 'session-expired', 'Подключитесь к игре заново.');
      token = multiplayer.createSession(); fresh = true;
    }
    const response = NextResponse.json(multiplayer.command(token, command), {headers});
    if (fresh) response.cookies.set(COOKIE, token, {httpOnly: true, sameSite: 'strict', secure: allowedOrigin.startsWith('https://'), path: '/', maxAge: 6 * 60 * 60});
    return response;
  } catch (error) {return errorResponse(error);}
}
