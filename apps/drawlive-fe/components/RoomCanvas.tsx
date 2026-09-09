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
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    const strip = token?.replace(/^Bearer\s+/i, "");

    if (!wsUrl || !strip) {
      return;
    }

    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const connect = () => {
      if (disposed) return;

      const ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(strip)}`);
      socketRef.current = ws;

    ws.onopen = () => {
      if (disposed || socketRef.current !== ws) return;
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

      ws.onclose = () => {
        if (socketRef.current === ws) {
          socketRef.current = null;
          setSocket(null);
        }

        if (!disposed) {
          setConnectionError("The drawing connection was interrupted. Reconnecting...");
          retryTimer = setTimeout(connect, 1000);
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


    return <div>
       <Canvas slug={slug} roomId={roomId} socket={socket}/>
    </div>
}

export default RoomCanvas
