import {
  SeatVideoTarget,
  type SeatVideoTargetRef,
} from "@/components/SeatVideoTarget";
import type { Position } from "@/domain/types";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";
import type { RelativePosition, TableViewModel } from "../model/tableTypes";

export function SeatVideoLayer({
  hideSouthSeat,
  model,
  onSeatElement,
  onSeatSelect,
  onSeatVideoTarget,
}: {
  hideSouthSeat: boolean;
  model: TableViewModel;
  onSeatElement: (
    position: RelativePosition,
    element: HTMLDivElement | null,
  ) => void;
  onSeatSelect?: (position: Position) => void;
  onSeatVideoTarget: SeatVideoTargetRef;
}) {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {model.seats.map((seat) => {
        if (hideSouthSeat && seat.displayPosition === "south") return null;
        const player = seat.player;
        const style = { "--seat-size": "76px" } as CSSProperties;
        const frame = player ? (
          <div
            aria-current={seat.turnLabel ? "true" : undefined}
            aria-label={`${player.name}, ${seat.displayPosition} seat${seat.turnLabel ? `, ${seat.turnLabel}` : ""}`}
            className={cn(
              "relative grid size-[var(--seat-size)] place-items-center rounded-full bg-gradient-to-br from-[#0a231b] to-[#04100c] font-heading font-bold shadow-[0_8px_24px_rgba(0,0,0,0.6)] pointer-events-auto transition-all",
              seat.team === "two" ? "text-emerald-300" : "text-primary",
              seat.turnLabel &&
                "ring-3 ring-primary/80 shadow-[0_0_24px_rgba(229,197,122,0.55)]",
            )}
          >
            <span className="text-xl" aria-hidden="true">
              {player.name.slice(0, 1).toUpperCase()}
            </span>
            <SeatVideoTarget
              playerId={player.id}
              onTarget={onSeatVideoTarget}
            />
            {seat.ready && (
              <span className="absolute right-0 bottom-0 z-20 grid size-5 place-items-center rounded-full border-2 border-[#081611] bg-emerald-500 text-[10px] font-bold text-emerald-950 shadow-md">
                ✓
              </span>
            )}
            {seat.turnLabel && (
              <span
                aria-hidden="true"
                className="absolute -right-1 top-1 z-30 size-3.5 rounded-full border-2 border-[#081611] bg-primary shadow-[0_0_14px_rgba(229,197,122,1)] motion-safe:animate-pulse"
              />
            )}
          </div>
        ) : onSeatSelect ? (
          <button
            aria-label={`Move to the ${seat.sourcePosition} seat`}
            className="relative grid size-[var(--seat-size)] place-items-center rounded-full border-2 border-dashed border-white/25 bg-black/25 font-heading text-xl font-bold text-muted-foreground shadow-sm transition-all hover:scale-105 hover:border-primary hover:text-primary hover:bg-black/40 hover:shadow-[0_0_16px_rgba(229,197,122,0.3)] pointer-events-auto active:scale-95"
            onClick={() => onSeatSelect(seat.sourcePosition)}
            type="button"
          >
            <span aria-hidden="true">+</span>
          </button>
        ) : (
          <div className="relative grid size-[var(--seat-size)] place-items-center rounded-full border border-border/50 bg-white/5 font-heading text-lg font-bold text-muted-foreground/60">
            <span aria-hidden="true">·</span>
          </div>
        );

        return (
          <div
            className={cn(
              "absolute top-0 left-0 grid justify-items-center text-center opacity-0 will-change-transform pointer-events-none",
              seat.turnLabel && "drop-shadow-[0_0_12px_rgba(229,197,122,0.6)]",
            )}
            data-seat-position={seat.displayPosition}
            key={seat.sourcePosition}
            ref={(element) => onSeatElement(seat.displayPosition, element)}
            style={style}
          >
            {frame}
            <strong className="mt-1.5 max-w-[120px] truncate font-heading text-xs font-bold text-[#f3f0e8] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
              {player?.name ?? "Open seat"}
            </strong>
            {(!player || !player.connected || model.phase === "lobby") && (
              <small className="text-[10px] font-medium text-muted-foreground/90">
                {player
                  ? !player.connected
                    ? "Reconnecting…"
                    : seat.ready
                      ? "Ready"
                      : "At table"
                  : "Available"}
              </small>
            )}
            {seat.bidWinner && model.phase !== "playing" && (
              <span className="absolute -top-2 -right-2 z-30 flex items-center gap-1 rounded-full border border-primary/60 bg-[#091f18] px-2.5 py-0.5 text-[9px] font-bold text-primary shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                <span aria-hidden="true">♛</span>
                <span>Bid {seat.bidAmount ?? "won"}</span>
              </span>
            )}
            {seat.trickWins > 0 && (
              <span
                aria-label={`${seat.trickWins} tricks won`}
                className="absolute top-1/2 -left-3 grid size-5.5 -translate-y-1/2 place-items-center rounded-full border-2 border-[#081611] bg-gradient-to-br from-primary to-[#c9a650] text-[10px] font-black text-primary-foreground shadow-md"
              >
                {seat.trickWins}
              </span>
            )}
            {model.dealerPosition === seat.displayPosition && (
              <span className="absolute -top-2 -left-2 z-30 grid size-5.5 place-items-center rounded-full border-2 border-[#081611] bg-gradient-to-br from-amber-400 to-amber-600 text-[10px] font-black text-amber-950 shadow-md">
                D
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
