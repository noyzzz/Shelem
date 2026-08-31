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
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Texture,
} from "three";
import type { Card } from "../gameClient";
import type { RelativePosition } from "./tableTypes";
import { SUIT_SYMBOL } from "./tableConfig";

export function buildTableEnvironment(scene: Scene, seatRoot: Group) {
  const chairMaterials = new Map<RelativePosition, MeshStandardMaterial>();
  const floorMaterial = new MeshStandardMaterial({
    color: 0x06100c,
    metalness: 0,
    roughness: 1,
  });
  const floor = new Mesh(new PlaneGeometry(40, 40), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  floor.receiveShadow = true;
  scene.add(floor);

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

  const woodMaterial = new MeshStandardMaterial({
    color: 0x3a2518,
    metalness: 0.05,
    roughness: 0.62,
  });
  const base = new Mesh(
    new CylinderGeometry(5.65, 5.65, 0.52, 96),
    woodMaterial,
  );
  base.position.y = 0.34;
  base.scale.z = 0.62;
  base.castShadow = true;
  base.receiveShadow = true;

  const feltMaterial = new MeshStandardMaterial({
    color: 0x10513a,
    metalness: 0,
    roughness: 0.92,
  });
  const felt = new Mesh(
    new CylinderGeometry(5.26, 5.26, 0.13, 96),
    feltMaterial,
  );
  felt.position.y = 0.64;
  felt.scale.z = 0.6;
  felt.receiveShadow = true;
  scene.add(base, felt);

  const seatPositions: Record<RelativePosition, Vector3> = {
    north: new Vector3(0, 0.28, -4.45),
    south: new Vector3(0, 0.28, 4.45),
    west: new Vector3(-6.05, 0.28, 0),
    east: new Vector3(6.05, 0.28, 0),
  };
  (Object.keys(seatPositions) as RelativePosition[]).forEach((position) => {
    const material = new MeshStandardMaterial({
      color:
        position === "north" || position === "south" ? 0x7c6530 : 0x315e51,
      emissive: 0x000000,
      metalness: 0.06,
      roughness: 0.7,
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
    seatRoot.add(chair);
  });

  const hemisphere = new HemisphereLight(0xffe8bd, 0x082217, 1.5);
  const ambient = new AmbientLight(0xbfd7cc, 0.55);
  const key = new DirectionalLight(0xffdf9a, 3.2);
  key.position.set(-4, 10, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 28;
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  scene.add(hemisphere, ambient, key);
  return chairMaterials;
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
    context.fillStyle = "#faf6eb";
    roundedRect(context, 2, 2, 296, 416, 20);
    context.fill();
    context.strokeStyle = "#ded6c4";
    context.lineWidth = 2.5;
    context.stroke();
    const red = card.suit === "diamonds" || card.suit === "hearts";
    context.fillStyle = red ? "#a42f32" : "#14241c";
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
    context.fillStyle = "#113427";
    roundedRect(context, 2, 2, 296, 416, 20);
    context.fill();
    context.strokeStyle = "#dfc179";
    context.lineWidth = 2.5;
    roundedRect(context, 12, 12, 276, 396, 14);
    context.stroke();
    context.lineWidth = 1.5;
    context.globalAlpha = 0.3;
    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 6; column += 1) {
        context.save();
        context.translate(38 + column * 45, 37 + row * 43);
        context.rotate(Math.PI / 4);
        context.strokeRect(-9, -9, 18, 18);
        context.restore();
      }
    }
    context.globalAlpha = 1;
    context.fillStyle = "#e5c57a";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "600 96px 'Outfit', 'Plus Jakarta Sans', sans-serif";
    context.fillText("ش", 150, 210);
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
