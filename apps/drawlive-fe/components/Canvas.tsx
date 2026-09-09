"use client"

import { Game } from "@/draw/Game";
import { CaseSensitive, Circle, Eraser, Minus, MousePointer2, Pencil, RectangleHorizontalIcon, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

export type Tool = "pointer" | "circle" | "pencil" | "rect" | "eraser" | "line" | "text";

const Canvas = ({
  slug,
  roomId,
  socket,
}: {
  slug: string;
  roomId: string;
  socket: WebSocket;
}) => {

  const [selectedTool, setSelectedTool] = useState<Tool>("pencil");
  const gameRef = useRef<Game | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef({ x: 0, y: 0, zoom: 1 });
  const animationFrameRef = useRef<number | null>(null);
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const spacePressedRef = useRef(false);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });

  const scheduleViewUpdate = useCallback((next: { x: number; y: number; zoom: number }) => {
    viewRef.current = next;
    if (animationFrameRef.current !== null) return;

    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      setView(viewRef.current);
    });
  }, []);

  useEffect(() => {
    game?.setTool(selectedTool)
  }, [selectedTool, game])

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const g = new Game(canvas, slug, socket, roomId)
    gameRef.current = g;
    setGame(g)

    return () => {
      g.destroy()
      if (gameRef.current === g) {
        gameRef.current = null
        setGame(null)
      }
    }
  }, [roomId, slug, socket]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = viewport.getBoundingClientRect();
      const previous = viewRef.current;
      const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? event.deltaY * 16
        : event.deltaY;
      // Trackpads emit many small wheel events. A continuous curve keeps both
      // trackpads and mouse wheels predictable instead of jumping 10% per event.
      const zoom = Math.min(3, Math.max(0.25, previous.zoom * Math.exp(-delta * 0.001)));
      const cursorX = event.clientX - bounds.left;
      const cursorY = event.clientY - bounds.top;

      scheduleViewUpdate({
        zoom,
        x: cursorX - ((cursorX - previous.x) * zoom) / previous.zoom,
        y: cursorY - ((cursorY - previous.y) * zoom) / previous.zoom,
      });
    };

    const handleMouseMove = (event: MouseEvent) => {
      const pan = panRef.current;
      if (!pan) return;
      scheduleViewUpdate({
        ...viewRef.current,
        x: pan.originX + event.clientX - pan.startX,
        y: pan.originY + event.clientY - pan.startY,
      });
    };

    const stopPanning = () => {
      panRef.current = null;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
        spacePressedRef.current = true;
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") spacePressedRef.current = false;
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopPanning);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopPanning);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [scheduleViewUpdate]);

  const startPan = (event: ReactMouseEvent<HTMLDivElement>) => {
    const usesMoveTool = selectedTool === "pointer" && event.button === 0;
    if (event.target !== canvasRef.current || (event.button !== 1 && !(event.button === 0 && spacePressedRef.current) && !usesMoveTool)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    panRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: viewRef.current.x,
      originY: viewRef.current.y,
    };
  };

  const blockDrawingWhilePanning = (event: ReactMouseEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (pan) {
      const next = {
        ...viewRef.current,
        x: pan.originX + event.clientX - pan.startX,
        y: pan.originY + event.clientY - pan.startY,
      };
      scheduleViewUpdate(next);
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const stopDrawingAndPanning = (event: ReactMouseEvent<HTMLDivElement>) => {
    blockDrawingWhilePanning(event);
    panRef.current = null;
  };

  const resetView = () => {
    const initial = { x: 0, y: 0, zoom: 1 };
    viewRef.current = initial;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setView(initial);
  };

  const tools: { id: Tool; icon: typeof Pencil; label: string }[] = [
    { id: "pointer", icon: MousePointer2, label: "Move canvas" },
    { id: "pencil", icon: Pencil, label: "Pencil" },
    { id: "circle", icon: Circle, label: "Circle" },
    { id: "rect", icon: RectangleHorizontalIcon, label: "Rectangle" },
    { id: "line", icon: Minus, label: "Line" },
    { id: "eraser", icon: Eraser, label: "Eraser" },
    {id: "text", icon: CaseSensitive, label: "text"}
  ];

  return (
    <div
      ref={viewportRef}
      className="h-screen w-screen overflow-hidden relative bg-black"
      onMouseDownCapture={startPan}
      onMouseMoveCapture={blockDrawingWhilePanning}
      onMouseUpCapture={stopDrawingAndPanning}
    >
      <canvas
        ref={canvasRef}
        width={1800}
        height={1080}
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          transformOrigin: "0 0",
          willChange: "transform",
        }}
      />

      {/* Room label */}
      <div className="absolute top-5 left-5 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
        <span className="font-mono text-sm text-white/50">{slug}</span>
      </div>

      {/* Floating toolbar */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/80 border border-white/15 rounded-lg p-1.5 backdrop-blur-sm">
        {tools.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => setSelectedTool(id)}
            className={`p-2.5 rounded-md transition-colors duration-150 cursor-pointer ${
              selectedTool === id
                ? "bg-white text-black"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            <Icon size={18} />
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-white/15" />
        <button
          title="Reset pan and zoom"
          onClick={resetView}
          className="p-2.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  );
};

export default Canvas;
