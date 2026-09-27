import type { Card } from "@/domain/types";
import { CARD_SIZE } from "./tableConfig";
import type { SceneCardTarget } from "./tableLayout";
import type { CardFaceTexture } from "./TableSceneObjects";
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Object3D,
  type Texture,
} from "three";

const CARD_RADIUS = 0.055;
const CARD_THICKNESS = 0.012;
const CORNER_SEGMENTS = 6;

export class SceneCard {
  readonly group = new Group();
  readonly id: string;
  readonly pickMeshes: Object3D[];
  private readonly materials: MeshStandardMaterial[];
  private readonly faceTexture?: CardFaceTexture;
  private readonly selection: Mesh<BufferGeometry, MeshBasicMaterial>;
  private readonly geometry = acquireGeometry();
  private opacity = 1;
  private destroyed = false;
  private target: SceneCardTarget;
  retiring = false;

  constructor({
    backTexture,
    card,
    faceDown,
    faceTexture,
    id,
  }: {
    backTexture: Texture;
    card?: Card;
    faceDown: boolean;
    faceTexture?: CardFaceTexture;
    id: string;
  }) {
    this.id = id;
    this.faceTexture = faceTexture;
    const front = new MeshStandardMaterial({
      map: faceDown ? backTexture : faceTexture?.texture,
      roughness: 0.8,
    });
    const back = new MeshStandardMaterial({ map: backTexture, roughness: 0.8 });
    const edge = new MeshStandardMaterial({ color: 0xe9e3d7, roughness: 0.9 });
    this.materials = [front, back, edge];
    const body = new Mesh(this.geometry.body, this.materials);
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData.cardId = id;
    this.pickMeshes = [body];

    this.selection = new Mesh(
      this.geometry.outline,
      new MeshBasicMaterial({
        color: 0xe5c57a,
        side: DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    this.selection.position.z = CARD_THICKNESS / 2 + 0.001;
    this.selection.visible = false;
    this.group.add(body, this.selection);
    this.group.name = card ? `${card.rank} of ${card.suit}` : "Face-down card";
    this.target = {
      opacity: 1,
      position: new Vector3(),
      quaternion: new Quaternion(),
      scale: 1,
    };
  }

  setTarget(target: SceneCardTarget, immediate: boolean) {
    this.target = {
      opacity: target.opacity,
      position: target.position.clone(),
      quaternion: target.quaternion.clone(),
      scale: target.scale,
    };
    if (immediate) {
      this.group.position.copy(target.position);
      this.group.quaternion.copy(target.quaternion);
      this.group.scale.setScalar(target.scale);
      this.setOpacity(target.opacity);
    }
  }

  setState(enabled: boolean, selected: boolean) {
    this.selection.visible = selected;
    this.pickMeshes.forEach((mesh) => {
      mesh.userData.enabled = enabled;
    });
  }

  retire(destination: Vector3) {
    this.retiring = true;
    this.selection.visible = false;
    this.pickMeshes.forEach((mesh) => {
      mesh.userData.enabled = false;
    });
    this.target = {
      ...this.target,
      opacity: 0,
      position: destination.clone(),
      scale: this.target.scale * 0.72,
    };
  }

  tick(deltaSeconds: number, reducedMotion: boolean) {
    const blend = reducedMotion
      ? 1
      : 1 - Math.pow(0.001, Math.min(deltaSeconds, 0.05) / 0.32);
    this.group.position.lerp(this.target.position, blend);
    this.group.quaternion.slerp(this.target.quaternion, blend);
    this.group.scale.setScalar(
      MathUtils.lerp(this.group.scale.x, this.target.scale, blend),
    );
    this.setOpacity(MathUtils.lerp(this.opacity, this.target.opacity, blend));
  }

  private setOpacity(opacity: number) {
    this.opacity = opacity > 0.999 ? 1 : opacity;
    const transparent = this.opacity < 1;
    this.materials.forEach((material) => {
      material.opacity = this.opacity;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.depthWrite = !transparent;
        material.needsUpdate = true;
      }
    });
    this.selection.material.opacity = this.opacity * 0.9;
  }

  get readyToDestroy() {
    return this.retiring && this.opacity < 0.025;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.materials.forEach((material) => material.dispose());
    this.selection.material.dispose();
    this.faceTexture?.release();
    releaseGeometry();
    this.group.removeFromParent();
  }
}

type CardGeometry = { body: BufferGeometry; outline: BufferGeometry; users: number };
let sharedGeometry: CardGeometry | undefined;

function acquireGeometry() {
  sharedGeometry ??= {
    body: createBodyGeometry(),
    outline: createOutlineGeometry(),
    users: 0,
  };
  sharedGeometry.users += 1;
  return sharedGeometry;
}

function releaseGeometry() {
  if (!sharedGeometry || --sharedGeometry.users > 0) return;
  sharedGeometry.body.dispose();
  sharedGeometry.outline.dispose();
  sharedGeometry = undefined;
}

function cardContour(margin = 0) {
  const halfWidth = CARD_SIZE.width / 2 + margin;
  const halfHeight = CARD_SIZE.height / 2 + margin;
  const radius = CARD_RADIUS + margin;
  const corners = [
    [halfWidth - radius, -halfHeight + radius],
    [halfWidth - radius, halfHeight - radius],
    [-halfWidth + radius, halfHeight - radius],
    [-halfWidth + radius, -halfHeight + radius],
  ];
  return corners.flatMap(([x, y], corner) =>
    Array.from({ length: CORNER_SEGMENTS + 1 }, (_, step) => {
      const angle = (corner - 1 + step / CORNER_SEGMENTS) * Math.PI / 2;
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);
      return { x: x + nx * radius, y: y + ny * radius, nx, ny };
    }),
  );
}

function createBodyGeometry() {
  const contour = cardContour();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const geometry = new BufferGeometry();

  for (const side of [1, -1]) {
    const center = positions.length / 3;
    const start = indices.length;
    positions.push(0, 0, side * CARD_THICKNESS / 2);
    normals.push(0, 0, side);
    uvs.push(0.5, 0.5);
    contour.forEach(({ x, y }) => {
      positions.push(x, y, side * CARD_THICKNESS / 2);
      normals.push(0, 0, side);
      uvs.push(0.5 + side * x / CARD_SIZE.width, 0.5 + y / CARD_SIZE.height);
    });
    contour.forEach((_, index) => {
      const current = center + 1 + index;
      const next = center + 1 + (index + 1) % contour.length;
      indices.push(center, side === 1 ? current : next, side === 1 ? next : current);
    });
    geometry.addGroup(start, indices.length - start, side === 1 ? 0 : 1);
  }

  const edgeStart = indices.length;
  const edgeVertex = positions.length / 3;
  contour.forEach(({ x, y, nx, ny }) => {
    for (const side of [-1, 1]) {
      positions.push(x, y, side * CARD_THICKNESS / 2);
      normals.push(nx, ny, 0);
      uvs.push(0, 0);
    }
  });
  contour.forEach((_, index) => {
    const current = edgeVertex + index * 2;
    const next = edgeVertex + ((index + 1) % contour.length) * 2;
    indices.push(current, next, current + 1, next, next + 1, current + 1);
  });
  geometry.addGroup(edgeStart, indices.length - edgeStart, 2);
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function createOutlineGeometry() {
  const outside = cardContour(0.02);
  const inside = cardContour(-0.003);
  const positions: number[] = [];
  const indices: number[] = [];
  outside.forEach((point, index) => {
    positions.push(point.x, point.y, 0, inside[index].x, inside[index].y, 0);
    const current = index * 2;
    const next = ((index + 1) % outside.length) * 2;
    indices.push(current, next, current + 1, next, next + 1, current + 1);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
