import { CardFace } from "@/components/PlayingCard";
import { cn } from "@/lib/utils";
import type { TableViewModel } from "../model/tableTypes";

export function MobileHand({
  cards,
  interactionBlocked,
  onCardAction,
  phase,
}: {
  cards: TableViewModel["hand"];
  interactionBlocked: boolean;
  onCardAction?: (cardId: string) => void;
  phase: TableViewModel["phase"];
}) {
  const bottomClass =
    phase === "bidding"
      ? "bottom-34"
      : phase === "ground"
        ? "bottom-22"
        : "bottom-16";

  return (
    <div
      aria-label="Your hand"
      className={cn(
        "absolute left-2 right-2 z-35 h-28 pointer-events-none",
        bottomClass,
      )}
      role="group"
    >
      {phase === "playing" && cards.some((card) => card.enabled) && (
        <span className="absolute -top-3 left-1 text-xs font-semibold text-primary">
          Your turn
        </span>
      )}
      {cards.map(({ card, enabled, selected }, index) => {
        const progress = cards.length <= 1 ? 0.5 : index / (cards.length - 1);
        const disabled = interactionBlocked || !enabled;
        return (
          <button
            aria-label={`${card.rank} of ${card.suit}`}
            aria-pressed={selected}
            className={cn(
              "absolute top-3 aspect-[5/7] w-[clamp(58px,18vw,76px)] overflow-hidden rounded-md border border-black/25 bg-[#fff0c2] shadow-[0_5px_14px_rgba(0,0,0,0.5)] transition-[filter,border-color,box-shadow] duration-150 pointer-events-auto",
              enabled && !interactionBlocked && "active:brightness-110",
              selected &&
                "border-primary ring-2 ring-inset ring-primary",
            )}
            disabled={disabled}
            key={card.id}
            onClick={() => onCardAction?.(card.id)}
            style={{
              left: `${progress * 100}%`,
              transform: `translateX(-${progress * 100}%)`,
              zIndex: index,
            }}
            type="button"
          >
            <CardFace card={card} className="h-full w-full object-cover" />
          </button>
        );
      })}
    </div>
  );
}
