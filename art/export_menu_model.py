"""Extract the unchanged furniture and rug from the Blender lounge export.

Run from the repository root: python art/export_menu_model.py
Uses only the Python standard library. Re-run after exporting the full lounge.
"""

from copy import deepcopy
import json
from pathlib import Path
import struct


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/models/persian-lounge.glb"
DESTINATION = ROOT / "public/models/persian-lounge-menu.glb"
GROUPS = {
    "Table", "ChairNorth", "ChairSouth", "ChairEast", "ChairWest", "Rug", "Decor"
}
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def read_glb(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data)
    if magic != b"glTF" or version != 2 or length != len(data):
        raise ValueError("Expected a complete glTF 2.0 binary file")
    chunks = {}
    offset = 12
    while offset < len(data):
        size, kind = struct.unpack_from("<II", data, offset)
        end = offset + 8 + size
        if size % 4 or end > len(data) or kind in chunks:
            raise ValueError("Invalid GLB chunk")
        chunks[kind] = data[offset + 8:end]
        offset = end
    if set(chunks) != {JSON_CHUNK, BIN_CHUNK}:
        raise ValueError("Expected one JSON chunk and one embedded binary chunk")
    return json.loads(chunks[JSON_CHUNK]), chunks[BIN_CHUNK]


def reject_extensions(value):
    # Extension references need their own remapping; fail rather than corrupt them.
    if isinstance(value, dict):
        if value.get("extensions"):
            raise ValueError("Export the lounge without glTF extensions")
        for key, child in value.items():
            if key != "extras":
                reject_extensions(child)
    elif isinstance(value, list):
        for child in value:
            reject_extensions(child)


def extract_menu(source, binary):
    reject_extensions(source)
    if any(source.get(key) for key in ("animations", "skins", "cameras")):
        raise ValueError("The menu extractor expects a static lounge export")
    if len(source["buffers"]) != 1 or "uri" in source["buffers"][0]:
        raise ValueError("Expected one embedded buffer")

    scene = source["scenes"][source.get("scene", 0)]
    roots = [node for node in scene["nodes"] if source["nodes"][node].get("name") in GROUPS]
    names = [source["nodes"][node]["name"] for node in roots]
    if len(names) != len(GROUPS) or set(names) != GROUPS:
        raise ValueError("Each required furniture group must be a unique scene root")

    result = {"asset": deepcopy(source["asset"]), "scene": 0}
    remapped = {}
    packed = bytearray()

    def copy_resource(kind, old_index):
        key = (kind, old_index)
        if key in remapped:
            return remapped[key]
        item = deepcopy(source[kind][old_index])
        items = result.setdefault(kind, [])
        new_index = len(items)
        remapped[key] = new_index
        items.append(item)

        def reference(field, target):
            if field in item:
                item[field] = copy_resource(target, item[field])

        if kind == "nodes":
            if "children" in item:
                item["children"] = [copy_resource("nodes", node) for node in item["children"]]
            reference("mesh", "meshes")
        elif kind == "meshes":
            for primitive in item["primitives"]:
                if primitive.get("mode", 4) != 4 or primitive.get("targets"):
                    raise ValueError("Expected static triangle meshes")
                primitive["attributes"] = {
                    name: copy_resource("accessors", index)
                    for name, index in primitive["attributes"].items()
                }
                for field, target in (("indices", "accessors"), ("material", "materials")):
                    if field in primitive:
                        primitive[field] = copy_resource(target, primitive[field])
        elif kind == "materials":
            texture_infos = [item.get(name) for name in ("normalTexture", "occlusionTexture", "emissiveTexture")]
            pbr = item.get("pbrMetallicRoughness", {})
            texture_infos.extend(pbr.get(name) for name in ("baseColorTexture", "metallicRoughnessTexture"))
            for info in texture_infos:
                if info is not None:
                    info["index"] = copy_resource("textures", info["index"])
        elif kind == "textures":
            reference("source", "images")
            reference("sampler", "samplers")
        elif kind == "images":
            if "uri" in item:
                raise ValueError("Expected an embedded rug texture")
            reference("bufferView", "bufferViews")
        elif kind == "accessors":
            reference("bufferView", "bufferViews")
            for sparse in item.get("sparse", {}).values():
                if isinstance(sparse, dict) and "bufferView" in sparse:
                    sparse["bufferView"] = copy_resource("bufferViews", sparse["bufferView"])
        elif kind == "bufferViews":
            start = item.get("byteOffset", 0)
            end = start + item["byteLength"]
            if item["buffer"] != 0 or start < 0 or end > source["buffers"][0]["byteLength"]:
                raise ValueError("Buffer view is outside the embedded buffer")
            packed.extend(b"\0" * (-len(packed) % 4))
            item["buffer"] = 0
            item["byteOffset"] = len(packed)
            packed.extend(binary[start:end])
        return new_index

    result["scenes"] = [{"name": "Shelem | menu furniture", "nodes": [copy_resource("nodes", node) for node in roots]}]
    result["buffers"] = [{"byteLength": len(packed)}]
    return result, bytes(packed)


def write_glb(path, document, binary):
    encoded = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    encoded += b" " * (-len(encoded) % 4)
    binary += b"\0" * (-len(binary) % 4)
    length = 12 + 8 + len(encoded) + 8 + len(binary)
    path.write_bytes(
        struct.pack("<4sII", b"glTF", 2, length)
        + struct.pack("<II", len(encoded), JSON_CHUNK) + encoded
        + struct.pack("<II", len(binary), BIN_CHUNK) + binary
    )


def main():
    source, binary = read_glb(SOURCE)
    menu, menu_binary = extract_menu(source, binary)
    write_glb(DESTINATION, menu, menu_binary)
    primitives = [primitive for mesh in menu["meshes"] for primitive in mesh["primitives"]]
    triangles = sum(
        menu["accessors"][primitive.get("indices", primitive["attributes"]["POSITION"])]["count"] // 3
        for primitive in primitives
    )
    print(f"{DESTINATION.name}: {DESTINATION.stat().st_size:,} bytes, {triangles:,} triangles, "
          f"{len(primitives)} mesh primitives, {len(menu.get('images', []))} embedded image(s)")


if __name__ == "__main__":
    main()
