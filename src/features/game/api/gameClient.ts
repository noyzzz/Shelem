import type { Position, Room } from "@/domain/types";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";
type RoomListener = (room: Room | null) => void;
type StatusListener = (status: ConnectionStatus) => void;

type ServerMessage =
  | { type: "room-state"; requestId?: string; room: Room }
  | { type: "left-room"; requestId: string }
  | { type: "media-token"; requestId: string; token: string; url: string }
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

export type MediaCredentials = {
  token: string;
  url: string;
};

type MediaPendingRequest = {
  resolve: (credentials: MediaCredentials) => void;
  reject: (error: Error) => void;
};

const PLAYER_ID_KEY = "shelem-player-id";
const ROOM_MEMBERSHIP_KEY = "shelem-room-membership";

const readPersistentValue = (key: string) => {
  try {
    const persistentValue = window.localStorage.getItem(key);
    if (persistentValue) return persistentValue;

    const sessionValue = window.sessionStorage.getItem(key);
    if (sessionValue) {
      window.localStorage.setItem(key, sessionValue);
      window.sessionStorage.removeItem(key);
    }
    return sessionValue;
  } catch {
    return window.sessionStorage.getItem(key);
  }
};

const writePersistentValue = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
    window.sessionStorage.removeItem(key);
  } catch {
    window.sessionStorage.setItem(key, value);
  }
};

const removePersistentValue = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Fall back to session storage when persistent storage is unavailable.
  }
  window.sessionStorage.removeItem(key);
};

const getPlayerId = () => {
  const existing = readPersistentValue(PLAYER_ID_KEY);
  if (existing) return existing;

  const created =
    window.crypto.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  writePersistentValue(PLAYER_ID_KEY, created);
  return created;
};

const getRememberedRoom = () => {
  try {
    const stored = readPersistentValue(ROOM_MEMBERSHIP_KEY);
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
  private manuallyStopped = false;
  private roomListeners = new Set<RoomListener>();
  private statusListeners = new Set<StatusListener>();
  private pending = new Map<string, PendingRequest>();
  private mediaPending = new Map<string, MediaPendingRequest>();
  private status: ConnectionStatus = "disconnected";
  private lastJoin = getRememberedRoom();
  private preferredRoomCode: string | null = null;

  get rememberedName() {
    return this.lastJoin?.name ?? "";
  }

  connect(preferredRoomCode?: string) {
    if (preferredRoomCode) {
      this.preferredRoomCode = preferredRoomCode;
    }
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
      if (
        this.lastJoin &&
        (!this.preferredRoomCode ||
          this.lastJoin.code === this.preferredRoomCode)
      ) {
        void this.request({
          type: "join-room",
          code: this.lastJoin.code,
          name: this.lastJoin.name,
        }).catch(() => {
          this.lastJoin = null;
          removePersistentValue(ROOM_MEMBERSHIP_KEY);
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
      } else if (message.type === "media-token") {
        this.mediaPending
          .get(message.requestId)
          ?.resolve({ token: message.token, url: message.url });
        this.mediaPending.delete(message.requestId);
      } else if (message.type === "error" && message.requestId) {
        this.pending.get(message.requestId)?.reject(new Error(message.message));
        this.pending.delete(message.requestId);
        this.mediaPending
          .get(message.requestId)
          ?.reject(new Error(message.message));
        this.mediaPending.delete(message.requestId);
      }
    });
    this.socket.addEventListener("close", () => {
      this.socket = null;
      this.setStatus("disconnected");
      for (const request of this.pending.values()) {
        request.reject(new Error("Connection lost. Please try again."));
      }
      this.pending.clear();
      for (const request of this.mediaPending.values()) {
        request.reject(new Error("Connection lost. Please try again."));
      }
      this.mediaPending.clear();
      if (!this.manuallyStopped) {
        window.setTimeout(() => this.connect(), 1_000);
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

  changeSeat(position: Position) {
    return this.request({ type: "change-seat", position });
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

  completeGround(discardIds: string[]) {
    return this.request({ type: "complete-ground", discardIds });
  }

  playCard(cardId: string) {
    return this.request({ type: "play-card", cardId });
  }

  acknowledgeTrickReview(reviewId: string) {
    return this.request({ type: "acknowledge-trick-review", reviewId });
  }

  setNextHandReady(ready: boolean) {
    return this.request({ type: "set-next-hand-ready", ready });
  }

  requestMediaToken() {
    return new Promise<MediaCredentials>((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error("Connect to the game server before joining voice."));
        return;
      }

      const requestId = window.crypto.randomUUID();
      this.mediaPending.set(requestId, { resolve, reject });
      this.socket.send(
        JSON.stringify({
          type: "request-media-token",
          requestId,
          playerId: this.playerId,
        }),
      );
    });
  }

  leaveRoom() {
    this.lastJoin = null;
    this.preferredRoomCode = null;
    removePersistentValue(ROOM_MEMBERSHIP_KEY);
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
    this.preferredRoomCode = code;
    writePersistentValue(ROOM_MEMBERSHIP_KEY, JSON.stringify(this.lastJoin));
  }
}

export const gameClient = new GameClient();
