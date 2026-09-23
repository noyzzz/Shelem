import { useCallback } from "react";

export type SeatVideoTargetRef = (
  playerId: string,
  target: HTMLElement | null,
) => void;

export function SeatVideoTarget({
  playerId,
  onTarget,
}: {
  playerId: string;
  onTarget: SeatVideoTargetRef;
}) {
  const register = useCallback(
    (target: HTMLSpanElement | null) => onTarget(playerId, target),
    [onTarget, playerId],
  );

  return (
    <span
      className="absolute inset-0 block overflow-hidden rounded-full"
      ref={register}
    />
  );
}
