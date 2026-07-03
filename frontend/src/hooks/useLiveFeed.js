import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

/** Keeps a rolling buffer of the most recent live request events. */
export function useLiveFeed(maxItems = 40) {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("request", (payload) => {
      setEvents((prev) => [payload, ...prev].slice(0, maxItems));
    });

    return () => socket.disconnect();
  }, [maxItems]);

  return { events, connected };
}
