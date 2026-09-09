import { Tool } from "@/components/Canvas";
import { getExistingShapes } from "./http";

type Shape = {
    type: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
} | {
    type: "circle";
    centerX: number;
    centerY: number;
    radius: number;
} | {
    type: "line";
    startX: number;
    startY: number;
    endX: number;
    endY: number;
} | {
    type: "pencil";
    points: { x: number, y: number }[]
} | {
    type: "text";
    x: number;
    y: number;
    content: string;
    fontSize: number;
}

type EraseAction = {
    type: "erase";
    x: number;
    y: number;
    radius: number;
}

type DrawingAction = Shape | EraseAction;

export class Game {

    private static readonly ERASER_RADIUS = 18;
    private static readonly ERASER_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%23ffffff' stroke='%23000000' stroke-width='1.5' d='m14.7 3.3 6 6a2 2 0 0 1 0 2.8l-7.6 7.6a2 2 0 0 1-2.8 0l-6-6a2 2 0 0 1 0-2.8l7.6-7.6a2 2 0 0 1 2.8 0Z'/%3E%3Cpath stroke='%23000000' stroke-width='1.5' d='m7.3 7.3 6 6'/%3E%3C/svg%3E") 12 12, auto`;

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private existingShapes: Shape[];
    private slug: string;
    private roomId: string;
    private socket: WebSocket;
    private clicked: boolean;
    private startX: number;
    private startY: number;
    private selectedTool: Tool = "circle";
    private currentPencilPoints: { x: number, y: number }[] = []

