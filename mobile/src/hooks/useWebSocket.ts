/**
 * useWebSocket — Real-time WebSocket connection to backend
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { API_WS_URL } from '../services/api';

type MessageHandler = (data: any) => void;

export function useWebSocket(token: string | null) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const handlers = useRef<Map<string, MessageHandler>>(new Map());

  const connect = useCallback(() => {
    if (!token) return;

    ws.current = new WebSocket(API_WS_URL);

    ws.current.onopen = () => {
      // Authenticate
      ws.current?.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'auth_ok') {
          setIsConnected(true);
          return;
        }

        // Route to handlers
        const handler = handlers.current.get(msg.type);
        if (handler) handler(msg.data || msg);
      } catch {}
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      // Auto-reconnect after 3s
      setTimeout(connect, 3000);
    };

    ws.current.onerror = () => {
      ws.current?.close();
    };
  }, [token]);

  useEffect(() => {
    connect();
    return () => { ws.current?.close(); };
  }, [connect]);

  const subscribe = useCallback((channel: string, minScore?: number) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'subscribe', channel, minScore }));
    }
  }, []);

  const onMessage = useCallback((type: string, handler: MessageHandler) => {
    handlers.current.set(type, handler);
  }, []);

  return { isConnected, subscribe, onMessage, ws: ws.current };
}
