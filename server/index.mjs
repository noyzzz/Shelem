import { createServer } from "node:http";
import { randomInt } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { calculateHandScore, cardPoints } from "./gameRules.mjs";

const port = Number(process.env.PORT ?? 3001);
const reconnectGraceMs = Number(process.env.RECONNECT_GRACE_MS ?? 60_000);
const botActionDelayMs = Number(process.env.BOT_ACTION_DELAY_MS ?? 350);
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const positions = ["south", "west", "north", "east"];
const suits = ["clubs", "diamonds", "hearts", "spades"];
const ranks = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
const rooms = new Map();

const teamForPosition = (position) =>
  position === "north" || position === "south" ? "one" : "two";

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
  hostPlayerId: room.hostPlayerId,
  score: room.score,
  matchWinnerTeam: room.matchWinnerTeam,
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
          discardCount: room.match.discarded.length,
          trump: room.match.trump,
          nextHandReadyPlayerIds: [
            ...room.match.nextHandReadyPlayerIds,
          ],
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
          play: room.match.play
            ? {
                currentTurnPlayerId: room.match.play.currentTurnPlayerId,
                currentTrick: room.match.play.currentTrick,
                completedTrickCount: room.match.play.completedTricks.length,
                lastTrickWinnerId: room.match.play.lastTrickWinnerId,
                trickWins: Object.fromEntries(
                  [...room.players.keys()].map((playerId) => [
                    playerId,
                    room.match.play.completedTricks.filter(
                      (trick) => trick.winnerId === playerId,
                    ).length,
                  ]),
                ),
              }
            : null,
          result: room.match.result,
          forfeit: room.match.forfeit,
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
  scheduleBotTurn(room);
};

const createDeck = () =>
  suits.flatMap((suit) =>
    ranks.map((rank) => ({ id: `${rank}-${suit}`, suit, rank })),
  );

const shuffle = (cards) => {
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
  }
  return cards;
};

const playerAtPosition = (room, position) =>
  [...room.players.values()].find((player) => player.position === position);

const nextPositionClockwise = (position) =>
  positions[(positions.indexOf(position) + 1) % positions.length];

