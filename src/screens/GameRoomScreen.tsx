import { invitePath, isVirtualTableRequested } from "@/app/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { getPlayableCardIds } from "@/domain/cards";
import type { Room } from "@/domain/types";
import type { ConnectionStatus } from "@/features/game/api/gameClient";
import { GameHud } from "@/features/game/components/GameHud";
import { LobbyControls } from "@/features/game/components/LobbyControls";
import { MatchScoreboard } from "@/features/game/components/MatchScoreboard";
import { BiddingPanel } from "@/features/game/components/panels/BiddingPanel";
import { ForfeitPanel } from "@/features/game/components/panels/ForfeitPanel";
import { GroundPanel } from "@/features/game/components/panels/GroundPanel";
import { ResultPanel } from "@/features/game/components/panels/ResultPanel";
import { useGameActions } from "@/features/game/hooks/useGameActions";
import { useGameDisplay } from "@/features/game/hooks/useGameDisplay";
import { getTableStatus } from "@/features/game/model/gameView";
import { useSeatVideoTargets } from "@/features/media/hooks/useSeatVideoTargets";
import type { RequestMediaCredentials } from "@/features/media/types";
import { DomTable } from "@/features/table/components/DomTable";
import { VirtualTable } from "@/features/table/components/VirtualTable";
import { buildTableViewModel } from "@/features/table/model/buildTableViewModel";
import { cn } from "@/lib/utils";
import { lazy, Suspense, useMemo, useState } from "react";

const MediaRoom = lazy(() =>
  import("@/features/media/components/MediaRoom").then(({ MediaRoom }) => ({
    default: MediaRoom,
  })),
);

export function GameRoomScreen({
  room,
  playerId,
  playerName,
  connectionStatus,
  onLeave,
  requestMediaCredentials,
}: {
  room: Room;
  playerId: string;
  playerName: string;
  connectionStatus: ConnectionStatus;
  onLeave: () => void;
  requestMediaCredentials: RequestMediaCredentials;
}) {
  const actions = useGameActions(room, playerId);
  const [virtualTableEnabled, setVirtualTableEnabled] = useState(
    isVirtualTableRequested,
  );
  const display = useGameDisplay(virtualTableEnabled, actions.setActionError);
  const video = useSeatVideoTargets();
  const { selectedDiscardIds, selectedPlayCardId } = actions;
  const model = useMemo(() => {
    const playing = room.match?.phase === "playing";
    const player = room.players.find((candidate) => candidate.id === playerId);
    return buildTableViewModel({
      room,
      viewerPosition: room.match ? player?.position : undefined,
      enabledIds: playing ? getPlayableCardIds(room, playerId) : undefined,
      selectable:
        (room.match?.phase === "ground" &&
          room.match.bidding.winnerId === playerId) ||
        (playing && room.match?.play?.currentTurnPlayerId === playerId),
      selectedIds: playing
        ? selectedPlayCardId
          ? [selectedPlayCardId]
          : []
        : selectedDiscardIds,
    });
  }, [room, playerId, selectedDiscardIds, selectedPlayCardId]);
  const tableStatus = getTableStatus(
    room,
    actions.viewerTeam,
    actions.isGroundWinner,
  );
  const tableProps = {
    model,
    ...tableStatus,
    interactionBlocked:
      display.hudPanel !== null ||
      model.phase === "hand-results" ||
      model.phase === "match-complete",
    onCardAction:
      model.phase === "playing"
        ? actions.selectOrPlayCard
        : actions.toggleDiscard,
    onSeatSelect:
      !room.match && !actions.seatChangePending
        ? actions.changeSeat
        : undefined,
    onSeatVideoTarget: video.register,
  };

  const copyInvite = async () => {
    await navigator.clipboard?.writeText(
      `${window.location.origin}${invitePath(room.code)}`,
    );
    toast.add({ title: "Invite link copied", type: "success" });
  };

  return (
    <main className="fixed inset-0 h-[100dvh] w-screen overflow-hidden bg-background text-foreground select-none isolate">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_42%,rgba(16,72,52,0.35),transparent_75%),radial-gradient(ellipse_95%_95%_at_50%_50%,transparent_45%,rgba(3,10,7,0.85)_100%)]"
      />
      <GameHud
        fullscreenEnabled={document.fullscreenEnabled}
        isFullscreen={display.isFullscreen}
        onCopyInvite={copyInvite}
        onLeave={onLeave}
        onPanelChange={display.setHudPanel}
        onToggleFullscreen={display.toggleFullscreen}
        openPanel={display.hudPanel}
        playerName={actions.currentPlayer?.name ?? playerName}
        roomCode={room.code}
        media={
          <Suspense
            fallback={
              <div className="py-6 text-center text-xs text-muted-foreground">
                Loading conversation…
              </div>
            }
          >
            <MediaRoom
              players={room.players}
              requestCredentials={requestMediaCredentials}
              seatVideoTargets={video.targets}
            />
          </Suspense>
        }
      />
      <section className="relative h-full w-full overflow-hidden pointer-events-none *:pointer-events-auto">
        {room.match && <MatchScoreboard room={room} playerId={playerId} />}
        {!room.match && (
          <div className="absolute top-18 left-1/2 -translate-x-1/2 z-20 w-[min(440px,calc(100%-2rem))] rounded-2xl border border-white/12 bg-[#081f18]/90 p-3.5 text-center shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_16px_rgba(229,197,122,0.12)] backdrop-blur-md pointer-events-none">
            <h1 className="m-0 font-heading text-lg sm:text-xl font-bold tracking-tight text-foreground">
              Gather your table
            </h1>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              Share the room code. The game starts when all four players are
              ready.
            </p>
          </div>
        )}
        {virtualTableEnabled ? (
          <VirtualTable
            {...tableProps}
            onRendererUnavailable={() => setVirtualTableEnabled(false)}
          />
        ) : (
          <DomTable {...tableProps} />
        )}
        {actions.actionError && (!room.match || model.phase === "playing") && (
          <Alert
            variant="destructive"
            className={cn(
              "absolute left-1/2 -translate-x-1/2 z-40 max-w-md shadow-lg",
              room.match ? "bottom-24" : "top-20",
            )}
          >
            <AlertDescription>{actions.actionError}</AlertDescription>
          </Alert>
        )}
        {model.phase === "bidding" && (
          <BiddingPanel
            room={room}
            playerId={playerId}
            actionError={actions.actionError}
            bidAmount={actions.bidAmount}
            setBidAmount={actions.setBidAmount}
            onBid={actions.placeBid}
            onPass={actions.passBid}
          />
        )}
        {model.phase === "ground" && actions.isGroundWinner && (
          <GroundPanel
            actionError={actions.actionError}
            onRemoveCard={actions.toggleDiscard}
            onSubmit={actions.completeGround}
            selectedCards={actions.selectedDiscardCards}
          />
        )}
        {model.phase === "hand-results" && (
          <ResultPanel
            room={room}
            playerId={playerId}
            actionError={actions.actionError}
            onToggleReady={actions.toggleNextHandReady}
          />
        )}
        {model.phase === "match-complete" && (
          <ForfeitPanel room={room} playerId={playerId} />
        )}
        <LobbyControls
          connectionStatus={connectionStatus}
          inLobby={!room.match}
          isHost={room.hostPlayerId === playerId}
          hasBots={actions.hasBots}
          ready={actions.ready}
          onToggleBots={actions.toggleBots}
          onToggleReady={actions.toggleReady}
        />
      </section>
    </main>
  );
}
