
import { WebSocketServer, WebSocket } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { prisma } from "@repo/db/prisma";

const PORT = Number(process.env.PORT) || 3002;

const wss = new WebSocketServer({
  port: PORT,
});

console.log(`WebSocket server running on port ${PORT}`);

interface User {
  socket: WebSocket;
  userId: string;
  rooms: string[];
}

const users: User[] = [];

wss.on("connection", (socket, request) => {
  try {
    const url = request.url;

    if (!url) {
      socket.close();
      return;
    }

    const queryParams = new URLSearchParams(url.split("?")[1]);
    const token = queryParams.get("token") || "";

    const decoded = jwt.verify(token, JWT_SECRET!) as JwtPayload;

    if (!decoded.userId) {
      socket.close();
      return;
    }

    const userId = decoded.userId;

    users.push({
      socket,
      userId,
      rooms: [],
    });

    console.log(`User ${userId} connected`);
  } catch (error) {
    console.error("WebSocket authentication error:", error);
    socket.close();
    return;
  }

  socket.on("message", async (data) => {
    try {
      const parsedData =
        typeof data === "string"
          ? JSON.parse(data)
          : JSON.parse(data.toString());

      const user = users.find((x) => x.socket === socket);

      if (!user) {
        return;
      }

      // JOIN ROOM
      if (parsedData.type === "join_room") {
        if (!parsedData.roomId) {
          return;
        }

        // Prevent duplicate rooms
        if (!user.rooms.includes(parsedData.roomId)) {
          user.rooms.push(parsedData.roomId);
        }

        console.log(`User ${user.userId} joined room ${parsedData.roomId}`);

        return;
      }

      // LEAVE ROOM
      if (parsedData.type === "leave_room") {
        if (!parsedData.roomId) {
          return;
        }

        user.rooms = user.rooms.filter(
          (room) => room !== parsedData.roomId
        );

        console.log(`User ${user.userId} left room ${parsedData.roomId}`);

        return;
      }

      // CHAT
      if (parsedData.type === "chat") {
        if (!parsedData.message || !parsedData.roomId) {
          return;
        }

        if (!user.rooms.includes(parsedData.roomId)) {
          console.warn(`User ${user.userId} tried to draw outside a joined room`);
          return;
        }

        // Save chat to database
        await prisma.chat.create({
          data: {
            message: parsedData.message,
            roomId: Number(parsedData.roomId),
            userId: user.userId,
          },
        });

        const message = JSON.stringify({
          type: "chat",
          message: parsedData.message,
          roomId: parsedData.roomId,
        });

        // Broadcast only to connected users in the room
        users.forEach((roomUser) => {
          if (
            roomUser.socket !== socket &&
            roomUser.rooms.includes(parsedData.roomId) &&
            roomUser.socket.readyState === WebSocket.OPEN
          ) {
            try {
              roomUser.socket.send(message);
            } catch (error) {
              console.error("Failed to send WebSocket message:", error);
            }
          }
        });
      }
    } catch (error) {
      console.error("WebSocket message error:", error);
    }
  });

  // IMPORTANT: remove disconnected users
  socket.on("close", () => {
    const index = users.findIndex((user) => user.socket === socket);

    if (index !== -1) {
      const user = users[index];

      users.splice(index, 1);

      console.log(`User ${user!.userId} disconnected`);
    }
  });

  socket.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});
