'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import type {OnlineCommand, OnlineSession} from '../../lib/multiplayer/types';

export function useOnlineSession(enabled: boolean) {
  const [session, setSession] = useState<OnlineSession | null>(null);
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [pending, setPending] = useState(false);
  const [connected, setConnected] = useState(true);
  const sequence = useRef(0), applied = useRef(0), mounted = useRef(true), sending = useRef(false);
  const receive = useCallback((data: OnlineSession, ticket: number) => {
    if (mounted.current && ticket >= applied.current) {applied.current = ticket; setSession(data); setConnected(true); setConnectionError('');}
  }, []);
  const refresh = useCallback(async () => {
    const ticket = ++sequence.current;
    try {
      let response = await fetch('/api/multiplayer', {cache: 'no-store', credentials: 'same-origin'});
      if (response.status === 401) response = await fetch('/api/multiplayer', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({type: 'session'})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      receive(data as OnlineSession, ticket);
    } catch (cause) {if (mounted.current && ticket >= applied.current) {applied.current = ticket; setConnected(false); setConnectionError(cause instanceof Error ? cause.message : 'Связь потеряна.');}}
  }, [receive]);
  const send = useCallback(async (command: OnlineCommand) => {
    if (sending.current) return;
    sending.current = true; setPending(true); setError('');
    const ticket = ++sequence.current;
    try {
      const response = await fetch('/api/multiplayer', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(command)});
      const data = await response.json();
      if (!response.ok) {if (data.code === 'revision') void refresh(); throw new Error(data.error);}
      receive(data as OnlineSession, ticket);
    } catch (cause) {if (mounted.current) setError(cause instanceof Error ? cause.message : 'Не удалось отправить действие.');}
    finally {sending.current = false; if (mounted.current) setPending(false);}
  }, [receive, refresh]);
  useEffect(() => {
    mounted.current = true;
    if (!enabled) return;
    void send({type: 'session'});
    const timer = window.setInterval(() => {if (!sending.current) void refresh();}, 2500);
    const visibility = () => {if (!document.hidden && !sending.current) void refresh();};
    document.addEventListener('visibilitychange', visibility);
    return () => {mounted.current = false; clearInterval(timer); document.removeEventListener('visibilitychange', visibility);};
  }, [enabled, refresh, send]);
  return {session, error: error || connectionError, pending, connected, send, refresh};
}
