import {
  Color,
  DoubleSide,
  FogExp2,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Card } from "../gameClient";
import type {
  RelativePosition,
  SeatProjection,
  TableViewModel,
} from "./tableTypes";
import {
  CAMERA_PRESETS,
  CARD_SIZE,
  RENDER_QUALITY,
  SEAT_ANCHORS,
  TABLE_SURFACE_Y,
} from "./tableConfig";
import { buildDesiredCards, type SceneCardTarget } from "./tableLayout";
import { buildTableEnvironment, CardTextureFactory } from "./TableSceneObjects";

class SceneCard {
  readonly group = new Group();
  readonly id: string;
  readonly pickMeshes: Object3D[] = [];
  private readonly materials: Material[] = [];
  private readonly selection: Mesh;
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
    faceTexture?: Texture;
    id: string;
  }) {
    this.id = id;
    const frontMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      map: faceDown ? backTexture : faceTexture,
      metalness: 0.02,
      roughness: 0.72,
      side: DoubleSide,
      transparent: true,
    });
    const backMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      map: backTexture,
      metalness: 0.02,
      roughness: 0.76,
      side: DoubleSide,
      transparent: true,
    });
    const front = new Mesh(
      new PlaneGeometry(CARD_SIZE.width, CARD_SIZE.height),
      frontMaterial,
    );
    const back = new Mesh(
      new PlaneGeometry(CARD_SIZE.width, CARD_SIZE.height),
      backMaterial,
    );
    front.position.z = 0.012;
    back.position.z = -0.012;
    back.rotation.y = Math.PI;
    front.castShadow = true;
    front.receiveShadow = true;
    back.castShadow = true;
    front.userData.cardId = id;
    back.userData.cardId = id;

    const selectionMaterial = new MeshBasicMaterial({
      color: 0xe5c57a,
      opacity: 0.65,
      side: DoubleSide,
      transparent: true,
    });
    this.selection = new Mesh(
      new PlaneGeometry(CARD_SIZE.width + 0.05, CARD_SIZE.height + 0.05),
      selectionMaterial,
    );
    this.selection.position.z = -0.025;
    this.selection.visible = false;
    this.materials.push(frontMaterial, backMaterial, selectionMaterial);
    this.pickMeshes.push(front, back);
    this.group.add(this.selection, front, back);
    this.group.name = card
      ? `${card.rank} of ${card.suit}`
      : "Face-down card";
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
    const scale = MathUtils.lerp(
      this.group.scale.x,
      this.target.scale,
      blend,
    );
    this.group.scale.setScalar(scale);
    const material = this.materials[0];
    const currentOpacity = "opacity" in material ? material.opacity : 1;
    this.setOpacity(MathUtils.lerp(currentOpacity, this.target.opacity, blend));
  }

  private setOpacity(opacity: number) {
    this.materials.forEach((material) => {
      if ("opacity" in material) material.opacity = opacity;
    });
  }

  get readyToDestroy() {
    const material = this.materials[0];
    return (
      this.retiring &&
      "opacity" in material &&
      material.opacity < 0.025
    );
  }

  destroy() {
    this.group.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    this.materials.forEach((material) => material.dispose());
    this.group.removeFromParent();
  }
}

export class TableSceneEngine {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(
    CAMERA_PRESETS.landscape.fov,
    1,
    0.1,
    100,
  );
  private readonly controls: OrbitControls;
  private readonly cardRoot = new Group();
  private readonly seatRoot = new Group();
  private readonly cards = new Map<string, SceneCard>();
  private readonly retiredCards = new Set<SceneCard>();
  private readonly chairMaterials: Map<RelativePosition, MeshStandardMaterial>;
  private readonly textureFactory: CardTextureFactory;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private interactiveMeshes: Object3D[] = [];
  private lastFrameTime = performance.now();
  private model?: TableViewModel;
  private reducedMotion = false;
  private hydrated = false;
  private width = 1;
  private height = 1;
  private interactionEnabled = true;
  private pointerStart?: { x: number; y: number };

