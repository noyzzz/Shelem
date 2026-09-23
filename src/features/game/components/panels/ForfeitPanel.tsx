import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getViewerTeam } from "@/domain/seats";
import type { Room } from "@/domain/types";
import { teamLabel } from "@/features/game/model/gameView";

export function ForfeitPanel({
  playerId,
  room,
}: {
  room: Room;
  playerId: string;
}) {
  const forfeit = room.match?.forfeit;
  if (!forfeit) return null;
  const viewerTeam = getViewerTeam(room, playerId);

  return (
    <Card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(680px,calc(100%-2rem))] z-50 bg-[#081f18]/95 backdrop-blur-md border-primary/40 shadow-[0_24px_64px_rgba(0,0,0,0.8)] rounded-xl animate-in fade-in-0 zoom-in-95">
      <CardHeader>
        <CardDescription className="text-xs font-semibold uppercase tracking-wider text-primary/80">
          Match result
        </CardDescription>
        <CardTitle className="font-heading text-2xl font-bold text-foreground">
          {teamLabel(forfeit.winningTeam, viewerTeam)} wins by forfeit
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {forfeit.losingPlayerName}{" "}
          {forfeit.reason === "left"
            ? "left the match."
            : "did not reconnect before the grace period ended."}
        </p>
      </CardContent>
      <CardFooter className="text-sm font-semibold text-foreground border-t border-white/10 pt-3">
        Final score: {teamLabel("one", viewerTeam)} {room.score.one} ·{" "}
        {teamLabel("two", viewerTeam)} {room.score.two}
      </CardFooter>
    </Card>
  );
}
