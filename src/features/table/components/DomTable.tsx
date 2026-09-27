import { CardBack } from "@/components/PlayingCard";
import { DomHand } from "./DomHand";
import { DomSeat } from "./DomSeat";
import { GroundRevealPanel } from "./GroundRevealPanel";
import type { TableProps } from "./tableProps";
import { TableTrick } from "./TableTrick";

export function DomTable({
  model,
  status,
  detail,
  onCardAction,
  onSeatSelect,
  interactionBlocked,
  onSeatVideoTarget,
}: TableProps) {
  return (
    <>
      <div className="relative mx-auto mt-20 h-[480px] w-[min(820px,100%)]">
        {model.seats.map((seat) => (
          <DomSeat
            key={seat.sourcePosition}
            position={seat.sourcePosition}
            displayPosition={seat.displayPosition}
            player={seat.player}
            team={seat.team}
            readiness={seat.readiness}
            biddingStatus={seat.biddingStatus}
            bidWinner={seat.bidWinner}
            bidAmount={seat.bidAmount}
            trump={model.trump}
            trickWins={seat.trickWins}
            turn={seat.turn}
            onSelect={
              !seat.player && model.phase === "lobby" ? onSeatSelect : undefined
            }
            onSeatVideoTarget={onSeatVideoTarget}
          />
        ))}
        <div className="absolute top-[22.5%] left-[20%] flex h-[55%] w-[60%] flex-col items-center justify-center rounded-[40%] border border-primary/20 bg-emerald-950/80 shadow-2xl backdrop-blur-sm">
          {model.phase === "playing" ? (
            <TableTrick model={model} />
          ) : (
            <div
              className="mb-3 flex h-14 w-10 items-center justify-center gap-0.5"
              aria-hidden="true"
            >
              <CardBack className="h-full w-full" />
            </div>
          )}
          <div className="relative z-10 grid justify-items-center text-center">
            <strong className="font-heading text-sm font-semibold text-foreground">
              {status}
            </strong>
            <small className="mt-1 text-xs text-muted-foreground">
              {detail}
            </small>
          </div>
        </div>
      </div>
      {model.phase === "ground-reveal" && model.groundCards.length > 0 && (
        <GroundRevealPanel cards={model.groundCards} />
      )}
      {model.phase !== "lobby" &&
        model.phase !== "hand-results" &&
        model.phase !== "match-complete" && (
          <DomHand
            cards={model.hand}
            phase={model.phase}
            interactionBlocked={interactionBlocked}
            onCardAction={onCardAction}
          />
        )}
    </>
  );
}
