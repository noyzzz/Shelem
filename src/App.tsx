import { FormEvent, useEffect, useState } from "react";
import {
  gameClient,
  type Card,
  type Player,
  type Position,
  type Room,
} from "./gameClient";

type Flow = "create" | "join";
type Screen = "home" | "setup" | "lobby";

const positions: Position[] = ["south", "north", "west", "east"];
const cleanRoomCode = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

const getInviteCode = () =>
  cleanRoomCode(new URLSearchParams(window.location.search).get("room") ?? "");

function Logo() {
  return (
    <div className="logo" aria-label="Shelem">
      <span>ش</span>
      <strong>SHELEM</strong>
    </div>
  );
}

export function App() {
  const inviteCode = getInviteCode();
  const [screen, setScreen] = useState<Screen>(
    inviteCode.length === 6 ? "setup" : "home",
  );
  const [flow, setFlow] = useState<Flow>(
    inviteCode.length === 6 ? "join" : "create",
  );
  const [name, setName] = useState("");
  const [roomInput, setRoomInput] = useState(inviteCode);
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [copied, setCopied] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [bidAmount, setBidAmount] = useState(105);
  const [selectedDiscardIds, setSelectedDiscardIds] = useState<string[]>([]);
  const [trump, setTrump] = useState<Card["suit"]>("clubs");
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const ready =
    room?.players.find((player) => player.id === gameClient.playerId)?.ready ??
    false;

  useEffect(() => {
    gameClient.connect();
    const unsubscribeRoom = gameClient.subscribeToRoom((nextRoom) => {
      if (!nextRoom) {
        setRoom(null);
        setRoomCode("");
        setFormError("That room has expired. Create or join another table.");
        setScreen("setup");
        return;
      }
      setRoom(nextRoom);
      setRoomCode(nextRoom.code);
      if (
        nextRoom.players.some((player) => player.id === gameClient.playerId)
      ) {
        setScreen("lobby");
      }
    });
    const unsubscribeStatus = gameClient.subscribeToStatus(setConnectionStatus);

    return () => {
      unsubscribeRoom();
      unsubscribeStatus();
    };
  }, []);

  useEffect(() => {
    const nextBid = (room?.match?.bidding.currentBid ?? 100) + 5;
    setBidAmount(Math.min(nextBid, 165));
  }, [room?.match?.bidding.currentBid]);

  useEffect(() => {
    if (room?.match?.phase !== "ground") {
      setSelectedDiscardIds([]);
    }
  }, [room?.match?.phase]);

  const begin = (nextFlow: Flow) => {
    setFlow(nextFlow);
    setFormError("");
    setScreen("setup");
  };

  const enterLobby = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanCode = roomInput.trim().toUpperCase();

    if (!cleanName || (flow === "join" && cleanCode.length !== 6)) return;

    try {
      const nextRoom =
        flow === "join"
          ? await gameClient.joinRoom(cleanCode, cleanName)
          : await gameClient.createRoom(cleanName);
      if (!nextRoom) return;

      setRoom(nextRoom);
      setRoomCode(nextRoom.code);
      setName(cleanName);
      setFormError("");
      setScreen("lobby");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to join the room.",
      );
    }
  };

  const leaveRoom = async () => {
    try {
      await gameClient.leaveRoom();
    } catch {
      // Return home even if the server connection dropped.
    }
    window.history.replaceState({}, "", window.location.pathname);
    setRoom(null);
    setRoomCode("");
    setScreen("home");
  };

  const toggleReady = async () => {
    if (!room) return;
    try {
      await gameClient.setReady(!ready);
    } catch {
      // The connection indicator communicates transient server failures.
    }
  };

  const placeBid = async () => {
    try {
      await gameClient.placeBid(bidAmount);
      setActionError("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to place that bid.",
      );
    }
  };

  const passBid = async () => {
    try {
      await gameClient.passBid();
      setActionError("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to pass.",
      );
    }
  };

  const toggleDiscard = (cardId: string) => {
    setSelectedDiscardIds((selected) =>
      selected.includes(cardId)
        ? selected.filter((id) => id !== cardId)
        : selected.length < 4
          ? [...selected, cardId]
          : selected,
    );
    setActionError("");
  };

  const completeGround = async () => {
    try {
      await gameClient.completeGround(selectedDiscardIds, trump);
      setSelectedDiscardIds([]);
      setActionError("");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to complete the ground phase.",
      );
    }
  };

  const playCard = async (cardId: string) => {
    try {
      await gameClient.playCard(cardId);
      setActionError("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to play that card.",
      );
    }
  };

  const playableCardIds = getPlayableCardIds(room);

  const copyInvite = async () => {
    const invite = `${window.location.origin}?room=${roomCode}`;
    await navigator.clipboard?.writeText(invite);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (screen === "lobby") {
    return (
      <main className="lobby-shell">
        <header className="lobby-header">
          <Logo />
          <div className="room-actions">
            <span className="room-label">Private room</span>
            <button className="code-button" onClick={copyInvite} type="button">
              <span>{roomCode}</span>
              <CopyIcon />
            </button>
            <button
              className="leave-button"
              onClick={leaveRoom}
              type="button"
            >
              Leave
            </button>
          </div>
        </header>

        <section className="lobby-content">
          <div className="lobby-title">
            <p className="eyebrow">
              {room?.match ? `Hand ${room.match.handNumber}` : "Your private table"}
            </p>
            <h1>
              {room?.match?.phase === "hand-complete"
                ? "The hand is complete."
                : room?.match?.phase === "playing"
                ? "Trump is declared."
                : room?.match?.phase === "ground"
                ? "The bid is won."
                : room?.match
                  ? "The cards are dealt."
                  : "Gather your players"}
            </h1>
            <p>
              {room?.match?.phase === "ground"
                ? "The winning bidder will take the zamin and declare trump."
                : room?.match?.phase === "hand-complete"
                  ? "All twelve tricks are finished. Scoring is next."
                : room?.match?.phase === "playing"
                  ? "The bidder will lead the first trick with a trump card."
                : room?.match
                ? "Your hand is private. Bidding is now open."
                : "Share the room code. The game begins when all four are ready."}
            </p>
          </div>

          <div className="table-wrap">
            <span className="team-tag team-one">Team One</span>
            <span className="team-tag team-two">Team Two</span>

            {positions.map((position) => {
              const player = room?.players.find(
                (candidate) => candidate.position === position,
              );
              return (
                <Seat
                  key={position}
                  position={position}
                  team={
                    position === "north" || position === "south" ? "one" : "two"
                  }
                  player={player}
                />
              );
            })}

            <div className="card-table">
              <div className="table-line" />
              <div className="deck" aria-hidden="true">
                <span />
                <span />
                <span>ش</span>
              </div>
              <strong>
                {room?.match
                  ? room.match.phase === "hand-complete"
                    ? "All 12 tricks are complete"
                    : room.match.phase === "playing"
                    ? `Trick ${
                        (room.match.play?.completedTrickCount ?? 0) + 1
                      } of 12`
                    : room.match.phase === "ground"
                    ? `${
                        room.players.find(
                          (player) =>
                            player.id === room.match?.bidding.winnerId,
                        )?.name ?? "The bidder"
                      } won with ${room.match.bidding.winningBid}`
                    : `Current bid: ${room.match.bidding.currentBid}`
                  : room?.players.length === 4
                  ? "All players have joined"
                  : `Waiting for ${4 - (room?.players.length ?? 1)} ${
                      4 - (room?.players.length ?? 1) === 1
                        ? "player"
                        : "players"
                    }`}
              </strong>
              <small>
                {room?.match?.phase === "hand-complete"
                  ? `${suitLabel(room.match.trump)} was trump`
                  : room?.match?.phase === "playing"
                  ? `${suitLabel(room.match.trump)} is trump`
                  : room?.match?.phase === "ground"
                    ? "The winning bidder now holds the four zamin cards"
                  : room?.match
                  ? `${room.match.groundCount} cards are face down in the zamin`
                  : `Invite friends using code ${roomCode}`}
              </small>
            </div>
          </div>

          {room?.match && (
            <Hand
              cards={room.match.yourHand}
              enabledIds={
                room.match.phase === "playing" ? playableCardIds : undefined
              }
              onToggle={
                room.match.phase === "playing" ? playCard : toggleDiscard
              }
              selectable={
                (room.match.phase === "ground" &&
                  room.match.bidding.winnerId === gameClient.playerId) ||
                (room.match.phase === "playing" &&
                  room.match.play?.currentTurnPlayerId === gameClient.playerId)
              }
              selectedIds={selectedDiscardIds}
            />
          )}
          {room?.match && (
            <BiddingPanel
              actionError={actionError}
              bidAmount={bidAmount}
              onBid={placeBid}
              onPass={passBid}
              room={room}
              setBidAmount={setBidAmount}
            />
          )}
          {room?.match?.phase === "ground" &&
            room.match.bidding.winnerId === gameClient.playerId && (
              <GroundPanel
                actionError={actionError}
                onSubmit={completeGround}
                selectedCount={selectedDiscardIds.length}
                setTrump={setTrump}
                trump={trump}
              />
            )}
          {(room?.match?.phase === "playing" ||
            room?.match?.phase === "hand-complete") && (
            <PlayPanel actionError={actionError} room={room} />
          )}

          <div className="lobby-footer">
            <div className="connection-note">
              <span
                className={`status-dot ${
                  connectionStatus === "connected" ? "" : "is-offline"
                }`}
              />
              {connectionStatus === "connected"
                ? "Connected to the game server"
                : "Reconnecting to the game server…"}
            </div>
            {room?.match ? (
              <span className="match-status">
                {room.match.phase === "ground"
                  ? room.match.bidding.winnerId === gameClient.playerId
                    ? "Choose four discards and trump"
                    : "Waiting for the bidder"
                  : room.match.phase === "playing"
                    ? room.match.play?.currentTurnPlayerId ===
                      gameClient.playerId
                      ? "Your turn to play"
                      : "Trick in progress"
                    : room.match.phase === "hand-complete"
                      ? "Ready for scoring"
                    : room.match.bidding.currentTurnPlayerId ===
                      gameClient.playerId
                    ? "Your turn to bid"
                    : "Bidding in progress"}
              </span>
            ) : (
              <button
                className={`ready-button ${ready ? "is-ready" : ""}`}
                onClick={toggleReady}
                type="button"
              >
                {ready ? "Ready ✓" : "I’m ready"}
              </button>
            )}
          </div>
        </section>

        {copied && <div className="toast">Invite link copied</div>}
      </main>
    );
  }

  return (
    <main className="shell">
      <nav className="home-nav">
        <Logo />
        <span>Private games with friends</span>
      </nav>

      {screen === "home" ? (
        <section className="welcome">
          <div className="suit-row" aria-hidden="true">
            <span>♣</span>
            <span>♦</span>
            <span>♥</span>
            <span>♠</span>
          </div>
          <p className="eyebrow">The table is waiting</p>
          <h1>Shelem, together again.</h1>
          <p className="intro">
            A private table for four friends—with the cards, conversation, and
            friendly competition all in one place.
          </p>

          <div className="actions">
            <button
              className="primary"
              onClick={() => begin("create")}
              type="button"
            >
              Create a table
              <ArrowIcon />
            </button>
            <button
              className="secondary"
              onClick={() => begin("join")}
              type="button"
            >
              Join with a code
            </button>
          </div>

          <div className="features">
            <span>
              <VideoIcon /> Live video
            </span>
            <span>
              <LockIcon /> Private rooms
            </span>
            <span>
              <UsersIcon /> Four players
            </span>
          </div>
        </section>
      ) : (
        <section className="setup-card">
          <button
            className="back-button"
            onClick={() => {
              setFormError("");
              window.history.replaceState({}, "", window.location.pathname);
              setScreen("home");
            }}
            type="button"
            aria-label="Back"
          >
            ←
          </button>
          <p className="eyebrow">
            {flow === "create" ? "Create a private table" : "Join your friends"}
          </p>
          <h1>{flow === "create" ? "Take your seat." : "Welcome to the table."}</h1>
          <p className="setup-copy">
            {flow === "create"
              ? "We’ll create a room code for you to share."
              : "Enter the six-character code shared by the host."}
          </p>

          <form onSubmit={enterLobby}>
            <label>
              Your name
              <input
                autoFocus
                maxLength={24}
                onChange={(event) => {
                  setName(event.target.value);
                  setFormError("");
                }}
                placeholder="How friends know you"
                value={name}
              />
            </label>

            {flow === "join" && (
              <label>
                Room code
                <input
                  className="room-input"
                  maxLength={6}
                  onChange={(event) => {
                    setRoomInput(
                      cleanRoomCode(event.target.value),
                    );
                    setFormError("");
                  }}
                  placeholder="ABC123"
                  value={roomInput}
                />
              </label>
            )}

            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}

            <button
              className="primary form-submit"
              disabled={
                connectionStatus !== "connected" ||
                !name.trim() ||
                (flow === "join" && roomInput.trim().length !== 6)
              }
              type="submit"
            >
              {flow === "create" ? "Create table" : "Join table"}
              <ArrowIcon />
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

function BiddingPanel({
  actionError,
  bidAmount,
  onBid,
  onPass,
  room,
  setBidAmount,
}: {
  actionError: string;
  bidAmount: number;
  onBid: () => void;
  onPass: () => void;
  room: Room;
  setBidAmount: (amount: number) => void;
}) {
  const bidding = room.match?.bidding;
  if (!bidding) return null;

  const highBidder = room.players.find(
    (player) => player.id === bidding.highBidderId,
  );
  const currentPlayer = room.players.find(
    (player) => player.id === bidding.currentTurnPlayerId,
  );
  const winner = room.players.find((player) => player.id === bidding.winnerId);
  const isYourTurn =
    room.match?.phase === "bidding" &&
    bidding.currentTurnPlayerId === gameClient.playerId;
  const bidOptions = Array.from(
    { length: Math.max(0, (165 - bidding.currentBid) / 5) },
    (_, index) => bidding.currentBid + (index + 1) * 5,
  );

  return (
    <section className="bidding-panel" aria-label="Bidding">
      <div className="bidding-summary">
        <div>
          <span>Highest bid</span>
          <strong>{bidding.currentBid}</strong>
        </div>
        <p>
          {room.match?.phase !== "bidding"
            ? `${winner?.name ?? "The bidder"} won the auction.`
            : `${highBidder?.name ?? "First bidder"} leads. ${
                isYourTurn
                  ? "It’s your turn."
                  : `Waiting for ${currentPlayer?.name ?? "the next player"}.`
              }`}
        </p>
      </div>

      {isYourTurn && (
        <div className="bid-actions">
          {bidOptions.length > 0 && (
            <>
              <label>
                Your bid
                <select
                  onChange={(event) => setBidAmount(Number(event.target.value))}
                  value={bidAmount}
                >
                  {bidOptions.map((amount) => (
                    <option key={amount} value={amount}>
                      {amount}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary bid-button" onClick={onBid} type="button">
                Place bid
              </button>
            </>
          )}
          <button className="pass-button" onClick={onPass} type="button">
            Pass
          </button>
        </div>
      )}

      {actionError && room.match?.phase === "bidding" && (
        <p className="action-error" role="alert">
          {actionError}
        </p>
      )}
    </section>
  );
}

function GroundPanel({
  actionError,
  onSubmit,
  selectedCount,
  setTrump,
  trump,
}: {
  actionError: string;
  onSubmit: () => void;
  selectedCount: number;
  setTrump: (suit: Card["suit"]) => void;
  trump: Card["suit"];
}) {
  return (
    <section className="ground-panel" aria-label="Ground and trump">
      <div>
        <strong>Prepare the hand</strong>
        <p>Select exactly four cards to discard face down.</p>
      </div>
      <label>
        Trump suit
        <select
          onChange={(event) => setTrump(event.target.value as Card["suit"])}
          value={trump}
        >
          <option value="clubs">♣ Clubs</option>
          <option value="diamonds">♦ Diamonds</option>
          <option value="hearts">♥ Hearts</option>
          <option value="spades">♠ Spades</option>
        </select>
      </label>
      <button
        className="primary ground-submit"
        disabled={selectedCount !== 4}
        onClick={onSubmit}
        type="button"
      >
        Discard {selectedCount}/4 and declare
      </button>
      {actionError && (
        <p className="action-error" role="alert">
          {actionError}
        </p>
      )}
    </section>
  );
}

function PlayPanel({
  actionError,
  room,
}: {
  actionError: string;
  room: Room;
}) {
  const play = room.match?.play;
  if (!play) return null;

  const currentPlayer = room.players.find(
    (player) => player.id === play.currentTurnPlayerId,
  );
  const lastWinner = room.players.find(
    (player) => player.id === play.lastTrickWinnerId,
  );

  return (
    <section className="play-panel" aria-label="Current trick">
      <div className="trick-summary">
        <strong>
          {room.match?.phase === "hand-complete"
            ? "Twelve tricks complete"
            : `Trick ${play.completedTrickCount + 1}`}
        </strong>
        <span>
          {room.match?.phase === "hand-complete"
            ? "Ready to count the hand"
            : `${currentPlayer?.name ?? "Next player"} to play`}
        </span>
        {lastWinner && (
          <small>Last trick won by {lastWinner.name}</small>
        )}
      </div>

      <div className="current-trick">
        {play.currentTrick.length > 0 ? (
          play.currentTrick.map(({ card, playerId }) => (
            <div className={`trick-card is-${card.suit}`} key={playerId}>
              <span>
                {card.rank}
                {suitSymbol(card.suit)}
              </span>
              <small>
                {room.players.find((player) => player.id === playerId)?.name}
              </small>
            </div>
          ))
        ) : (
          <span className="empty-trick">
            {room.match?.phase === "hand-complete"
              ? "Hand finished"
              : "Waiting for the lead"}
          </span>
        )}
      </div>

      <div className="trick-score">
        {room.players.map((player) => (
          <span key={player.id}>
            {player.name}: {play.trickWins[player.id] ?? 0}
          </span>
        ))}
      </div>

      {actionError && (
        <p className="action-error" role="alert">
          {actionError}
        </p>
      )}
    </section>
  );
}

function Hand({
  cards,
  enabledIds,
  onToggle,
  selectable = false,
  selectedIds = [],
}: {
  cards: Card[];
  enabledIds?: string[];
  onToggle?: (cardId: string) => void;
  selectable?: boolean;
  selectedIds?: string[];
}) {
  const suitSymbols: Record<Card["suit"], string> = {
    clubs: "♣",
    diamonds: "♦",
    hearts: "♥",
    spades: "♠",
  };
  const suitOrder: Card["suit"][] = [
    "clubs",
    "diamonds",
    "hearts",
    "spades",
  ];
  const rankOrder: Card["rank"][] = [
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
  const sortedCards = [...cards].sort(
    (left, right) =>
      suitOrder.indexOf(left.suit) - suitOrder.indexOf(right.suit) ||
      rankOrder.indexOf(left.rank) - rankOrder.indexOf(right.rank),
  );

  return (
    <section className="hand-panel" aria-label="Your hand">
      <div className="hand-heading">
        <strong>Your hand</strong>
        <span>{cards.length} cards</span>
      </div>
      <div className="hand-cards">
        {sortedCards.map((card) => (
          <button
            className={`playing-card is-${card.suit} ${
              selectedIds.includes(card.id) ? "is-selected" : ""
            }`}
            disabled={
              !selectable ||
              (enabledIds !== undefined && !enabledIds.includes(card.id))
            }
            key={card.id}
            aria-label={`${card.rank} of ${card.suit}`}
            onClick={() => onToggle?.(card.id)}
            type="button"
          >
            <strong>{card.rank}</strong>
            <span>{suitSymbols[card.suit]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function suitLabel(suit: Card["suit"] | null) {
  const labels: Record<Card["suit"], string> = {
    clubs: "Clubs",
    diamonds: "Diamonds",
    hearts: "Hearts",
    spades: "Spades",
  };
  return suit ? labels[suit] : "No suit";
}

function suitSymbol(suit: Card["suit"]) {
  const symbols: Record<Card["suit"], string> = {
    clubs: "♣",
    diamonds: "♦",
    hearts: "♥",
    spades: "♠",
  };
  return symbols[suit];
}

function getPlayableCardIds(room: Room | null) {
  if (
    room?.match?.phase !== "playing" ||
    room.match.play?.currentTurnPlayerId !== gameClient.playerId
  ) {
    return [];
  }

  const hand = room.match.yourHand;
  const currentTrick = room.match.play.currentTrick;
  if (currentTrick.length === 0) {
    return room.match.play.completedTrickCount === 0
      ? hand
          .filter((card) => card.suit === room.match?.trump)
          .map((card) => card.id)
      : hand.map((card) => card.id);
  }

  const leadSuit = currentTrick[0].card.suit;
  const followingCards = hand.filter((card) => card.suit === leadSuit);
  return (followingCards.length > 0 ? followingCards : hand).map(
    (card) => card.id,
  );
}

function Seat({
  position,
  team,
  player,
}: {
  position: Position;
  team: "one" | "two";
  player?: Player;
}) {
  return (
    <div className={`seat seat-${position}`}>
      <div className={`avatar team-${team}`}>
        {player ? player.name.slice(0, 1).toUpperCase() : <UsersIcon />}
        {player?.ready && <span className="ready-check">✓</span>}
      </div>
      <strong>{player?.name || "Open seat"}</strong>
      <small>
        {player
          ? !player.connected
            ? "Reconnecting…"
            : player.ready
              ? "Ready"
              : "Not ready"
          : "Waiting…"}
      </small>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
