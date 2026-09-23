import type { SeatProjection } from "../scene/sceneTypes";

export function applySeatProjection(
  element: HTMLDivElement | undefined,
  projection: SeatProjection,
  options: { clearHand?: boolean; stackByDepth?: boolean } = {},
) {
  if (!element) return;
  element.style.opacity = projection.visible ? "1" : "0";
  element.style.visibility = projection.visible ? "visible" : "hidden";
  if (options.stackByDepth)
    element.style.zIndex = String(10 + Math.round(projection.scale * 20));
  const offset = options.clearHand ? 110 * projection.scale : 0;
  element.style.transform = `translate3d(${projection.x}px, ${projection.y + offset}px, 0) translate(-50%, -50%) scale(${projection.scale})`;
}
