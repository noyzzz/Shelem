import { suitSymbol } from "@/domain/cards";
import type { TableViewModel } from "../model/tableTypes";

export function TableAccessibility({
  cards,
  interactionBlocked,
  onCardAction,
  status,
}: {
  cards: TableViewModel["hand"];
  interactionBlocked: boolean;
  onCardAction?: (cardId: string) => void;
  status: string;
}) {
  if (cards.length === 0) {
    return (
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
    );
  }
  return (
    <div className="absolute right-3 bottom-3 z-40">
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
      <div
        className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:right-0 focus-within:bottom-0 focus-within:flex focus-within:w-[min(560px,calc(100vw-40px))] focus-within:flex-wrap focus-within:gap-1.5 focus-within:rounded-xl focus-within:border focus-within:border-border focus-within:bg-card/95 focus-within:p-3 focus-within:shadow-2xl"
        aria-label="Your hand"
        role="group"
      >
        <span className="w-full text-xs font-semibold text-muted-foreground">
          Keyboard hand
        </span>
        {cards.map(({ card, enabled, selected }) => (
          <button
            aria-label={`${card.rank} of ${card.suit}`}
            aria-pressed={selected}
            className="min-h-9 min-w-9 rounded-md border border-border bg-secondary px-2 py-1 text-sm font-semibold text-secondary-foreground shadow-xs disabled:opacity-40"
            disabled={interactionBlocked || !enabled}
            key={card.id}
            onClick={() => {
              if (!interactionBlocked) onCardAction?.(card.id);
            }}
            type="button"
          >
            {card.rank}
            {suitSymbol(card.suit)}
          </button>
        ))}
      </div>
    </div>
  );
}
