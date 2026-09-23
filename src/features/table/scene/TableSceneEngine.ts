import { SceneCard } from "@/features/table/scene/SceneCard";
import type {
  RelativePosition,
  TableViewModel,
} from "@/features/table/model/tableTypes";
import type { SeatProjection } from "@/features/table/scene/sceneTypes";
import {
  CAMERA_PRESETS,
  RENDER_QUALITY,
  SEAT_ANCHORS,
  TABLE_SURFACE_Y,
} from "@/features/table/scene/tableConfig";
import { buildDesiredCards } from "@/features/table/scene/tableLayout";
import {
  buildTableEnvironment,
  CardTextureFactory,
} from "@/features/table/scene/TableSceneObjects";
import {
  ACESFilmicToneMapping,
  Color,
  FogExp2,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class TableSceneEngine {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(
    CAMERA_PRESETS.landscape.fov,
    1,
    0.1,
    400,
  );
  private readonly controls: OrbitControls;
  private readonly cardRoot = new Group();
  private readonly seatRoot = new Group();
  private readonly cards = new Map<string, SceneCard>();
  private readonly retiredCards = new Set<SceneCard>();
  private readonly chairMaterials: Map<RelativePosition, MeshStandardMaterial>;
  private readonly chairs: Map<RelativePosition, Object3D>;
  private readonly disposeEnvironment: () => void;
  private readonly updateEnvironment: (cameraPosition: Vector3) => void;
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
  private readonly seatProjectionHeight: number;
  private readonly transparentBackground: boolean;

  constructor({
    canvas,
    onCardAction,
    onRendererError,
    onSeatProjection,
    seatProjectionHeight = SEAT_ANCHORS.north.y,
    transparentBackground = false,
  }: {
    canvas: HTMLCanvasElement;
    onCardAction: (cardId: string) => void;
    onRendererError: () => void;
    onSeatProjection: (
      position: RelativePosition,
      projection: SeatProjection,
    ) => void;
    seatProjectionHeight?: number;
    transparentBackground?: boolean;
  }) {
    this.seatProjectionHeight = seatProjectionHeight;
    this.transparentBackground = transparentBackground;
    this.renderer = new WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setClearColor(0xdce7e4, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.scene.background = transparentBackground ? null : new Color(0xdce7e4);
    this.scene.fog = new FogExp2(0xdce7e4, transparentBackground ? 0 : 0.009);
    this.camera.position.copy(CAMERA_PRESETS.landscape.position);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(CAMERA_PRESETS.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.enablePan = false;
    this.controls.minDistance = 6.5;
    this.controls.maxDistance = transparentBackground ? 26 : 16;
    this.controls.minPolarAngle = MathUtils.degToRad(28);
    this.controls.maxPolarAngle = MathUtils.degToRad(78);
    this.controls.rotateSpeed = 0.62;
    this.controls.zoomSpeed = 0.82;
    this.resetCamera();

    this.textureFactory = new CardTextureFactory(this.renderer);
    const tableEnvironment = buildTableEnvironment(this.scene, this.seatRoot, {
      transparentBackground,
      textureAnisotropy: Math.min(4, this.renderer.capabilities.getMaxAnisotropy()),
      onReady: () => this.updateSeats(),
    });
    this.chairMaterials = tableEnvironment.chairMaterials;
    this.chairs = tableEnvironment.chairs;
    this.disposeEnvironment = tableEnvironment.dispose;
    this.updateEnvironment = tableEnvironment.update;
    this.scene.add(this.cardRoot, this.seatRoot);

    canvas.addEventListener("pointerdown", (event) => {
      if (!this.interactionEnabled) return;
      this.pointerStart = { x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener("pointerup", (event) => {
      if (!this.interactionEnabled) return;
      const start = this.pointerStart;
      this.pointerStart = undefined;
      if (
        !start ||
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7
      ) {
        return;
      }
      const bounds = canvas.getBoundingClientRect();
      this.pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(
        this.interactiveMeshes,
        false,
      )[0];
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
      this.updateEnvironment(this.camera.position);
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
    this.renderer.setPixelRatio(
      Math.max(
        RENDER_QUALITY.minimumPixelRatio,
        Math.min(
          window.devicePixelRatio || 1,
          mobile
            ? RENDER_QUALITY.mobileMaxPixelRatio
            : RENDER_QUALITY.desktopMaxPixelRatio,
          budgetRatio,
        ),
      ),
    );
    if (this.renderer.shadowMap.enabled === mobile) {
      this.renderer.shadowMap.enabled = !mobile;
      // Recompile shadow shader variants when crossing the mobile breakpoint.
      // Otherwise existing materials can retain a stale desktop shadow map.
      const materials = new Set<Material>();
      this.scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const meshMaterials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        meshMaterials.forEach((material) => materials.add(material));
      });
      materials.forEach((material) => {
        material.needsUpdate = true;
      });
    }
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
    const preset = this.transparentBackground
      ? CAMERA_PRESETS.menu
      : portrait
        ? CAMERA_PRESETS.portrait
        : CAMERA_PRESETS.landscape;
    this.camera.position.copy(preset.position);
    this.controls.target.copy(
      this.transparentBackground
        ? CAMERA_PRESETS.menu.target
        : CAMERA_PRESETS.target,
    );
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
    this.chairs.forEach((chair, position) => {
      chair.visible = position !== "south" || this.model?.phase === "lobby";
    });
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
          ? this.textureFactory.acquireFace(specification.card)
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
      if (specification.enabled)
        this.interactiveMeshes.push(...card.pickMeshes);
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
    callback: (position: RelativePosition, projection: SeatProjection) => void,
  ) {
    (Object.keys(SEAT_ANCHORS) as RelativePosition[]).forEach((position) => {
      const world = SEAT_ANCHORS[position].clone();
      world.y = this.seatProjectionHeight;
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
    this.disposeEnvironment();
    this.renderer.dispose();
  }
}