const startHand = (room, handNumber, dealerPosition) => {
  const deck = shuffle(createDeck());
  const playersInDealOrder = Array.from({ length: 4 }, (_, index) =>
    playerAtPosition(
      room,
      positions[
        (positions.indexOf(dealerPosition) + index + 1) % positions.length
      ],
    ),
  );
  const hands = new Map(
    [...room.players.values()].map((player) => [player.id, []]),
  );
  for (let cardIndex = 0; cardIndex < 48; cardIndex += 1) {
    const player = playersInDealOrder[cardIndex % playersInDealOrder.length];
    hands.get(player.id).push(deck[cardIndex]);
  }

  const firstBidderPosition = nextPositionClockwise(dealerPosition);
  const firstBidder = playerAtPosition(room, firstBidderPosition);
  const secondBidder = playerAtPosition(
    room,
    nextPositionClockwise(firstBidderPosition),
  );
  room.match = {
    phase: "bidding",
    handNumber,
    dealerPosition,
    firstBidderPosition,
    hands,
    ground: deck.slice(48),
    discarded: [],
    trump: null,
    nextHandReadyPlayerIds: new Set(),
    result: null,
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

const startMatchIfReady = (room) => {
  const players = [...room.players.values()];
  if (
    room.match ||
    players.length !== 4 ||
    players.some((player) => !player.ready || !player.connected)
  ) {
    return;
  }

  startHand(room, 1, "south");
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
    room.match.hands
      .get(activePlayers[0].id)
      .push(...room.match.ground);
    room.match.ground = [];
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

const nextPlayerClockwise = (room, currentPlayerId) => {
  const currentPlayer = room.players.get(currentPlayerId);
  const currentPositionIndex = positions.indexOf(currentPlayer.position);
  const nextPosition =
    positions[(currentPositionIndex + 1) % positions.length];
  return [...room.players.values()].find(
    (player) => player.position === nextPosition,
  );
};

const determineTrickWinner = (trick, trump) => {
  const leadSuit = trick[0].card.suit;
  const trumpCards = trick.filter(({ card }) => card.suit === trump);
  const eligibleCards =
    trumpCards.length > 0
      ? trumpCards
      : trick.filter(({ card }) => card.suit === leadSuit);
  return eligibleCards.reduce((winner, play) =>
    ranks.indexOf(play.card.rank) < ranks.indexOf(winner.card.rank)
      ? play
      : winner,
  ).playerId;
};

const completeGroundPhase = (room, playerId, discardIds, trump) => {
  const discardIdSet = new Set(discardIds);
  const hand = room.match.hands.get(playerId);
  room.match.discarded = hand.filter((card) => discardIdSet.has(card.id));
  room.match.hands.set(
    playerId,
    hand.filter((card) => !discardIdSet.has(card.id)),
  );
  room.match.trump = trump;
  room.match.play = {
    currentTurnPlayerId: playerId,
    currentTrick: [],
    completedTricks: [],
    lastTrickWinnerId: null,
  };
  room.match.phase = "playing";
};

const playCardForPlayer = (room, playerId, card) => {
  const play = room.match.play;
  const hand = room.match.hands.get(playerId);
  room.match.hands.set(
    playerId,
    hand.filter((candidate) => candidate.id !== card.id),
  );
  play.currentTrick.push({ playerId, card });

  if (play.currentTrick.length === 4) {
    const winnerId = determineTrickWinner(
      play.currentTrick,
      room.match.trump,
    );
    play.completedTricks.push({
      number: play.completedTricks.length + 1,
      winnerId,
      cards: play.currentTrick,
    });
    play.currentTrick = [];
    play.lastTrickWinnerId = winnerId;
    play.currentTurnPlayerId = winnerId;
    if (play.completedTricks.length === 12) {
      play.currentTurnPlayerId = null;
      scoreCompletedHand(room);
    }
  } else {
    play.currentTurnPlayerId = nextPlayerClockwise(room, playerId).id;
  }
};

const scoreCompletedHand = (room) => {
  const match = room.match;
  const biddingPlayer = room.players.get(match.bidding.winnerId);
  const biddingTeam = teamForPosition(biddingPlayer.position);
  const rawPoints = { one: 0, two: 0 };

  for (const trick of match.play.completedTricks) {
    const winner = room.players.get(trick.winnerId);
    const team = teamForPosition(winner.position);
    rawPoints[team] +=
      5 +
      trick.cards.reduce(
        (total, { card }) => total + cardPoints(card),
        0,
      );
  }

  rawPoints[biddingTeam] +=
    5 +
    match.discarded.reduce(
      (total, card) => total + cardPoints(card),
      0,
    );

  const result = calculateHandScore({
    rawPoints,
    biddingTeam,
    bid: match.bidding.winningBid,
  });

  room.score.one += result.scoreDelta.one;
  room.score.two += result.scoreDelta.two;
  const teamsAtTarget = ["one", "two"].filter(
    (team) => room.score[team] >= 1_000,
  );
  if (teamsAtTarget.length > 0) {
    room.matchWinnerTeam = teamsAtTarget.includes(biddingTeam)
      ? biddingTeam
      : teamsAtTarget[0];
  }

  match.result = {
    ...result,
    matchScore: { ...room.score },
    matchWinnerTeam: room.matchWinnerTeam,
  };
  match.phase = "hand-results";
};

const startNextHandIfReady = (room) => {
  const allPlayersReady =
    room.players.size === 4 &&
    [...room.players.values()].every(
      (candidate) =>
        candidate.connected &&
        room.match.nextHandReadyPlayerIds.has(candidate.id),
    );
  if (!allPlayersReady) return false;

  const previousMatch = room.match;
  startHand(
    room,
    previousMatch.handNumber + 1,
    nextPositionClockwise(previousMatch.dealerPosition),
  );
  return true;
};

const chooseBotGround = (room, playerId) => {
  const hand = room.match.hands.get(playerId);
  const suitStrength = Object.fromEntries(
    suits.map((suit) => [
      suit,
      hand
        .filter((card) => card.suit === suit)
        .reduce(
          (total, card) =>
            total + (ranks.length - ranks.indexOf(card.rank)) + cardPoints(card),
          0,
        ),
    ]),
  );
  const trump = suits.reduce((best, suit) =>
    suitStrength[suit] > suitStrength[best] ? suit : best,
  );
  const weakestFirst = [...hand].sort((left, right) => {
    const leftTrumpPenalty = left.suit === trump ? 100 : 0;
    const rightTrumpPenalty = right.suit === trump ? 100 : 0;
    return (
      leftTrumpPenalty +
      cardPoints(left) * 10 +
      (ranks.length - ranks.indexOf(left.rank)) -
      (rightTrumpPenalty +
        cardPoints(right) * 10 +
        (ranks.length - ranks.indexOf(right.rank)))
    );
  });
  return {
    trump,
    discardIds: weakestFirst.slice(0, 4).map((card) => card.id),
  };
};

const chooseBotCard = (room, playerId) => {
  const hand = room.match.hands.get(playerId);
  const play = room.match.play;
  const leadSuit = play.currentTrick[0]?.card.suit;
  let legalCards = hand;
  if (play.completedTricks.length === 0 && play.currentTrick.length === 0) {
    legalCards = hand.filter((card) => card.suit === room.match.trump);
  } else if (leadSuit && hand.some((card) => card.suit === leadSuit)) {
    legalCards = hand.filter((card) => card.suit === leadSuit);
  }
  return [...legalCards].sort(
    (left, right) =>
      ranks.indexOf(right.rank) - ranks.indexOf(left.rank),
  )[0];
};

const runBotTurn = (room) => {
  if (!room.match || room.matchWinnerTeam) return;
  const match = room.match;

  if (match.phase === "hand-results") {
    let changed = false;
    for (const player of room.players.values()) {
      if (player.isBot && !match.nextHandReadyPlayerIds.has(player.id)) {
        match.nextHandReadyPlayerIds.add(player.id);
        changed = true;
      }
    }
    if (!changed) return;
    startNextHandIfReady(room);
    broadcastRoom(room);
    return;
  }

  if (match.phase === "bidding") {
    const player = room.players.get(match.bidding.currentTurnPlayerId);
    if (!player?.isBot) return;
    match.bidding.passedPlayerIds.add(player.id);
    match.bidding.history.push({ playerId: player.id, pass: true });
    advanceBidTurn(room, player.id);
    broadcastRoom(room);
    return;
  }

  if (match.phase === "ground") {
    const player = room.players.get(match.bidding.winnerId);
    if (!player?.isBot) return;
    const { discardIds, trump } = chooseBotGround(room, player.id);
    completeGroundPhase(room, player.id, discardIds, trump);
    broadcastRoom(room);
    return;
  }

  if (match.phase === "playing") {
    const player = room.players.get(match.play.currentTurnPlayerId);
    if (!player?.isBot) return;
    const card = chooseBotCard(room, player.id);
    playCardForPlayer(room, player.id, card);
    broadcastRoom(room);
  }
};

const scheduleBotTurn = (room) => {
  clearTimeout(room.botTimer);
  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    runBotTurn(room);
  }, botActionDelayMs);
};

const forfeitMatch = (room, player, reason) => {
  if (!room.match || room.matchWinnerTeam) return;

  const losingTeam = teamForPosition(player.position);
  const winningTeam = losingTeam === "one" ? "two" : "one";
  room.matchWinnerTeam = winningTeam;
  room.match.phase = "match-complete";
  room.match.forfeit = {
    losingPlayerId: player.id,
    losingPlayerName: player.name,
    losingTeam,
    winningTeam,
    reason,
  };
  if (room.match.play) {
    room.match.play.currentTurnPlayerId = null;
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

    forfeitMatch(
      currentRoom,
      currentPlayer,
      removeImmediately ? "left" : "disconnected",
    );
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
      const room = {
        code,
        hostPlayerId: playerId,
        players: new Map(),
        score: { one: 0, two: 0 },
        matchWinnerTeam: null,
      };
      room.players.set(playerId, {
        id: playerId,
        name,
        position: "south",
        ready: false,
        connected: true,
        isBot: false,
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
          isBot: false,
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

    if (message.type === "fill-with-bots" || message.type === "remove-bots") {
      if (room.hostPlayerId !== playerId) {
        sendError(
          socket,
          requestId,
          "host-only",
          "Only the room host can manage bots.",
        );
        return;
      }
      if (room.match) {
        sendError(
          socket,
          requestId,
          "match-started",
          "Bots can only be changed before the match starts.",
        );
        return;
      }

      if (message.type === "remove-bots") {
        for (const candidate of room.players.values()) {
          if (candidate.isBot) room.players.delete(candidate.id);
        }
      } else {
        const occupiedPositions = new Set(
          [...room.players.values()].map((candidate) => candidate.position),
        );
        for (const position of positions) {
          if (occupiedPositions.has(position)) continue;
          const botId = `bot-${room.code}-${position}`;
          room.players.set(botId, {
            id: botId,
            name: `Bot ${position[0].toUpperCase()}${position.slice(1)}`,
            position,
            ready: true,
            connected: true,
            isBot: true,
            socket: null,
            disconnectTimer: null,
          });
        }
        startMatchIfReady(room);
      }
      broadcastRoom(room, requestId, socket);
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

    if (message.type === "complete-ground") {
      if (!room.match || room.match.phase !== "ground") {
        sendError(
          socket,
          requestId,
          "ground-closed",
          "The ground phase is not active.",
        );
        return;
      }

      if (room.match.bidding.winnerId !== playerId) {
        sendError(
          socket,
          requestId,
          "not-winning-bidder",
          "Only the winning bidder can discard and declare trump.",
        );
        return;
      }

      const discardIds = Array.isArray(message.discardIds)
        ? message.discardIds.filter((id) => typeof id === "string")
        : [];
      const uniqueDiscardIds = new Set(discardIds);
      const trump = typeof message.trump === "string" ? message.trump : "";
      const hand = room.match.hands.get(playerId);
      const remainingHand = hand.filter(
        (card) => !uniqueDiscardIds.has(card.id),
      );
      if (
        discardIds.length !== 4 ||
        uniqueDiscardIds.size !== 4 ||
        discardIds.some((id) => !hand.some((card) => card.id === id))
      ) {
        sendError(
          socket,
          requestId,
          "invalid-discard",
          "Select exactly four cards from your hand.",
        );
        return;
      }
      if (!suits.includes(trump)) {
        sendError(
          socket,
          requestId,
          "invalid-trump",
          "Choose a valid trump suit.",
        );
        return;
      }
      if (!remainingHand.some((card) => card.suit === trump)) {
        sendError(
          socket,
          requestId,
          "invalid-trump",
          "Keep at least one card in the trump suit for the opening lead.",
        );
        return;
      }

      completeGroundPhase(room, playerId, discardIds, trump);
      broadcastRoom(room, requestId, socket);
      return;
    }

    if (message.type === "play-card") {
      if (!room.match || room.match.phase !== "playing") {
        sendError(
          socket,
          requestId,
          "play-closed",
          "Card play is not active.",
        );
        return;
      }

      const play = room.match.play;
      if (play.currentTurnPlayerId !== playerId) {
        sendError(
          socket,
          requestId,
          "not-your-turn",
          "Wait for your turn to play.",
        );
        return;
      }

      const hand = room.match.hands.get(playerId);
      const card = hand.find((candidate) => candidate.id === message.cardId);
      if (!card) {
        sendError(
          socket,
          requestId,
          "invalid-card",
          "That card is not in your hand.",
        );
        return;
      }

      if (
        play.completedTricks.length === 0 &&
        play.currentTrick.length === 0 &&
        card.suit !== room.match.trump
      ) {
        sendError(
          socket,
          requestId,
          "trump-lead-required",
          "The bidder must lead the first trick with a trump card.",
        );
        return;
      }

      const leadSuit = play.currentTrick[0]?.card.suit;
      if (
        leadSuit &&
        card.suit !== leadSuit &&
        hand.some((candidate) => candidate.suit === leadSuit)
      ) {
        sendError(
          socket,
          requestId,
          "must-follow-suit",
          `You must follow ${leadSuit}.`,
        );
        return;
      }

      playCardForPlayer(room, playerId, card);

      broadcastRoom(room, requestId, socket);
      return;
    }

    if (message.type === "set-next-hand-ready") {
      if (!room.match || room.match.phase !== "hand-results") {
        sendError(
          socket,
          requestId,
          "hand-not-complete",
          "The current hand is not complete.",
        );
        return;
      }
      if (room.matchWinnerTeam) {
        sendError(
          socket,
          requestId,
          "match-complete",
          "The match is already complete.",
        );
        return;
      }

      if (message.ready) {
        room.match.nextHandReadyPlayerIds.add(playerId);
      } else {
        room.match.nextHandReadyPlayerIds.delete(playerId);
      }

      startNextHandIfReady(room);

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
