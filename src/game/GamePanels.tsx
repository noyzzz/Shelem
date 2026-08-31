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
  const winner = room.players.find((player) => player.id === bidding.winnerId);
  const isYourTurn = room.match?.phase === "bidding" && bidding.currentTurnPlayerId === gameClient.playerId;
  const isOpeningBid = bidding.currentBid === null;
  const minimumBid = bidding.currentBid === null ? 100 : bidding.currentBid + 5;
  const bidOptions = Array.from(
    { length: Math.max(0, Math.floor((165 - minimumBid) / 5) + 1) },
    (_, index) => minimumBid + index * 5,
  );
  const bidItems = bidOptions.map((amount) => ({ label: String(amount), value: String(amount) }));
  const description = room.match?.phase !== "bidding"
    ? `${winner?.name ?? "The bidder"} won the auction.`
    : isOpeningBid
      ? isYourTurn
        ? "Choose any opening bid from 100 to 165."
        : `Waiting for ${currentPlayer?.name ?? "the first bidder"} to open.`
      : `${highBidder?.name ?? "The bidder"} leads. ${
          isYourTurn ? "It’s your turn." : `Waiting for ${currentPlayer?.name ?? "the next player"}.`
        }`;

  return (
    <Card className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(860px,calc(100%-2rem))] z-40 bg-[#081f18]/95 backdrop-blur-md border-primary/35 shadow-[0_16px_48px_rgba(0,0,0,0.7),0_0_24px_rgba(229,197,122,0.12)] rounded-xl animate-in fade-in-0 slide-in-from-bottom-2" size="sm">
      <CardHeader>
        <CardDescription className="text-xs font-semibold text-primary/80 uppercase tracking-wider">{isOpeningBid ? "Opening auction" : "Current highest bid"}</CardDescription>
        <CardTitle className="font-heading text-2xl font-bold text-foreground">{isOpeningBid ? "100 minimum" : `${bidding.currentBid} pts`}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium text-muted-foreground">{description}</p>
        {actionError && room.match?.phase === "bidding" && (
          <Alert className="mt-2.5" variant="destructive">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      {isYourTurn && (
        <CardFooter className="flex flex-wrap items-end gap-3 pt-1">
          {bidOptions.length > 0 && (
            <>
              <Field className="w-36">
                <FieldLabel className="text-xs font-semibold text-foreground/80">Your bid</FieldLabel>
                <Select
                  items={bidItems}
                  onValueChange={(value) => {
                    if (value) setBidAmount(Number(value));
                  }}
                  value={String(bidAmount)}
                >
                  <SelectTrigger className="rounded-lg border-white/15 bg-black/25">
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
                className="rounded-lg font-bold bg-gradient-to-r from-[#f3dfa7] via-primary to-[#d8b35e] text-primary-foreground shadow-[0_2px_14px_rgba(229,197,122,0.25)] hover:brightness-105"
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
              className="rounded-lg border-white/15 bg-black/20 text-foreground/90 font-semibold hover:bg-white/10"
            >
              Pass
            </Button>
          )}
        </CardFooter>
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
    <Card className="absolute top-20 right-4 max-h-[calc(100dvh-6rem)] w-[min(360px,calc(100%-2rem))] overflow-y-auto z-40 bg-[#081f18]/95 backdrop-blur-md border-primary/35 shadow-[0_16px_48px_rgba(0,0,0,0.7)] rounded-xl animate-in fade-in-0 slide-in-from-right-2">
      <CardHeader>
        <CardTitle className="font-heading text-lg font-bold text-foreground">Prepare the hand</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">Select four cards to discard. Your opening lead establishes trump.</CardDescription>
      </CardHeader>
      <CardContent>
        {selectedCards.length > 0 && (
          <div className="flex flex-wrap gap-2.5 py-2" aria-label="Selected discards">
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
