import type { RelativePosition } from "@/features/table/model/tableTypes";
import { SEAT_ANCHORS } from "./tableConfig";
import {
  BoxGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Texture,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Scene,
  type Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MODEL_URL = "/models/persian-lounge.glb";
const MENU_MODEL_URL = "/models/persian-lounge-menu.glb";
const CHAIR_NAMES: Record<RelativePosition, string> = {
  north: "ChairNorth",
  south: "ChairSouth",
  east: "ChairEast",
  west: "ChairWest",
};
const SEATS = Object.keys(CHAIR_NAMES) as RelativePosition[];
// Hide only the wall between the orbit camera and the table.
const WALLS = [
  { name: "BackWall", axis: "z", direction: -1, limit: 9.0 },
  { name: "FrontWall", axis: "z", direction: 1, limit: 9.0 },
  { name: "LeftWall", axis: "x", direction: -1, limit: 11.0 },
  { name: "RightWall", axis: "x", direction: 1, limit: 11.0 },
] as const;

type EnvironmentOptions = {
  transparentBackground?: boolean;
  textureAnisotropy?: number;
  onReady?: () => void;
};

export function buildTableEnvironment(
  scene: Scene,
  seatRoot: Group,
  {
    transparentBackground = false,
    textureAnisotropy = 1,
    onReady,
  }: EnvironmentOptions = {},
) {
  const environmentRoot = new Group();
  environmentRoot.name = "Table environment";
  const chairRoot = new Group();
  const chairMaterials = new Map<RelativePosition, MeshStandardMaterial>();
  const chairs = new Map<RelativePosition, Object3D>();
  scene.add(environmentRoot);
  seatRoot.add(chairRoot);

  const fallback = buildFallback(transparentBackground, chairs, chairMaterials);
  environmentRoot.add(fallback);
  const lights = buildLights();
  environmentRoot.add(lights);
  let disposed = false;
  const walls: { object: Object3D; spec: (typeof WALLS)[number] }[] = [];
  const cameraLocation = { x: 0, z: 0 };
  const replacedMaterials = new Set<Material>();

  const update = (cameraPosition: Vector3) => {
    cameraLocation.x = cameraPosition.x;
    cameraLocation.z = cameraPosition.z;
    walls.forEach(({ object, spec }) => {
      object.visible =
        !transparentBackground &&
        cameraLocation[spec.axis] * spec.direction < spec.limit;
    });
  };

  new GLTFLoader().load(
    transparentBackground ? MENU_MODEL_URL : MODEL_URL,
    ({ scene: model }) => {
      if (disposed) {
        disposeResources(model);
        return;
      }

      const modelChairs = SEATS.map((seat) =>
        model.getObjectByName(CHAIR_NAMES[seat]),
      );
      if (!model.getObjectByName("Table") || modelChairs.some((chair) => !chair)) {
        disposeResources(model);
        console.warn(
          "The lounge model is incomplete. The fallback table is still available.",
        );
        return;
      }

      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        object.receiveShadow = true;
        // The broad floor and rug receive shadows but do not need a shadow pass.
        object.castShadow = !/floor|rug/i.test(object.name);
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => {
          if (material.transparent) {
            // Window panes tint the view without a refraction render pass.
            material.depthWrite = false;
            object.castShadow = false;
            object.receiveShadow = false;
          }
          if (material instanceof MeshStandardMaterial && material.map) {
            material.map.anisotropy = textureAnisotropy;
          }
        });
      });
      const exterior = model.getObjectByName("Exterior");
      exterior?.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        object.castShadow = false;
        object.receiveShadow = false;
      });
      if (transparentBackground) {
        const room = model.getObjectByName("Room");
        if (room) room.visible = false;
        const roomFloor = model.getObjectByName("RoomFloor");
        if (roomFloor) roomFloor.visible = false;
        if (exterior) exterior.visible = false;
      }
      WALLS.forEach((spec) => {
        const object = model.getObjectByName(spec.name);
        if (!object) return;
        object.visible =
          !transparentBackground &&
          cameraLocation[spec.axis] * spec.direction < spec.limit;
        walls.push({ object, spec });
      });

      disposeResources(fallback);
      fallback.removeFromParent();
      chairs.clear();
      chairMaterials.clear();
      environmentRoot.add(model);
      SEATS.forEach((seat, index) => {
        const chair = modelChairs[index]!;
        const sourceToClone = new Map<MeshStandardMaterial, MeshStandardMaterial>();
        const materialName = CHAIR_NAMES[seat].replace("Chair", "Upholstery");
        chair.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          const cloneUpholstery = (material: Material) => {
            if (
              !(material instanceof MeshStandardMaterial) ||
              !material.name.startsWith(materialName)
            ) {
              return material;
            }
            let clone = sourceToClone.get(material);
            if (!clone) {
              clone = material.clone();
              sourceToClone.set(material, clone);
              replacedMaterials.add(material);
              chairMaterials.set(seat, clone);
            }
            return clone;
          };
          object.material = Array.isArray(object.material)
            ? object.material.map(cloneUpholstery)
            : cloneUpholstery(object.material);
        });
        // Preserve the exported world transform if Blender adds a parent transform.
        chairRoot.attach(chair);
        chairs.set(seat, chair);
      });
      onReady?.();
    },
    undefined,
    (error: unknown) => {
      if (!disposed) {
        console.warn(
          "The lounge model could not load. The fallback table is still available.",
          error,
        );
      }
    },
  );

  return {
    chairMaterials,
    chairs,
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeResources(environmentRoot, chairRoot);
      replacedMaterials.forEach((material) => material.dispose());
      environmentRoot.removeFromParent();
      chairRoot.removeFromParent();
      lights.traverse((object) => {
        if (object instanceof DirectionalLight) object.shadow.dispose();
      });
    },
  };
}

