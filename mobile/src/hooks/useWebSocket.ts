/**
 * useWebSocket — Enhanced real-time WebSocket connection
 * 
 * Improvements:
 * - Exponential backoff for reconnection
 * - Connection health ping/pong
 * - Message queuing when disconnected
 * - Typed event system
 * - Max reconnect attempts
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { API_WS_URL, getAuthToken } from '../services/api';

type MessageHandler = (data: any) => void;

interface WebSocketOptions {
  autoConnect?: boolean;
  maxReconnectAttempts?: number;
  pingInterval?: number;
}

export function useWebSocket(options: WebSocketOptions = {}) {
  const {
    autoConnect = true,
    maxReconnectAttempts = 10,
    pingInterval = 30000,
  } = options;

  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const handlers = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const messageQueue = useRef<string[]>([]);
  const pingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush queued messages
  const flushQueue = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      while (messageQueue.current.length > 0) {
        const msg = messageQueue.current.shift();
        if (msg) ws.current.send(msg);
      }
    }
  }, []);

  // Start ping interval
  const startPing = useCallback(() => {
    stopPing();
    pingTimer.current = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, pingInterval);
  }, [pingInterval]);

  const stopPing = useCallback(() => {
    if (pingTimer.current) {
      clearInterval(pingTimer.current);
      pingTimer.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    try {
      const socket = new WebSocket(API_WS_URL);
      ws.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        setReconnectAttempts(0);

        // Authenticate if we have a token
        const authToken = getAuthToken();
        if (authToken) {
          socket.send(JSON.stringify({ type: 'auth', token: authToken }));
        }

        flushQueue();
        startPing();
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // Handle pong
          if (msg.type === 'pong') return;

          // Route to registered handlers
          const typeHandlers = handlers.current.get(msg.type);
          if (typeHandlers) {
            typeHandlers.forEach(handler => handler(msg.data || msg));
          }

          // Also notify wildcard handlers
          const wildcardHandlers = handlers.current.get('*');
          if (wildcardHandlers) {
            wildcardHandlers.forEach(handler => handler(msg));
          }
        } catch {}
      };

      socket.onclose = () => {
        setIsConnected(false);
        ws.current = null;
        stopPing();

        // Exponential backoff reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          reconnectTimer.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
        }
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch {
      setIsConnected(false);
    }
  }, [reconnectAttempts, maxReconnectAttempts, flushQueue, startPing, stopPing]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    stopPing();
    ws.current?.close();
    ws.current = null;
    setIsConnected(false);
    setReconnectAttempts(maxReconnectAttempts); // prevent auto-reconnect
  }, [maxReconnectAttempts, stopPing]);

  // Send message (queues if disconnected)
  const send = useCallback((type: string, data?: any) => {
    const msg = JSON.stringify({ type, ...data });
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(msg);
    } else {
      messageQueue.current.push(msg);
    }
  }, []);

  // Subscribe to channel
  const subscribe = useCallback((channel: string, params?: Record<string, any>) => {
    send('subscribe', { channel, ...params });
  }, [send]);

  // Register event handler
  const on = useCallback((type: string, handler: MessageHandler) => {
    if (!handlers.current.has(type)) {
      handlers.current.set(type, new Set());
    }
    handlers.current.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      handlers.current.get(type)?.delete(handler);
    };
  }, []);

  // Handle app state changes (reconnect on foreground)
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active' && !isConnected && reconnectAttempts < maxReconnectAttempts) {
        setReconnectAttempts(0);
        connect();
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub?.remove();
  }, [isConnected, reconnectAttempts, maxReconnectAttempts, connect]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      stopPing();
      ws.current?.close();
    };
  }, []);

  return {
    isConnected,
    reconnectAttempts,
    connect,
    disconnect,
    send,
    subscribe,
    on,
  };
}
