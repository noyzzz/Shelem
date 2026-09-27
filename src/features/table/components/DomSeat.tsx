import {
  SeatVideoTarget,
  type SeatVideoTargetRef,
} from "@/components/SeatVideoTarget";
import { suitLabel, suitSymbol } from "@/domain/cards";
import type { Card, Player, Position } from "@/domain/types";
import { cn } from "@/lib/utils";
import { UsersIcon } from "lucide-react";
import type {
  BiddingStatus,
  SeatReadiness,
  TurnContext,
} from "../model/seatStatus";

export function DomSeat({
  bidAmount,
  bidWinner,
  biddingStatus,
  displayPosition,
  onSelect,
  position,
  team,
  player,
  readiness,
  trickWins,
  trump,
  turn,
  onSeatVideoTarget,
}: {
  bidAmount?: number | null;
  bidWinner?: boolean;
  biddingStatus?: BiddingStatus;
  displayPosition: Position;
  onSelect?: (position: Position) => void;
  position: Position;
  team: "one" | "two";
  player?: Player;
  readiness?: SeatReadiness;
  trickWins?: number;
  trump?: Card["suit"] | null;
  turn?: TurnContext;
  onSeatVideoTarget: SeatVideoTargetRef;
}) {
  const bidWinnerDescription = player
    ? trump
      ? `${player.name} won the bid. ${suitLabel(trump)} is trump.`
      : `${player.name} won the bid${bidAmount ? ` with ${bidAmount}` : ""}.`
    : "";

  const seatPositionStyles: Record<Position, string> = {
    north: "top-0 left-1/2 -translate-x-1/2",
    south: "bottom-0 left-1/2 -translate-x-1/2",
    west: "top-1/2 left-3 -translate-y-1/2",
    east: "top-1/2 right-3 -translate-y-1/2",
  };

  return (
    <div
      className={cn(
        "absolute grid min-w-28 justify-items-center text-center z-20",
        seatPositionStyles[displayPosition],
      )}
    >
      {player || !onSelect ? (
        <div
          className={cn(
            "relative mb-1.5 grid size-14 place-items-center rounded-full bg-card font-heading text-lg font-bold text-foreground shadow-md",
            team === "two" ? "text-emerald-400" : "text-primary",
            bidWinner && "ring-2 ring-primary",
            turn &&
              "ring-3 ring-primary/80 shadow-[0_0_26px_rgba(229,197,122,0.6)]",
          )}
          aria-current={turn ? "true" : undefined}
          aria-label={
            turn && player ? `${player.name}, ${turn.seatLabel}` : undefined
          }
        >
          {player ? player.name.slice(0, 1).toUpperCase() : <UsersIcon />}
          {player && (
            <SeatVideoTarget
              playerId={player.id}
              onTarget={onSeatVideoTarget}
            />
          )}
          {readiness?.ready && (
            <span className="absolute right-0 bottom-0 z-20 grid size-4.5 place-items-center rounded-full border border-background bg-emerald-500 text-[10px] font-bold text-emerald-950">
              ✓
            </span>
          )}
          {player && bidWinner && (
            <span
              aria-label={bidWinnerDescription}
              className={cn(
                "absolute -top-2 -right-3 z-30 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-primary-foreground shadow-sm",
                (trump === "diamonds" || trump === "hearts") &&
                  "text-destructive",
              )}
              role="status"
            >
              <span aria-hidden="true">{trump ? suitSymbol(trump) : "♛"}</span>
              <small>
                {trump ? `Trump ${suitLabel(trump)}` : `Bid ${bidAmount ?? ""}`}
              </small>
            </span>
          )}
          {player && turn && (
            <span
              aria-hidden="true"
              className="absolute -right-1 top-1 z-30 size-3 rounded-full border-2 border-[#081611] bg-primary shadow-[0_0_12px_rgba(229,197,122,1)] motion-safe:animate-pulse"
            />
          )}
          {player && Boolean(trickWins) && (
            <span
              aria-label={`${player.name} has won ${trickWins} ${
                trickWins === 1 ? "trick" : "tricks"
              }`}
              className="absolute top-1/2 -left-3 grid size-5 -translate-y-1/2 place-items-center rounded-full border border-background bg-primary text-[9px] font-bold text-primary-foreground shadow-sm"
              role="status"
            >
              <span aria-hidden="true">{trickWins}</span>
            </span>
          )}
        </div>
      ) : (
        <button
          aria-label={`Move to the ${displayPosition} seat`}
          className="relative mb-1.5 grid size-14 place-items-center rounded-full border border-dashed border-border bg-card/40 font-heading text-lg font-bold text-muted-foreground shadow-sm transition-transform hover:scale-105 hover:border-primary hover:text-primary active:scale-95"
          onClick={() => onSelect(position)}
          type="button"
        >
          <UsersIcon />
        </button>
      )}
      <strong className="max-w-[110px] truncate text-xs font-semibold text-foreground">
        {player?.name || "Open seat"}
      </strong>
      {biddingStatus && (
        <span
          className={cn(
            "mt-0.5 rounded-full px-2 py-0.5 text-[9px] font-semibold text-foreground bg-muted",
            biddingStatus.passed && "opacity-60",
          )}
        >
          {biddingStatus.label}
        </span>
      )}
      <small className="mt-0.5 text-[10px] text-muted-foreground">
        {player
          ? !player.connected
            ? "Reconnecting…"
            : readiness
              ? readiness.label
              : player.isBot
                ? "Bot player"
                : "In game"
          : onSelect
            ? "Choose this seat"
            : "Waiting…"}
      </small>
    </div>
  );
}
