import { useRef, useState } from "react";
import { applySeatProjection } from "../hooks/seatProjection";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useTableScene } from "../hooks/useTableScene";
import type { RelativePosition, TableViewModel } from "../model/tableTypes";

const menuModel: TableViewModel = {
  groundCards: [],
  groundCount: 0,
  hand: [],
  phase: "lobby",
  seats: (["north", "east", "south", "west"] as RelativePosition[]).map(
    (position) => ({
      bidAmount: null,
      bidWinner: false,
      displayPosition: position,
      handCount: 0,
      ready: false,
      sourcePosition: position,
      team: position === "north" || position === "south" ? "one" : "two",
      trickWins: 0,
    }),
  ),
  trick: [],
  trump: null,
};

export function MenuTableScene({ playerName }: { playerName: string }) {
  const seatElements = useRef<
    Partial<Record<RelativePosition, HTMLDivElement>>
  >({});
  const [rendererUnavailable, setRendererUnavailable] = useState(false);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { hostRef, canvasRef } = useTableScene({
    model: menuModel,
    reducedMotion,
    interactionBlocked: true,
    transparentBackground: true,
    seatProjectionHeight: 0.405,
    resetCameraOnResize: true,
    onRendererUnavailable: () => setRendererUnavailable(true),
    onSeatProjection: (position, projection) =>
      applySeatProjection(seatElements.current[position], projection),
  });

  return (
    <div
      aria-hidden="true"
      className="menu-table-scene absolute inset-0 overflow-hidden"
    >
      <div className="menu-table-stage absolute inset-0" ref={hostRef}>
        <canvas className="absolute inset-0 block size-full" ref={canvasRef} />
        {rendererUnavailable && <div className="menu-table-fallback" />}
        {menuModel.seats.map((seat) => (
          <div
            className="menu-seat-marker absolute top-0 left-0 hidden size-14 md:block md:opacity-0 pointer-events-none"
            key={seat.displayPosition}
            ref={(element) => {
              if (element) seatElements.current[seat.displayPosition] = element;
              else delete seatElements.current[seat.displayPosition];
            }}
          >
            <span className="absolute inset-0 grid place-items-center rounded-full border-2 border-primary/75 bg-[#0a1f18]/95 font-heading text-sm font-bold text-primary shadow-[0_4px_18px_rgba(0,0,0,0.65),0_0_14px_rgba(229,197,122,0.3)] backdrop-blur-md">
              {seat.displayPosition === "south"
                ? playerName.slice(0, 1).toUpperCase()
                : "+"}
            </span>
            <strong className="absolute top-full left-1/2 mt-1.5 max-w-28 -translate-x-1/2 truncate text-center text-[10px] font-bold tracking-[0.16em] text-[#f3f0e8] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] uppercase">
              {seat.displayPosition === "south" ? playerName : "Open seat"}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}
