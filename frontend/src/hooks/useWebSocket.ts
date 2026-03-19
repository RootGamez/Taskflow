import { useEffect, useRef } from "react";

interface UseWebSocketOptions {
  enabled?: boolean;
  onMessage?: (event: MessageEvent<string>) => void;
}

export function useWebSocket(path: string, options: UseWebSocketOptions = {}) {
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!options.enabled) {
      return;
    }

    const base = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws";
    const socket = new WebSocket(`${base}${path}`);

    socket.onmessage = (event) => {
      options.onMessage?.(event as MessageEvent<string>);
    };

    socketRef.current = socket;

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [options.enabled, options.onMessage, path]);

  return socketRef;
}
