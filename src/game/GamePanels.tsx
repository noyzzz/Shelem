import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { gameClient, type Card as GameCard, type Room, type Team } from "../gameClient";
import { CardFace } from "../ui/PlayingCard";
import { formatScoreDelta, getViewerTeam, otherTeam, teamLabel } from "./gameView";
import { cn } from "@/lib/utils";

export function BiddingPanel({ actionError, bidAmount, onBid, onPass, room, setBidAmount }: {
  actionError: string;
  bidAmount: number;
  onBid: () => void;
  onPass: () => void;
  room: Room;
  setBidAmount: (amount: number) => void;
}) {
  const bidding = room.match?.bidding;
  if (!bidding) return null;

  const highBidder = room.players.find((player) => player.id === bidding.highBidderId);
  const currentPlayer = room.players.find((player) => player.id === bidding.currentTurnPlayerId);
  const isYourTurn = room.match?.phase === "bidding" && bidding.currentTurnPlayerId === gameClient.playerId;
  const isOpeningBid = bidding.currentBid === null;
  const minimumBid = bidding.currentBid === null ? 100 : bidding.currentBid + 5;
  const bidOptions = Array.from(
    { length: Math.max(0, Math.floor((165 - minimumBid) / 5) + 1) },
    (_, index) => minimumBid + index * 5,
  );
  const bidItems = bidOptions.map((amount) => ({ label: String(amount), value: String(amount) }));
  const auctionStatus = isOpeningBid
    ? isYourTurn
      ? "Set the opening bid"
      : `${currentPlayer?.name ?? "The first bidder"} is choosing`
    : `${highBidder?.name ?? "The bidder"} leads`;

  return (
    <Card className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-1rem)] sm:w-[min(720px,calc(100%-2rem))] z-40 gap-0 py-0 bg-[#081f18]/94 backdrop-blur-md border-white/12 shadow-[0_12px_36px_rgba(0,0,0,0.58),0_0_18px_rgba(229,197,122,0.08)] rounded-xl animate-in fade-in-0 slide-in-from-bottom-2" size="sm">
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

export function GroundPanel({ actionError, onRemoveCard, onSubmit, selectedCards }: {
  actionError: string;
  onRemoveCard: (cardId: string) => void;
  onSubmit: () => void;
  selectedCards: GameCard[];
}) {
  return (
    <Card className="absolute bottom-2 left-2 right-2 sm:bottom-auto sm:left-auto sm:right-4 sm:top-20 max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-6rem)] sm:w-[min(360px,calc(100%-2rem))] overflow-y-auto z-40 bg-[#081f18]/95 backdrop-blur-md border-primary/35 shadow-[0_16px_48px_rgba(0,0,0,0.7)] rounded-xl animate-in fade-in-0 slide-in-from-right-2">
      <CardHeader className="hidden sm:grid">
        <CardTitle className="font-heading text-lg font-bold text-foreground">Prepare the hand</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">Select four cards to discard. Your opening lead establishes trump.</CardDescription>
      </CardHeader>
      <CardContent className={cn("sm:block", actionError ? "block" : "hidden")}>
        {selectedCards.length > 0 && (
          <div className="hidden flex-wrap gap-2.5 py-2 sm:flex" aria-label="Selected discards">
            {selectedCards.map((card) => (
              <button
                aria-label={`Remove ${card.rank} of ${card.suit} from discards`}
                className="relative aspect-[5/7] w-14 overflow-hidden rounded-md border border-primary/40 shadow-md transition-all hover:scale-105 hover:border-destructive group"
                key={card.id}
                onClick={() => onRemoveCard(card.id)}
                type="button"
              >
                <CardFace card={card} className="w-full h-full object-cover" />
                <span className="absolute top-0.5 right-0.5 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-sm" aria-hidden="true">×</span>
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

export function ResultPanel({ actionError, onToggleReady, room }: {
  actionError: string;
  onToggleReady: () => void;
  room: Room;
}) {
  const result = room.match?.result;
  if (!result) return null;

  const readyPlayerIds = room.match?.nextHandReadyPlayerIds ?? [];
  const isReady = readyPlayerIds.includes(gameClient.playerId);
  const viewerTeam = getViewerTeam(room);
  const displayedTeams: Team[] = viewerTeam ? [viewerTeam, otherTeam(viewerTeam)] : ["one", "two"];
  const outcome = result.shelem
    ? `${teamLabel(result.biddingTeam, viewerTeam)} won Shelem`
    : result.madeBid
      ? `${teamLabel(result.biddingTeam, viewerTeam)} made the ${result.bid} bid`
      : `${teamLabel(result.biddingTeam, viewerTeam)} missed the ${result.bid} bid`;

  return (
    <Card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(880px,calc(100%-2rem))] max-h-[85vh] overflow-y-auto z-50 bg-[#081f18]/95 backdrop-blur-md border-primary/40 shadow-[0_24px_64px_rgba(0,0,0,0.8),0_0_32px_rgba(229,197,122,0.18)] rounded-xl animate-in fade-in-0 zoom-in-95">
      <CardHeader>
        <CardDescription className="text-xs font-semibold uppercase tracking-wider text-primary/80">Hand {room.match?.handNumber} result</CardDescription>
        <CardTitle className="font-heading text-2xl font-bold text-foreground">{outcome}</CardTitle>
        {room.matchWinnerTeam && (
          <Badge className="w-fit bg-primary text-primary-foreground font-bold shadow-md">
            {teamLabel(room.matchWinnerTeam, viewerTeam)} wins the match
          </Badge>
        )}
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {displayedTeams.map((team) => (
          <article
            className={cn(
              "flex flex-col gap-2 rounded-lg border border-white/10 bg-black/25 p-3.5",
              result.biddingTeam === team && "border-primary/50 bg-primary/5",
            )}
            key={team}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-foreground">{teamLabel(team, viewerTeam)}</span>
              {result.biddingTeam === team && (
                <Badge variant="outline" className="border-primary/50 text-primary font-semibold text-[10px]">
                  Bidding team
                </Badge>
              )}
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center mt-1">
              <div className="rounded-md border border-white/8 bg-white/5 p-2">
                <dt className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Hand</dt>
                <dd className="font-heading text-base font-bold tabular-nums text-foreground">{result.rawPoints[team]}</dd>
              </div>
              <div className="rounded-md border border-white/8 bg-white/5 p-2">
                <dt className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Change</dt>
                <dd className="font-heading text-base font-bold tabular-nums text-primary">{formatScoreDelta(result.scoreDelta[team])}</dd>
              </div>
              <div className="rounded-md border border-white/8 bg-white/5 p-2">
                <dt className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Match</dt>
                <dd className="font-heading text-base font-bold tabular-nums text-foreground">{result.matchScore[team]}</dd>
              </div>
            </dl>
          </article>
        ))}
        {actionError && (
          <Alert className="col-span-full" variant="destructive">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      {!room.matchWinnerTeam && (
        <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
          <span className="text-xs font-medium text-muted-foreground">{readyPlayerIds.length} of 4 ready for next hand</span>
          <Button
            onClick={onToggleReady}
            type="button"
            variant={isReady ? "secondary" : "default"}
            className={cn(
              "rounded-lg font-bold transition-all",
              !isReady && "bg-gradient-to-r from-[#f3dfa7] via-primary to-[#d8b35e] text-primary-foreground shadow-[0_2px_14px_rgba(229,197,122,0.25)]",
            )}
          >
            {isReady ? "Ready for next hand ✓" : "Ready for next hand"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

export function ForfeitPanel({ room }: { room: Room }) {
  const forfeit = room.match?.forfeit;
  if (!forfeit) return null;
  const viewerTeam = getViewerTeam(room);

  return (
    <Card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(680px,calc(100%-2rem))] z-50 bg-[#081f18]/95 backdrop-blur-md border-primary/40 shadow-[0_24px_64px_rgba(0,0,0,0.8)] rounded-xl animate-in fade-in-0 zoom-in-95">
      <CardHeader>
        <CardDescription className="text-xs font-semibold uppercase tracking-wider text-primary/80">Match result</CardDescription>
        <CardTitle className="font-heading text-2xl font-bold text-foreground">{teamLabel(forfeit.winningTeam, viewerTeam)} wins by forfeit</CardTitle>
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
        Final score: {teamLabel("one", viewerTeam)} {room.score.one} · {teamLabel("two", viewerTeam)} {room.score.two}
      </CardFooter>
    </Card>
  );
}
