import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  gameClient,
  type Card,
  type Player,
  type Position,
  type Room,
  type Team,
} from "./gameClient";
import type { User } from "./authClient";
import { AccountPanel } from "./AccountPanel";
import { VirtualTable } from "./table/VirtualTable";
import { MenuTableScene } from "./table/MenuTableScene";
import { HomeScreen } from "./screens/HomeScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { GameRoomScreen } from "./screens/GameRoomScreen";
import { GameHud, type HudPanel } from "./game/GameHud";
import { BiddingPanel, ForfeitPanel, GroundPanel, ResultPanel } from "./game/GamePanels";
import {
  getViewerTeam,
  otherTeam,
  positionsClockwise,
  positionFromViewer,
  teamForPosition,
  teamLabel,
  teamPlayerNames,
} from "./game/gameView";
import { UsersIcon } from "lucide-react";
import { Logo } from "./ui/Logo";
import { CardBack, CardFace } from "./ui/PlayingCard";
import { cn } from "@/lib/utils";

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

const virtualTableRequested =
  new URLSearchParams(window.location.search).get("renderer") !== "dom";
const cleanRoomCode = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

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
  const [accountUser, setAccountUser] = useState<User | null>(null);
  const [hudPanel, setHudPanel] = useState<HudPanel>(null);
  const [virtualTableEnabled, setVirtualTableEnabled] = useState(
    virtualTableRequested,
  );
  const [isFullscreen, setIsFullscreen] = useState(
    () => Boolean(document.fullscreenElement),
  );
  const acknowledgedTrickReviewIds = useRef(new Set<string>());
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
  const selectedDiscardCards =
    room?.match?.yourHand.filter((card) =>
      selectedDiscardIds.includes(card.id),
    ) ?? [];

  useEffect(() => {
    if (accountUser && !name.trim()) {
      setName(accountUser.name);
    }
  }, [accountUser]);

  useEffect(() => {
    const immersive = screen === "lobby" && virtualTableEnabled;
    document.documentElement.classList.toggle("game-is-immersive", immersive);
    document.body.classList.toggle("game-is-immersive", immersive);
    if (!immersive && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    return () => {
      document.documentElement.classList.remove("game-is-immersive");
      document.body.classList.remove("game-is-immersive");
    };
  }, [screen, virtualTableEnabled]);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    if (!hudPanel) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) {
        setHudPanel(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [hudPanel]);

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

  useEffect(() => {
    const reviewId = room?.match?.play?.trickReviewId;
    if (
      room?.match?.phase !== "playing" ||
      room.match.play?.currentTrick.length !== 4 ||
      !reviewId ||
      acknowledgedTrickReviewIds.current.has(reviewId)
    ) {
      return;
    }

    acknowledgedTrickReviewIds.current.add(reviewId);
    void gameClient.acknowledgeTrickReview(reviewId).catch(() => {
      acknowledgedTrickReviewIds.current.delete(reviewId);
    });
  }, [
    room?.match?.phase,
    room?.match?.play?.currentTrick.length,
    room?.match?.play?.trickReviewId,
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
    setHudPanel(null);
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

  const selectOrPlayCard = async (cardId: string) => {
    if (playPending) return;
    if (selectedPlayCardId !== cardId) {
      setSelectedPlayCardId(cardId);
      setActionError("");
      return;
    }

    setPlayPending(true);
    try {
      await gameClient.playCard(cardId);
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
  const tableCopy = room
    ? getVirtualTableCopy(room, viewerTeam, isGroundWinner, roomCode)
    : { detail: "", status: "Waiting for the table" };

  const copyInvite = async () => {
    const invite = `${window.location.origin}${invitePath(roomCode)}`;
    await navigator.clipboard?.writeText(invite);
    toast.add({ title: "Invite link copied", type: "success" });
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
      setHudPanel(null);
    } catch {
      setActionError("Fullscreen is not available in this browser.");
    }
  };

  if (screen === "lobby") {
    return (
      <GameRoomScreen
        hud={<GameHud
          fullscreenEnabled={document.fullscreenEnabled}
          isFullscreen={isFullscreen}
          onCopyInvite={copyInvite}
          onLeave={leaveRoom}
          onPanelChange={setHudPanel}
          onToggleFullscreen={toggleFullscreen}
          openPanel={hudPanel}
          playerName={currentPlayer?.name ?? name}
          players={room?.players ?? []}
          roomCode={roomCode}
        />}
      >
        {room?.match && <MatchScoreboard room={room} />}

        {!room?.match && (
          <div className="absolute top-18 left-1/2 -translate-x-1/2 z-20 w-[min(440px,calc(100%-2rem))] rounded-xl border border-border/60 bg-card/75 p-3 text-center shadow-md backdrop-blur-md pointer-events-none">
            <h1 className="m-0 font-heading text-lg sm:text-xl font-semibold text-foreground">
              Gather your players
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Share the room code. The game starts when all four players are ready.
            </p>
          </div>
        )}

        {room && turnContext && (
          <TurnBanner room={room} turn={turnContext} />
        )}

        {room && virtualTableEnabled ? (
          <VirtualTable
            detail={tableCopy.detail}
            enabledIds={
              room.match?.phase === "playing" ? playableCardIds : []
            }
            interactionBlocked={
              hudPanel !== null ||
              room.match?.phase === "hand-results" ||
              room.match?.phase === "match-complete"
            }
            onCardAction={
              room.match?.phase === "playing"
                ? selectOrPlayCard
                : toggleDiscard
            }
            onRendererUnavailable={() => setVirtualTableEnabled(false)}
            onSeatSelect={
              !room.match && !seatChangePending ? changeSeat : undefined
            }
            room={room}
            selectable={
              (room.match?.phase === "ground" &&
                room.match.bidding.winnerId === gameClient.playerId) ||
              (room.match?.phase === "playing" &&
                room.match.play?.currentTurnPlayerId === gameClient.playerId)
            }
            selectedIds={
              room.match?.phase === "playing"
                ? selectedPlayCardId
                  ? [selectedPlayCardId]
                  : []
                : selectedDiscardIds
            }
            status={tableCopy.status}
            viewerPosition={room.match ? currentPlayer?.position : undefined}
          />
        ) : (
          <div className="relative mx-auto mt-20 h-[480px] w-[min(820px,100%)]">
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
                    room?.match ? currentPlayer?.position : undefined,
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
                  bidWinner={
                    Boolean(player) &&
                    room?.match?.bidding.winnerId === player?.id
                  }
                  bidAmount={room?.match?.bidding.winningBid}
                  trump={room?.match?.trump}
                  trickWins={
                    player && room?.match?.play
                      ? room.match.play.trickWins[player.id] ?? 0
                      : 0
                  }
                />
              );
            })}

            <div className="absolute top-[22.5%] left-[20%] flex h-[55%] w-[60%] flex-col items-center justify-center rounded-[40%] border border-primary/20 bg-emerald-950/80 shadow-2xl backdrop-blur-sm">
              {room?.match?.phase === "playing" ? (
                <TableTrick
                  room={room}
                  viewerPosition={currentPlayer?.position}
                />
              ) : (
                <div className="mb-3 flex h-14 w-10 items-center justify-center gap-0.5" aria-hidden="true">
                  <CardBack className="h-full w-full" />
                </div>
              )}
              <div className="relative z-10 grid justify-items-center text-center">
                <strong className="font-heading text-sm font-semibold text-foreground">
                  {tableCopy.status}
                </strong>
                <small className="mt-1 text-xs text-muted-foreground">
                  {tableCopy.detail}
                </small>
              </div>
            </div>
          </div>
        )}

        {!room?.match && actionError && (
          <Alert className="absolute top-20 left-1/2 -translate-x-1/2 z-40 max-w-md shadow-lg" variant="destructive">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        {!virtualTableEnabled && room?.match?.phase === "ground-reveal" &&
          room.match.groundCards.length > 0 && (
          <GroundRevealPanel cards={room.match.groundCards} />
        )}

        {!virtualTableEnabled && room?.match &&
          room.match.phase !== "hand-results" &&
          room.match.phase !== "match-complete" && (
          <Hand
            cards={room.match.yourHand}
            enabledIds={
              room.match.phase === "playing" ? playableCardIds : undefined
            }
            onToggle={
              room.match.phase === "playing"
                ? selectOrPlayCard
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
            <p className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 rounded-full border border-border/70 bg-card/85 px-4 py-1 text-xs text-muted-foreground shadow-md backdrop-blur-md text-center">
              {selectedPlayCardId
                ? "Tap the selected card again to play it."
                : "Tap a card once to preview it."}
            </p>
          )}
        {room?.match?.phase === "playing" && actionError && (
          <Alert className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 max-w-md shadow-lg" variant="destructive">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
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
              onRemoveCard={toggleDiscard}
              onSubmit={completeGround}
              selectedCards={selectedDiscardCards}
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

        <div className="absolute bottom-3.5 left-3.5 z-30 flex items-center gap-2.5 rounded-lg border border-border/60 bg-card/80 px-3 py-1.5 backdrop-blur-md shadow-md">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 rounded-full",
                connectionStatus === "connected"
                  ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                  : "bg-destructive animate-pulse",
              )}
            />
            <span className="text-xs text-muted-foreground">
              {connectionStatus === "connected"
                ? "Connected"
                : "Reconnecting…"}
            </span>
          </div>
          {!room?.match && (
            <div className="flex items-center gap-2 border-l border-border/50 pl-2.5">
              {room?.hostPlayerId === gameClient.playerId && (
                <Button
                  onClick={toggleBots}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {hasBots ? "Remove bots" : "Fill bots"}
                </Button>
              )}
              <Button
                onClick={toggleReady}
                size="sm"
                type="button"
                variant={ready ? "secondary" : "default"}
              >
                {ready ? "Ready ✓" : "I’m ready"}
              </Button>
            </div>
          )}
        </div>
      </GameRoomScreen>
    );
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-background">
      <MenuTableScene playerName={accountUser?.name || name || "Guest"} />
      <div aria-hidden="true" className="menu-scene-scrim absolute inset-0" />
      {screen === "home" ? (
        <div className="absolute top-3 right-3 z-30 sm:top-5 sm:right-6">
          <AccountPanel blend onUserChange={setAccountUser} />
        </div>
      ) : (
        <nav className="absolute top-0 left-0 z-30 flex min-h-[72px] w-full items-center justify-between px-6 sm:px-12">
          <Logo />
          <AccountPanel onUserChange={setAccountUser} />
        </nav>
      )}

      <div
        className={cn(
          "relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[1536px] px-5 pt-24 pb-7 sm:px-8 sm:pb-10 lg:px-12",
          screen === "home"
            ? "items-end justify-start md:items-center"
            : "items-center justify-center",
        )}
      >
        {screen === "home" ? (
          <HomeScreen onBegin={begin} />
        ) : (
          <SetupScreen
            connectionStatus={connectionStatus}
            error={formError}
            flow={flow}
            name={name}
            onBack={() => {
              setFormError("");
              window.history.replaceState({}, "", "/");
              setScreen("home");
            }}
            onNameChange={(nextName) => {
              setName(nextName);
              setFormError("");
            }}
            onRoomCodeChange={(code) => {
              setRoomInput(cleanRoomCode(code));
              setFormError("");
            }}
            onSubmit={enterLobby}
            roomCode={roomInput}
          />
        )}
      </div>
    </main>
  );
}

function GroundRevealPanel({ cards }: { cards: Card[] }) {
  return (
    <section className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex w-[min(860px,calc(100%-2rem))] flex-col gap-2 rounded-xl border border-border/80 bg-card/95 p-4 shadow-2xl backdrop-blur-md" aria-label="Revealed zamin">
      <div>
        <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Private zamin</span>
        <strong className="block text-sm font-semibold text-foreground">Only you can see these cards</strong>
        <p className="text-xs text-muted-foreground">They will enter your hand shortly.</p>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {cards.map((card) => (
          <article
            aria-label={`${card.rank} of ${card.suit}`}
            className="aspect-[5/7] w-14 overflow-hidden rounded-md border border-border shadow-md"
            key={card.id}
          >
            <CardFace card={card} className="h-full w-full object-cover" />
          </article>
        ))}
      </div>
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
    <section className="absolute inset-4 pointer-events-none" aria-label="Cards on the table">
      {positionsClockwise.map((position) => {
        const player = room.players.find(
          (candidate) => candidate.position === position,
        );
        const played = play.currentTrick.find(
          (candidate) => candidate.playerId === player?.id,
        );
        const displayPosition = positionFromViewer(position, viewerPosition);
        const slotPositionStyle: Record<Position, string> = {
          north: "top-0 left-1/2 -translate-x-1/2",
          south: "bottom-0 left-1/2 -translate-x-1/2",
          west: "top-1/2 left-2 -translate-y-1/2",
          east: "top-1/2 right-2 -translate-y-1/2",
        };
        return (
          <div
            className={cn("absolute grid justify-items-center gap-1 text-center", slotPositionStyle[displayPosition])}
            key={position}
          >
            {played ? (
              <article
                aria-label={`${played.card.rank} of ${played.card.suit}`}
                className="aspect-[5/7] w-14 overflow-hidden rounded-md border border-border shadow-md"
              >
                <CardFace card={played.card} className="h-full w-full object-cover" />
              </article>
            ) : (
              <span className="size-1.5 rounded-full bg-border" aria-hidden="true" />
            )}
            <small className="max-w-[70px] truncate text-[9px] text-muted-foreground">{player?.name ?? position}</small>
          </div>
        );
      })}
      <div className="absolute right-2 bottom-1 left-2 flex justify-between text-[10px] font-semibold text-muted-foreground">
        <span>{teamLabel("one", viewerTeam)} {teamTricks.one}</span>
        <span>{teamLabel("two", viewerTeam)} {teamTricks.two}</span>
      </div>
    </section>
  );
}

function MatchScoreboard({ room }: { room: Room }) {
  const viewerTeam = getViewerTeam(room) ?? "one";
  const opponentTeam = otherTeam(viewerTeam);

  return (
    <section className="absolute top-18 sm:top-4 left-1/2 -translate-x-1/2 z-30 grid grid-cols-[1fr_auto_1fr] items-center gap-3 min-h-11 w-[min(440px,calc(100%-2rem))] px-4 py-1.5 rounded-xl border border-border/70 bg-card/85 backdrop-blur-md shadow-md" aria-label="Current match score">
      <ScoreboardTeam room={room} team={viewerTeam} viewerTeam={viewerTeam} />
      <small className="text-[10px] font-medium text-muted-foreground tracking-wide">First to 1,000</small>
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
    <div className="flex min-w-0 items-center justify-between gap-2">
      <div className="min-w-0">
        <span className="block truncate text-[11px] font-semibold text-muted-foreground">{teamLabel(team, viewerTeam)}</span>
        <small className="block truncate text-[9px] text-muted-foreground/70">{teamPlayerNames(room, team)}</small>
      </div>
      <strong className={cn("font-heading text-xl font-semibold tabular-nums", team === "one" ? "text-primary" : "text-emerald-400")}>
        {room.score[team]}
      </strong>
    </div>
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
    <section className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex w-[min(920px,calc(100%-2rem))] flex-col items-center gap-2" aria-label="Your hand">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <strong>Your hand</strong>
        <span>·</span>
        <span>{cards.length} cards</span>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
        {sortedCards.map((card) => {
          const selected = selectedIds.includes(card.id);
          return (
            <button
              className={cn(
                "relative aspect-[5/7] w-12 sm:w-16 overflow-hidden rounded-md border border-border shadow-md transition-all",
                selected && "-translate-y-2 ring-2 ring-primary border-primary",
                !selectable && "opacity-90",
              )}
              disabled={
                !selectable ||
                (enabledIds !== undefined && !enabledIds.includes(card.id))
              }
              key={card.id}
              aria-label={`${card.rank} of ${card.suit}`}
              aria-pressed={selected}
              onClick={() => onToggle?.(card.id)}
              type="button"
            >
              <CardFace card={card} className="h-full w-full object-cover" />
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

function getVirtualTableCopy(
  room: Room,
  viewerTeam: Team | undefined,
  isGroundWinner: boolean,
  roomCode: string,
) {
  const match = room.match;
  if (!match) {
    const remaining = 4 - room.players.length;
    return {
      status:
        remaining === 0
          ? "All players have joined"
          : `Waiting for ${remaining} ${remaining === 1 ? "player" : "players"}`,
      detail: `Invite friends using code ${roomCode}`,
    };
  }

  if (match.phase === "match-complete") {
    const winner =
      match.forfeit?.winningTeam ?? room.matchWinnerTeam ?? "one";
    return {
      status: `${teamLabel(winner, viewerTeam)} wins`,
      detail: match.forfeit
        ? "The match ended by forfeit"
        : "The match is complete",
    };
  }
  if (match.phase === "hand-results") {
    return {
      status: `${teamLabel("one", viewerTeam)} ${
        match.result?.rawPoints.one ?? 0
      } · ${teamLabel("two", viewerTeam)} ${
        match.result?.rawPoints.two ?? 0
      }`,
      detail: `Bid ${match.result?.bid ?? "—"} · ${suitLabel(
        match.trump,
      )} was trump`,
    };
  }
  if (match.phase === "playing") {
    const resolvingPlayer = room.players.find(
      (player) => player.id === match.play?.resolvingTrickWinnerId,
    );
    return resolvingPlayer
      ? {
          status: `${resolvingPlayer.name} wins the trick`,
          detail: "Reviewing all four cards",
        }
      : {
          status: `Trick ${(match.play?.completedTrickCount ?? 0) + 1} of 12`,
          detail: match.trump
            ? `${suitLabel(match.trump)} is trump`
            : "The opening card establishes trump",
        };
  }
  if (match.phase === "ground-reveal") {
    return {
      status: isGroundWinner ? "Your zamin is revealed" : "The zamin is hidden",
      detail: isGroundWinner
        ? "These cards will enter your hand"
        : "Waiting for the bidder",
    };
  }
  if (match.phase === "ground") {
    const bidder = room.players.find(
      (player) => player.id === match.bidding.winnerId,
    );
    return {
      status: `${bidder?.name ?? "The bidder"} won with ${
        match.bidding.winningBid ?? "—"
      }`,
      detail: isGroundWinner
        ? "Select four cards to discard"
        : "Waiting for the bidder to discard",
    };
  }
  return {
    status:
      match.bidding.currentBid === null
        ? "Opening bid: 100 minimum"
        : `Current bid: ${match.bidding.currentBid}`,
    detail: `${match.groundCount} cards are face down in the zamin`,
  };
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
    return hand.map((card) => card.id);
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
      className={cn(
        "absolute top-28 sm:top-20 left-4 sm:left-6 z-30 flex min-h-12 w-[min(300px,calc(100%-2rem))] items-center gap-3 rounded-xl border bg-card/85 p-3 shadow-md backdrop-blur-md transition-colors",
        isYou ? "border-primary/50 bg-primary/10" : "border-border/70",
      )}
    >
      <span
        className={cn(
          "size-2.5 shrink-0 rounded-full",
          isYou ? "bg-primary shadow-[0_0_8px_rgba(229,197,122,0.8)]" : "bg-emerald-400",
        )}
        aria-hidden="true"
      />
      <div className="grid gap-0.5">
        <small className="text-[10px] font-semibold text-muted-foreground">{isYou ? "Your turn" : "Current turn"}</small>
        <strong className="font-heading text-xs font-semibold text-foreground">
          {isYou ? `Your turn, ${player.name}` : `${player.name}'s turn`}
        </strong>
      </div>
      <p className="ml-auto text-[11px] text-muted-foreground">{turn.action}</p>
    </section>
  );
}

function Seat({
  bidAmount,
  bidWinner,
  biddingStatus,
  displayPosition,
  onSelect,
  position,
  team,
  player,
  readiness,
  trickWins,
  trump,
  turn,
}: {
  bidAmount?: number | null;
  bidWinner?: boolean;
  biddingStatus?: BiddingStatus;
  displayPosition: Position;
  onSelect?: (position: Position) => void;
  position: Position;
  team: "one" | "two";
  player?: Player;
  readiness?: SeatReadiness;
  trickWins?: number;
  trump?: Card["suit"] | null;
  turn?: TurnContext;
}) {
  const isYou = player?.id === gameClient.playerId;
  const bidWinnerDescription = player
    ? trump
      ? `${player.name} won the bid. ${suitLabel(trump)} is trump.`
      : `${player.name} won the bid${bidAmount ? ` with ${bidAmount}` : ""}.`
    : "";

  const seatPositionStyles: Record<Position, string> = {
    north: "top-0 left-1/2 -translate-x-1/2",
    south: "bottom-0 left-1/2 -translate-x-1/2",
    west: "top-1/2 left-3 -translate-y-1/2",
    east: "top-1/2 right-3 -translate-y-1/2",
  };

  return (
    <div
      className={cn(
        "absolute grid min-w-28 justify-items-center text-center z-20",
        seatPositionStyles[displayPosition],
      )}
    >
      {player || !onSelect ? (
        <div
          className={cn(
            "relative mb-1.5 grid size-14 place-items-center rounded-full border border-border bg-card font-heading text-lg font-bold text-foreground shadow-md",
            team === "two" ? "border-emerald-500/40 text-emerald-400" : "border-primary/40 text-primary",
            bidWinner && "ring-2 ring-primary",
          )}
        >
          {player ? player.name.slice(0, 1).toUpperCase() : <UsersIcon />}
          {player && (
            <span
              className="absolute inset-0.5 block overflow-hidden rounded-full"
              id={`seat-camera-${player.id}`}
            />
          )}
          {readiness?.ready && (
            <span className="absolute right-0 bottom-0 z-20 grid size-4.5 place-items-center rounded-full border border-background bg-emerald-500 text-[10px] font-bold text-emerald-950">
              ✓
            </span>
          )}
          {player && bidWinner && (
            <span
              aria-label={bidWinnerDescription}
              className={cn(
                "absolute -top-2 -right-3 z-30 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-primary-foreground shadow-sm",
                (trump === "diamonds" || trump === "hearts") && "text-destructive",
              )}
              role="status"
            >
              <span aria-hidden="true">{trump ? suitSymbol(trump) : "♛"}</span>
              <small>
                {trump ? `Trump ${suitLabel(trump)}` : `Bid ${bidAmount ?? ""}`}
              </small>
            </span>
          )}
          {player && Boolean(trickWins) && (
            <span
              aria-label={`${player.name} has won ${trickWins} ${
                trickWins === 1 ? "trick" : "tricks"
              }`}
              className="absolute top-1/2 -left-3 grid size-5 -translate-y-1/2 place-items-center rounded-full border border-background bg-primary text-[9px] font-bold text-primary-foreground shadow-sm"
              role="status"
            >
              <span aria-hidden="true">{trickWins}</span>
            </span>
          )}
        </div>
      ) : (
        <button
          aria-label={`Move to the ${displayPosition} seat`}
          className="relative mb-1.5 grid size-14 place-items-center rounded-full border border-dashed border-border bg-card/40 font-heading text-lg font-bold text-muted-foreground shadow-sm transition-transform hover:scale-105 hover:border-primary hover:text-primary active:scale-95"
          onClick={() => onSelect(position)}
          type="button"
        >
          <UsersIcon />
        </button>
      )}
      <strong className="max-w-[110px] truncate text-xs font-semibold text-foreground">{player?.name || "Open seat"}</strong>
      {biddingStatus && (
        <span
          className={cn(
            "mt-0.5 rounded-full px-2 py-0.5 text-[9px] font-semibold text-foreground bg-muted",
            biddingStatus.passed && "opacity-60",
          )}
        >
          {biddingStatus.label}
        </span>
      )}
      {turn && (
        <span className="mt-0.5 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-primary-foreground shadow-xs">
          {isYou ? "Your turn" : turn.seatLabel}
        </span>
      )}
      <small className="mt-0.5 text-[10px] text-muted-foreground">
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
