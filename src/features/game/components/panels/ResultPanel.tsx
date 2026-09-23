import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getViewerTeam, otherTeam } from "@/domain/seats";
import type { Room, Team } from "@/domain/types";
import { formatScoreDelta, teamLabel } from "@/features/game/model/gameView";
import { cn } from "@/lib/utils";

export function ResultPanel({
  playerId,
  actionError,
  onToggleReady,
  room,
}: {
  actionError: string;
  onToggleReady: () => void;
  room: Room;
  playerId: string;
}) {
  const result = room.match?.result;
  if (!result) return null;

  const readyPlayerIds = room.match?.nextHandReadyPlayerIds ?? [];
  const isReady = readyPlayerIds.includes(playerId);
  const viewerTeam = getViewerTeam(room, playerId);
  const displayedTeams: Team[] = viewerTeam
    ? [viewerTeam, otherTeam(viewerTeam)]
    : ["one", "two"];
  const outcome = result.shelem
    ? `${teamLabel(result.biddingTeam, viewerTeam)} won Shelem`
    : result.madeBid
      ? `${teamLabel(result.biddingTeam, viewerTeam)} made the ${result.bid} bid`
      : `${teamLabel(result.biddingTeam, viewerTeam)} missed the ${result.bid} bid`;

  return (
    <Card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(880px,calc(100%-2rem))] max-h-[85vh] overflow-y-auto z-50 bg-[#081f18]/95 backdrop-blur-md border-primary/40 shadow-[0_24px_64px_rgba(0,0,0,0.8),0_0_32px_rgba(229,197,122,0.18)] rounded-xl animate-in fade-in-0 zoom-in-95">
      <CardHeader>
        <CardDescription className="text-xs font-semibold uppercase tracking-wider text-primary/80">
          Hand {room.match?.handNumber} result
        </CardDescription>
        <CardTitle className="font-heading text-2xl font-bold text-foreground">
          {outcome}
        </CardTitle>
        {room.matchWinnerTeam && (
          <Badge className="w-fit bg-primary text-primary-foreground font-bold shadow-md">
            {teamLabel(room.matchWinnerTeam, viewerTeam)} wins the match
          </Badge>
        )}
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {displayedTeams.map((team) => (
          <article
            className={cn(
              "flex flex-col gap-2 rounded-lg border border-white/10 bg-black/25 p-3.5",
              result.biddingTeam === team && "border-primary/50 bg-primary/5",
            )}
            key={team}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-foreground">
                {teamLabel(team, viewerTeam)}
              </span>
              {result.biddingTeam === team && (
                <Badge
                  variant="outline"
                  className="border-primary/50 text-primary font-semibold text-[10px]"
                >
                  Bidding team
                </Badge>
              )}
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center mt-1">
              <div className="rounded-md border border-white/8 bg-white/5 p-2">
                <dt className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Hand
                </dt>
                <dd className="font-heading text-base font-bold tabular-nums text-foreground">
                  {result.rawPoints[team]}
                </dd>
              </div>
              <div className="rounded-md border border-white/8 bg-white/5 p-2">
                <dt className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Change
                </dt>
                <dd className="font-heading text-base font-bold tabular-nums text-primary">
                  {formatScoreDelta(result.scoreDelta[team])}
                </dd>
              </div>
              <div className="rounded-md border border-white/8 bg-white/5 p-2">
                <dt className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Match
                </dt>
                <dd className="font-heading text-base font-bold tabular-nums text-foreground">
                  {result.matchScore[team]}
                </dd>
              </div>
            </dl>
          </article>
        ))}
        {actionError && (
          <Alert className="col-span-full" variant="destructive">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      {!room.matchWinnerTeam && (
        <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
          <span className="text-xs font-medium text-muted-foreground">
            {readyPlayerIds.length} of 4 ready for next hand
          </span>
          <Button
            onClick={onToggleReady}
            type="button"
            variant={isReady ? "secondary" : "default"}
            className={cn(
              "rounded-lg font-bold transition-all",
              !isReady &&
                "bg-gradient-to-r from-[#f3dfa7] via-primary to-[#d8b35e] text-primary-foreground shadow-[0_2px_14px_rgba(229,197,122,0.25)]",
            )}
          >
            {isReady ? "Ready for next hand ✓" : "Ready for next hand"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
