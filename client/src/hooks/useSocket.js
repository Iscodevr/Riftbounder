import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

let _socket = null;

export function getSocket() {
  if (!_socket) {
    const url = import.meta.env.VITE_API_URL || "http://localhost:3001";
    _socket = io(url, { withCredentials: true, autoConnect: false });
  }
  return _socket;
}

export function useSocket(handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    const off = Object.entries(handlersRef.current).map(([event, fn]) => {
      const handler = (...args) => handlersRef.current[event]?.(...args);
      socket.on(event, handler);
      return () => socket.off(event, handler);
    });

    return () => off.forEach((fn) => fn());
  }, []);
}
