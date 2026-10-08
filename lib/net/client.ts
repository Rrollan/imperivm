'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {normalizeRoomCode, validRoomCode} from './roomCode';
import type {ClientMessage, GameIntent, NetSnapshot, PlayerRegistration, ServerMessage} from './protocol';

export type NetStatus = 'idle' | 'connecting' | 'waiting' | 'playing' | 'reconnecting' | 'finished' | 'error';
interface SavedSeat extends Omit<PlayerRegistration, 'collectionAuth'> {roomCode: string; resumeToken: string}
const SESSION_KEY = 'imperivm.net-game.v1';
const HEARTBEAT_MS = 10_000;
const SILENCE_MS = 35_000;
function record(value: unknown): value is Record<string, unknown> {return typeof value === 'object' && value !== null && !Array.isArray(value);}
function registration(value: unknown): value is PlayerRegistration {
  return record(value) && typeof value.playerName === 'string' && Array.isArray(value.deckList) && value.deckList.length === 30 && value.deckList.every(id => typeof id === 'string') && (value.heroId === undefined || typeof value.heroId === 'string');
}
function savedSeat(value: unknown): value is SavedSeat {return registration(value) && record(value) && typeof value.roomCode === 'string' && validRoomCode(value.roomCode) && typeof value.resumeToken === 'string' && value.resumeToken.length > 16;}
function readSaved(roomCode?: string): SavedSeat | null {
  try {const value: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); return savedSeat(value) && (!roomCode || normalizeRoomCode(roomCode) === value.roomCode) ? {playerName: value.playerName, heroId: value.heroId, deckList: value.deckList, roomCode: value.roomCode, resumeToken: value.resumeToken} : null;} catch {return null;}
}
function saveSeat(value: SavedSeat | null) {try {if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); else sessionStorage.removeItem(SESSION_KEY);} catch { /* Reconnect still works in this page when storage is unavailable. */ }}
function isSnapshot(value: unknown): value is NetSnapshot {
  if (!record(value) || typeof value.roomCode !== 'string' || !validRoomCode(value.roomCode) || typeof value.id !== 'string' || !Number.isSafeInteger(value.revision) || (value.seat !== 0 && value.seat !== 1) || !['waiting', 'playing', 'finished'].includes(String(value.status)) || typeof value.serverTime !== 'number' || value.turnDuration !== 75 || !Array.isArray(value.names) || value.names.length !== 2 || !Array.isArray(value.history)) return false;
  if (value.game === null) return true;
  if (!record(value.game) || !Array.isArray(value.game.players) || value.game.players.length !== 2 || !Array.isArray(value.game.actions) || typeof value.game.turnDeadline !== 'number') return false;
  return value.game.players.every(player => record(player) && typeof player.heroId === 'string' && typeof player.treasury === 'number' && Array.isArray(player.board) && Array.isArray(player.edicts) && (player.hand === undefined || Array.isArray(player.hand)));
}
function readMessage(data: unknown): ServerMessage | null {
  if (typeof data !== 'string') return null;
  let value: unknown;
  try {value = JSON.parse(data);} catch {return null;}
  if (!record(value)) return null;
  switch (value.type) {
    case 'state': return isSnapshot(value.snapshot) ? {type: 'state', snapshot: value.snapshot} : null;
    case 'joined': return (value.you === 'p1' || value.you === 'p2') && typeof value.roomCode === 'string' && validRoomCode(value.roomCode) && typeof value.resumeToken === 'string' && record(value.opponent) && typeof value.opponent.name === 'string' ? {type: 'joined', you: value.you, roomCode: value.roomCode, resumeToken: value.resumeToken, opponent: {name: value.opponent.name}} : null;
    case 'error': return typeof value.reason === 'string' && typeof value.code === 'string' ? {type: 'error', reason: value.reason, code: value.code, fatal: value.fatal === true} : null;
    case 'gameOver': return (value.winner === 'p1' || value.winner === 'p2' || value.winner === 'draw') && typeof value.reason === 'string' ? {type: 'gameOver', winner: value.winner, reason: value.reason} : null;
    case 'opponentLeft': return {type: 'opponentLeft'};
    case 'pong': return typeof value.serverTime === 'number' ? {type: 'pong', serverTime: value.serverTime} : null;
    default: return null;
  }
}
function serverUrl(): string {
  const configured = process.env.NEXT_PUBLIC_WS_URL?.trim();
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  if (!configured && !local) throw new Error('Сетевой сервер не настроен. Укажите NEXT_PUBLIC_WS_URL в настройках сайта.');
  const url = new URL(configured || `ws://${window.location.hostname}:3102`);
  if (!['ws:', 'wss:'].includes(url.protocol) || (window.location.protocol === 'https:' && url.protocol !== 'wss:')) throw new Error('Для этой страницы нужен адрес защищённого WebSocket-сервера: wss://…');
  return url.href;
}

