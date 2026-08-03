import {
  FormEvent,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ComponentType,
  type CSSProperties,
  type SVGProps,
} from "react";
import * as PlayingCardDeck from "@letele/playing-cards";
import {
  gameClient,
  type Card,
  type Player,
  type Position,
  type Room,
  type Team,
} from "./gameClient";

const MediaRoom = lazy(() =>
  import("./MediaRoom").then(({ MediaRoom }) => ({ default: MediaRoom })),
);

type Flow = "create" | "join";
type Screen = "home" | "setup" | "lobby";
type TurnContext = {
  playerId: string;
  action: string;
  seatLabel: string;
};
type BiddingStatus = {
  label: string;
  passed: boolean;
};
type SeatReadiness = {
  label: string;
  ready: boolean;
};

const positionsClockwise: Position[] = ["south", "west", "north", "east"];
const cleanRoomCode = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

const positionFromViewer = (
  position: Position,
  viewerPosition?: Position,
): Position => {
  if (!viewerPosition) return position;
  const relativeIndex =
    (positionsClockwise.indexOf(position) -
      positionsClockwise.indexOf(viewerPosition) +
      positionsClockwise.length) %
    positionsClockwise.length;
  return positionsClockwise[relativeIndex];
};

const getInviteCode = () => {
  const pathMatch = window.location.pathname.match(
    /\/join\/([A-Z0-9]{6})(?:\/|$)/i,
  );
  if (pathMatch) return cleanRoomCode(pathMatch[1]);

  return cleanRoomCode(
    new URLSearchParams(window.location.search).get("room") ?? "",
  );
};

const invitePath = (roomCode: string) => `/join/${roomCode}`;

type PlayingCardComponent = ComponentType<
  SVGProps<SVGSVGElement> & { title?: string }
>;

const playingCardDeck = PlayingCardDeck as unknown as Record<
  string,
  PlayingCardComponent
>;
const cardSuitPrefix: Record<Card["suit"], string> = {
  clubs: "C",
  diamonds: "D",
  hearts: "H",
  spades: "S",
};
const cardRankSuffix: Record<Card["rank"], string> = {
  A: "a",
  K: "k",
  Q: "q",
  J: "j",
  "10": "10",
  "9": "9",
  "8": "8",
  "7": "7",
  "6": "6",
  "5": "5",
  "4": "4",
  "3": "3",
  "2": "2",
};

function CardFace({ card, className }: { card: Card; className?: string }) {
  const Face =
    playingCardDeck[`${cardSuitPrefix[card.suit]}${cardRankSuffix[card.rank]}`];
  return <Face aria-hidden="true" className={className} focusable="false" />;
}

