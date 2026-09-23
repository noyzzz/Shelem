import { SUIT_SYMBOL } from "@/domain/cards";
import type { Card } from "@/domain/types";
import { CanvasTexture, SRGBColorSpace, WebGLRenderer, type Texture } from "three";

export { buildTableEnvironment } from "./TableEnvironment";

const ARTWORK_WIDTH = 300;
const ARTWORK_HEIGHT = 420;
const TEXTURE_WIDTH = 512;
const TEXTURE_HEIGHT = 720;

export type CardFaceTexture = {
  texture: Texture;
  release: () => void;
};

export class CardTextureFactory {
  private readonly cache = new Map<
    string,
    { texture: CanvasTexture; references: number }
  >();
  readonly back: CanvasTexture;

  constructor(private readonly renderer: WebGLRenderer) {
    this.back = this.createBackTexture();
  }

  acquireFace(card: Card): CardFaceTexture {
    const textureKey = `${card.suit}:${card.rank}`;
    const entry = this.cache.get(textureKey) ?? {
      texture: this.createFaceTexture(card),
      references: 0,
    };
    entry.references += 1;
    this.cache.set(textureKey, entry);
    let released = false;
    return {
      texture: entry.texture,
      release: () => {
        if (released) return;
        released = true;
        entry.references -= 1;
        if (entry.references === 0 && this.cache.get(textureKey) === entry) {
          this.cache.delete(textureKey);
          disposeArtwork(entry.texture);
        }
      },
    };
  }

  dispose() {
    this.cache.forEach(({ texture }) => disposeArtwork(texture));
    this.cache.clear();
    disposeArtwork(this.back);
  }

  private createFaceTexture(card: Card) {
    const { canvas, context } = createArtworkCanvas();
    context.fillStyle = "#faf7ef";
    // The mesh supplies the rounded silhouette; opaque artwork prevents dark seams.
    context.fillRect(0, 0, ARTWORK_WIDTH, ARTWORK_HEIGHT);
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
    return this.createTexture(canvas);
  }

  private createBackTexture() {
    const { canvas, context } = createArtworkCanvas();
    context.fillStyle = "#f7f3e9";
    context.fillRect(0, 0, ARTWORK_WIDTH, ARTWORK_HEIGHT);
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
    return this.createTexture(canvas);
  }

  private createTexture(canvas: HTMLCanvasElement) {
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(
      8,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    return texture;
  }
}

function disposeArtwork(texture: CanvasTexture) {
  texture.dispose();
  // Release the canvas backing store as well as the GPU allocation.
  const canvas = texture.image as HTMLCanvasElement;
  canvas.width = 1;
  canvas.height = 1;
}

function createArtworkCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create card artwork.");
  context.scale(TEXTURE_WIDTH / ARTWORK_WIDTH, TEXTURE_HEIGHT / ARTWORK_HEIGHT);
  return { canvas, context };
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
