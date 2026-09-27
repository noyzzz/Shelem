import { CardFace } from "@/components/PlayingCard";
import { cn } from "@/lib/utils";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { TableViewModel } from "../model/tableTypes";

const LONG_PRESS_MS = 1_000;
const MOVE_CANCEL_DISTANCE = 10;

type HandOffset = { x: number; y: number };

type DragGesture = {
  dragging: boolean;
  maxX: number;
  maxY: number;
  minY: number;
  offsetX: number;
  offsetY: number;
  pointerId: number;
  startX: number;
  startY: number;
};

export function MobileHand({
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
  const handRef = useRef<HTMLDivElement>(null);
  const holdTimerRef = useRef<number | null>(null);
  const gestureRef = useRef<DragGesture | null>(null);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState<HandOffset>({ x: 0, y: 0 });
  const hasSelection = cards.some((card) => card.selected);
  const stepPercent =
    cards.length <= 1 ? 0 : Math.min(6, 84 / (cards.length - 1));
  const spreadPercent = stepPercent * Math.max(0, cards.length - 1);
  const bottomClass =
    phase === "bidding"
      ? "bottom-20"
      : phase === "ground"
        ? "bottom-16"
        : "bottom-2";

  const clearHoldTimer = () => {
    if (holdTimerRef.current === null) return;
    window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  };

  useEffect(() => clearHoldTimer, []);

  const beginHold = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (interactionBlocked || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }

    clearHoldTimer();
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);

    const hand = handRef.current;
    if (!hand) return;
    const bounds = hand.getBoundingClientRect();
    const cardWidth = Math.min(60, Math.max(46, window.innerWidth * 0.14));
    const spreadWidth = bounds.width * (spreadPercent / 100);
    const maxX = Math.max(0, (bounds.width - spreadWidth - cardWidth) / 2);
    const baseTop = bounds.top - offset.y;
    const baseBottom = bounds.bottom - offset.y + 8;

    gestureRef.current = {
      dragging: false,
      maxX,
      maxY: window.innerHeight - 8 - baseBottom,
      minY: 56 - baseTop,
      offsetX: offset.x,
      offsetY: offset.y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };

    holdTimerRef.current = window.setTimeout(() => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      gesture.dragging = true;
      suppressClickRef.current = true;
      setDragging(true);
      navigator.vibrate?.(35);
    }, LONG_PRESS_MS);
  };

  const moveHand = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;

    if (!gesture.dragging) {
      if (Math.hypot(deltaX, deltaY) > MOVE_CANCEL_DISTANCE) {
        clearHoldTimer();
      }
      return;
    }

    event.preventDefault();
    setOffset({
      x: Math.min(gesture.maxX, Math.max(-gesture.maxX, gesture.offsetX + deltaX)),
      y: Math.min(gesture.maxY, Math.max(gesture.minY, gesture.offsetY + deltaY)),
    });
  };

  const finishHold = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    clearHoldTimer();
    const wasDragging = gesture.dragging;
    gestureRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (wasDragging) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 100);
    }
  };

  return (
    <div
      aria-label="Your hand"
      className={cn(
        "absolute left-2 right-2 z-35 h-20 pointer-events-none",
        dragging && "drop-shadow-[0_0_16px_rgba(229,197,122,0.7)]",
        bottomClass,
      )}
      ref={handRef}
      role="group"
      style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
    >
      {dragging ? (
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-full border border-primary/50 bg-[#081f18]/95 px-2 py-0.5 text-[10px] font-bold text-primary shadow-md">
          Move hand
        </span>
      ) : phase === "playing" && cards.some((card) => card.enabled) ? (
        <span className="absolute -top-3 left-1 text-xs font-semibold text-primary">
          Your turn
        </span>
      ) : null}
      {cards.map(({ card, enabled, selected }, index) => {
        const leftPercent =
          cards.length <= 1
            ? 50
            : 50 - spreadPercent / 2 + index * stepPercent;
        const disabled = interactionBlocked || !enabled;
        return (
          <button
            aria-disabled={disabled}
            aria-label={`${card.rank} of ${card.suit}`}
            aria-pressed={selected}
            className={cn(
              "absolute top-1 aspect-[5/7] w-[clamp(46px,14vw,60px)] overflow-hidden rounded-md border border-black/25 bg-[#fff0c2] shadow-[0_4px_10px_rgba(0,0,0,0.48)] transition-[filter,border-color,box-shadow,transform] duration-150 pointer-events-auto",
              enabled && !interactionBlocked && "active:brightness-110",
              hasSelection && !selected && "brightness-75 saturate-75",
              selected &&
                "border-primary ring-3 ring-inset ring-primary brightness-110 saturate-125 shadow-[0_0_16px_rgba(229,197,122,0.75)]",
            )}
            draggable={false}
            key={card.id}
            onClick={() => {
              if (suppressClickRef.current || disabled) return;
              onCardAction?.(card.id);
            }}
            onContextMenu={(event) => event.preventDefault()}
            onPointerCancel={finishHold}
            onPointerDown={beginHold}
            onPointerMove={moveHand}
            onPointerUp={finishHold}
            style={{
              left: `${leftPercent}%`,
              transform: "translateX(-50%)",
              zIndex: index,
              touchAction: "none",
            }}
            type="button"
          >
            <CardFace card={card} className="h-full w-full object-cover" />
            {selected && (
              <span
                aria-hidden="true"
                className="absolute top-1/2 left-1/2 grid size-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#fff3c9]/80 bg-primary/95 text-[9px] font-black leading-none text-primary-foreground shadow-md"
              >
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
