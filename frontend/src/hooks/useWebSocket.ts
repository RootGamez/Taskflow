import { useEffect, useRef } from "react";

interface UseWebSocketOptions {
  enabled?: boolean;
  onMessage?: (event: MessageEvent<string>) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: () => void;
  reconnectAttempts?: number;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

export function useWebSocket(path: string, options: UseWebSocketOptions = {}) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const enabled = options.enabled ?? false;
  const reconnectAttempts = options.reconnectAttempts ?? 8;
  const reconnectDelayMs = options.reconnectDelayMs ?? 500;
  const maxReconnectDelayMs = options.maxReconnectDelayMs ?? 8000;

  useEffect(() => {
    if (!enabled || !path) {
      return;
    }

    let reconnectCount = 0;
    let manualClose = false;

    const base = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws";

    const connect = () => {
      if (manualClose) {
        return;
      }

      const socket = new WebSocket(`${base}${path}`);

      socket.onopen = () => {
        reconnectCount = 0;
        options.onOpen?.();
      };

      socket.onmessage = (event) => {
        options.onMessage?.(event as MessageEvent<string>);
      };

      socket.onerror = () => {
        options.onError?.();
      };

      socket.onclose = () => {
        socketRef.current = null;
        options.onClose?.();

        if (manualClose || reconnectCount >= reconnectAttempts) {
          return;
        }

        reconnectCount += 1;
        const wait = Math.min(reconnectDelayMs * 2 ** (reconnectCount - 1), maxReconnectDelayMs);
        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, wait);
      };

      socketRef.current = socket;
    };

    connect();

    return () => {
      manualClose = true;

      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [
    enabled,
    maxReconnectDelayMs,
    options.onClose,
    options.onError,
    options.onMessage,
    options.onOpen,
    path,
    reconnectAttempts,
    reconnectDelayMs,
  ]);

  return socketRef;
}
