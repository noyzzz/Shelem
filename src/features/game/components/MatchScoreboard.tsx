import { suitLabel, suitSymbol } from "@/domain/cards";
import { getViewerTeam, otherTeam } from "@/domain/seats";
import type { Room, Team } from "@/domain/types";
import { cn } from "@/lib/utils";
import { teamLabel, teamPlayerNames } from "../model/gameView";

export function MatchScoreboard({
  room,
  playerId,
}: {
  room: Room;
  playerId: string;
}) {
  const viewerTeam = getViewerTeam(room, playerId) ?? "one";
  const opponentTeam = otherTeam(viewerTeam);
  const bidder = room.players.find(
    (player) => player.id === room.match?.bidding.winnerId,
  );
  const trump = room.match?.trump;

  return (
    <section
      aria-label="Current match score"
      className="absolute top-18 sm:top-4 left-1/2 -translate-x-1/2 z-30 flex items-center justify-between gap-2.5 sm:gap-4 min-h-12 w-[min(460px,calc(100%-2rem))] px-4 py-2 rounded-2xl border border-white/12 bg-[#081f18]/90 shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_16px_rgba(229,197,122,0.1)] backdrop-blur-md"
    >
      <ScoreboardTeam
        isViewer
        room={room}
        team={viewerTeam}
        viewerTeam={viewerTeam}
      />
      <div
        aria-label={
          bidder
            ? trump
              ? `${suitLabel(trump)} is trump. ${bidder.name} won the bid.`
              : `${bidder.name} won the bid.`
            : "Target score 1,000"
        }
        className="flex min-w-16 shrink-0 flex-col items-center justify-center border-x border-white/10 px-2 py-0.5"
      >
        <span className="font-heading text-[9px] font-bold uppercase tracking-wider text-primary/75">
          {bidder ? (trump ? "Trump" : "Bid won") : "Target"}
        </span>
        {bidder ? (
          <div className="flex items-center gap-1.5">
            <strong
              className={cn(
                "font-serif text-base font-semibold leading-none text-primary",
                trump &&
                  (trump === "diamonds" || trump === "hearts") &&
                  "text-destructive",
              )}
            >
              {trump ? suitSymbol(trump) : room.match?.bidding.winningBid}
            </strong>
            <small className="max-w-14 truncate text-[8px] font-medium text-muted-foreground">
              {bidder.name}
            </small>
          </div>
        ) : (
          <strong className="text-xs font-semibold tabular-nums text-foreground/90">
            1,000
          </strong>
        )}
      </div>
      <ScoreboardTeam
        isViewer={false}
        room={room}
        team={opponentTeam}
        viewerTeam={viewerTeam}
      />
    </section>
  );
}

function ScoreboardTeam({
  isViewer,
  room,
  team,
  viewerTeam,
}: {
  isViewer: boolean;
  room: Room;
  team: Team;
  viewerTeam: Team;
}) {
  const isTeamOne = team === "one";
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2.5",
        !isViewer && "flex-row-reverse",
      )}
    >
      <div className={cn("min-w-0 flex-1", !isViewer && "text-right")}>
        <div
          className={cn(
            "flex items-center",
            isViewer ? "justify-start" : "justify-end",
          )}
        >
          <span className="truncate text-[11px] font-bold tracking-wide text-foreground/90">
            {teamLabel(team, viewerTeam)}
          </span>
        </div>
        <small className="block truncate text-[9px] font-medium text-muted-foreground">
          {teamPlayerNames(room, team)}
        </small>
      </div>
      <strong
        className={cn(
          "font-heading text-2xl font-bold tabular-nums shrink-0 leading-none",
          isTeamOne ? "text-primary" : "text-emerald-300",
        )}
      >
        {room.score[team]}
      </strong>
    </div>
  );
}
