import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Room } from "@/domain/types";

export function BiddingPanel({
  playerId,
  actionError,
  bidAmount,
  onBid,
  onPass,
  room,
  setBidAmount,
}: {
  actionError: string;
  bidAmount: number;
  onBid: () => void;
  onPass: () => void;
  room: Room;
  playerId: string;
  setBidAmount: (amount: number) => void;
}) {
  const bidding = room.match?.bidding;
  if (!bidding) return null;

  const highBidder = room.players.find(
    (player) => player.id === bidding.highBidderId,
  );
  const currentPlayer = room.players.find(
    (player) => player.id === bidding.currentTurnPlayerId,
  );
  const isYourTurn =
    room.match?.phase === "bidding" && bidding.currentTurnPlayerId === playerId;
  const isOpeningBid = bidding.currentBid === null;
  const minimumBid = bidding.currentBid === null ? 100 : bidding.currentBid + 5;
  const bidOptions = Array.from(
    { length: Math.max(0, Math.floor((165 - minimumBid) / 5) + 1) },
    (_, index) => minimumBid + index * 5,
  );
  const bidItems = bidOptions.map((amount) => ({
    label: String(amount),
    value: String(amount),
  }));
  const auctionStatus = isOpeningBid
    ? isYourTurn
      ? "Set the opening bid"
      : `${currentPlayer?.name ?? "The first bidder"} is choosing`
    : `${highBidder?.name ?? "The bidder"} leads`;

  return (
    <Card
      className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-1rem)] sm:w-[min(720px,calc(100%-2rem))] z-40 gap-0 py-0 bg-[#081f18]/94 backdrop-blur-md border-white/12 shadow-[0_12px_36px_rgba(0,0,0,0.58),0_0_18px_rgba(229,197,122,0.08)] rounded-xl animate-in fade-in-0 slide-in-from-bottom-2"
      size="sm"
    >
      <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:flex-nowrap sm:gap-5 sm:px-4">
        <div className="min-w-0 flex-1">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-primary/75">
            {isOpeningBid ? "Opening bid" : "Current bid"}
          </span>
          <div className="mt-0.5 flex items-baseline gap-2">
            <strong className="font-heading text-lg font-bold leading-none tabular-nums text-foreground">
              {isOpeningBid ? "100" : bidding.currentBid}
            </strong>
            <small className="truncate text-[11px] font-medium text-muted-foreground">
              {auctionStatus}
            </small>
          </div>
        </div>
        {isYourTurn && (
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            {bidOptions.length > 0 && (
              <>
                <Field className="min-w-20 flex-1 sm:w-32 sm:flex-none">
                  <FieldLabel className="sr-only">Your bid</FieldLabel>
                  <Select
                    items={bidItems}
                    onValueChange={(value) => {
                      if (value) setBidAmount(Number(value));
                    }}
                    value={String(bidAmount)}
                  >
                    <SelectTrigger className="h-9 w-full rounded-lg border-white/12 bg-black/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border-white/15 bg-[#081f18]/95 shadow-2xl">
                      <SelectGroup>
                        {bidItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label} pts
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Button
                  onClick={onBid}
                  type="button"
                  className="h-9 shrink-0 rounded-lg px-3 sm:px-4 font-bold bg-gradient-to-r from-[#f3dfa7] via-primary to-[#d8b35e] text-primary-foreground shadow-[0_2px_12px_rgba(229,197,122,0.2)] hover:brightness-105"
                >
                  Place bid
                </Button>
              </>
            )}
            {!isOpeningBid && (
              <Button
                onClick={onPass}
                type="button"
                variant="outline"
                className="h-9 shrink-0 rounded-lg border-white/12 bg-black/15 px-3 text-foreground/85 font-semibold hover:bg-white/10"
              >
                Pass
              </Button>
            )}
          </div>
        )}
      </div>
      {actionError && room.match?.phase === "bidding" && (
        <Alert className="mx-3 mb-2.5" variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}
    </Card>
  );
}
