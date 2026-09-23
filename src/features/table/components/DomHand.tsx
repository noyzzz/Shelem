import { CardFace } from "@/components/PlayingCard";
import { cn } from "@/lib/utils";
import type { TableCardView } from "../model/tableTypes";

export function DomHand({
  cards,
  interactionBlocked,
  onCardAction,
}: {
  cards: TableCardView[];
  interactionBlocked: boolean;
  onCardAction?: (cardId: string) => void;
}) {
  const selectable = cards.some((card) => card.enabled);
  return (
    <section
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex w-[min(920px,calc(100%-2rem))] flex-col items-center gap-2"
      aria-label="Your hand"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <strong>Your hand</strong>
        <span>·</span>
        <span>{cards.length} cards</span>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
        {cards.map(({ card, enabled, selected }) => {
          return (
            <button
              className={cn(
                "relative aspect-[5/7] w-12 sm:w-16 overflow-hidden rounded-md border border-border shadow-md transition-all",
                selected && "ring-2 ring-primary border-primary",
                !selectable && "opacity-90",
              )}
              disabled={interactionBlocked || !enabled}
              key={card.id}
              aria-label={`${card.rank} of ${card.suit}`}
              aria-pressed={selected}
              onClick={() => onCardAction?.(card.id)}
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
