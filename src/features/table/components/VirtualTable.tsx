import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { useMemo, useRef } from "react";
import { applySeatProjection } from "../hooks/seatProjection";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useTableScene } from "../hooks/useTableScene";
import type { RelativePosition } from "../model/tableTypes";
import { MobileHand } from "./MobileHand";
import { SeatVideoLayer } from "./SeatVideoLayer";
import { TableAccessibility } from "./TableAccessibility";
import type { TableProps } from "./tableProps";

export function VirtualTable({
  model,
  detail,
  status,
  interactionBlocked,
  onCardAction,
  onSeatSelect,
  onSeatVideoTarget,
  onRendererUnavailable,
}: TableProps & { onRendererUnavailable: () => void }) {
  const seatElements = useRef<
    Partial<Record<RelativePosition, HTMLDivElement>>
  >({});
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const isMobileViewport = useMediaQuery("(max-width: 639px)");
  const dockSouthSeat = model.phase !== "lobby" && model.viewerTeam !== undefined;
  const sceneModel = useMemo(
    () => (isMobileViewport ? { ...model, hand: [] } : model),
    [isMobileViewport, model],
  );
  const { hostRef, canvasRef, sceneRef } = useTableScene({
    model: sceneModel,
    reducedMotion,
    interactionBlocked,
    onCardAction,
    onRendererUnavailable,
    onSeatProjection: (position, projection) =>
      applySeatProjection(seatElements.current[position], projection, {
        clearHand: position === "south",
        dockToBottom: dockSouthSeat && position === "south",
        stackByDepth: true,
      }),
  });

  return (
    <section
      aria-label="Three-dimensional card table"
      className="relative h-full w-full overflow-clip select-none"
    >
      <div
        className="relative h-full w-full overflow-clip bg-background"
        ref={hostRef}
      >
        <canvas
          aria-label="Interactive 3D table. Drag to rotate. Pinch or scroll to zoom."
          className="absolute inset-0 block h-full w-full cursor-grab active:cursor-grabbing touch-none"
          ref={canvasRef}
        />
        <SeatVideoLayer
          dockSouthSeat={dockSouthSeat}
          hideSouthSeat={isMobileViewport && model.hand.length > 0}
          model={model}
          onSeatElement={(position, element) => {
            if (element) seatElements.current[position] = element;
            else delete seatElements.current[position];
          }}
          onSeatSelect={model.phase === "lobby" ? onSeatSelect : undefined}
          onSeatVideoTarget={onSeatVideoTarget}
        />
        {isMobileViewport && model.hand.length > 0 && (
          <MobileHand
            cards={model.hand}
            interactionBlocked={interactionBlocked}
            onCardAction={onCardAction}
            phase={model.phase}
          />
        )}
        <ButtonGroup
          className="absolute right-3.5 bottom-3.5 z-30 shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur-md rounded-lg border border-white/10 bg-[#081b15]/90 p-0.5"
          aria-label="Table camera controls"
        >
          <Button
            aria-label="Rotate camera left"
            onClick={() => sceneRef.current?.rotateCamera(-1)}
            size="icon-sm"
            type="button"
            variant="ghost"
            className="hover:bg-white/10 text-foreground/90 hover:text-foreground"
          >
            ↶
          </Button>
          <Button
            onClick={() => sceneRef.current?.resetCamera()}
            size="sm"
            type="button"
            variant="ghost"
            className="text-xs font-semibold hover:bg-white/10 text-foreground/90 hover:text-foreground"
          >
            My seat
          </Button>
          <Button
            aria-label="Rotate camera right"
            onClick={() => sceneRef.current?.rotateCamera(1)}
            size="icon-sm"
            type="button"
            variant="ghost"
            className="hover:bg-white/10 text-foreground/90 hover:text-foreground"
          >
            ↷
          </Button>
        </ButtonGroup>
        <span className="hidden sm:block absolute bottom-4 left-4 z-20 text-[11px] font-medium tracking-wide text-muted-foreground/70 pointer-events-none">
          Drag to rotate · Pinch or scroll to zoom
        </span>
      </div>
      <TableAccessibility
        cards={model.hand}
        interactionBlocked={interactionBlocked}
        onCardAction={onCardAction}
        status={`${status}. ${detail}`}
      />
    </section>
  );
}
