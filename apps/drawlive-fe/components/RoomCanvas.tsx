"use client"
import { useEffect, useRef, useState } from "react";
import Canvas from "./Canvas";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";

const RoomCanvas = ({slug, roomId}: {slug: string, roomId: string}) => {
  useProtectedRoute()
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  
  useEffect(() => {
    const token = localStorage.getItem("token");
    const configuredWsUrl = process.env.NEXT_PUBLIC_WS_URL;
    const strip = token?.replace(/^Bearer\s+/i, "");

    if (!configuredWsUrl || !strip) {
      return;
    }

    let wsUrl: URL;
    try {
      wsUrl = new URL(configuredWsUrl);
      if (wsUrl.protocol === "http:") wsUrl.protocol = "ws:";
      if (wsUrl.protocol === "https:") wsUrl.protocol = "wss:";
      // Browsers block insecure WebSockets from an HTTPS site. This also makes a
      // mistakenly configured production `ws://` URL use the secure endpoint.
      if (window.location.protocol === "https:" && wsUrl.protocol === "ws:") {
        wsUrl.protocol = "wss:";
      }
    } catch {
      return;
    }

    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let hasConnected = false;
    let retryAttempt = 0;

    const connect = () => {
      if (disposed) return;

      wsUrl.searchParams.set("token", strip);
      const ws = new WebSocket(wsUrl.toString());
      socketRef.current = ws;

    ws.onopen = () => {
      if (disposed || socketRef.current !== ws) return;
      hasConnected = true;
      retryAttempt = 0;
      setConnectionError(null);
      setSocket(ws);
      ws.send(JSON.stringify({
        type: "join_room",
        roomId: roomId
      }))
    }

      ws.onerror = () => {
        // `close` supplies the single recovery path and avoids duplicate retries.
        setConnectionError("The drawing connection was interrupted. Reconnecting...");
      };

      ws.onclose = (event) => {
        if (socketRef.current === ws) {
          socketRef.current = null;
          // Keep the last canvas mounted during a transient reconnect. Its drawing
          // handlers safely ignore sends until the replacement socket is ready.
          if (!hasConnected) setSocket(null);
        }

        if (event.code === 1008) {
          setSocket(null);
          setConnectionError("Your drawing session was rejected. Please sign in again.");
          return;
        }

        if (!disposed) {
          setConnectionError("The drawing connection was interrupted. Reconnecting...");
          const retryDelay = Math.min(15_000, 1_000 * 2 ** retryAttempt++);
          retryTimer = setTimeout(connect, retryDelay);
        }
      };
    };

    // In development, React deliberately runs an effect setup/cleanup cycle once
    // before the real mount. Deferring the first connection prevents that throwaway
    // cycle from opening (and then aborting) a WebSocket handshake in the browser.
    retryTimer = setTimeout(connect, 0);

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);

      const ws = socketRef.current;
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "leave_room", roomId }));
        }
        socketRef.current = null;
        ws.close();
      }
      setSocket(null);
    };
  }, [roomId])

  if(!socket) {
    return <div className="bg-black h-screen text-white flex items-center justify-center">
      {connectionError ?? "Connecting to drawing server..."}
    </div>
  }


    return <div className="relative">
       <Canvas slug={slug} roomId={roomId} socket={socket}/>
       {connectionError && (
         <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-md border border-amber-300/20 bg-black/80 px-3 py-2 text-xs text-amber-100 backdrop-blur-sm">
           {connectionError}
         </div>
       )}
    </div>
}

export default RoomCanvas
