import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { WebSocket } from "ws";
import { calculateHandScore, cardPoints } from "./gameRules.mjs";

const port = 3101;
const url = `ws://127.0.0.1:${port}/ws`;
let server;
const inboxes = new WeakMap();

const waitForServer = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      // The child process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Game server did not start.");
};

const connect = () =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const inbox = { messages: [], waiters: [] };
    inboxes.set(socket, inbox);
    socket.on("message", (data) => {
      const message = JSON.parse(data.toString());
      const waiter = inbox.waiters.shift();
      if (waiter) {
        clearTimeout(waiter.timer);
        waiter.resolve(message);
      } else inbox.messages.push(message);
    });
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });

const nextMessage = (socket) => {
  const inbox = inboxes.get(socket);
  const existing = inbox.messages.shift();
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const waiter = {
      resolve,
      timer: setTimeout(
        () => reject(new Error("Timed out waiting for a server message.")),
        2_000,
      ),
    };
    inbox.waiters.push(waiter);
  });
};

const command = async (socket, message) => {
  const requestId = crypto.randomUUID();
  socket.send(JSON.stringify({ ...message, requestId }));

  while (true) {
    const response = await nextMessage(socket);
    if (response.requestId === requestId) return response;
  }
};

const waitForMessage = async (socket, predicate) => {
  while (true) {
    const message = await nextMessage(socket);
    if (predicate(message)) return message;
  }
};

test("hand scoring covers made bids, missed bids, and Shelem", () => {
  assert.deepEqual(
    calculateHandScore({
      rawPoints: { one: 145, two: 20 },
      biddingTeam: "one",
      bid: 140,
    }),
    {
      bid: 140,
      biddingTeam: "one",
      defendingTeam: "two",
      rawPoints: { one: 145, two: 20 },
      scoreDelta: { one: 145, two: 20 },
      madeBid: true,
      shelem: false,
    },
  );
  assert.deepEqual(
    calculateHandScore({
      rawPoints: { one: 135, two: 30 },
      biddingTeam: "one",
      bid: 140,
    }).scoreDelta,
    { one: -140, two: 30 },
  );
  assert.deepEqual(
    calculateHandScore({
      rawPoints: { one: 0, two: 165 },
      biddingTeam: "two",
      bid: 120,
    }).scoreDelta,
    { one: -165, two: 165 },
  );
});

before(async () => {
  server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      RECONNECT_GRACE_MS: "50",
      BOT_ACTION_DELAY_MS: "1",
      GROUND_REVEAL_MS: "5",
    },
    stdio: "ignore",
  });
  await waitForServer();
});

after(() => {
  server.kill();
});

test("creates, validates, synchronizes, and cleans up rooms", async () => {
  const host = await connect();
  const guest = await connect();
  const stranger = await connect();

  const created = await command(host, {
    type: "create-room",
    playerId: "host",
    name: "Host",
  });
  assert.equal(created.type, "room-state");
  assert.equal(created.room.players.length, 1);

  const rejected = await command(stranger, {
    type: "join-room",
    playerId: "stranger",
    name: "Stranger",
    code: "BAD999",
  });
  assert.equal(rejected.type, "error");
  assert.equal(rejected.code, "room-not-found");

  const hostSawJoin = nextMessage(host);
  const joined = await command(guest, {
    type: "join-room",
    playerId: "guest",
    name: "Guest",
    code: created.room.code,
  });
  assert.equal(joined.room.players.length, 2);
  assert.equal((await hostSawJoin).room.players.length, 2);

  const rejectedBotManagement = await command(guest, {
    type: "fill-with-bots",
    playerId: "guest",
  });
  assert.equal(rejectedBotManagement.code, "host-only");

  const hostSawReady = nextMessage(host);
  await command(guest, {
    type: "set-ready",
    playerId: "guest",
    ready: true,
  });
  const readyState = await hostSawReady;
  assert.equal(
    readyState.room.players.find((player) => player.id === "guest").ready,
    true,
  );

  const hostSawDisconnect = nextMessage(host);
  guest.close();
  const disconnectedState = await hostSawDisconnect;
  assert.equal(
    disconnectedState.room.players.find((player) => player.id === "guest")
      .connected,
    false,
  );
  const removedState = await nextMessage(host);
  assert.equal(removedState.room.players.length, 1);

  host.close();
  stranger.close();
});

