import { CardFace } from "@/components/PlayingCard";
import type { Card } from "@/domain/types";

export function GroundRevealPanel({ cards }: { cards: Card[] }) {
  return (
    <section
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex w-[min(860px,calc(100%-2rem))] flex-col gap-2 rounded-xl border border-border/80 bg-card/95 p-4 shadow-2xl backdrop-blur-md"
      aria-label="Revealed zamin"
    >
      <div>
        <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
          Private zamin
        </span>
        <strong className="block text-sm font-semibold text-foreground">
          Only you can see these cards
        </strong>
        <p className="text-xs text-muted-foreground">
          They will enter your hand shortly.
        </p>
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
