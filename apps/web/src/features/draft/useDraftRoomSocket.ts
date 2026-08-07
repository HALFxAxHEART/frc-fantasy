import { useEffect, useRef } from "react";

/**
 * Push-only signal — the server never sends draft state over the socket, only a
 * "something changed" ping. Refetching on `open` (not just `message`) is what closes
 * the gap for whatever happened while disconnected; a stale onUpdate closure is
 * avoided via a ref so the effect doesn't need to re-run when the caller's callback
 * identity changes.
 */
export function useDraftRoomSocket(leagueId: string, onUpdate: () => void): void {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let stopped = false;

    function connect() {
      if (stopped) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/ws/draft/${leagueId}`);

      socket.onopen = () => {
        attempt = 0;
        onUpdateRef.current();
      };
      socket.onmessage = () => {
        onUpdateRef.current();
      };
      socket.onclose = () => {
        if (!stopped) scheduleReconnect();
      };
      socket.onerror = () => {
        socket?.close();
      };
    }

    function scheduleReconnect() {
      const base = Math.min(10_000, 500 * 2 ** attempt);
      const jitter = base * (0.8 + Math.random() * 0.4);
      attempt += 1;
      reconnectTimer = setTimeout(connect, jitter);
    }

    // Laptop sleep / tab backgrounding can leave a socket "zombied" without ever
    // firing close — regaining visibility forces a refetch and, if the socket isn't
    // actually open, reconnects immediately instead of waiting for the backoff timer.
    function handleVisibility() {
      if (document.visibilityState !== "visible") return;
      onUpdateRef.current();
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        connect();
      }
    }

    connect();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [leagueId]);
}
