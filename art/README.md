# Persian lounge assets

Original assets made for this game in Blender. The scene includes an oval walnut card table, four upholstered chairs, a Persian garden rug, two plants in ceramic pots, a linen floor lamp, a small side table, and four finished plaster walls with large windows. Outside, a simple meadow, five trees, and a curved limestone path give the room a quiet garden setting.

## Files

- `blender/persian-lounge.blend`: editable Blender source.
- `blender/build_lounge.py`: repeatable Blender construction and export script.
- `blender/persian-lounge.stats.json`: generated mesh counts and export size from Blender; not tracked in Git.
- `textures/make_rug.py`: original rug pattern generator; requires Pillow.
- `textures/persian-rug.png`: rug color texture, embedded in the GLB.
- `export_menu_model.py`: standard-library Python helper that extracts menu furniture from the full GLB.
- `../public/models/persian-lounge.glb`: full in-game browser asset.
- `../public/models/persian-lounge-menu.glb`: smaller home and setup screen asset.

## Edit and export

Open the Blend file in Blender to edit the model directly. For a full rebuild, first set `ROOT` in `build_lounge.py` to this repository. Run that script inside Blender's Python console or Text Editor. It creates a new scene, preserves the existing scene, and exports a GLB with the texture included. The game loads the GLB with Three.js.

Keep the named `Table`, `ChairNorth`, `ChairSouth`, `ChairEast`, `ChairWest`, `Room`, `Rug`, `Decor`, `BackWall`, `FrontWall`, `LeftWall`, `RightWall`, and `Exterior` groups. Seat upholstery materials start with `UpholsteryNorth`, `UpholsterySouth`, `UpholsteryEast`, and `UpholsteryWest`; the game uses these for turn indication. Table surface height must remain below the cards at Y = 0.66. The floor is Y = -1.90. Export uses Y up.

The saved Blender viewport hides the front and right walls to show the room. Use Alt+H in the viewport to reveal them. The GLB includes every wall. Back/front walls are at Z = ±9.85; side walls are at X = ±11.85. Update the matching camera cutaway limits in `TableEnvironment.ts` if these positions change.

After each full GLB export, rebuild the menu asset from the repository root:

```sh
python art/export_menu_model.py
```

The helper preserves the exact `Table`, four chair, `Rug`, and `Decor` groups, including transforms, geometry, normals, UVs, materials, and embedded rug image. It removes other groups and compacts unused glTF resources and binary buffer data. It requires no Blender session or Python packages and does not change the full GLB. It rejects animated or extension-based exports instead of silently losing their resource references.

## Browser budget

The exported GLB is 1,223,788 bytes, with 27,686 triangles and 58 mesh primitives for the complete room and garden. It includes one 1024 × 768 rug texture. The meadow uses vertex colors, and the windows use thin alpha-blended panes without a refraction pass. No external model decoder is required.

The menu GLB is 702,616 bytes, with 15,618 triangles and 35 mesh primitives. It retains the same rug image and saves 521,172 bytes (43%) compared with loading the full room. Home and setup screens load only this smaller asset; their room lighting background uses CSS without more model geometry or textures.

Static meshes are joined by material within each group. The scene uses shared PBR materials, small embedded textures, one shadow light, and capped texture anisotropy. It has no animation rig, physics, bloom, or post-processing pass. The existing mobile resolution cap and shadow policy remain in use. During camera rotation, walls between the camera and the table hide so they do not block play. Glass and exterior meshes do not enter the shadow pass.

The runtime has a small fallback table if the GLB cannot load. It releases geometry, materials, textures, and decoded images on scene removal, including models that complete loading after removal.

Playing cards use shared, closed rounded geometry with face, back, and edge materials. Card artwork is drawn at 512 × 720 with capped 8× anisotropy. Face textures remain in memory only while live or retiring cards use them. The selection outline is hollow; selection does not raise, enlarge, or reorder a card.

All model geometry and rug artwork in this directory are original project assets. No third-party model or texture attribution is required.