test("one human can complete a hand with three bots", async () => {
  const host = await connect();
  const playerId = "solo-host";
  const created = await command(host, {
    type: "create-room",
    playerId,
    name: "Solo Host",
  });
  assert.equal(created.room.hostPlayerId, playerId);

  const filled = await command(host, {
    type: "fill-with-bots",
    playerId,
  });
  assert.equal(filled.room.players.length, 4);
  assert.equal(
    filled.room.players.filter((player) => player.isBot).length,
    3,
  );
  assert.equal(
    filled.room.players
      .filter((player) => player.isBot)
      .every((player) => player.ready && player.connected),
    true,
  );

  const cleared = await command(host, {
    type: "remove-bots",
    playerId,
  });
  assert.equal(cleared.room.players.length, 1);
  await command(host, { type: "fill-with-bots", playerId });

  let state = await command(host, {
    type: "set-ready",
    playerId,
    ready: true,
  });
  assert.equal(state.room.match.phase, "bidding");

  while (state.room.match.phase !== "hand-results") {
    const match = state.room.match;
    if (
      match.phase === "bidding" &&
      match.bidding.currentTurnPlayerId === playerId
    ) {
      state = await command(host, { type: "pass-bid", playerId });
      continue;
    }

    if (
      match.phase === "ground" &&
      match.bidding.winnerId === playerId
    ) {
      const discardIds = match.yourHand.slice(0, 4).map((card) => card.id);
      const retainedCards = match.yourHand.filter(
        (card) => !discardIds.includes(card.id),
      );
      state = await command(host, {
        type: "complete-ground",
        playerId,
        discardIds,
        trump: retainedCards[0].suit,
      });
      continue;
    }

    if (
      match.phase === "playing" &&
      match.play.currentTurnPlayerId === playerId
    ) {
      const leadSuit = match.play.currentTrick[0]?.card.suit;
      const followingCards = leadSuit
        ? match.yourHand.filter((card) => card.suit === leadSuit)
        : [];
      const legalCards =
        followingCards.length > 0 ? followingCards : match.yourHand;
      state = await command(host, {
        type: "play-card",
        playerId,
        cardId: legalCards[0].id,
      });
      continue;
    }

    state = await nextMessage(host);
  }

  assert.equal(
    state.room.match.result.rawPoints.one +
      state.room.match.result.rawPoints.two,
    165,
  );
  const botsReady = await waitForMessage(
    host,
    (message) =>
      message.room?.match?.phase === "hand-results" &&
      message.room.match.nextHandReadyPlayerIds.length === 3,
  );
  assert.equal(botsReady.room.match.play.completedTrickCount, 12);

  const secondHand = await command(host, {
    type: "set-next-hand-ready",
    playerId,
    ready: true,
  });
  assert.equal(secondHand.room.match.handNumber, 2);
  assert.equal(secondHand.room.match.dealerPosition, "west");

  host.close();
});

