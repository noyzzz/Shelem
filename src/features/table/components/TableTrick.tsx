import { CardFace } from "@/components/PlayingCard";
import type { Position } from "@/domain/types";
import { teamLabel } from "@/features/game/model/gameView";
import { cn } from "@/lib/utils";
import type { TableViewModel } from "../model/tableTypes";

const slotPositionStyle: Record<Position, string> = {
  north: "top-0 left-1/2 -translate-x-1/2",
  south: "bottom-0 left-1/2 -translate-x-1/2",
  west: "top-1/2 left-2 -translate-y-1/2",
  east: "top-1/2 right-2 -translate-y-1/2",
};

export function TableTrick({ model }: { model: TableViewModel }) {
  const teamTricks = model.seats.reduce(
    (totals, seat) => {
      totals[seat.team] += seat.trickWins;
      return totals;
    },
    { one: 0, two: 0 },
  );

  return (
    <section
      className="absolute inset-4 pointer-events-none"
      aria-label="Cards on the table"
    >
      {model.seats.map((seat) => {
        const played = model.trick.find(
          (card) => card.playerId === seat.player?.id,
        );
        return (
          <div
            className={cn(
              "absolute grid justify-items-center gap-1 text-center",
              slotPositionStyle[seat.displayPosition],
            )}
            key={seat.sourcePosition}
          >
            {played ? (
              <article
                aria-label={`${played.card.rank} of ${played.card.suit}`}
                className="aspect-[5/7] w-14 overflow-hidden rounded-md border border-border shadow-md"
              >
                <CardFace
                  card={played.card}
                  className="h-full w-full object-cover"
                />
              </article>
            ) : (
              <span
                className="size-1.5 rounded-full bg-border"
                aria-hidden="true"
              />
            )}
            <small className="max-w-[70px] truncate text-[9px] text-muted-foreground">
              {seat.player?.name ?? seat.sourcePosition}
            </small>
          </div>
        );
      })}
      <div className="absolute right-2 bottom-1 left-2 flex justify-between text-[10px] font-semibold text-muted-foreground">
        <span>
          {teamLabel("one", model.viewerTeam)} {teamTricks.one}
        </span>
        <span>
          {teamLabel("two", model.viewerTeam)} {teamTricks.two}
        </span>
      </div>
    </section>
  );
}
