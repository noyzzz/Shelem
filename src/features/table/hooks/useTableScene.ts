import { useEffect, useRef } from "react";
import type { RelativePosition, TableViewModel } from "../model/tableTypes";
import type { SeatProjection } from "../scene/sceneTypes";
import { TableSceneEngine } from "../scene/TableSceneEngine";

type TableSceneOptions = {
  model: TableViewModel;
  reducedMotion: boolean;
  interactionBlocked: boolean;
  onRendererUnavailable: () => void;
  onCardAction?: (cardId: string) => void;
  onSeatProjection: (
    position: RelativePosition,
    projection: SeatProjection,
  ) => void;
  transparentBackground?: boolean;
  seatProjectionHeight?: number;
  resetCameraOnResize?: boolean;
};

export function useTableScene(options: TableSceneOptions) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<TableSceneEngine | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const {
    model,
    reducedMotion,
    interactionBlocked,
    transparentBackground,
    seatProjectionHeight,
  } = options;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let scene: TableSceneEngine;
    try {
      scene = new TableSceneEngine({
        canvas,
        transparentBackground,
        seatProjectionHeight,
        onCardAction: (cardId) => latest.current.onCardAction?.(cardId),
        onRendererError: () => latest.current.onRendererUnavailable(),
        onSeatProjection: (position, projection) =>
          latest.current.onSeatProjection(position, projection),
      });
      sceneRef.current = scene;
      const bounds = host.getBoundingClientRect();
      scene.resize(bounds.width, bounds.height);
      scene.resetCamera();
      scene.update({
        model: latest.current.model,
        reducedMotion: latest.current.reducedMotion,
      });
      scene.setInteractionEnabled(!latest.current.interactionBlocked);
    } catch {
      sceneRef.current?.destroy();
      sceneRef.current = null;
      latest.current.onRendererUnavailable();
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      scene.resize(entry.contentRect.width, entry.contentRect.height);
      if (latest.current.resetCameraOnResize) scene.resetCamera();
    });
    observer.observe(host);

    return () => {
      observer.disconnect();
      sceneRef.current = null;
      scene.destroy();
    };
  }, [transparentBackground, seatProjectionHeight]);

  useEffect(() => {
    sceneRef.current?.update({ model, reducedMotion });
  }, [model, reducedMotion]);

  useEffect(() => {
    sceneRef.current?.setInteractionEnabled(!interactionBlocked);
  }, [interactionBlocked]);

  return { hostRef, canvasRef, sceneRef };
}
