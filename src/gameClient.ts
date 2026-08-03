export type Position = "north" | "south" | "east" | "west";
export type Team = "one" | "two";

export type Player = {
  id: string;
  name: string;
  position: Position;
  ready: boolean;
  connected: boolean;
  isBot: boolean;
};

export type Card = {
  id: string;
  suit: "clubs" | "diamonds" | "hearts" | "spades";
  rank:
    | "A"
    | "K"
    | "Q"
    | "J"
    | "10"
    | "9"
    | "8"
    | "7"
    | "6"
    | "5"
    | "4"
    | "3"
    | "2";
};

export type Match = {
  phase:
    | "bidding"
    | "ground-reveal"
    | "ground"
    | "playing"
    | "hand-results"
    | "match-complete";
  handNumber: number;
  dealerPosition: Position;
  firstBidderPosition: Position;
  groundCount: number;
  groundCards: Card[];
  discardCount: number;
  trump: Card["suit"] | null;
  nextHandReadyPlayerIds: string[];
  handCounts: Record<string, number>;
  yourHand: Card[];
  bidding: {
    currentBid: number;
    highBidderId: string;
    currentTurnPlayerId: string | null;
    passedPlayerIds: string[];
    history: Array<
      | { playerId: string; amount: number }
      | { playerId: string; pass: true }
    >;
    winningBid: number | null;
    winnerId: string | null;
  };
  play: {
    currentTurnPlayerId: string | null;
    currentTrick: Array<{ playerId: string; card: Card }>;
    completedTrickCount: number;
    lastTrickWinnerId: string | null;
    trickWins: Record<string, number>;
  } | null;
  result?: {
    bid: number;
    biddingTeam: Team;
    defendingTeam: Team;
    rawPoints: Record<Team, number>;
    scoreDelta: Record<Team, number>;
    madeBid: boolean;
    shelem: boolean;
    matchScore: Record<Team, number>;
    matchWinnerTeam: Team | null;
  };
  forfeit?: {
    losingPlayerId: string;
    losingPlayerName: string;
    losingTeam: Team;
    winningTeam: Team;
    reason: "left" | "disconnected";
  };
};

export type Room = {
  code: string;
  hostPlayerId: string;
  players: Player[];
  score: Record<Team, number>;
  matchWinnerTeam: Team | null;
  match?: Match;
};

type ConnectionStatus = "connecting" | "connected" | "disconnected";
type RoomListener = (room: Room | null) => void;
type StatusListener = (status: ConnectionStatus) => void;

type ServerMessage =
  | { type: "room-state"; requestId?: string; room: Room }
  | { type: "left-room"; requestId: string }
  | {
      type: "error";
      requestId?: string;
      code: string;
      message: string;
    };

type PendingRequest = {
  resolve: (room: Room | null) => void;
  reject: (error: Error) => void;
};

const getPlayerId = () => {
  const existing = window.sessionStorage.getItem("shelem-player-id");
  if (existing) return existing;

  const created =
    window.crypto.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.sessionStorage.setItem("shelem-player-id", created);
  return created;
};

const getRememberedRoom = () => {
  try {
    const stored = window.sessionStorage.getItem("shelem-room-membership");
    return stored
      ? (JSON.parse(stored) as { code: string; name: string })
      : null;
  } catch {
    return null;
  }
};

class GameClient {
  readonly playerId = getPlayerId();
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private manuallyStopped = false;
  private roomListeners = new Set<RoomListener>();
  private statusListeners = new Set<StatusListener>();
  private pending = new Map<string, PendingRequest>();
  private status: ConnectionStatus = "disconnected";
  private lastJoin = getRememberedRoom();

  connect() {
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    this.manuallyStopped = false;
    this.setStatus("connecting");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

    this.socket.addEventListener("open", () => {
      this.setStatus("connected");
      if (this.lastJoin) {
        void this.request({
          type: "join-room",
          code: this.lastJoin.code,
          name: this.lastJoin.name,
        }).catch(() => {
          this.lastJoin = null;
          window.sessionStorage.removeItem("shelem-room-membership");
          this.roomListeners.forEach((listener) => listener(null));
        });
      }
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === "room-state") {
        this.roomListeners.forEach((listener) => listener(message.room));
        if (message.requestId) {
          this.pending.get(message.requestId)?.resolve(message.room);
          this.pending.delete(message.requestId);
        }
      } else if (message.type === "left-room") {
        this.pending.get(message.requestId)?.resolve(null);
        this.pending.delete(message.requestId);
      } else if (message.type === "error" && message.requestId) {
        this.pending.get(message.requestId)?.reject(new Error(message.message));
        this.pending.delete(message.requestId);
      }
    });
    this.socket.addEventListener("close", () => {
      this.socket = null;
      this.setStatus("disconnected");
      for (const request of this.pending.values()) {
        request.reject(new Error("Connection lost. Please try again."));
      }
      this.pending.clear();
      if (!this.manuallyStopped) {
        this.reconnectTimer = window.setTimeout(() => this.connect(), 1_000);
      }
    });
  }

  subscribeToRoom(listener: RoomListener) {
    this.roomListeners.add(listener);
    return () => this.roomListeners.delete(listener);
  }

  subscribeToStatus(listener: StatusListener) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  async createRoom(name: string) {
    const room = await this.request({ type: "create-room", name });
    if (room) this.rememberRoom(room.code, name);
    return room;
  }

  async joinRoom(code: string, name: string) {
    const room = await this.request({ type: "join-room", code, name });
    if (room) this.rememberRoom(room.code, name);
    return room;
  }

  setReady(ready: boolean) {
    return this.request({ type: "set-ready", ready });
  }

  fillWithBots() {
    return this.request({ type: "fill-with-bots" });
  }

  removeBots() {
    return this.request({ type: "remove-bots" });
  }

  placeBid(amount: number) {
    return this.request({ type: "place-bid", amount });
  }

  passBid() {
    return this.request({ type: "pass-bid" });
  }

  completeGround(discardIds: string[], trump: Card["suit"]) {
    return this.request({ type: "complete-ground", discardIds, trump });
  }

  playCard(cardId: string) {
    return this.request({ type: "play-card", cardId });
  }

  setNextHandReady(ready: boolean) {
    return this.request({ type: "set-next-hand-ready", ready });
  }

  leaveRoom() {
    this.lastJoin = null;
    window.sessionStorage.removeItem("shelem-room-membership");
    return this.request({ type: "leave-room" });
  }

  private request(command: Record<string, unknown>) {
    return new Promise<Room | null>((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error("Connecting to the game server. Please try again."));
        return;
      }

      const requestId = window.crypto.randomUUID();
      this.pending.set(requestId, { resolve, reject });
      this.socket.send(
        JSON.stringify({
          ...command,
          requestId,
          playerId: this.playerId,
        }),
      );
    });
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private rememberRoom(code: string, name: string) {
    this.lastJoin = { code, name };
    window.sessionStorage.setItem(
      "shelem-room-membership",
      JSON.stringify(this.lastJoin),
    );
  }
}

export const gameClient = new GameClient();