test("starts a four-player hand and deals private cards", async () => {
  const clients = await Promise.all([
    connect(),
    connect(),
    connect(),
    connect(),
  ]);
  const playerIds = ["south", "west", "north", "east"];

  const created = await command(clients[0], {
    type: "create-room",
    playerId: playerIds[0],
    name: "South",
  });

  for (let index = 1; index < clients.length; index += 1) {
    await command(clients[index], {
      type: "join-room",
      playerId: playerIds[index],
      name: playerIds[index],
      code: created.room.code,
    });
  }

  for (let index = 0; index < clients.length - 1; index += 1) {
    await command(clients[index], {
      type: "set-ready",
      playerId: playerIds[index],
      ready: true,
    });
  }

  const finalReady = await command(clients[3], {
    type: "set-ready",
    playerId: playerIds[3],
    ready: true,
  });
  assert.equal(finalReady.room.match.phase, "bidding");

  const dealtStates = await Promise.all(
    clients.map((client, index) =>
      index === 3
        ? finalReady
        : waitForMessage(client, (message) => Boolean(message.room?.match)),
    ),
  );

  const allDealtCards = dealtStates.flatMap(
    (message) => message.room.match.yourHand,
  );
  assert.equal(allDealtCards.length, 48);
  assert.equal(
    new Set(allDealtCards.map((card) => card.id)).size,
    48,
  );

  for (const [index, state] of dealtStates.entries()) {
    assert.equal(state.room.match.yourHand.length, 12);
    assert.equal(state.room.match.groundCount, 4);
    assert.equal(state.room.match.dealerPosition, "south");
    assert.equal(state.room.match.firstBidderPosition, "west");
    assert.equal(state.room.match.bidding.currentBid, 100);
    assert.equal(state.room.match.bidding.highBidderId, "west");
    assert.equal(state.room.match.bidding.currentTurnPlayerId, "north");
    assert.equal(state.room.players[index].position, playerIds[index]);
    assert.equal("ground" in state.room.match, false);
  }

  const outOfTurn = await command(clients[0], {
    type: "place-bid",
    playerId: "south",
    amount: 105,
  });
  assert.equal(outOfTurn.code, "not-your-turn");

  const invalidIncrement = await command(clients[2], {
    type: "place-bid",
    playerId: "north",
    amount: 103,
  });
  assert.equal(invalidIncrement.code, "invalid-bid");

  const northBid = await command(clients[2], {
    type: "place-bid",
    playerId: "north",
    amount: 105,
  });
  assert.equal(northBid.room.match.bidding.currentBid, 105);
  assert.equal(northBid.room.match.bidding.currentTurnPlayerId, "east");

  const eastPass = await command(clients[3], {
    type: "pass-bid",
    playerId: "east",
  });
  assert.deepEqual(eastPass.room.match.bidding.passedPlayerIds, ["east"]);
  assert.equal(eastPass.room.match.bidding.currentTurnPlayerId, "south");

  const southPass = await command(clients[0], {
    type: "pass-bid",
    playerId: "south",
  });
  assert.equal(southPass.room.match.bidding.currentTurnPlayerId, "west");

  const westPass = await command(clients[1], {
    type: "pass-bid",
    playerId: "west",
  });
  assert.equal(westPass.room.match.phase, "ground-reveal");
  assert.equal(westPass.room.match.bidding.winnerId, "north");
  assert.equal(westPass.room.match.bidding.winningBid, 105);
  assert.equal(westPass.room.match.bidding.currentTurnPlayerId, null);
  assert.equal(westPass.room.match.groundCount, 4);
  assert.equal(westPass.room.match.groundCards.length, 4);

  const northGround = await waitForMessage(
    clients[2],
    (message) => message.room?.match?.phase === "ground",
  );
  assert.equal(northGround.room.match.yourHand.length, 16);
  assert.equal(northGround.room.match.groundCount, 0);
  assert.deepEqual(northGround.room.match.groundCards, []);

  const wrongPlayer = await command(clients[0], {
    type: "complete-ground",
    playerId: "south",
    discardIds: [],
    trump: "hearts",
  });
  assert.equal(wrongPlayer.code, "not-winning-bidder");

  const invalidDiscard = await command(clients[2], {
    type: "complete-ground",
    playerId: "north",
    discardIds: northGround.room.match.yourHand.slice(0, 3).map((card) => card.id),
    trump: "hearts",
  });
  assert.equal(invalidDiscard.code, "invalid-discard");

  const discardIds = northGround.room.match.yourHand
    .slice(0, 4)
    .map((card) => card.id);
  const discardedCards = northGround.room.match.yourHand.filter((card) =>
    discardIds.includes(card.id),
  );
  const retainedCards = northGround.room.match.yourHand.filter(
    (card) => !discardIds.includes(card.id),
  );
  const trump = retainedCards[0].suit;
  const completedGround = await command(clients[2], {
    type: "complete-ground",
    playerId: "north",
    discardIds,
    trump,
  });
  assert.equal(completedGround.room.match.phase, "playing");
  assert.equal(completedGround.room.match.yourHand.length, 12);
  assert.equal(completedGround.room.match.discardCount, 4);
  assert.equal(completedGround.room.match.trump, trump);
  assert.equal("discarded" in completedGround.room.match, false);

  const eastPlaying = await waitForMessage(
    clients[3],
    (message) => message.room?.match?.phase === "playing",
  );
  assert.equal(eastPlaying.room.match.yourHand.length, 12);
  assert.equal(eastPlaying.room.match.discardCount, 4);
  assert.equal(eastPlaying.room.match.trump, trump);
  assert.equal("discarded" in eastPlaying.room.match, false);

  const clientByPlayerId = new Map(
    playerIds.map((playerId, index) => [playerId, clients[index]]),
  );
  const hands = new Map([
    ["south", [...dealtStates[0].room.match.yourHand]],
    ["west", [...dealtStates[1].room.match.yourHand]],
    ["north", [...completedGround.room.match.yourHand]],
    ["east", [...dealtStates[3].room.match.yourHand]],
  ]);
  const rankOrder = [
    "A",
    "K",
    "Q",
    "J",
    "10",
    "9",
    "8",
    "7",
    "6",
    "5",
    "4",
    "3",
    "2",
  ];
  const expectedWinner = (trick) => {
    const leadSuit = trick[0].card.suit;
    const trumpCards = trick.filter(({ card }) => card.suit === trump);
    const eligible =
      trumpCards.length > 0
        ? trumpCards
        : trick.filter(({ card }) => card.suit === leadSuit);
    return eligible.reduce((winner, play) =>
      rankOrder.indexOf(play.card.rank) < rankOrder.indexOf(winner.card.rank)
        ? play
        : winner,
    ).playerId;
  };
  const teamForPlayerId = (playerId) =>
    playerId === "north" || playerId === "south" ? "one" : "two";
  const expectedRawPoints = {
    one:
      5 +
      discardedCards.reduce(
        (total, card) => total + cardPoints(card),
        0,
      ),
    two: 0,
  };

  let playState = completedGround;
  let followSuitRejectionChecked = false;
  for (let playIndex = 0; playIndex < 48; playIndex += 1) {
    const play = playState.room.match.play;
    const currentPlayerId = play.currentTurnPlayerId;
    const hand = hands.get(currentPlayerId);
    const leadSuit = play.currentTrick[0]?.card.suit;
    let legalCards = hand;
    if (play.completedTrickCount === 0 && play.currentTrick.length === 0) {
      legalCards = hand.filter((card) => card.suit === trump);
    } else if (leadSuit && hand.some((card) => card.suit === leadSuit)) {
      legalCards = hand.filter((card) => card.suit === leadSuit);
    }

    if (
      !followSuitRejectionChecked &&
      leadSuit &&
      hand.some((card) => card.suit === leadSuit) &&
      hand.some((card) => card.suit !== leadSuit)
    ) {
      const illegalCard = hand.find((card) => card.suit !== leadSuit);
      const rejectedPlay = await command(clientByPlayerId.get(currentPlayerId), {
        type: "play-card",
        playerId: currentPlayerId,
        cardId: illegalCard.id,
      });
      assert.equal(rejectedPlay.code, "must-follow-suit");
      followSuitRejectionChecked = true;
    }

    const card = legalCards[0];
    const completedTrick =
      play.currentTrick.length === 3
        ? [...play.currentTrick, { playerId: currentPlayerId, card }]
        : null;
    const response = await command(clientByPlayerId.get(currentPlayerId), {
      type: "play-card",
      playerId: currentPlayerId,
      cardId: card.id,
    });
    hands.set(
      currentPlayerId,
      hand.filter((candidate) => candidate.id !== card.id),
    );

    if (completedTrick) {
      const winnerId = expectedWinner(completedTrick);
      assert.equal(
        response.room.match.play.lastTrickWinnerId,
        winnerId,
      );
      expectedRawPoints[teamForPlayerId(winnerId)] +=
        5 +
        completedTrick.reduce(
          (total, { card: playedCard }) =>
            total + cardPoints(playedCard),
          0,
        );
    }
    playState = response;
  }

  assert.equal(playState.room.match.phase, "hand-results");
  assert.equal(playState.room.match.play.completedTrickCount, 12);
  assert.equal(playState.room.match.play.currentTurnPlayerId, null);
  assert.equal(
    Object.values(playState.room.match.play.trickWins).reduce(
      (total, wins) => total + wins,
      0,
    ),
    12,
  );
  assert.equal(
    [...hands.values()].reduce((total, hand) => total + hand.length, 0),
    0,
  );
  assert.equal(followSuitRejectionChecked, true);
  assert.equal(expectedRawPoints.one + expectedRawPoints.two, 165);
  assert.deepEqual(playState.room.match.result.rawPoints, expectedRawPoints);
  const expectedResult = calculateHandScore({
    rawPoints: expectedRawPoints,
    biddingTeam: "one",
    bid: 105,
  });
  assert.deepEqual(playState.room.match.result.scoreDelta, expectedResult.scoreDelta);
  assert.deepEqual(playState.room.score, expectedResult.scoreDelta);
  assert.equal(playState.room.match.result.madeBid, expectedResult.madeBid);
  assert.equal(playState.room.match.result.shelem, expectedResult.shelem);
  assert.deepEqual(playState.room.match.nextHandReadyPlayerIds, []);

  for (let playerIndex = 0; playerIndex < 3; playerIndex += 1) {
    const readyState = await command(clients[playerIndex], {
      type: "set-next-hand-ready",
      playerId: playerIds[playerIndex],
      ready: true,
    });
    assert.equal(readyState.room.match.phase, "hand-results");
    assert.equal(
      readyState.room.match.nextHandReadyPlayerIds.length,
      playerIndex + 1,
    );
  }

  const nextHand = await command(clients[3], {
    type: "set-next-hand-ready",
    playerId: playerIds[3],
    ready: true,
  });
  assert.equal(nextHand.room.match.phase, "bidding");
  assert.equal(nextHand.room.match.handNumber, 2);
  assert.equal(nextHand.room.match.dealerPosition, "west");
  assert.equal(nextHand.room.match.firstBidderPosition, "north");
  assert.equal(nextHand.room.match.bidding.highBidderId, "north");
  assert.equal(nextHand.room.match.bidding.currentTurnPlayerId, "east");
  assert.deepEqual(nextHand.room.score, expectedResult.scoreDelta);
  assert.deepEqual(nextHand.room.match.nextHandReadyPlayerIds, []);

  const nextHandStates = await Promise.all(
    clients.map((client, index) =>
      index === 3
        ? nextHand
        : waitForMessage(
            client,
            (message) => message.room?.match?.handNumber === 2,
          ),
    ),
  );
  const nextDealCards = nextHandStates.flatMap(
    (message) => message.room.match.yourHand,
  );
  assert.equal(nextDealCards.length, 48);
  assert.equal(new Set(nextDealCards.map((card) => card.id)).size, 48);

  const southSawDisconnect = nextMessage(clients[0]);
  clients[1].close();
  const disconnectedPlayerState = await southSawDisconnect;
  assert.equal(
    disconnectedPlayerState.room.players.find(
      (player) => player.id === "west",
    ).connected,
    false,
  );
  assert.equal(disconnectedPlayerState.room.match.phase, "bidding");
  assert.equal(disconnectedPlayerState.room.matchWinnerTeam, null);

  const forfeitState = await waitForMessage(
    clients[0],
    (message) => message.room?.match?.phase === "match-complete",
  );
  assert.equal(forfeitState.room.matchWinnerTeam, "one");
  assert.equal(forfeitState.room.match.forfeit.losingPlayerId, "west");
  assert.equal(forfeitState.room.match.forfeit.winningTeam, "one");
  assert.equal(forfeitState.room.match.forfeit.reason, "disconnected");
  assert.equal(
    forfeitState.room.players.some((player) => player.id === "west"),
    false,
  );

  clients[0].close();
  clients[2].close();
  clients[3].close();
});