    constructor(canvas: HTMLCanvasElement, slug: string, socket: WebSocket, roomId: string) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d")!;
        this.existingShapes = [];
        this.slug = slug;
        this.roomId = roomId;
        this.socket = socket;
        this.clicked = false;
        this.startX = 0;
        this.startY = 0;
        this.init();
        this.initHandlers();
        this.initMouseHandler();
    }

    setTool(tool: "pointer" | "circle" | "pencil" | "rect" | "eraser" | "line" | "text") {
        this.selectedTool = tool;
        if (tool === "pointer") {
            this.canvas.style.cursor = "grab";
        } else if (tool !== "eraser") {
            this.canvas.style.cursor = "crosshair";
        }
    }

    async init() {
        try {
            const actions = await getExistingShapes(this.slug);
            actions.forEach((action: unknown) => {
                if (this.isDrawingAction(action)) {
                    this.applyAction(action);
                }
            });
        } catch {}
        this.clearCanvas()
    }

    initHandlers() {
        this.socket.onmessage = (event) => {
            try {
                const parsedData = JSON.parse(event.data);

                if (parsedData.type === "chat" && typeof parsedData.message === "string") {
                    const shapes = JSON.parse(parsedData.message);
                    if (this.isDrawingAction(shapes.shape)) {
                        this.applyAction(shapes.shape)
                        this.clearCanvas()
                    }
                }
            } catch {}
        }
    }

    private getCanvasPoint(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height),
        };
    }

    private isDrawingAction(action: unknown): action is DrawingAction {
        return !!action && typeof action === "object" && "type" in action;
    }

    private applyAction(action: DrawingAction) {
        if (action.type === "erase") {
            this.existingShapes = this.existingShapes.filter(
                (shape) => !this.shapeTouchesEraser(shape, action),
            );
            return;
        }

        this.existingShapes.push(action);
    }

    private shapeTouchesEraser(shape: Shape, eraser: EraseAction) {
        const distanceToSegment = (x1: number, y1: number, x2: number, y2: number) => {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const lengthSquared = dx * dx + dy * dy;
            const t = lengthSquared === 0
                ? 0
                : Math.max(0, Math.min(1, ((eraser.x - x1) * dx + (eraser.y - y1) * dy) / lengthSquared));
            return Math.hypot(eraser.x - (x1 + t * dx), eraser.y - (y1 + t * dy));
        };

        if (shape.type === "circle") {
            return Math.hypot(eraser.x - shape.centerX, eraser.y - shape.centerY) <= shape.radius + eraser.radius;
        }
        if (shape.type === "rect") {
            const left = Math.min(shape.x, shape.x + shape.width) - eraser.radius;
            const right = Math.max(shape.x, shape.x + shape.width) + eraser.radius;
            const top = Math.min(shape.y, shape.y + shape.height) - eraser.radius;
            const bottom = Math.max(shape.y, shape.y + shape.height) + eraser.radius;
            return eraser.x >= left && eraser.x <= right && eraser.y >= top && eraser.y <= bottom;
        }
        if (shape.type === "line") {
            return distanceToSegment(shape.startX, shape.startY, shape.endX, shape.endY) <= eraser.radius + 1;
        }
        if (shape.type === "pencil") {
            return shape.points.some((point, index) => {
                const previous = shape.points[Math.max(0, index - 1)];
                return distanceToSegment(previous.x, previous.y, point.x, point.y) <= eraser.radius + 1;
            });
        }

        const width = this.ctx.measureText(shape.content).width || shape.content.length * shape.fontSize * 0.6;
        return eraser.x >= shape.x - eraser.radius && eraser.x <= shape.x + width + eraser.radius
            && eraser.y >= shape.y - eraser.radius && eraser.y <= shape.y + shape.fontSize + eraser.radius;
    }

    private updateEraserCursor(point: { x: number; y: number }) {
        if (this.selectedTool !== "eraser") return;

        const eraser: EraseAction = {
            type: "erase",
            x: point.x,
            y: point.y,
            radius: Game.ERASER_RADIUS,
        };
        const isOverShape = this.existingShapes.some((shape) => this.shapeTouchesEraser(shape, eraser));
        this.canvas.style.cursor = isOverShape ? Game.ERASER_CURSOR : "crosshair";
    }

    private sendAction(action: DrawingAction) {
        if (this.socket.readyState !== WebSocket.OPEN) {
            return false;
        }

        try {
            this.socket.send(JSON.stringify({
                type: "chat",
                message: JSON.stringify({ shape: action }),
                roomId: this.roomId
            }));
            return true;
        } catch {
            return false;
        }
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        this.ctx.fillStyle = "rgba(0, 0, 0)"
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
        // A new canvas context defaults to a black stroke. Set drawing styles before
        // replaying history so pencil-only rooms are visible immediately on refresh.
        this.ctx.strokeStyle = "rgba(255, 255, 255)"
        this.ctx.lineWidth = 2;
        this.ctx.lineJoin = "round";
        this.ctx.lineCap = "round";

        this.existingShapes.map((shape) => {
            if (shape.type == "rect") {
                this.ctx.strokeStyle = "rgba(255, 255, 255)"
                this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
            } else if (shape.type == "circle") {
                this.ctx.beginPath()
                this.ctx.arc(shape.centerX, shape.centerY, shape.radius, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.closePath()
            } else if (shape.type == "line") {
                this.ctx.beginPath();
                this.ctx.moveTo(shape.startX, shape.startY);
                this.ctx.lineTo(shape.endX, shape.endY);
                this.ctx.stroke();
                this.ctx.closePath()
            } else if (shape.type == "pencil") {
                if (shape.points.length === 0) {
                    return;
                }
                this.ctx.beginPath();
                const pts = shape.points;
                this.ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) {
                    this.ctx.lineTo(pts[i].x, pts[i].y);
                }
                this.ctx.stroke();
                this.ctx.closePath();
            } else if (shape.type == "text") {
                this.ctx.fillStyle = "rgba(255, 255, 255)";
                this.ctx.font = `${shape.fontSize}px sans-serif`;
                this.ctx.textBaseline = "top";
                this.ctx.fillText(shape.content, shape.x, shape.y);
            }
        })
    }

    handleMouseDown = (e: MouseEvent) => {
        const point = this.getCanvasPoint(e);
        this.clicked = true;
        this.startX = point.x;
        this.startY = point.y;

        if (this.selectedTool == "pencil") {
            this.currentPencilPoints = [point];
        }
        if (this.selectedTool == "text") {
            e.preventDefault()
            this.createTextInput(point.x, point.y, e.clientX, e.clientY);
            return;
        }
    }

    handleMouseUp = (e: MouseEvent) => {
        const point = this.getCanvasPoint(e);
        this.clicked = false;

        if (this.selectedTool === "eraser") {
            const eraseAction: EraseAction = {
                type: "erase",
                x: point.x,
                y: point.y,
                radius: Game.ERASER_RADIUS,
            };
            this.applyAction(eraseAction);
            this.clearCanvas();
            this.sendAction(eraseAction);
            return;
        }

        const width = point.x - this.startX;
        const height = point.y - this.startY;
        let shape: Shape | null = null;
        if (this.selectedTool == "rect") {
            shape = {
                type: "rect",
                x: this.startX,
                y: this.startY,
                width,
                height
            }

        } else if (this.selectedTool == "circle") {
            const radius = Math.sqrt(width * width + height * height) / 2;
            shape = {
                type: "circle",
                centerX: this.startX + width / 2,
                centerY: this.startY + height / 2,
                radius: radius
            }
        } else if (this.selectedTool == "line") {
            shape = {
                type: "line",
                startX: this.startX,
                startY: this.startY,
                endX: point.x,
                endY: point.y
            }
        } else if (this.selectedTool == "pencil") {
            if (this.currentPencilPoints.length > 1) {
                shape = {
                    type: "pencil",
                    points: this.currentPencilPoints,
                };
            }
        }

        if (!shape) {
            return;
        }
        this.applyAction(shape)

        this.sendAction(shape);

    }

    handleMouseMove = (e: MouseEvent) => {
        const point = this.getCanvasPoint(e);
        this.updateEraserCursor(point);

        if (this.clicked) {
            const width = point.x - this.startX;
            const height = point.y - this.startY;
            this.clearCanvas();
            this.ctx.strokeStyle = "rgba(255, 255, 255)"

            if (this.selectedTool == "circle") {
                const radius = Math.sqrt(width * width + height * height) / 2;
                const centerX = this.startX + width / 2;
                const centerY = this.startY + height / 2;
                this.ctx.beginPath()
                this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.closePath()
            } else if (this.selectedTool == "rect") {
                this.ctx.strokeRect(this.startX, this.startY, width, height)
            } else if (this.selectedTool == "line") {
                this.ctx.strokeStyle = "rgba(255, 255, 255)";
                this.ctx.beginPath()
                this.ctx.moveTo(this.startX, this.startY)
                this.ctx.lineTo(point.x, point.y)
                this.ctx.stroke()
                this.ctx.closePath()
            } else if (this.selectedTool == "pencil") {
                this.currentPencilPoints.push(point);

                this.ctx.strokeStyle = "rgba(255, 255, 255)";
                this.ctx.lineWidth = 2;
                this.ctx.lineJoin = "round";
                this.ctx.lineCap = "round";

                this.ctx.beginPath();
                const pts = this.currentPencilPoints;
                this.ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) {
                    this.ctx.lineTo(pts[i].x, pts[i].y);
                }
                this.ctx.stroke();
                this.ctx.closePath();
            }
        }
    }

    handleMouseLeave = () => {
        this.canvas.style.cursor = "default";
    }

    createTextInput(x: number, y: number, clientX: number, clientY: number) {
        const fontSize = 20;

        const input = document.createElement("textarea");
        input.style.position = "fixed";
        input.style.left = `${clientX}px`;
        input.style.top = `${clientY}px`;
        input.style.background = "transparent";
        input.style.border = "1px dashed rgba(255, 255, 255, 0.4)";
        input.style.outline = "none";
        input.style.color = "white";
        input.style.font = `${fontSize}px sans-serif`;
        input.style.lineHeight = "1.3";        // room for ascenders/descenders
        input.style.padding = "2px 4px";       // small breathing room, no clipping
        input.style.margin = "0px";
        input.style.resize = "none";
        input.style.overflow = "hidden";
        input.style.whiteSpace = "pre";        // don't wrap while measuring width
        input.style.zIndex = "1000";
        input.rows = 1;

        document.body.appendChild(input);
        setTimeout(() => input.focus(), 0);

        const resize = () => {
            this.ctx.font = `${fontSize}px sans-serif`;
            const width = this.ctx.measureText(input.value || " ").width;
            input.style.width = `${width + 12}px`; // +12 = padding + a little room for the caret

            input.style.height = "auto";
            input.style.height = `${input.scrollHeight}px`;
        };

        resize(); // set initial size immediately, don't wait for first keystroke
        input.addEventListener("input", resize);

        const commit = () => {
            const content = input.value.trim();
            if (document.body.contains(input)) {
                document.body.removeChild(input);
            }

            if (!content) return;

            const shape: Shape = {
                type: "text",
                x,
                y,
                content,
                fontSize
            };

            this.applyAction(shape);
            this.clearCanvas();

            this.sendAction(shape);
        };

        input.addEventListener("blur", commit);

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                input.blur();
            }
            if (e.key === "Escape") {
                input.removeEventListener("blur", commit);
                if (document.body.contains(input)) {
                    document.body.removeChild(input);
                }
            }
        });
    }

    initMouseHandler() {
        this.canvas.addEventListener("mousedown", this.handleMouseDown);
        this.canvas.addEventListener("mouseup", this.handleMouseUp);
        this.canvas.addEventListener("mousemove", this.handleMouseMove);
        this.canvas.addEventListener("mouseleave", this.handleMouseLeave);
    }

    destroy() {
        this.canvas.removeEventListener("mousedown", this.handleMouseDown);
        this.canvas.removeEventListener("mouseup", this.handleMouseUp);
        this.canvas.removeEventListener("mousemove", this.handleMouseMove);
        this.canvas.removeEventListener("mouseleave", this.handleMouseLeave);
    }
}
