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
import { CardFace } from "../ui/PlayingCard";

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
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    window.matchMedia?.("(max-width: 639px)").matches ?? false,
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
  const sceneModel = useMemo(
    () => isMobileViewport ? { ...model, hand: [] } : model,
    [isMobileViewport, model],
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
    const media = window.matchMedia?.("(max-width: 639px)");
    if (!media) return;
    const update = () => setIsMobileViewport(media.matches);
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
          applySeatProjection(seatElements.current[position], position, projection);
        },
      });
      sceneRef.current = scene;
      const initialBounds = host.getBoundingClientRect();
      scene.resize(initialBounds.width, initialBounds.height);
      scene.resetCamera();
      scene.update({ model: sceneModel, reducedMotion });
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
    sceneRef.current?.update({ model: sceneModel, reducedMotion });
  }, [sceneModel, reducedMotion]);

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
          hideSouthSeat={isMobileViewport && model.hand.length > 0}
          model={model}
          onSeatElement={(position, element) => {
            if (element) seatElements.current[position] = element;
            else delete seatElements.current[position];
          }}
          onSeatSelect={room.match ? undefined : onSeatSelect}
        />
        {isMobileViewport && model.hand.length > 0 && (
          <MobileHand
            cards={model.hand}
            interactionBlocked={interactionBlocked}
            onCardAction={onCardAction}
            phase={model.phase}
          />
        )}
        <ButtonGroup className="absolute right-3.5 bottom-3.5 z-30 shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur-md rounded-lg border border-white/10 bg-[#081b15]/90 p-0.5" aria-label="Table camera controls">
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

function SeatVideoLayer({
  hideSouthSeat,
  model,
  onSeatElement,
  onSeatSelect,
}: {
  hideSouthSeat: boolean;
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
        if (hideSouthSeat && seat.displayPosition === "south") return null;
        const player = seat.player;
        const style = { "--seat-size": "76px" } as CSSProperties;
        const frame = player ? (
          <div
            aria-current={seat.turnLabel ? "true" : undefined}
            aria-label={`${player.name}, ${seat.displayPosition} seat${seat.turnLabel ? `, ${seat.turnLabel}` : ""}`}
            className={cn(
              "relative grid size-[var(--seat-size)] place-items-center rounded-full bg-gradient-to-br from-[#0a231b] to-[#04100c] font-heading font-bold shadow-[0_8px_24px_rgba(0,0,0,0.6)] pointer-events-auto transition-all",
              seat.team === "two"
                ? "text-emerald-300"
                : "text-primary",
              seat.turnLabel && "ring-3 ring-primary/80 shadow-[0_0_24px_rgba(229,197,122,0.55)]",
            )}
          >
            <span className="text-xl" aria-hidden="true">
              {player.name.slice(0, 1).toUpperCase()}
            </span>
            <span
              className="absolute inset-0 block overflow-hidden rounded-full"
              id={`seat-camera-${player.id}`}
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

function MobileHand({
  cards,
  interactionBlocked,
  onCardAction,
  phase,
}: {
  cards: TableViewModel["hand"];
  interactionBlocked: boolean;
  onCardAction?: (cardId: string) => void;
  phase: TableViewModel["phase"];
}) {
  const bottomClass = phase === "bidding"
    ? "bottom-34"
    : phase === "ground"
      ? "bottom-22"
      : "bottom-16";

  return (
    <div
      aria-label="Your hand"
      className={cn(
        "absolute left-2 right-2 z-35 h-28 pointer-events-none",
        bottomClass,
      )}
      role="group"
    >
      {cards.map(({ card, enabled, selected }, index) => {
        const progress = cards.length <= 1 ? 0.5 : index / (cards.length - 1);
        const disabled = interactionBlocked || !enabled;
        return (
          <button
            aria-label={`${card.rank} of ${card.suit}`}
            aria-pressed={selected}
            className={cn(
              "absolute top-3 aspect-[5/7] w-[clamp(58px,18vw,76px)] overflow-hidden rounded-md border border-black/25 bg-[#fff0c2] shadow-[0_5px_14px_rgba(0,0,0,0.5)] transition-[top,filter] duration-150 pointer-events-auto",
              enabled && !interactionBlocked && "active:brightness-110",
              selected && "top-0 border-2 border-primary shadow-[0_0_18px_rgba(229,197,122,0.65)]",
            )}
            disabled={disabled}
            key={card.id}
            onClick={() => onCardAction?.(card.id)}
            style={{
              left: `${progress * 100}%`,
              transform: `translateX(-${progress * 100}%)`,
              zIndex: selected ? cards.length + 1 : index,
            }}
            type="button"
          >
            <CardFace card={card} className="h-full w-full object-cover" />
          </button>
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
  position: RelativePosition,
  projection: SeatProjection,
) {
  if (!element) return;
  element.style.opacity = projection.visible ? "1" : "0";
  element.style.visibility = projection.visible ? "visible" : "hidden";
  element.style.zIndex = String(10 + Math.round(projection.scale * 20));
  const clearHandOffset = position === "south" ? 110 * projection.scale : 0;
  element.style.transform = `translate3d(${projection.x}px, ${projection.y + clearHandOffset}px, 0) translate(-50%, -50%) scale(${projection.scale})`;
}

const suitSymbol = (suit: Card["suit"]) =>
  ({ clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" })[suit];
