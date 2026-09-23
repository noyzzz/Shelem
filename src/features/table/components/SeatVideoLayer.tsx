import {
  SeatVideoTarget,
  type SeatVideoTargetRef,
} from "@/components/SeatVideoTarget";
import type { Position } from "@/domain/types";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";
import type { RelativePosition, TableViewModel } from "../model/tableTypes";

export function SeatVideoLayer({
  dockSouthSeat,
  hideSouthSeat,
  model,
  onSeatElement,
  onSeatSelect,
  onSeatVideoTarget,
}: {
  dockSouthSeat: boolean;
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
        const docked = dockSouthSeat && seat.displayPosition === "south";
        const style = {
          "--seat-size": docked ? "clamp(40px, 7dvh, 52px)" : "76px",
        } as CSSProperties;
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
            className="relative grid size-[var(--seat-size)] place-items-center rounded-full border-2 border-dashed border-primary/80 bg-[#0a2119]/95 font-sans text-3xl font-semibold text-primary shadow-md transition-all hover:scale-105 hover:border-primary hover:bg-[#173b2d] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-primary pointer-events-auto active:scale-95"
            onClick={() => onSeatSelect(seat.sourcePosition)}
            type="button"
          >
            <span aria-hidden="true">+</span>
          </button>
        ) : (
          <div className="relative grid size-[var(--seat-size)] place-items-center rounded-full border border-primary/60 bg-[#0a2119]/95 font-sans text-lg font-bold text-primary">
            <span aria-hidden="true">·</span>
          </div>
        );

        return (
          <div
            className={cn(
              "absolute grid justify-items-center text-center opacity-0 pointer-events-none",
              docked
                ? "left-1/2 bottom-4"
                : "top-0 left-0 will-change-transform",
              docked && model.phase === "bidding" && "bottom-20",
              seat.turnLabel && "drop-shadow-[0_0_12px_rgba(229,197,122,0.6)]",
            )}
            data-seat-position={seat.displayPosition}
            key={seat.sourcePosition}
            ref={(element) => onSeatElement(seat.displayPosition, element)}
            style={style}
          >
            {frame}
            <div className="mt-1.5 grid origin-top justify-items-center rounded-md border border-[#dac699]/60 bg-[#0a2119]/95 px-2.5 py-1 shadow-[0_2px_8px_rgba(0,0,0,0.35)] scale-[var(--seat-label-scale,1)]">
              <strong className="max-w-[150px] truncate font-sans text-sm font-semibold leading-tight text-[#fff7e8] sm:text-base">
                {player?.name ?? "Open seat"}
              </strong>
              {(!player || !player.connected || model.phase === "lobby") && (
                <small className="font-sans text-xs font-semibold leading-5 text-[#e5d5b1]">
                  {player
                    ? !player.connected
                      ? "Reconnecting…"
                      : seat.ready
                        ? "Ready"
                        : "At table"
                    : "Available"}
                </small>
              )}
            </div>
            {seat.bidWinner && model.phase !== "playing" && (
              <span className={cn(
                "absolute z-30 flex w-max items-center gap-1 whitespace-nowrap rounded-full border border-primary/60 bg-[#091f18] px-2.5 py-0.5 text-[9px] font-bold text-primary shadow-[0_2px_8px_rgba(0,0,0,0.6)]",
                docked ? "left-full top-1 ml-2" : "-top-2 -right-2",
              )}>
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