function CardBack({ className }: { className?: string }) {
  const Back = playingCardDeck.B1;
  return <Back aria-hidden="true" className={className} focusable="false" />;
}

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
  const [name, setName] = useState(gameClient.rememberedName);
  const [roomInput, setRoomInput] = useState(inviteCode);
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [copied, setCopied] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [bidAmount, setBidAmount] = useState(100);
  const [selectedDiscardIds, setSelectedDiscardIds] = useState<string[]>([]);
  const [selectedPlayCardId, setSelectedPlayCardId] = useState<string | null>(
    null,
  );
  const [playPending, setPlayPending] = useState(false);
  const [seatChangePending, setSeatChangePending] =
    useState<Position | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const ready =
    room?.players.find((player) => player.id === gameClient.playerId)?.ready ??
    false;
  const currentPlayer = room?.players.find(
    (player) => player.id === gameClient.playerId,
  );
  const viewerTeam = currentPlayer
    ? teamForPosition(currentPlayer.position)
    : undefined;
  const hasBots = room?.players.some((player) => player.isBot) ?? false;
  const isGroundWinner =
    room?.match?.bidding.winnerId === gameClient.playerId;
  const turnContext = getTurnContext(room);

  useEffect(() => {
    gameClient.connect(inviteCode || undefined);
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
      window.history.replaceState({}, "", invitePath(nextRoom.code));
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
    const currentBid = room?.match?.bidding.currentBid;
    const minimumBid =
      currentBid === null || currentBid === undefined ? 100 : currentBid + 5;
    setBidAmount(Math.min(minimumBid, 165));
  }, [room?.match?.bidding.currentBid]);

  useEffect(() => {
    if (room?.match?.phase !== "ground") {
      setSelectedDiscardIds([]);
    }
  }, [room?.match?.phase]);

  useEffect(() => {
    if (!selectedPlayCardId) return;
    const canKeepSelection =
      room?.match?.phase === "playing" &&
      room.match.play?.currentTurnPlayerId === gameClient.playerId &&
      room.match.yourHand.some((card) => card.id === selectedPlayCardId);
    if (!canKeepSelection) setSelectedPlayCardId(null);
  }, [
    room?.match?.phase,
    room?.match?.play?.currentTurnPlayerId,
    room?.match?.yourHand,
    selectedPlayCardId,
  ]);

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
      window.history.replaceState({}, "", invitePath(nextRoom.code));
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
    window.history.replaceState({}, "", "/");
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

  const changeSeat = async (position: Position) => {
    if (!room || room.match || seatChangePending) return;
    setSeatChangePending(position);
    setActionError("");
    try {
      await gameClient.changeSeat(position);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to change seats.",
      );
    } finally {
      setSeatChangePending(null);
    }
  };

  const toggleBots = async () => {
    try {
      if (hasBots) {
        await gameClient.removeBots();
      } else {
        await gameClient.fillWithBots();
      }
      setActionError("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to manage bots.",
      );
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
      await gameClient.completeGround(selectedDiscardIds);
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

  const selectPlayCard = (cardId: string) => {
    setSelectedPlayCardId(cardId);
    setActionError("");
  };

  const confirmPlayCard = async () => {
    if (!selectedPlayCardId || playPending) return;
    setPlayPending(true);
    try {
      await gameClient.playCard(selectedPlayCardId);
      setSelectedPlayCardId(null);
      setActionError("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to play that card.",
      );
    } finally {
      setPlayPending(false);
    }
  };

  const toggleNextHandReady = async () => {
    if (!room?.match) return;
    const isReady = room.match.nextHandReadyPlayerIds.includes(
      gameClient.playerId,
    );
    try {
      await gameClient.setNextHandReady(!isReady);
      setActionError("");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to update your readiness.",
      );
    }
  };

  const playableCardIds = getPlayableCardIds(room);

  const copyInvite = async () => {
    const invite = `${window.location.origin}${invitePath(roomCode)}`;
    await navigator.clipboard?.writeText(invite);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (screen === "lobby") {
    return (
      <main
        className={`lobby-shell ${room?.match ? "is-match-active" : ""}`}
      >
        <header className="lobby-header">
          <Logo />
          <div className="room-actions">
            <span className="player-identity">
              Playing as <strong>{currentPlayer?.name ?? name}</strong>
            </span>
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
          {room?.match && <MatchScoreboard room={room} />}
          <div className="lobby-title">
            <p className="eyebrow">
              {room?.match ? `Hand ${room.match.handNumber}` : "Your private table"}
            </p>
            <h1>
              {room?.match?.phase === "match-complete"
                ? "The match is over."
                : room?.match?.phase === "hand-results"
                ? "The hand is scored."
                : room?.match?.phase === "playing"
                ? "Trump is declared."
                : room?.match?.phase === "ground-reveal"
                ? isGroundWinner
                  ? "Your zamin is revealed."
                  : "The bidder is viewing the zamin."
                : room?.match?.phase === "ground"
                ? "The bid is won."
                : room?.match
                  ? "The cards are dealt."
                  : "Gather your players"}
            </h1>
            <p>
              {room?.match?.phase === "match-complete"
                ? `${teamLabel(
                    room.match.forfeit?.winningTeam ??
                      room.matchWinnerTeam ??
                      "one",
                    viewerTeam,
                  )} wins by forfeit.`
                : room?.match?.phase === "ground-reveal"
                ? isGroundWinner
                  ? "Only you can see these four cards before they enter your hand."
                  : "The four cards remain hidden while the winning bidder reviews them."
                : room?.match?.phase === "ground"
                ? "The winning bidder will discard four cards before leading."
                : room?.match?.phase === "hand-results"
                  ? room.match.result?.shelem
                    ? "Shelem! All 165 points went to the bidding team."
                    : room.match.result?.madeBid
                      ? "The bidding team made its contract."
                      : "The bidding team missed its contract."
                : room?.match?.phase === "playing"
                  ? "The bidder’s opening card establishes trump for the hand."
                : room?.match
                ? "Your hand is private. Bidding is now open."
                : "Share the room code. The game begins when all four are ready."}
            </p>
          </div>

          {room && turnContext && (
            <TurnBanner room={room} turn={turnContext} />
          )}

          {room && (
            <Suspense
              fallback={<div className="media-room media-room-loading">Loading conversation…</div>}
            >
              <MediaRoom players={room.players} />
            </Suspense>
          )}

          <div className="table-wrap">
            {positionsClockwise.map((position) => {
              const player = room?.players.find(
                (candidate) => candidate.position === position,
              );
              return (
                <Seat
                  key={position}
                  position={position}
                  displayPosition={positionFromViewer(
                    position,
                    currentPlayer?.position,
                  )}
                  team={
                    position === "north" || position === "south" ? "one" : "two"
                  }
                  player={player}
                  readiness={
                    player && room
                      ? getSeatReadiness(room, player.id)
                      : undefined
                  }
                  onSelect={
                    !player && !room?.match && !seatChangePending
                      ? changeSeat
                      : undefined
                  }
                  turn={
                    player && turnContext && player.id === turnContext.playerId
                      ? turnContext
                      : undefined
                  }
                  biddingStatus={
                    player && room?.match?.phase === "bidding"
                      ? getPlayerBiddingStatus(room, player.id)
                      : undefined
                  }
                />
              );
            })}

            <div className="card-table">
              <div className="table-line" />
              {room?.match?.phase === "playing" ? (
                <TableTrick
                  room={room}
                  viewerPosition={currentPlayer?.position}
                />
              ) : (
                <div className="deck" aria-hidden="true">
                  <CardBack />
                  <CardBack />
                  <CardBack />
                </div>
              )}
              <div className="table-status">
                <strong>
                {room?.match
                  ? room.match.phase === "match-complete"
                    ? `${teamLabel(room.matchWinnerTeam ?? "one", viewerTeam)} wins`
                    : room.match.phase === "hand-results"
                    ? `${teamLabel("one", viewerTeam)} ${
                        room.match.result?.rawPoints.one
                      } · ${teamLabel("two", viewerTeam)} ${
                        room.match.result?.rawPoints.two
                      }`
                    : room.match.phase === "playing"
                    ? room.match.play?.resolvingTrickWinnerId
                      ? `${
                          room.players.find(
                            (player) =>
                              player.id ===
                              room.match?.play?.resolvingTrickWinnerId,
                          )?.name ?? "The winner"
                        } wins the trick`
                      : `Trick ${
                          (room.match.play?.completedTrickCount ?? 0) + 1
                        } of 12`
                    : room.match.phase === "ground-reveal"
                    ? isGroundWinner
                      ? "Your four zamin cards are revealed"
                      : "The zamin is hidden"
                    : room.match.phase === "ground"
                    ? `${
                        room.players.find(
                          (player) =>
                            player.id === room.match?.bidding.winnerId,
                        )?.name ?? "The bidder"
                      } won with ${room.match.bidding.winningBid}`
                    : room.match.bidding.currentBid === null
                    ? "Opening bid: 100 minimum"
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
                {room?.match?.phase === "match-complete"
                  ? "The match ended by forfeit"
                  : room?.match?.phase === "hand-results"
                  ? `Bid: ${room.match.result?.bid} · ${suitLabel(room.match.trump)} was trump`
                  : room?.match?.phase === "playing"
                  ? room.match.play?.resolvingTrickWinnerId
                    ? "Reviewing all four played cards"
                    : room.match.trump
                    ? `${suitLabel(room.match.trump)} is trump`
                    : "The opening card will establish trump"
                  : room?.match?.phase === "ground-reveal"
                  ? isGroundWinner
                    ? "These cards will enter your hand in a moment"
                    : "Waiting for the bidder to review their cards"
                  : room?.match?.phase === "ground"
                    ? "The winning bidder now holds the four zamin cards"
                  : room?.match
                  ? `${room.match.groundCount} cards are face down in the zamin`
                  : `Invite friends using code ${roomCode}`}
                </small>
              </div>
            </div>
          </div>

          {!room?.match && actionError && (
            <p className="table-action-error action-error" role="alert">
              {actionError}
            </p>
          )}

          {room?.match?.phase === "ground-reveal" &&
            room.match.groundCards.length > 0 && (
            <GroundRevealPanel cards={room.match.groundCards} />
          )}

          {room?.match &&
            room.match.phase !== "hand-results" &&
            room.match.phase !== "match-complete" && (
            <Hand
              cards={room.match.yourHand}
              enabledIds={
                room.match.phase === "playing" ? playableCardIds : undefined
              }
              onToggle={
                room.match.phase === "playing"
                  ? selectPlayCard
                  : toggleDiscard
              }
              selectable={
                (room.match.phase === "ground" &&
                  room.match.bidding.winnerId === gameClient.playerId) ||
                (room.match.phase === "playing" &&
                  room.match.play?.currentTurnPlayerId === gameClient.playerId)
              }
              selectedIds={
                room.match.phase === "playing"
                  ? selectedPlayCardId
                    ? [selectedPlayCardId]
                    : []
                  : selectedDiscardIds
              }
            />
          )}
          {room?.match?.phase === "playing" &&
            room.match.play?.currentTurnPlayerId === gameClient.playerId && (
              <PlayCardConfirmation
                card={
                  room.match.yourHand.find(
                    (card) => card.id === selectedPlayCardId,
                  ) ?? null
                }
                canConfirm={
                  selectedPlayCardId !== null &&
                  playableCardIds.includes(selectedPlayCardId)
                }
                error={actionError}
                onCancel={() => setSelectedPlayCardId(null)}
                onConfirm={confirmPlayCard}
                pending={playPending}
              />
            )}
          {room?.match?.phase === "bidding" && (
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
              />
            )}
          {room?.match?.phase === "hand-results" && (
            <ResultPanel
              actionError={actionError}
              onToggleReady={toggleNextHandReady}
              room={room}
            />
          )}
          {room?.match?.phase === "match-complete" && (
            <ForfeitPanel room={room} />
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
                {room.match.phase === "match-complete"
                  ? "Match complete"
                  : room.match.phase === "ground-reveal"
                  ? isGroundWinner
                    ? "Review your private zamin"
                    : "Waiting for the bidder"
                  : room.match.phase === "ground"
                  ? room.match.bidding.winnerId === gameClient.playerId
                    ? "Choose four cards to discard"
                    : "Waiting for the bidder"
                  : room.match.phase === "playing"
                    ? room.match.play?.currentTurnPlayerId ===
                      gameClient.playerId
                      ? "Your turn to play"
                      : "Trick in progress"
                    : room.match.phase === "hand-results"
                      ? room.matchWinnerTeam
                        ? "Match complete"
                        : "Hand scored"
                    : room.match.bidding.currentTurnPlayerId ===
                      gameClient.playerId
                    ? "Your turn to bid"
                    : "Bidding in progress"}
              </span>
            ) : (
              <div className="lobby-controls">
                {room?.hostPlayerId === gameClient.playerId && (
                  <button
                    className="bot-button"
                    onClick={toggleBots}
                    type="button"
                  >
                    {hasBots ? "Remove bots" : "Fill empty seats with bots"}
                  </button>
                )}
                <button
                  className={`ready-button ${ready ? "is-ready" : ""}`}
                  onClick={toggleReady}
                  type="button"
                >
                  {ready ? "Ready ✓" : "I’m ready"}
                </button>
              </div>
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
              window.history.replaceState({}, "", "/");
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
  const currentBid = bidding.currentBid;
  const isOpeningBid = currentBid === null;
  const minimumBid = currentBid === null ? 100 : currentBid + 5;
  const bidOptions = Array.from(
    { length: Math.max(0, Math.floor((165 - minimumBid) / 5) + 1) },
    (_, index) => minimumBid + index * 5,
  );

  return (
    <section className="bidding-panel" aria-label="Bidding">
      <div className="bidding-summary">
        <div>
          <span>{isOpeningBid ? "Opening bid" : "Highest bid"}</span>
          <strong>{isOpeningBid ? "100 minimum" : bidding.currentBid}</strong>
        </div>
        <p>
          {room.match?.phase !== "bidding"
            ? `${winner?.name ?? "The bidder"} won the auction.`
            : isOpeningBid
              ? `${
                  isYourTurn
                    ? "Choose any opening bid from 100 to 165."
                    : `Waiting for ${currentPlayer?.name ?? "the first bidder"} to open.`
                }`
              : `${highBidder?.name ?? "The bidder"} leads. ${
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
          {!isOpeningBid && (
            <button className="pass-button" onClick={onPass} type="button">
              Pass
            </button>
          )}
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

function GroundRevealPanel({ cards }: { cards: Card[] }) {
  return (
    <section className="ground-reveal-panel" aria-label="Revealed zamin">
      <div>
        <span>Private zamin</span>
        <strong>Only you can see these cards</strong>
        <p>They will enter your hand shortly.</p>
      </div>
      <div className="ground-reveal-cards">
        {cards.map((card) => (
          <article
            aria-label={`${card.rank} of ${card.suit}`}
            className="ground-card"
            key={card.id}
          >
            <CardFace card={card} className="card-face" />
          </article>
        ))}
      </div>
    </section>
  );
}

function GroundPanel({
  actionError,
  onSubmit,
  selectedCount,
}: {
  actionError: string;
  onSubmit: () => void;
  selectedCount: number;
}) {
  return (
    <section className="ground-panel" aria-label="Ground discard">
      <div>
        <strong>Prepare the hand</strong>
        <p>
          Select four cards to discard. Your opening card will establish trump.
        </p>
      </div>
      <button
        className="primary ground-submit"
        disabled={selectedCount !== 4}
        onClick={onSubmit}
        type="button"
      >
        Discard {selectedCount}/4 and continue
      </button>
      {actionError && (
        <p className="action-error" role="alert">
          {actionError}
        </p>
      )}
    </section>
  );
}

function PlayCardConfirmation({
  canConfirm,
  card,
  error,
  onCancel,
  onConfirm,
  pending,
}: {
  canConfirm: boolean;
  card: Card | null;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <section className="play-confirmation" aria-label="Confirm card play">
      <div>
        <strong>
          {card
            ? `${card.rank} of ${suitLabel(card.suit)} selected`
            : "Choose a card from your hand"}
        </strong>
        <small>
          {card
            ? "It will not be played until you confirm."
            : "Tap a highlighted card to preview it first."}
        </small>
      </div>
      <div className="play-confirmation-actions">
        <button
          className="play-cancel"
          disabled={!card || pending}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="play-confirm"
          disabled={!canConfirm || pending}
          onClick={onConfirm}
          type="button"
        >
          {pending ? "Playing…" : "Play card"}
        </button>
      </div>
      {error && (
        <p className="action-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function TableTrick({
  room,
  viewerPosition,
}: {
  room: Room;
  viewerPosition?: Position;
}) {
  const play = room.match?.play;
  if (!play) return null;
  const viewerTeam = viewerPosition
    ? teamForPosition(viewerPosition)
    : undefined;
  const teamTricks = room.players.reduce(
    (totals, player) => {
      const team =
        player.position === "north" || player.position === "south"
          ? "one"
          : "two";
      totals[team] += play.trickWins[player.id] ?? 0;
      return totals;
    },
    { one: 0, two: 0 },
  );

  return (
    <section className="table-trick" aria-label="Cards on the table">
      {positionsClockwise.map((position) => {
        const player = room.players.find(
          (candidate) => candidate.position === position,
        );
        const played = play.currentTrick.find(
          (candidate) => candidate.playerId === player?.id,
        );
        const displayPosition = positionFromViewer(position, viewerPosition);
        return (
          <div
            className={`table-card-slot slot-${displayPosition} ${
              played ? "has-card" : ""
            }`}
            key={position}
          >
            {played ? (
              <article
                aria-label={`${played.card.rank} of ${played.card.suit}`}
                className="table-played-card"
              >
                <CardFace card={played.card} className="card-face" />
              </article>
            ) : (
              <span className="card-waiting-dot" aria-hidden="true" />
            )}
            <small>{player?.name ?? position}</small>
          </div>
        );
      })}
      <div className="table-team-tricks">
        <span>{teamLabel("one", viewerTeam)} {teamTricks.one}</span>
        <span>{teamLabel("two", viewerTeam)} {teamTricks.two}</span>
      </div>
    </section>
  );
}

function ResultPanel({
  actionError,
  onToggleReady,
  room,
}: {
  actionError: string;
  onToggleReady: () => void;
  room: Room;
}) {
  const result = room.match?.result;
  if (!result) return null;
  const readyPlayerIds = room.match?.nextHandReadyPlayerIds ?? [];
  const isReady = readyPlayerIds.includes(gameClient.playerId);
  const viewerTeam = getViewerTeam(room);
  const displayedTeams: Team[] = viewerTeam
    ? [viewerTeam, otherTeam(viewerTeam)]
    : ["one", "two"];

  const outcome = result.shelem
    ? `${teamLabel(result.biddingTeam, viewerTeam)} won Shelem`
    : result.madeBid
      ? `${teamLabel(result.biddingTeam, viewerTeam)} made the ${result.bid} bid`
      : `${teamLabel(result.biddingTeam, viewerTeam)} missed the ${result.bid} bid`;

  return (
    <section className="result-panel" aria-label="Hand result">
      <div className="result-heading">
        <span>Hand {room.match?.handNumber} result</span>
        <strong>{outcome}</strong>
        {room.matchWinnerTeam && (
          <small>
            {teamLabel(room.matchWinnerTeam, viewerTeam)} wins the match
          </small>
        )}
      </div>
      {displayedTeams.map((team) => (
        <article
          className={`result-team ${
            result.biddingTeam === team ? "is-bidding-team" : ""
          }`}
          key={team}
        >
          <div>
            <span>{teamLabel(team, viewerTeam)}</span>
            {result.biddingTeam === team && <small>Bidding team</small>}
          </div>
          <dl>
            <div>
              <dt>Hand</dt>
              <dd>{result.rawPoints[team]}</dd>
            </div>
            <div>
              <dt>Change</dt>
              <dd>{formatScoreDelta(result.scoreDelta[team])}</dd>
            </div>
            <div>
              <dt>Match</dt>
              <dd>{result.matchScore[team]}</dd>
            </div>
          </dl>
        </article>
      ))}
      {!room.matchWinnerTeam && (
        <div className="next-hand-ready">
          <span>{readyPlayerIds.length} of 4 ready for the next hand</span>
          <button
            className={`ready-button ${isReady ? "is-ready" : ""}`}
            onClick={onToggleReady}
            type="button"
          >
            {isReady ? "Ready for next hand ✓" : "Ready for next hand"}
          </button>
          {actionError && (
            <p className="action-error" role="alert">
              {actionError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function ForfeitPanel({ room }: { room: Room }) {
  const forfeit = room.match?.forfeit;
  if (!forfeit) return null;
  const viewerTeam = getViewerTeam(room);

  return (
    <section className="forfeit-panel" aria-label="Match result">
      <span>Match result</span>
      <strong>
        {teamLabel(forfeit.winningTeam, viewerTeam)} wins by forfeit
      </strong>
      <p>
        {forfeit.losingPlayerName}{" "}
        {forfeit.reason === "left"
          ? "left the match."
          : "did not reconnect before the grace period ended."}
      </p>
      <div>
        Final score: {teamLabel("one", viewerTeam)} {room.score.one} ·{" "}
        {teamLabel("two", viewerTeam)} {room.score.two}
      </div>
    </section>
  );
}

function teamForPosition(position: Position): Team {
  return position === "north" || position === "south" ? "one" : "two";
}

function otherTeam(team: Team): Team {
  return team === "one" ? "two" : "one";
}

function getViewerTeam(room: Room): Team | undefined {
  const viewer = room.players.find(
    (player) => player.id === gameClient.playerId,
  );
  return viewer ? teamForPosition(viewer.position) : undefined;
}

function teamLabel(team: Team, viewerTeam?: Team) {
  if (!viewerTeam) return team === "one" ? "Team one" : "Team two";
  return team === viewerTeam ? "Your team" : "Opponents";
}

function teamPlayerNames(room: Room, team: Team) {
  return room.players
    .filter((player) => teamForPosition(player.position) === team)
    .map((player) => player.name)
    .join(" & ");
}

function MatchScoreboard({ room }: { room: Room }) {
  const viewerTeam = getViewerTeam(room) ?? "one";
  const opponentTeam = otherTeam(viewerTeam);

  return (
    <section className="match-scoreboard" aria-label="Current match score">
      <ScoreboardTeam room={room} team={viewerTeam} viewerTeam={viewerTeam} />
      <small>First to 1,000</small>
      <ScoreboardTeam
        room={room}
        team={opponentTeam}
        viewerTeam={viewerTeam}
      />
    </section>
  );
}

function ScoreboardTeam({
  room,
  team,
  viewerTeam,
}: {
  room: Room;
  team: Team;
  viewerTeam: Team;
}) {
  return (
    <div className={`match-score-team team-${team}-score`}>
      <div>
        <span>{teamLabel(team, viewerTeam)}</span>
        <small>{teamPlayerNames(room, team)}</small>
      </div>
      <strong>{room.score[team]}</strong>
    </div>
  );
}

function formatScoreDelta(score: number) {
  return score > 0 ? `+${score}` : String(score);
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
  const suitOrder: Card["suit"][] = [
    "clubs",
    "diamonds",
    "spades",
    "hearts",
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
      <div
        className={`hand-cards ${cards.length > 12 ? "is-large-hand" : ""}`}
      >
        {sortedCards.map((card, index) => {
          const selected = selectedIds.includes(card.id);
          const distanceFromCenter = index - (sortedCards.length - 1) / 2;
          const fanAngleStep = sortedCards.length > 12 ? 1.55 : 2.25;
          const fanDropStep = sortedCards.length > 12 ? 1.45 : 2.1;
          const fanStyle = {
            "--fan-angle": `${distanceFromCenter * fanAngleStep}deg`,
            "--fan-drop": `${Math.abs(distanceFromCenter) * fanDropStep}px`,
            zIndex: selected ? sortedCards.length + 2 : index + 1,
          } as CSSProperties;
          return (
          <button
            className={`playing-card is-${card.suit} ${
              selected ? "is-selected" : ""
            }`}
            disabled={
              !selectable ||
              (enabledIds !== undefined && !enabledIds.includes(card.id))
            }
            key={card.id}
            aria-label={`${card.rank} of ${card.suit}`}
            aria-pressed={selected}
            onClick={() => onToggle?.(card.id)}
            style={fanStyle}
            type="button"
          >
            <CardFace card={card} className="card-face" />
          </button>
          );
        })}
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
      ? hand.map((card) => card.id)
      : hand.map((card) => card.id);
  }

  const leadSuit = currentTrick[0].card.suit;
  const followingCards = hand.filter((card) => card.suit === leadSuit);
  return (followingCards.length > 0 ? followingCards : hand).map(
    (card) => card.id,
  );
}

function getTurnContext(room: Room | null): TurnContext | null {
  const match = room?.match;
  if (!match) return null;

  if (match.phase === "bidding" && match.bidding.currentTurnPlayerId) {
    return {
      playerId: match.bidding.currentTurnPlayerId,
      action: "Choose a bid or pass.",
      seatLabel: "Bidding now",
    };
  }

  if (match.phase === "ground" && match.bidding.winnerId) {
    return {
      playerId: match.bidding.winnerId,
      action: "Discard four cards before the opening lead.",
      seatLabel: "Discarding",
    };
  }

  if (match.phase === "playing" && match.play?.currentTurnPlayerId) {
    return {
      playerId: match.play.currentTurnPlayerId,
      action: "Play one of the highlighted cards.",
      seatLabel: "Playing now",
    };
  }

  return null;
}

function TurnBanner({ room, turn }: { room: Room; turn: TurnContext }) {
  const player = room.players.find(
    (candidate) => candidate.id === turn.playerId,
  );
  if (!player) return null;

  const isYou = player.id === gameClient.playerId;
  return (
    <section
      aria-live="polite"
      className={`turn-banner ${isYou ? "is-your-turn" : ""}`}
    >
      <span className="turn-pulse" aria-hidden="true" />
      <div>
        <small>{isYou ? "Your turn" : "Current turn"}</small>
        <strong>
          {isYou ? `Your turn, ${player.name}` : `${player.name}'s turn`}
        </strong>
      </div>
      <p>{turn.action}</p>
    </section>
  );
}

function Seat({
  biddingStatus,
  displayPosition,
  onSelect,
  position,
  team,
  player,
  readiness,
  turn,
}: {
  biddingStatus?: BiddingStatus;
  displayPosition: Position;
  onSelect?: (position: Position) => void;
  position: Position;
  team: "one" | "two";
  player?: Player;
  readiness?: SeatReadiness;
  turn?: TurnContext;
}) {
  const isYou = player?.id === gameClient.playerId;
  return (
    <div
      className={`seat seat-${displayPosition} ${turn ? "is-active-turn" : ""} ${
        turn && isYou ? "is-your-turn" : ""
      }`}
    >
      {player || !onSelect ? (
        <div className={`avatar team-${team}`}>
          {player ? player.name.slice(0, 1).toUpperCase() : <UsersIcon />}
          {player && (
            <span
              className="seat-camera-root"
              id={`seat-camera-${player.id}`}
            />
          )}
          {readiness?.ready && <span className="ready-check">✓</span>}
        </div>
      ) : (
        <button
          aria-label={`Move to the ${displayPosition} seat`}
          className={`avatar team-${team} is-selectable`}
          onClick={() => onSelect(position)}
          type="button"
        >
          <UsersIcon />
        </button>
      )}
      <strong>{player?.name || "Open seat"}</strong>
      {biddingStatus && (
        <span
          className={`seat-bid-status ${
            biddingStatus.passed ? "has-passed" : ""
          }`}
        >
          {biddingStatus.label}
        </span>
      )}
      {turn && (
        <span className="seat-turn-label">
          {isYou ? "Your turn" : turn.seatLabel}
        </span>
      )}
      <small>
        {turn
          ? turn.action
          : player
          ? !player.connected
            ? "Reconnecting…"
            : readiness
              ? readiness.label
              : player.isBot
                ? "Bot player"
                : "In game"
          : onSelect
            ? "Choose this seat"
            : "Waiting…"}
      </small>
    </div>
  );
}

function getSeatReadiness(room: Room, playerId: string): SeatReadiness | undefined {
  if (!room.match) {
    const ready = room.players.find((player) => player.id === playerId)?.ready ?? false;
    return { label: ready ? "Ready" : "Not ready", ready };
  }

  if (room.match.phase === "hand-results") {
    const ready = room.match.nextHandReadyPlayerIds.includes(playerId);
    return {
      label: ready ? "Ready for next hand" : "Not ready for next hand",
      ready,
    };
  }

  return undefined;
}

function getPlayerBiddingStatus(
  room: Room,
  playerId: string,
): BiddingStatus {
  const history = room.match?.bidding.history ?? [];
  const actions = history.filter((action) => action.playerId === playerId);
  const latestBid = [...actions]
    .reverse()
    .find((action): action is { playerId: string; amount: number } =>
      "amount" in action,
    );
  const passed = room.match?.bidding.passedPlayerIds.includes(playerId) ?? false;

  if (passed) {
    return {
      label: latestBid ? `Passed · last bid ${latestBid.amount}` : "Passed",
      passed: true,
    };
  }

  return {
    label: latestBid ? `Bid ${latestBid.amount}` : "No bid yet",
    passed: false,
  };
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
