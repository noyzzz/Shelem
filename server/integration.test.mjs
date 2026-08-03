import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { WebSocket } from "ws";

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

before(async () => {
  server = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      RECONNECT_GRACE_MS: "50",
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
  assert.equal(westPass.room.match.phase, "ground");
  assert.equal(westPass.room.match.bidding.winnerId, "north");
  assert.equal(westPass.room.match.bidding.winningBid, 105);
  assert.equal(westPass.room.match.bidding.currentTurnPlayerId, null);

  const northGround = await waitForMessage(
    clients[2],
    (message) => message.room?.match?.phase === "ground",
  );
  assert.equal(northGround.room.match.yourHand.length, 16);
  assert.equal(northGround.room.match.groundCount, 0);

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
  const completedGround = await command(clients[2], {
    type: "complete-ground",
    playerId: "north",
    discardIds,
    trump: "hearts",
  });
  assert.equal(completedGround.room.match.phase, "playing");
  assert.equal(completedGround.room.match.yourHand.length, 12);
  assert.equal(completedGround.room.match.discardCount, 4);
  assert.equal(completedGround.room.match.trump, "hearts");
  assert.equal("discarded" in completedGround.room.match, false);

  const eastPlaying = await waitForMessage(
    clients[3],
    (message) => message.room?.match?.phase === "playing",
  );
  assert.equal(eastPlaying.room.match.yourHand.length, 12);
  assert.equal(eastPlaying.room.match.discardCount, 4);
  assert.equal(eastPlaying.room.match.trump, "hearts");
  assert.equal("discarded" in eastPlaying.room.match, false);

  clients.forEach((client) => client.close());
});
