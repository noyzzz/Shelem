import { CardFace } from "@/components/PlayingCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Card as GameCard } from "@/domain/types";
import { useMediaQuery } from "@/features/table/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

export function GroundPanel({
  actionError,
  onRemoveCard,
  onSubmit,
  selectedCards,
  submitting,
}: {
  actionError: string;
  onRemoveCard: (cardId: string) => void;
  onSubmit: () => void;
  selectedCards: GameCard[];
  submitting: boolean;
}) {
  const compactLandscape = useMediaQuery(
    "(max-height: 500px) and (orientation: landscape)",
  );

  return (
    <Card
      className={cn(
        "absolute z-40 max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-xl border-primary/35 bg-[#081f18]/95 shadow-[0_16px_48px_rgba(0,0,0,0.7)] backdrop-blur-md animate-in fade-in-0 slide-in-from-right-2",
        compactLandscape
          ? "right-2 bottom-2 left-2 w-auto gap-0 py-0"
          : "right-2 bottom-2 left-2 sm:top-20 sm:right-4 sm:bottom-auto sm:left-auto sm:max-h-[calc(100dvh-6rem)] sm:w-[min(360px,calc(100%-2rem))]",
      )}
    >
      {!compactLandscape && <CardHeader className="hidden sm:grid">
        <CardTitle className="font-heading text-lg font-bold text-foreground">
          Prepare the hand
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Select four cards to discard. Your opening lead establishes trump.
        </CardDescription>
      </CardHeader>}
      <CardContent
        className={cn(
          compactLandscape && "px-2 pt-2 pb-0",
          actionError ? "block" : compactLandscape ? "hidden" : "hidden sm:block",
        )}
      >
        {!compactLandscape && selectedCards.length > 0 && (
          <div
            className="hidden flex-wrap gap-2.5 py-2 sm:flex"
            aria-label="Selected discards"
          >
            {selectedCards.map((card) => (
              <button
                aria-label={`Remove ${card.rank} of ${card.suit} from discards`}
                className="relative aspect-[5/7] w-14 overflow-hidden rounded-md border border-primary/40 shadow-md transition-all hover:scale-105 hover:border-destructive group"
                key={card.id}
                onClick={() => onRemoveCard(card.id)}
                type="button"
              >
                <CardFace card={card} className="w-full h-full object-cover" />
                <span
                  className="absolute top-0.5 right-0.5 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-sm"
                  aria-hidden="true"
                >
                  ×
                </span>
              </button>
            ))}
          </div>
        )}
        {actionError && (
          <Alert className="mt-2" variant="destructive">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className={cn(compactLandscape && "p-2")}>
        <Button
          disabled={selectedCards.length !== 4 || submitting}
          onClick={onSubmit}
          type="button"
          className={cn(
            "w-full rounded-lg font-bold bg-gradient-to-r from-[#f3dfa7] via-primary to-[#d8b35e] text-primary-foreground shadow-[0_2px_14px_rgba(229,197,122,0.25)] disabled:opacity-50",
            compactLandscape && "h-9 text-xs",
          )}
        >
          {submitting
            ? "Preparing play…"
            : `Discard ${selectedCards.length}/4 and continue`}
        </Button>
      </CardFooter>
    </Card>
  );
}
