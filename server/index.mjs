import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const port = Number(process.env.PORT ?? 3001);
const reconnectGraceMs = Number(process.env.RECONNECT_GRACE_MS ?? 15_000);
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const positions = ["south", "north", "west", "east"];
const rooms = new Map();

const httpServer = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ok");
    return;
  }

  response.writeHead(404);
  response.end("not found");
});

const webSocketServer = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  if (pathname !== "/ws") {
    socket.destroy();
    return;
  }

  webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
    webSocketServer.emit("connection", webSocket);
  });
});

const createRoomCode = () => {
  let code = "";
  do {
    code = Array.from(
      { length: 6 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join("");
  } while (rooms.has(code));
  return code;
};

const serializeRoom = (room) => ({
  code: room.code,
  players: [...room.players.values()].map(
    ({ disconnectTimer: _disconnectTimer, socket: _socket, ...player }) =>
      player,
  ),
});

const send = (socket, message) => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};

const broadcastRoom = (room, requestId, targetSocket) => {
  const message = {
    type: "room-state",
    room: serializeRoom(room),
    ...(requestId ? { requestId } : {}),
  };

  for (const player of room.players.values()) {
    if (player.socket === targetSocket && requestId) {
      send(player.socket, message);
    } else {
      send(player.socket, { type: "room-state", room: message.room });
    }
  }
};

const sendError = (socket, requestId, code, message) => {
  send(socket, { type: "error", requestId, code, message });
};

const cleanName = (value) =>
  typeof value === "string" ? value.trim().slice(0, 24) : "";
const cleanCode = (value) =>
  typeof value === "string"
    ? value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
    : "";

const detachSocket = (socket, removeImmediately = false) => {
  const membership = socket.membership;
  if (!membership) return;

  socket.membership = null;
  const room = rooms.get(membership.code);
  const player = room?.players.get(membership.playerId);
  if (!room || !player || player.socket !== socket) return;

  player.socket = null;
  player.connected = false;
  clearTimeout(player.disconnectTimer);

  const removePlayer = () => {
    const currentRoom = rooms.get(room.code);
    const currentPlayer = currentRoom?.players.get(player.id);
    if (!currentRoom || !currentPlayer || currentPlayer.socket) return;

    currentRoom.players.delete(player.id);
    if (currentRoom.players.size === 0) {
      rooms.delete(currentRoom.code);
    } else {
      broadcastRoom(currentRoom);
    }
  };

  if (removeImmediately) {
    removePlayer();
  } else {
    player.disconnectTimer = setTimeout(removePlayer, reconnectGraceMs);
    broadcastRoom(room);
  }
};

webSocketServer.on("connection", (socket) => {
  socket.on("message", (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      sendError(socket, undefined, "invalid-message", "Invalid message.");
      return;
    }

    const { requestId, playerId } = message;
    if (typeof requestId !== "string" || typeof playerId !== "string") {
      sendError(socket, requestId, "invalid-message", "Invalid message.");
      return;
    }

    if (message.type === "create-room") {
      const name = cleanName(message.name);
      if (!name) {
        sendError(socket, requestId, "invalid-name", "Enter your name.");
        return;
      }

      detachSocket(socket, true);
      const code = createRoomCode();
      const room = { code, players: new Map() };
      room.players.set(playerId, {
        id: playerId,
        name,
        position: "south",
        ready: false,
        connected: true,
        socket,
        disconnectTimer: null,
      });
      rooms.set(code, room);
      socket.membership = { code, playerId };
      broadcastRoom(room, requestId, socket);
      return;
    }

    if (message.type === "join-room") {
      const code = cleanCode(message.code);
      const name = cleanName(message.name);
      const room = rooms.get(code);
      if (!room) {
        sendError(
          socket,
          requestId,
          "room-not-found",
          "That room does not exist. Check the code and try again.",
        );
        return;
      }
      if (!name) {
        sendError(socket, requestId, "invalid-name", "Enter your name.");
        return;
      }

      const existingPlayer = room.players.get(playerId);
      if (!existingPlayer && room.players.size >= 4) {
        sendError(
          socket,
          requestId,
          "room-full",
          "That table is already full.",
        );
        return;
      }

      detachSocket(socket, true);
      if (existingPlayer) {
        clearTimeout(existingPlayer.disconnectTimer);
        if (
          existingPlayer.socket &&
          existingPlayer.socket !== socket &&
          existingPlayer.socket.readyState === WebSocket.OPEN
        ) {
          existingPlayer.socket.close(4001, "Reconnected elsewhere");
        }
        existingPlayer.socket = socket;
        existingPlayer.connected = true;
        existingPlayer.name = name;
      } else {
        room.players.set(playerId, {
          id: playerId,
          name,
          position: positions[room.players.size],
          ready: false,
          connected: true,
          socket,
          disconnectTimer: null,
        });
      }

      socket.membership = { code, playerId };
      broadcastRoom(room, requestId, socket);
      return;
    }

    const membership = socket.membership;
    const room = membership ? rooms.get(membership.code) : null;
    const player = room?.players.get(playerId);
    if (!room || !player || player.socket !== socket) {
      sendError(socket, requestId, "not-in-room", "Join a room first.");
      return;
    }

    if (message.type === "set-ready") {
      player.ready = Boolean(message.ready);
      broadcastRoom(room, requestId, socket);
      return;
    }

    if (message.type === "leave-room") {
      detachSocket(socket, true);
      send(socket, { type: "left-room", requestId });
      return;
    }

    sendError(socket, requestId, "unknown-command", "Unknown command.");
  });

  socket.on("close", () => detachSocket(socket));
});

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Shelem game server listening on port ${port}`);
});
