import type { RelativePosition } from "@/features/table/model/tableTypes";
import { Vector3 } from "three";

export const CARD_SIZE = {
  height: 1.2,
  width: 0.86,
} as const;

export const TABLE_SURFACE_Y = 0.66;

export const SEAT_ANCHORS: Record<RelativePosition, Vector3> = {
  north: new Vector3(0, 1.82, -4.45),
  south: new Vector3(0, 1.82, 4.45),
  west: new Vector3(-6.05, 1.82, 0),
  east: new Vector3(6.05, 1.82, 0),
};
export const CAMERA_PRESETS = {
  menu: {
    position: new Vector3(0, 10.8, 15.6),
    target: new Vector3(0, -0.6, 0),
  },
  landscape: {
    fov: 47,
    position: new Vector3(0, 7.2, 10.4),
  },
  portrait: {
    fov: 56,
    position: new Vector3(0, 9.6, 12.4),
  },
  target: new Vector3(0, 0.55, 0),
} as const;

export const RENDER_QUALITY = {
  desktopMaxPixelRatio: 1.6,
  desktopPixelBudget: 3_200_000,
  minimumPixelRatio: 0.6,
  mobileBreakpoint: 600,
  mobileMaxPixelRatio: 1.25,
  mobilePixelBudget: 1_600_000,
} as const;
