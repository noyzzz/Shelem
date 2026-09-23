import { suitSymbol } from "@/domain/cards";
import type { TableViewModel } from "../model/tableTypes";

export function TableAccessibility({
  model,
  interactionBlocked,
  onCardAction,
  status,
}: {
  model: TableViewModel;
  interactionBlocked: boolean;
  onCardAction?: (cardId: string) => void;
  status: string;
}) {
  const cards = model.hand;
  const currentTurn = model.seats.find((seat) => seat.turn);
  return (
    <div className="absolute right-3 bottom-3 z-40">
      <p className="sr-only" aria-live="polite">
        {status}
        {currentTurn?.turn &&
          `. ${currentTurn.player?.name ?? currentTurn.displayPosition}: ${currentTurn.turn.seatLabel}.`}
      </p>
      {model.trick.length > 0 && (
        <ul className="sr-only" aria-label="Cards on the table">
          {model.trick.map(({ card, playerId, displayPosition }) => {
            const player = model.seats.find(
              (seat) => seat.player?.id === playerId,
            )?.player;
            return (
              <li key={card.id}>
                {player?.name ?? displayPosition}: {card.rank} of {card.suit}
              </li>
            );
          })}
        </ul>
      )}
      {model.groundCards.length > 0 && (
        <ul className="sr-only" aria-label="Your revealed zamin cards">
          {model.groundCards.map((card) => (
            <li key={card.id}>
              {card.rank} of {card.suit}
            </li>
          ))}
        </ul>
      )}
      {cards.length > 0 && (
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
      )}
    </div>
  );
}
