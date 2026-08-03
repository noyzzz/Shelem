import { createServer } from "node:http";
import { randomInt } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";

const port = Number(process.env.PORT ?? 3001);
const reconnectGraceMs = Number(process.env.RECONNECT_GRACE_MS ?? 60_000);
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const positions = ["south", "west", "north", "east"];
const suits = ["clubs", "diamonds", "hearts", "spades"];
const ranks = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
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

const serializeRoom = (room, viewerId) => ({
  code: room.code,
  players: [...room.players.values()].map(
    ({ disconnectTimer: _disconnectTimer, socket: _socket, ...player }) =>
      player,
  ),
  ...(room.match
    ? {
        match: {
          phase: room.match.phase,
          handNumber: room.match.handNumber,
          dealerPosition: room.match.dealerPosition,
          firstBidderPosition: room.match.firstBidderPosition,
          groundCount: room.match.ground.length,
          handCounts: Object.fromEntries(
            [...room.match.hands].map(([playerId, hand]) => [
              playerId,
              hand.length,
            ]),
          ),
          yourHand: room.match.hands.get(viewerId) ?? [],
          bidding: {
            currentBid: room.match.bidding.currentBid,
            highBidderId: room.match.bidding.highBidderId,
            currentTurnPlayerId: room.match.bidding.currentTurnPlayerId,
            passedPlayerIds: [...room.match.bidding.passedPlayerIds],
            history: room.match.bidding.history,
            winningBid: room.match.bidding.winningBid,
            winnerId: room.match.bidding.winnerId,
          },
        },
      }
    : {}),
});

const send = (socket, message) => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};

const broadcastRoom = (room, requestId, targetSocket) => {
  for (const player of room.players.values()) {
    const message = {
      type: "room-state",
      room: serializeRoom(room, player.id),
      ...(player.socket === targetSocket && requestId ? { requestId } : {}),
    };
    if (player.socket === targetSocket && requestId) {
      send(player.socket, message);
    } else {
      send(player.socket, message);
    }
  }
};

const createDeck = () =>
  suits.flatMap((suit) => ranks.map((rank) => ({ suit, rank })));

const shuffle = (cards) => {
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
  }
  return cards;
};

const startMatchIfReady = (room) => {
  const players = [...room.players.values()];
  if (
    room.match ||
    players.length !== 4 ||
    players.some((player) => !player.ready || !player.connected)
  ) {
    return;
  }

  const deck = shuffle(createDeck());
  const hands = new Map(players.map((player) => [player.id, []]));
  for (let cardIndex = 0; cardIndex < 48; cardIndex += 1) {
    const player = players[cardIndex % players.length];
    hands.get(player.id).push(deck[cardIndex]);
  }

  const firstBidder = players.find((player) => player.position === "west");
  const secondBidder = players.find((player) => player.position === "north");
  room.match = {
    phase: "bidding",
    handNumber: 1,
    dealerPosition: "south",
    firstBidderPosition: "west",
    hands,
    ground: deck.slice(48),
    bidding: {
      currentBid: 100,
      highBidderId: firstBidder.id,
      currentTurnPlayerId: secondBidder.id,
      passedPlayerIds: new Set(),
      history: [{ playerId: firstBidder.id, amount: 100 }],
      winningBid: null,
      winnerId: null,
    },
  };
};

const advanceBidTurn = (room, currentPlayerId) => {
  const bidding = room.match.bidding;
  const activePlayers = [...room.players.values()].filter(
    (player) => !bidding.passedPlayerIds.has(player.id),
  );
  if (activePlayers.length === 1) {
    bidding.winnerId = activePlayers[0].id;
    bidding.winningBid = bidding.currentBid;
    bidding.currentTurnPlayerId = null;
    room.match.phase = "ground";
    return;
  }

  const currentPlayer = room.players.get(currentPlayerId);
  const currentPositionIndex = positions.indexOf(currentPlayer.position);
  for (let offset = 1; offset <= positions.length; offset += 1) {
    const nextPosition =
      positions[(currentPositionIndex + offset) % positions.length];
    const nextPlayer = activePlayers.find(
      (player) => player.position === nextPosition,
    );
    if (nextPlayer) {
      bidding.currentTurnPlayerId = nextPlayer.id;
      return;
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
      if (room.match) {
        sendError(
          socket,
          requestId,
          "match-started",
          "The match has already started.",
        );
        return;
      }
      player.ready = Boolean(message.ready);
      startMatchIfReady(room);
      broadcastRoom(room, requestId, socket);
      return;
    }

    if (message.type === "place-bid" || message.type === "pass-bid") {
      if (!room.match || room.match.phase !== "bidding") {
        sendError(
          socket,
          requestId,
          "bidding-closed",
          "Bidding is not active.",
        );
        return;
      }

      const bidding = room.match.bidding;
      if (bidding.currentTurnPlayerId !== playerId) {
        sendError(
          socket,
          requestId,
          "not-your-turn",
          "Wait for your turn to bid.",
        );
        return;
      }

      if (message.type === "place-bid") {
        const amount = Number(message.amount);
        if (
          !Number.isInteger(amount) ||
          amount <= bidding.currentBid ||
          amount > 165 ||
          amount % 5 !== 0
        ) {
          sendError(
            socket,
            requestId,
            "invalid-bid",
            `Bid in increments of 5 from ${bidding.currentBid + 5} to 165.`,
          );
          return;
        }

        bidding.currentBid = amount;
        bidding.highBidderId = playerId;
        bidding.history.push({ playerId, amount });
      } else {
        bidding.passedPlayerIds.add(playerId);
        bidding.history.push({ playerId, pass: true });
      }

      advanceBidTurn(room, playerId);
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
