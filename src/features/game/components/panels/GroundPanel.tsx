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
import { cn } from "@/lib/utils";

export function GroundPanel({
  actionError,
  onRemoveCard,
  onSubmit,
  selectedCards,
}: {
  actionError: string;
  onRemoveCard: (cardId: string) => void;
  onSubmit: () => void;
  selectedCards: GameCard[];
}) {
  return (
    <Card className="absolute bottom-2 left-2 right-2 sm:bottom-auto sm:left-auto sm:right-4 sm:top-20 max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-6rem)] sm:w-[min(360px,calc(100%-2rem))] overflow-y-auto z-40 bg-[#081f18]/95 backdrop-blur-md border-primary/35 shadow-[0_16px_48px_rgba(0,0,0,0.7)] rounded-xl animate-in fade-in-0 slide-in-from-right-2">
      <CardHeader className="hidden sm:grid">
        <CardTitle className="font-heading text-lg font-bold text-foreground">
          Prepare the hand
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Select four cards to discard. Your opening lead establishes trump.
        </CardDescription>
      </CardHeader>
      <CardContent className={cn("sm:block", actionError ? "block" : "hidden")}>
        {selectedCards.length > 0 && (
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
      <CardFooter>
        <Button
          disabled={selectedCards.length !== 4}
          onClick={onSubmit}
          type="button"
          className="w-full rounded-lg font-bold bg-gradient-to-r from-[#f3dfa7] via-primary to-[#d8b35e] text-primary-foreground shadow-[0_2px_14px_rgba(229,197,122,0.25)] disabled:opacity-50"
        >
          Discard {selectedCards.length}/4 and continue
        </Button>
      </CardFooter>
    </Card>
  );
}
