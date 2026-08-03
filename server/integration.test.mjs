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
  assert.equal(finalReady.room.match.phase, "dealt");

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
    new Set(allDealtCards.map((card) => `${card.rank}-${card.suit}`)).size,
    48,
  );

  for (const [index, state] of dealtStates.entries()) {
    assert.equal(state.room.match.yourHand.length, 12);
    assert.equal(state.room.match.groundCount, 4);
    assert.equal(state.room.match.dealerPosition, "south");
    assert.equal(state.room.match.firstBidderPosition, "west");
    assert.equal(state.room.players[index].position, playerIds[index]);
    assert.equal("ground" in state.room.match, false);
  }

  clients.forEach((client) => client.close());
});