function buildLights() {
  const lights = new Group();
  const hemisphere = new HemisphereLight(0xfff1dc, 0x4a4135, 1.45);
  const key = new DirectionalLight(0xffebd1, 2.8);
  key.position.set(-4, 10, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 32;
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 11;
  key.shadow.camera.bottom = -11;
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.025;
  const lamp = new PointLight(0xffc17f, 12, 8, 2);
  lamp.position.set(7.5, 1.5, 1.8);
  lights.add(hemisphere, key, lamp);
  return lights;
}

function buildFallback(
  transparentBackground: boolean,
  chairs: Map<RelativePosition, Object3D>,
  chairMaterials: Map<RelativePosition, MeshStandardMaterial>,
) {
  const root = new Group();
  root.name = "Lounge loading fallback";
  const wood = new MeshStandardMaterial({ color: 0x5c3c27, roughness: 0.65 });
  const felt = new MeshStandardMaterial({ color: 0x254a3b, roughness: 0.95 });
  const brass = new MeshStandardMaterial({
    color: 0xbca16a,
    roughness: 0.5,
    metalness: 0.65,
  });
  const addOval = (radius: number, height: number, y: number, material: Material) => {
    const mesh = new Mesh(
      new CylinderGeometry(radius, radius, height, 64),
      material,
    );
    mesh.position.y = y;
    mesh.scale.z = 0.62;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  };
  addOval(5.65, 0.3, 0.42, wood);
  addOval(5.35, 0.065, 0.5975, brass);
  addOval(5.27, 0.06, 0.62, felt);
  const legGeometry = new BoxGeometry(0.28, 2.17, 0.28);
  for (const x of [-3.8, 3.8]) {
    for (const z of [-1.8, 1.8]) {
      const leg = new Mesh(legGeometry, wood);
      leg.position.set(x, -0.815, z);
      leg.castShadow = true;
      root.add(leg);
    }
  }
  const rug = new Mesh(
    new PlaneGeometry(15, 10.5),
    new MeshStandardMaterial({ color: 0x723b35, roughness: 1 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = -1.86;
  rug.receiveShadow = true;
  root.add(rug);
  if (!transparentBackground) {
    const floor = new Mesh(
      new PlaneGeometry(24, 20),
      new MeshStandardMaterial({ color: 0x67503b, roughness: 0.85 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.9;
    floor.receiveShadow = true;
    root.add(floor);
  }
  SEATS.forEach((seat) => {
    const material = new MeshStandardMaterial({
      color: seat === "north" || seat === "south" ? 0x987247 : 0x52624b,
      roughness: 0.9,
    });
    const chair = new Mesh(new CylinderGeometry(0.7, 0.75, 0.25, 32), material);
    chair.position.copy(SEAT_ANCHORS[seat]);
    chair.position.y = 0.28;
    chair.scale.z = 0.75;
    chair.castShadow = true;
    chair.receiveShadow = true;
    chairs.set(seat, chair);
    chairMaterials.set(seat, material);
    root.add(chair);
  });
  return root;
}

// GLB meshes share resources. Release each resource once, including decoded images.
function disposeResources(...roots: Object3D[]) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const images = new Set<ImageBitmap>();
  roots.forEach((root) =>
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      geometries.add(object.geometry);
      const meshMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      meshMaterials.forEach((material) => {
        materials.add(material);
        Object.values(material).forEach((value: unknown) => {
          if (value instanceof Texture) textures.add(value);
        });
      });
    }),
  );
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => {
    if (typeof ImageBitmap !== "undefined" && texture.image instanceof ImageBitmap) {
      images.add(texture.image);
    }
    texture.dispose();
  });
  images.forEach((image) => image.close());
}
