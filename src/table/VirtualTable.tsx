import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import type { Card, Position, Room } from "../gameClient";
import { buildTableViewModel } from "./buildTableViewModel";
import { TableSceneEngine } from "./TableSceneEngine";
import type {
  RelativePosition,
  SeatProjection,
  TableViewModel,
} from "./tableTypes";
import { cn } from "@/lib/utils";

type VirtualTableProps = {
  detail: string;
  enabledIds: string[];
  interactionBlocked?: boolean;
  onCardAction?: (cardId: string) => void;
  onRendererUnavailable: () => void;
  onSeatSelect?: (position: Position) => void;
  room: Room;
  selectable: boolean;
  selectedIds: string[];
  status: string;
  viewerPosition?: Position;
};

export function VirtualTable({
  detail,
  enabledIds,
  interactionBlocked = false,
  onCardAction,
  onRendererUnavailable,
  onSeatSelect,
  room,
  selectable,
  selectedIds,
  status,
  viewerPosition,
}: VirtualTableProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<TableSceneEngine | null>(null);
  const cardActionRef = useRef(onCardAction);
  const rendererUnavailableRef = useRef(onRendererUnavailable);
  const seatElements = useRef<
    Partial<Record<RelativePosition, HTMLDivElement>>
  >({});
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  const model = useMemo(
    () =>
      buildTableViewModel({
        enabledIds,
        room,
        selectable,
        selectedIds,
        viewerPosition,
      }),
    [enabledIds, room, selectable, selectedIds, viewerPosition],
  );

  cardActionRef.current = onCardAction;
  rendererUnavailableRef.current = onRendererUnavailable;

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    let scene: TableSceneEngine;
    try {
      scene = new TableSceneEngine({
        canvas,
        onCardAction: (cardId) => cardActionRef.current?.(cardId),
        onRendererError: () => rendererUnavailableRef.current(),
        onSeatProjection: (position, projection) => {
          applySeatProjection(seatElements.current[position], projection);
        },
      });
      sceneRef.current = scene;
      const initialBounds = host.getBoundingClientRect();
      scene.resize(initialBounds.width, initialBounds.height);
      scene.resetCamera();
      scene.update({ model, reducedMotion });
    } catch {
      rendererUnavailableRef.current();
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      scene.resize(width, height);
    });
    observer.observe(host);

    return () => {
      observer.disconnect();
      sceneRef.current = null;
      scene.destroy();
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.update({ model, reducedMotion });
  }, [model, reducedMotion]);

  useEffect(() => {
    sceneRef.current?.setInteractionEnabled(!interactionBlocked);
  }, [interactionBlocked]);

  return (
    <section
      aria-label="Three-dimensional card table"
      className="relative h-full w-full overflow-hidden select-none"
    >
      <div className="relative h-full w-full overflow-hidden bg-background" ref={hostRef}>
        <canvas
          aria-label="Interactive 3D table. Drag to rotate. Pinch or scroll to zoom."
          className="absolute inset-0 block h-full w-full cursor-grab active:cursor-grabbing touch-none"
          ref={canvasRef}
        />
        <SeatVideoLayer
          model={model}
          onSeatElement={(position, element) => {
            if (element) seatElements.current[position] = element;
            else delete seatElements.current[position];
          }}
          onSeatSelect={room.match ? undefined : onSeatSelect}
        />
        <div
          className={cn(
            "absolute top-[48%] left-1/2 z-20 grid max-w-xs -translate-x-1/2 -translate-y-1/2 justify-items-center gap-0.5 rounded-xl border border-border/60 bg-card/80 px-3.5 py-1.5 text-center shadow-md backdrop-blur-md pointer-events-none",
            model.trick.length > 0 && "top-[52%]",
          )}
        >
          <strong className="font-heading text-xs sm:text-sm font-semibold text-foreground">{status}</strong>
          <small className="text-[10px] sm:text-xs text-muted-foreground">{detail}</small>
        </div>
        {model.trump && (
          <div
            className={cn(
              "absolute top-16 right-4 sm:top-18 sm:right-6 z-20 grid size-10 sm:size-12 place-items-center rounded-full border border-primary/30 bg-primary text-primary-foreground shadow-lg pointer-events-none",
              (model.trump === "diamonds" || model.trump === "hearts") && "text-destructive",
            )}
          >
            <span className="font-serif text-xl sm:text-2xl leading-none">{suitSymbol(model.trump)}</span>
            <small className="text-[8px] font-bold tracking-tight">Trump</small>
          </div>
        )}
        <ButtonGroup className="absolute right-3.5 bottom-3.5 z-30 shadow-md backdrop-blur-md" aria-label="Table camera controls">
          <Button
            aria-label="Rotate camera left"
            onClick={() => sceneRef.current?.rotateCamera(-1)}
            size="icon-sm"
            type="button"
            variant="secondary"
          >
            ↶
          </Button>
          <Button
            onClick={() => sceneRef.current?.resetCamera()}
            size="sm"
            type="button"
            variant="secondary"
          >
            My seat
          </Button>
          <Button
            aria-label="Rotate camera right"
            onClick={() => sceneRef.current?.rotateCamera(1)}
            size="icon-sm"
            type="button"
            variant="secondary"
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

function SeatVideoLayer({
  model,
  onSeatElement,
  onSeatSelect,
}: {
  model: TableViewModel;
  onSeatElement: (
    position: RelativePosition,
    element: HTMLDivElement | null,
  ) => void;
  onSeatSelect?: (position: Position) => void;
}) {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {model.seats.map((seat) => {
        const player = seat.player;
        const style = { "--seat-size": "76px" } as CSSProperties;
        const frame = player ? (
          <div
            aria-label={`${player.name}, ${seat.displayPosition} seat`}
            className={cn(
              "relative grid size-[var(--seat-size)] place-items-center rounded-full border bg-gradient-to-br from-emerald-950 to-card font-heading font-bold text-primary shadow-lg pointer-events-auto",
              seat.team === "two" ? "border-emerald-500/40 text-emerald-400" : "border-primary/40",
            )}
          >
            <span className="text-xl" aria-hidden="true">
              {player.name.slice(0, 1).toUpperCase()}
            </span>
            <span
              className="absolute inset-0.5 block overflow-hidden rounded-full"
              id={`seat-camera-${player.id}`}
            />
            {seat.ready && (
              <span className="absolute right-0 bottom-0 z-20 grid size-4.5 place-items-center rounded-full border border-background bg-emerald-500 text-[10px] font-bold text-emerald-950">
                ✓
              </span>
            )}
          </div>
        ) : onSeatSelect ? (
          <button
            aria-label={`Move to the ${seat.sourcePosition} seat`}
            className="relative grid size-[var(--seat-size)] place-items-center rounded-full border border-dashed border-border bg-white/5 font-heading text-xl font-bold text-muted-foreground shadow-sm transition-transform hover:scale-105 hover:border-primary hover:text-primary pointer-events-auto active:scale-95"
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
              "absolute top-0 left-0 grid -translate-x-1/2 -translate-y-1/2 justify-items-center text-center opacity-0 will-change-transform pointer-events-none",
              seat.turnLabel && "drop-shadow-[0_0_8px_rgba(229,197,122,0.5)]",
            )}
            data-seat-position={seat.displayPosition}
            key={seat.sourcePosition}
            ref={(element) => onSeatElement(seat.displayPosition, element)}
            style={style}
          >
            {frame}
            <strong className="mt-1.5 max-w-[110px] truncate text-[11px] font-medium leading-tight text-foreground">
              {player?.name ?? "Open seat"}
            </strong>
            {seat.turnLabel ? (
              <span className="mt-0.5 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[9px] font-semibold text-white shadow-xs">
                {seat.turnLabel}
              </span>
            ) : (
              <small className="text-[10px] text-muted-foreground">
                {player
                  ? !player.connected
                    ? "Reconnecting…"
                    : player.isBot
                      ? "Bot"
                      : seat.ready
                        ? "Ready"
                        : "At table"
                  : "Available"}
              </small>
            )}
            {seat.bidWinner && (
              <span className="absolute -top-1 -right-2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-primary-foreground shadow-sm">
                Bid {seat.bidAmount ?? "won"}
              </span>
            )}
            {seat.trickWins > 0 && (
              <span
                aria-label={`${seat.trickWins} tricks won`}
                className="absolute top-1/2 -left-3 grid size-5 -translate-y-1/2 place-items-center rounded-full border border-background bg-primary text-[9px] font-bold text-primary-foreground shadow-sm"
              >
                {seat.trickWins}
              </span>
            )}
            {model.dealerPosition === seat.displayPosition && (
              <span className="absolute -top-1 -left-2 grid size-5 place-items-center rounded-full border border-border bg-muted text-[9px] font-bold text-foreground shadow-sm">
                D
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TableAccessibility({
  cards,
  interactionBlocked,
  onCardAction,
  status,
}: {
  cards: TableViewModel["hand"];
  interactionBlocked: boolean;
  onCardAction?: (cardId: string) => void;
  status: string;
}) {
  if (cards.length === 0) {
    return (
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
    );
  }
  return (
    <div className="absolute right-3 bottom-3 z-40">
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
      <div className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:right-0 focus-within:bottom-0 focus-within:flex focus-within:w-[min(560px,calc(100vw-40px))] focus-within:flex-wrap focus-within:gap-1.5 focus-within:rounded-xl focus-within:border focus-within:border-border focus-within:bg-card/95 focus-within:p-3 focus-within:shadow-2xl" aria-label="Your hand" role="group">
        <span className="w-full text-xs font-semibold text-muted-foreground">Keyboard hand</span>
        {cards.map(({ card, enabled, selected }) => (
          <button
            aria-label={`${card.rank} of ${card.suit}`}
            aria-pressed={selected}
            className="min-h-9 min-w-9 rounded-md border border-border bg-secondary px-2 py-1 text-sm font-semibold text-secondary-foreground shadow-xs disabled:opacity-40"
            disabled={interactionBlocked || !enabled}
            key={card.id}
            onClick={() => {
              if (!interactionBlocked) onCardAction?.(card.id);
            }}
            type="button"
          >
            {card.rank}
            {suitSymbol(card.suit)}
          </button>
        ))}
      </div>
    </div>
  );
}

function applySeatProjection(
  element: HTMLDivElement | undefined,
  projection: SeatProjection,
) {
  if (!element) return;
  element.style.opacity = projection.visible ? "1" : "0";
  element.style.visibility = projection.visible ? "visible" : "hidden";
  element.style.zIndex = String(10 + Math.round(projection.scale * 20));
  element.style.transform = `translate3d(${projection.x}px, ${projection.y}px, 0) translate(-50%, -50%) scale(${projection.scale})`;
}

const suitSymbol = (suit: Card["suit"]) =>
  ({ clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" })[suit];
