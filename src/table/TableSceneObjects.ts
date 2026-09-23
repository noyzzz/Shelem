import {
  AmbientLight,
  CanvasTexture,
  CylinderGeometry,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Texture,
} from "three";
import type { Card } from "../gameClient";
import type { RelativePosition } from "./tableTypes";
import { SUIT_SYMBOL } from "./tableConfig";

export function buildTableEnvironment(
  scene: Scene,
  seatRoot: Group,
  { transparentBackground = false }: { transparentBackground?: boolean } = {},
) {
  const chairMaterials = new Map<RelativePosition, MeshStandardMaterial>();
  const chairs = new Map<RelativePosition, Mesh>();
  const floorMaterial = transparentBackground
    ? new ShadowMaterial({ opacity: 0.25, fog: false })
    : new MeshStandardMaterial({
        color: 0x071610,
        metalness: 0,
        roughness: 1,
      });
  const floor = new Mesh(new PlaneGeometry(120, 120), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  floor.receiveShadow = true;
  scene.add(floor);

  if (!transparentBackground) {
    const grid = new GridHelper(30, 30, 0x173c2c, 0x0d241a);
    grid.position.y = 0.005;
    const gridMaterials = Array.isArray(grid.material)
      ? grid.material
      : [grid.material];
    gridMaterials.forEach((material) => {
      material.opacity = 0.12;
      material.transparent = true;
    });
    scene.add(grid);
  }

  const woodMaterial = new MeshStandardMaterial({
    color: 0x2c190e,
    metalness: 0.12,
    roughness: 0.5,
  });
  const base = new Mesh(
    new CylinderGeometry(5.65, 5.65, 0.52, 96),
    woodMaterial,
  );
  base.position.y = 0.34;
  base.scale.z = 0.62;
  base.castShadow = true;
  base.receiveShadow = true;

  const trimMaterial = new MeshStandardMaterial({
    color: 0xb88e3d,
    metalness: 0.65,
    roughness: 0.32,
  });
  const trim = new Mesh(
    new CylinderGeometry(5.31, 5.31, 0.135, 96),
    trimMaterial,
  );
  trim.position.y = 0.636;
  trim.scale.z = 0.6;
  trim.receiveShadow = true;

  const feltMaterial = new MeshStandardMaterial({
    color: 0x0c4833,
    metalness: 0.02,
    roughness: 0.84,
  });
  const felt = new Mesh(
    new CylinderGeometry(5.24, 5.24, 0.13, 96),
    feltMaterial,
  );
  felt.position.y = 0.64;
  felt.scale.z = 0.6;
  felt.receiveShadow = true;
  scene.add(base, trim, felt);

  const seatPositions: Record<RelativePosition, Vector3> = {
    north: new Vector3(0, 0.28, -4.45),
    south: new Vector3(0, 0.28, 4.45),
    west: new Vector3(-6.05, 0.28, 0),
    east: new Vector3(6.05, 0.28, 0),
  };
  (Object.keys(seatPositions) as RelativePosition[]).forEach((position) => {
    const material = new MeshStandardMaterial({
      color:
        position === "north" || position === "south" ? 0x8a6d2b : 0x1b5e48,
      emissive: 0x000000,
      metalness: 0.08,
      roughness: 0.65,
    });
    const chair = new Mesh(
      new CylinderGeometry(0.7, 0.78, 0.25, 48),
      material,
    );
    chair.position.copy(seatPositions[position]);
    chair.scale.z = 0.72;
    chair.castShadow = true;
    chair.receiveShadow = true;
    chairMaterials.set(position, material);
    chairs.set(position, chair);
    seatRoot.add(chair);
  });

  const hemisphere = new HemisphereLight(0xffeed1, 0x071e14, 0.85);
  const ambient = new AmbientLight(0x18382b, 0.35);
  const key = new DirectionalLight(0xffdfa0, 2.8);
  key.position.set(-4, 10, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 28;
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  key.shadow.bias = -0.0005;
  scene.add(hemisphere, ambient, key);
  return { chairMaterials, chairs };
}
export class CardTextureFactory {
  private readonly cache = new Map<string, CanvasTexture>();
  readonly back: CanvasTexture;

  constructor(private readonly renderer: WebGLRenderer) {
    this.back = this.createBackTexture();
  }

  getFace(card: Card): Texture {
    const textureKey = `${card.suit}:${card.rank}`;
    const existing = this.cache.get(textureKey);
    if (existing) return existing;

    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 420;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to create card artwork.");
    context.fillStyle = "#faf7ef";
    roundedRect(context, 2, 2, 296, 416, 20);
    context.fill();
    context.strokeStyle = "#ded7c6";
    context.lineWidth = 2.5;
    context.stroke();
    context.strokeStyle = "#e8e1d0";
    context.lineWidth = 1;
    roundedRect(context, 8, 8, 284, 404, 14);
    context.stroke();
    const red = card.suit === "diamonds" || card.suit === "hearts";
    context.fillStyle = red ? "#ba2c32" : "#14251d";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "700 58px 'Outfit', 'Plus Jakarta Sans', sans-serif";
    context.fillText(card.rank, 46, 48);
    context.font = "52px 'Outfit', 'Plus Jakarta Sans', sans-serif";
    context.fillText(SUIT_SYMBOL[card.suit], 46, 105);
    context.save();
    context.translate(254, 372);
    context.rotate(Math.PI);
    context.font = "700 58px 'Outfit', 'Plus Jakarta Sans', sans-serif";
    context.fillText(card.rank, 0, 0);
    context.font = "52px 'Outfit', 'Plus Jakarta Sans', sans-serif";
    context.fillText(SUIT_SYMBOL[card.suit], 0, 57);
    context.restore();
    context.font =
      card.rank === "J" || card.rank === "Q" || card.rank === "K"
        ? "700 110px 'Outfit', 'Plus Jakarta Sans', sans-serif"
        : "124px 'Outfit', 'Plus Jakarta Sans', sans-serif";
    context.fillText(
      card.rank === "J" || card.rank === "Q" || card.rank === "K"
        ? `${card.rank}${SUIT_SYMBOL[card.suit]}`
        : SUIT_SYMBOL[card.suit],
      150,
      215,
    );
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(
      8,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    this.cache.set(textureKey, texture);
    return texture;
  }

  dispose() {
    this.cache.forEach((texture) => texture.dispose());
    this.back.dispose();
  }

  private createBackTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 420;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to create card artwork.");
    context.fillStyle = "#f7f3e9";
    roundedRect(context, 2, 2, 296, 416, 20);
    context.fill();
    context.fillStyle = "#163f68";
    roundedRect(context, 10, 10, 280, 400, 14);
    context.fill();
    context.strokeStyle = "#f7f3e9";
    context.lineWidth = 4;
    roundedRect(context, 18, 18, 264, 384, 10);
    context.stroke();
    context.lineWidth = 2;
    roundedRect(context, 26, 26, 248, 368, 8);
    context.stroke();
    context.globalAlpha = 0.42;
    for (let row = 0; row < 11; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        context.save();
        context.translate(40 + column * 37, 31 + row * 36);
        context.rotate(Math.PI / 4);
        context.strokeRect(-8, -8, 16, 16);
        context.beginPath();
        context.arc(0, 0, 4, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }
    }
    context.globalAlpha = 1;
    context.lineWidth = 5;
    context.beginPath();
    context.ellipse(150, 210, 54, 72, 0, 0, Math.PI * 2);
    context.stroke();
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(150, 210, 42, 60, 0, 0, Math.PI * 2);
    context.stroke();
    context.save();
    context.translate(150, 210);
    for (let index = 0; index < 8; index += 1) {
      context.rotate(Math.PI / 4);
      context.beginPath();
      context.moveTo(0, -12);
      context.bezierCurveTo(18, -30, 28, -9, 0, 0);
      context.bezierCurveTo(-28, -9, -18, -30, 0, -12);
      context.stroke();
    }
    context.restore();
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}