  constructor({
    canvas,
    onCardAction,
    onRendererError,
    onSeatProjection,
  }: {
    canvas: HTMLCanvasElement;
    onCardAction: (cardId: string) => void;
    onRendererError: () => void;
    onSeatProjection: (
      position: RelativePosition,
      projection: SeatProjection,
    ) => void;
  }) {
    this.renderer = new WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setClearColor(0x06140f, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.scene.background = new Color(0x071610);
    this.scene.fog = new FogExp2(0x071610, 0.025);
    this.camera.position.copy(CAMERA_PRESETS.landscape.position);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(CAMERA_PRESETS.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.enablePan = false;
    this.controls.minDistance = 6.5;
    this.controls.maxDistance = 16;
    this.controls.minPolarAngle = MathUtils.degToRad(28);
    this.controls.maxPolarAngle = MathUtils.degToRad(78);
    this.controls.rotateSpeed = 0.62;
    this.controls.zoomSpeed = 0.82;
    this.controls.update();

    this.textureFactory = new CardTextureFactory(this.renderer);
    this.chairMaterials = buildTableEnvironment(this.scene, this.seatRoot);
    this.scene.add(this.cardRoot, this.seatRoot);

    canvas.addEventListener("pointerdown", (event) => {
      if (!this.interactionEnabled) return;
      this.pointerStart = { x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener("pointerup", (event) => {
      if (!this.interactionEnabled) return;
      const start = this.pointerStart;
      this.pointerStart = undefined;
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7) {
        return;
      }
      const bounds = canvas.getBoundingClientRect();
      this.pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(this.interactiveMeshes, false)[0];
      const cardId = hit?.object.userData.cardId;
      if (cardId && hit.object.userData.enabled) onCardAction(cardId);
    });
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      onRendererError();
    });

    const render = (time: number) => {
      const delta = Math.min((time - this.lastFrameTime) / 1000, 0.05);
      this.lastFrameTime = time;
      this.controls.update();
      this.cards.forEach((card) => card.tick(delta, this.reducedMotion));
      this.retiredCards.forEach((card) => {
        card.tick(delta, this.reducedMotion);
        if (card.readyToDestroy) {
          this.retiredCards.delete(card);
          card.destroy();
        }
      });
      this.projectSeats(onSeatProjection);
      this.renderer.render(this.scene, this.camera);
    };
    this.renderer.setAnimationLoop(render);
  }

  update({
    model,
    reducedMotion,
  }: {
    model: TableViewModel;
    reducedMotion: boolean;
  }) {
    this.model = model;
    this.reducedMotion = reducedMotion;
    this.updateSeats();
    this.syncCards();
    this.hydrated = true;
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const mobile = this.width < RENDER_QUALITY.mobileBreakpoint;
    const pixelBudget = mobile
      ? RENDER_QUALITY.mobilePixelBudget
      : RENDER_QUALITY.desktopPixelBudget;
    const budgetRatio = Math.sqrt(pixelBudget / (this.width * this.height));
    this.renderer.setPixelRatio(Math.max(
      RENDER_QUALITY.minimumPixelRatio,
      Math.min(
        window.devicePixelRatio || 1,
        mobile
          ? RENDER_QUALITY.mobileMaxPixelRatio
          : RENDER_QUALITY.desktopMaxPixelRatio,
        budgetRatio,
      ),
    ));
    this.renderer.shadowMap.enabled = !mobile;
    this.camera.aspect = this.width / this.height;
    this.camera.fov =
      this.camera.aspect < 0.82
        ? CAMERA_PRESETS.portrait.fov
        : CAMERA_PRESETS.landscape.fov;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
  }

  resetCamera() {
    const portrait = this.width / this.height < 0.82;
    this.camera.position.copy(
      portrait
        ? CAMERA_PRESETS.portrait.position
        : CAMERA_PRESETS.landscape.position,
    );
    this.controls.target.copy(CAMERA_PRESETS.target);
    this.controls.update();
  }

  rotateCamera(direction: -1 | 1) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.applyAxisAngle(new Vector3(0, 1, 0), direction * Math.PI * 0.25);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  setInteractionEnabled(enabled: boolean) {
    this.interactionEnabled = enabled;
    this.controls.enabled = enabled;
    if (!enabled) this.pointerStart = undefined;
  }

  private updateSeats() {
    this.chairMaterials.forEach((material, position) => {
      const seat = this.model?.seats.find(
        (candidate) => candidate.displayPosition === position,
      );
      const active = Boolean(seat?.turnLabel);
      material.emissive.set(active ? 0x8b6122 : 0x000000);
      material.emissiveIntensity = active ? 0.85 : 0;
    });
  }

  private syncCards() {
    if (!this.model) return;
    const desired = buildDesiredCards(this.model);
    const desiredIds = new Set(desired.map((card) => card.id));
    const immediate = !this.hydrated || this.reducedMotion;
    this.interactiveMeshes = [];

    desired.forEach((specification) => {
      let card = this.cards.get(specification.id);
      if (!card) {
        const faceTexture = specification.card
          ? this.textureFactory.getFace(specification.card)
          : undefined;
        card = new SceneCard({
          backTexture: this.textureFactory.back,
          card: specification.card,
          faceDown: specification.faceDown,
          faceTexture,
          id: specification.id,
        });
        card.group.position.copy(specification.spawn);
        card.group.scale.setScalar(0.28);
        this.cards.set(specification.id, card);
        this.cardRoot.add(card.group);
      }
      card.setState(specification.enabled, specification.selected);
      card.setTarget(specification.target, immediate);
      if (specification.enabled) this.interactiveMeshes.push(...card.pickMeshes);
    });

    this.cards.forEach((card, id) => {
      if (desiredIds.has(id)) return;
      this.cards.delete(id);
      const winnerPosition = this.model?.resolvingTrickWinnerPosition;
      const destination = winnerPosition
        ? SEAT_ANCHORS[winnerPosition]
        : new Vector3(0, TABLE_SURFACE_Y, 0);
      card.retire(destination);
      this.retiredCards.add(card);
    });
  }

  private projectSeats(
    callback: (
      position: RelativePosition,
      projection: SeatProjection,
    ) => void,
  ) {
    (Object.keys(SEAT_ANCHORS) as RelativePosition[]).forEach((position) => {
      const world = SEAT_ANCHORS[position];
      const projected = world.clone().project(this.camera);
      const distance = this.camera.position.distanceTo(world);
      callback(position, {
        scale: MathUtils.clamp(9 / distance, 0.58, 1.15),
        visible:
          projected.z > -1 &&
          projected.z < 1 &&
          Math.abs(projected.x) < 1.12 &&
          Math.abs(projected.y) < 1.12,
        x: (projected.x * 0.5 + 0.5) * this.width,
        y: (-projected.y * 0.5 + 0.5) * this.height,
      });
    });
  }

  destroy() {
    this.renderer.setAnimationLoop(null);
    this.controls.dispose();
    this.cards.forEach((card) => card.destroy());
    this.retiredCards.forEach((card) => card.destroy());
    this.textureFactory.dispose();
    this.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => material.dispose());
    });
    this.renderer.dispose();
  }
}