/** Sends intentions only. A reconnect joins with the saved seat token and never replays moves. */
export function useNetGame({roomCode: initialRoomCode}: {roomCode?: string} = {}) {
  const [status, setStatus] = useState<NetStatus>('idle'), [snapshot, setSnapshot] = useState<NetSnapshot | null>(null);
  const [error, setError] = useState(''), [pending, setPending] = useState(false), [connected, setConnected] = useState(false);
  const [identity, setIdentity] = useState<SavedSeat | null>(null), [timeOffset, setTimeOffset] = useState(0);
  const socket = useRef<WebSocket | null>(null), seat = useRef<SavedSeat | null>(null), current = useRef<NetSnapshot | null>(null);
  const activeRegistration = useRef<PlayerRegistration | null>(null), enabled = useRef(false), attempt = useRef(0), generation = useRef(0);
  const requestPending = useRef(false);
  const heartbeatTimer = useRef<number | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null), requestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<(message: ClientMessage, reconnect: boolean) => void>(() => undefined);
  const clearRequest = useCallback(() => {if (requestTimer.current) clearTimeout(requestTimer.current); requestTimer.current = null; requestPending.current = false; setPending(false);}, []);
  const stop = useCallback(() => {
    enabled.current = false; generation.current += 1;
    if (retryTimer.current) clearTimeout(retryTimer.current); retryTimer.current = null;
    if (heartbeatTimer.current) window.clearInterval(heartbeatTimer.current); heartbeatTimer.current = null;
    clearRequest(); const previous = socket.current; socket.current = null; previous?.close(); setConnected(false);
  }, [clearRequest]);
  const connect = useCallback((message: ClientMessage, reconnect: boolean) => {
    const marker = ++generation.current;
    if (retryTimer.current) clearTimeout(retryTimer.current); retryTimer.current = null;
    if (heartbeatTimer.current) window.clearInterval(heartbeatTimer.current); heartbeatTimer.current = null;
    const previous = socket.current; socket.current = null; previous?.close();
    setConnected(false); setStatus(reconnect ? 'reconnecting' : 'connecting'); setError('');
    let ws: WebSocket;
    try {ws = new WebSocket(serverUrl());} catch (cause) {enabled.current = false; setStatus('error'); setError(cause instanceof Error ? cause.message : 'Не удалось подключиться к серверу.'); clearRequest(); return;}
    socket.current = ws; let lastInbound = Date.now(), lastCheck = lastInbound;
    const heartbeat = window.setInterval(() => {
      if (marker !== generation.current) return;
      const now = Date.now(), schedulerPaused = now - lastCheck > HEARTBEAT_MS * 2;
      lastCheck = now;
      // Native WS control-frame ping/pong remains active in the background.
      // A throttled JS timer is not evidence that the connection failed.
      if (document.hidden || schedulerPaused) lastInbound = now;
      if (now - lastInbound > SILENCE_MS) {ws.close(); return;}
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({type: 'ping'} satisfies ClientMessage));
    }, HEARTBEAT_MS);
    heartbeatTimer.current = heartbeat;
    ws.onopen = () => {if (marker !== generation.current) return; lastInbound = Date.now(); ws.send(JSON.stringify(message));};
    ws.onmessage = event => {
      if (marker !== generation.current) return;
      lastInbound = Date.now(); const incoming = readMessage(event.data);
      if (!incoming) {setError('Сервер прислал неподдерживаемое сообщение.'); return;}
      switch (incoming.type) {
        case 'joined': {
          const details = activeRegistration.current;
          if (!details) return;
          const value: SavedSeat = {playerName: details.playerName, heroId: details.heroId, deckList: [...details.deckList], roomCode: incoming.roomCode, resumeToken: incoming.resumeToken};
          activeRegistration.current = value; seat.current = value; setIdentity(value); saveSeat(value); attempt.current = 0; setConnected(true); setStatus(current.current?.game ? current.current.status : 'waiting'); break;
        }
        case 'state':
          if (current.current?.roomCode === incoming.snapshot.roomCode && current.current.revision > incoming.snapshot.revision) return;
          current.current = incoming.snapshot; setSnapshot(incoming.snapshot); setTimeOffset(incoming.snapshot.serverTime - Date.now());
          setConnected(true); setStatus(incoming.snapshot.status); setError(''); clearRequest(); break;
        case 'error':
          setError(incoming.reason); clearRequest();
          if (incoming.fatal) {enabled.current = false; seat.current = null; current.current = null; setSnapshot(null); setIdentity(null); saveSeat(null); setStatus('error'); setConnected(false); ws.close();}
          else if (!current.current) setStatus('error');
          break;
        case 'gameOver': setStatus('finished'); clearRequest(); break;
        case 'opponentLeft':
          if (current.current) {const next = {...current.current, opponentPresent: false}; current.current = next; setSnapshot(next);} break;
        case 'pong': setTimeOffset(incoming.serverTime - Date.now()); break;
      }
    };
    ws.onerror = () => {if (marker === generation.current && !seat.current) setError('Сервер недоступен. Убедитесь, что сетевой сервис запущен.');};
    ws.onclose = event => {
      clearInterval(heartbeat); if (heartbeatTimer.current === heartbeat) heartbeatTimer.current = null;
      if (marker !== generation.current) return;
      socket.current = null; setConnected(false); clearRequest();
      if (event.code === 4001) {
        enabled.current = false; seat.current = null; current.current = null; setIdentity(null); setSnapshot(null); saveSeat(null);
        setStatus('error'); setError('Это место открыто в другой вкладке. Вы можете создать новую комнату.'); return;
      }
      if (!enabled.current) return;
      // Creation is not safe to replay: the response may have been lost after allocation.
      const saved = seat.current;
      if (!saved && message.type === 'create') {enabled.current = false; setStatus('error'); setError('Соединение оборвалось до получения кода. Создайте комнату заново.'); return;}
      const retry: ClientMessage = saved ? {type: 'join', ...saved} : message;
      setStatus('reconnecting'); const delay = Math.min(15_000, 800 * 2 ** Math.min(attempt.current++, 5)) + Math.floor(Math.random() * 350);
      retryTimer.current = setTimeout(() => connectRef.current(retry, true), delay);
    };
  }, [clearRequest]);
  connectRef.current = connect;
  useEffect(() => {
    const saved = readSaved(initialRoomCode);
    if (saved) {seat.current = saved; activeRegistration.current = saved; setIdentity(saved); enabled.current = true; connect({type: 'join', ...saved}, true);}
    return stop;
  }, [connect, initialRoomCode, stop]);
  useEffect(() => {
    const restore = () => {if (enabled.current && seat.current && socket.current?.readyState !== WebSocket.OPEN) connectRef.current({type: 'join', ...seat.current}, true);};
    const offline = () => {
      if (!enabled.current) return;
      setConnected(false); clearRequest();
      if (seat.current) setStatus('reconnecting');
      socket.current?.close();
    };
    const visible = () => {
      if (document.visibilityState !== 'visible') return;
      const ws = socket.current;
      if (enabled.current && ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({type: 'ping'} satisfies ClientMessage));
        ws.send(JSON.stringify({type: 'sync'} satisfies ClientMessage));
      } else restore();
    };
    window.addEventListener('online', restore); window.addEventListener('offline', offline); document.addEventListener('visibilitychange', visible);
    return () => {window.removeEventListener('online', restore); window.removeEventListener('offline', offline); document.removeEventListener('visibilitychange', visible);};
  }, [clearRequest]);
  const begin = useCallback((details: PlayerRegistration, code?: string) => {
    stop(); seat.current = null; current.current = null; setSnapshot(null); setIdentity(null); saveSeat(null); attempt.current = 0;
    const cleaned = {...details, playerName: details.playerName.trim(), deckList: [...details.deckList]}; activeRegistration.current = cleaned;
    if (!cleaned.playerName || cleaned.playerName.length > 32 || (code !== undefined && !validRoomCode(code))) {setStatus('error'); setError('Укажите имя до 32 символов и код комнаты из 6 символов.'); return;}
    enabled.current = true; setPending(true);
    connect(code === undefined ? {type: 'create', ...cleaned} : {type: 'join', ...cleaned, roomCode: normalizeRoomCode(code)}, false);
  }, [connect, stop]);
  const create = useCallback((details: PlayerRegistration) => begin(details), [begin]);
  const join = useCallback((code: string, details: PlayerRegistration) => begin(details, code), [begin]);
  const sendIntent = useCallback(async (intent: GameIntent): Promise<void> => {
    const ws = socket.current, room = current.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !room || !connected || !navigator.onLine) {setError('Нет соединения. Дождитесь переподключения — ход не отправлен.'); return;}
    if (requestPending.current) return;
    requestPending.current = true; setPending(true); setError('');
    ws.send(JSON.stringify({type: 'intent', intent, revision: room.revision} satisfies ClientMessage));
    requestTimer.current = setTimeout(() => {setError('Подтверждение хода задержалось. Восстанавливаем актуальное состояние.'); ws.close();}, 8000);
  }, [connected]);
  const sync = useCallback(async (): Promise<void> => {
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({type: 'sync'} satisfies ClientMessage));
    else if (seat.current) {enabled.current = true; connect({type: 'join', ...seat.current}, true);}
  }, [connect]);
  const leave = useCallback(async (): Promise<void> => {
    const ws = socket.current; if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({type: 'leave'} satisfies ClientMessage));
    stop(); seat.current = null; current.current = null; activeRegistration.current = null; setIdentity(null); setSnapshot(null); setStatus('idle'); setError(''); saveSeat(null);
  }, [stop]);
  return {status, snapshot, error, pending, connected, identity, timeOffset, create, join, sendIntent, sync, leave};
}