test("leaving an active match forfeits immediately", async () => {
  const clients = await Promise.all([
    connect(),
    connect(),
    connect(),
    connect(),
  ]);
  const playerIds = ["leave-south", "leave-west", "leave-north", "leave-east"];
  const playerNames = ["south", "west", "north", "east"];
  const created = await command(clients[0], {
    type: "create-room",
    playerId: playerIds[0],
    name: "South",
  });

  for (let index = 1; index < clients.length; index += 1) {
    await command(clients[index], {
      type: "join-room",
      playerId: playerIds[index],
      name: playerNames[index],
      code: created.room.code,
    });
  }
  for (let index = 0; index < clients.length; index += 1) {
    await command(clients[index], {
      type: "set-ready",
      playerId: playerIds[index],
      ready: true,
    });
  }

  const observerSawForfeit = waitForMessage(
    clients[0],
    (message) => message.room?.match?.phase === "match-complete",
  );
  await command(clients[1], {
    type: "leave-room",
    playerId: playerIds[1],
  });
  const forfeitState = await observerSawForfeit;
  assert.equal(forfeitState.room.matchWinnerTeam, "one");
  assert.equal(forfeitState.room.match.forfeit.reason, "left");
  assert.equal(forfeitState.room.match.forfeit.losingPlayerName, "west");

  clients[0].close();
  clients[2].close();
  clients[3].close();
});
