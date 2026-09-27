"""Build the hand-authored Shelem lounge in a new Blender scene.

Run from Blender's Python console:
    exec(compile(open(r'C:\\src\\Shelem\\art\\blender\\build_lounge.py',
                      encoding='utf-8').read(), 'build_lounge.py', 'exec'))

Coordinates in the construction helpers are Three.js coordinates (Y up).
The mesh writer maps these to Blender's Z-up coordinates. GLB export maps
them back to Y up. All dimensions are game units. No external add-ons.
"""

import bpy
import json
import math
import os
from collections import defaultdict
from mathutils import Vector


ROOT = r"C:\src\Shelem"
MODEL_PATH = os.path.join(ROOT, "public", "models", "persian-lounge.glb")
BLEND_PATH = os.path.join(ROOT, "art", "blender", "persian-lounge.blend")
STATS_PATH = os.path.join(ROOT, "art", "blender", "persian-lounge.stats.json")
RUG_PATH = os.path.join(ROOT, "art", "textures", "persian-rug.png")
FLOOR = -1.90
WALL_X = 11.85
WALL_Z = 9.85
WALL_TOP = 7.10
TAU = math.tau

# Keep the user's current scene and its objects. This script owns a new scene.
scene = bpy.data.scenes.new("Shelem | Persian lounge")
bpy.context.window.scene = scene
scene.unit_settings.system = "METRIC"
scene.render.engine = "BLENDER_EEVEE" if bpy.app.version >= (5, 0, 0) else "BLENDER_EEVEE_NEXT"
scene.world = bpy.data.worlds.new("Lounge preview world")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.16, 0.13, 0.10, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7
scene.view_settings.view_transform = "AgX"


def linear_channel(v):
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def rgb(hex_color):
    text = hex_color.lstrip("#")
    return tuple(linear_channel(int(text[i:i + 2], 16) / 255) for i in (0, 2, 4))


def material(name, color, roughness=0.65, metallic=0.0, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    rgba = (*rgb(color), 1)
    mat.diffuse_color = rgba
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*rgb(emission), 1)
        bsdf.inputs["Emission Strength"].default_value = 0.3
    return mat


walnut = material("Lounge | oiled walnut", "684A35", 0.34)
walnut_edge = material("Lounge | walnut end grain", "493323", 0.43)
brass = material("Lounge | brushed aged brass", "B89A5A", 0.36, 0.68)
felt = material("Lounge | forest wool baize", "284F42", 0.94)
upholstery = material("Lounge | warm flax upholstery", "BFA784", 0.91)
chair_upholstery = {}
for direction in ("North", "South", "East", "West"):
    mat_name = "Upholstery" + direction
    old_mat = bpy.data.materials.get(mat_name)
    if old_mat and old_mat.get("authored_for") == "Shelem browser game":
        old_mat.name = "Previous lounge | " + mat_name
    chair_mat = upholstery.copy()
    chair_mat.name = mat_name
    chair_mat["authored_for"] = "Shelem browser game"
    chair_upholstery["Chair" + direction] = chair_mat
piping = material("Lounge | upholstery welt", "927C5E", 0.82)
floor_mat = material("Lounge | smoked oak floor", "8C7760", 0.78)
floor_edge = material("Lounge | floor seams", "675642", 0.83)
wall_mat = material("Lounge | warm plaster", "B9AA92", 0.95)
window_frame = material("Lounge | charcoal bronze window frame", "363D38", 0.38, 0.45)
glass = material("Lounge | clear window glass", "C3DBD7", 0.16, 0.08)
glass_bsdf = glass.node_tree.nodes["Principled BSDF"]
glass_bsdf.inputs["Alpha"].default_value = 0.065
glass_bsdf.inputs["IOR"].default_value = 1.45
glass.diffuse_color = (*rgb("C3DBD7"), 0.065)
# A thin alpha-blended pane avoids transmission render targets and refraction.
if hasattr(glass, "surface_render_method"):
    glass.surface_render_method = "BLENDED"
elif hasattr(glass, "blend_method"):
    glass.blend_method = "BLEND"
terrace_mat = material("Lounge | honed limestone terrace", "BBB7A4", 0.86)
meadow_mat = material("Lounge | quiet sage meadow", "939B7C", 1.0)
tree_bark = material("Lounge | olive tree bark", "77725E", 0.95)
tree_cypress = material("Lounge | cypress foliage", "667B63", 0.96)
tree_olive = material("Lounge | silver olive foliage", "8C9B79", 0.97)
pot_mat = material("Lounge | celadon ceramic", "67847B", 0.32)
pot_terra = material("Lounge | earthenware", "A37153", 0.77)
soil = material("Lounge | soil", "30291E", 1.0)
leaf_dark = material("Lounge | leaf shadow", "345343", 0.62)
leaf_light = material("Lounge | leaf face", "587252", 0.6)
stem_mat = material("Lounge | stems", "566343", 0.8)
linen = material("Lounge | illuminated linen", "E6D4B0", 0.96, emission="D8AE66")
book_red = material("Lounge | oxblood cloth", "7D493C", 0.86)
book_pages = material("Lounge | book paper", "CCBA94", 0.92)
rug_edge = material("Lounge | rug binding", "733F39", 1.0)
rug_fringe = material("Lounge | rug fringe", "C1AA82", 1.0)
rug_mat = material("Lounge | Persian woven rug", "885249", 1.0)

if os.path.exists(RUG_PATH):
    rug_image = bpy.data.images.load(RUG_PATH, check_existing=True)
    rug_image.colorspace_settings.name = "sRGB"
    rug_image.pack()
    tex = rug_mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = rug_image
    tex.interpolation = "Linear"
    rug_mat.node_tree.links.new(tex.outputs["Color"],
                              rug_mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
else:
    print("Rug texture missing; export uses burgundy base color:", RUG_PATH)

groups = {}
for name in ("Table", "ChairNorth", "ChairSouth", "ChairEast", "ChairWest", "Room", "Rug", "Decor",
             "BackWall", "FrontWall", "LeftWall", "RightWall", "Exterior"):
    old_group = bpy.data.objects.get(name)
    if old_group and old_group.get("asset") == "Shelem Persian lounge":
        old_group.name = "Previous lounge | " + name
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj["asset"] = "Shelem Persian lounge"
    groups[name] = obj


def native(p):
    return (p[0], -p[2], p[1])


def mesh(name, vertices, faces, mat, group, smooth=False, uv=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata([native(p) for p in vertices], [], faces)
    data.materials.append(mat)
    data.update()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.parent = groups[group]
    if smooth:
        for polygon in data.polygons:
            polygon.use_smooth = True
    if uv is not None:
        layer = data.uv_layers.new(name="UVMap")
        for polygon in data.polygons:
            for loop_index in polygon.loop_indices:
                layer.data[loop_index].uv = uv[data.loops[loop_index].vertex_index]
    return obj


def rotate_y(p, angle):
    c, s = math.cos(angle), math.sin(angle)
    return (p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c)


def transformed(points, center, angle=0):
    return [tuple(a + b for a, b in zip(rotate_y(p, angle), center)) for p in points]


def bevel_box(name, center, size, mat, group, bevel=0.04, angle=0):
    x, y, z = (v / 2 for v in size)
    vertices = [(-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z),
                (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
             (3, 7, 6, 2), (0, 4, 7, 3), (1, 2, 6, 5)]
    obj = mesh(name, transformed(vertices, center, angle), faces, mat, group)
    if bevel:
        mod = obj.modifiers.new("Small crafted edge", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.affect = "EDGES"
        mod.harden_normals = True
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=mod.name)
        obj.select_set(False)
        normal = obj.modifiers.new("Face weighted normals", "WEIGHTED_NORMAL")
        normal.keep_sharp = True
        normal.weight = 50
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=normal.name)
        obj.select_set(False)
    return obj


def ring_surface(name, profile, mat, group, segments=64, center=(0, 0, 0), close=True):
    """Profile points are elliptical radius X, radius Z, height Y."""
    vertices = []
    for rx, rz, y in profile:
        vertices += [(center[0] + math.cos(i * TAU / segments) * rx,
                      center[1] + y,
                      center[2] + math.sin(i * TAU / segments) * rz)
                     for i in range(segments)]
    faces = []
    for layer in range(len(profile) - 1):
        for i in range(segments):
            j = (i + 1) % segments
            a, b = layer * segments, (layer + 1) * segments
            faces.append((a + i, b + i, b + j, a + j))
    if close:
        faces.append(tuple(range(segments)))
        faces.append(tuple((len(profile) - 1) * segments + i for i in reversed(range(segments))))
    obj = mesh(name, vertices, faces, mat, group, smooth=True)
    if close:
        obj.data.polygons[-2].use_smooth = False
        obj.data.polygons[-1].use_smooth = False
    return obj


def tube(name, points, radius, mat, group, sides=8):
    pts = [Vector(p) for p in points]
    vertices = []
    for index, point in enumerate(pts):
        tangent = (pts[min(index + 1, len(pts) - 1)] - pts[max(0, index - 1)]).normalized()
        helper = Vector((0, 1, 0)) if abs(tangent.y) < 0.92 else Vector((1, 0, 0))
        right = tangent.cross(helper).normalized()
        up = tangent.cross(right).normalized()
        for i in range(sides):
            p = point + radius * (right * math.cos(i * TAU / sides) + up * math.sin(i * TAU / sides))
            vertices.append(tuple(p))
    faces = []
    for j in range(len(pts) - 1):
        for i in range(sides):
            k = (i + 1) % sides
            faces.append((j * sides + i, j * sides + k, (j + 1) * sides + k, (j + 1) * sides + i))
    faces += [tuple(reversed(range(sides))), tuple((len(pts) - 1) * sides + i for i in range(sides))]
    return mesh(name, vertices, faces, mat, group, smooth=True)


def rounded_path(width, depth, radius, steps=5):
    points = []
    for cx, cz, start in ((width / 2 - radius, depth / 2 - radius, 0),
                          (-width / 2 + radius, depth / 2 - radius, math.pi / 2),
                          (-width / 2 + radius, -depth / 2 + radius, math.pi),
                          (width / 2 - radius, -depth / 2 + radius, 3 * math.pi / 2)):
        for i in range(steps + 1):
            a = start + i * math.pi / (2 * steps)
            points.append((cx + radius * math.cos(a), cz + radius * math.sin(a)))
    return points


def cushion(name, center, width, depth, height, group, angle=0, upright=False, fabric=None):
    path = rounded_path(width, depth, min(width, depth) * 0.22)
    vertices = []
    # Gently domed upholstery: curved perimeter and one broad, quiet top face.
    for scale, y in ((0.89, -height / 2), (1.0, -height * 0.15), (0.99, height * 0.25), (0.85, height / 2)):
        for x, z in path:
            point = (x * scale, y, z * scale)
            if upright:
                point = (point[0], point[2], -point[1])
            vertices.append(point)
    n = len(path)
    faces = []
    for j in range(3):
        for i in range(n):
            k = (i + 1) % n
            faces.append((j * n + i, (j + 1) * n + i, (j + 1) * n + k, j * n + k))
    faces += [tuple(range(n)), tuple(3 * n + i for i in reversed(range(n)))]
    mesh(name, transformed(vertices, center, angle), faces, fabric or upholstery, group, smooth=True)
    welt_points = []
    for x, z in path + [path[0]]:
        p = (x * 0.997, height * 0.02, z * 0.997)
        if upright:
            p = (p[0], p[2], -p[1])
        welt_points.append(p)
    tube(name + " welt", transformed(welt_points, center, angle), 0.015, piping, group, sides=5)


# The table keeps the existing gameplay surface height and footprint.
ring_surface("Walnut sculpted table edge", [(5.22, 3.07, .34), (5.53, 3.38, .42),
             (5.65, 3.50, .52), (5.64, 3.49, .60), (5.57, 3.42, .66),
             (5.20, 3.05, .66), (5.18, 3.03, .61)], walnut, "Table", 96, close=False)
ring_surface("Table underside", [(5.20, 3.05, .32), (5.22, 3.07, .36)], walnut_edge, "Table", 64)
ring_surface("Recessed green baize", [(5.185, 3.035, .61), (5.185, 3.035, .646)], felt, "Table", 96)
ring_surface("Single brass hairline inlay", [(5.42, 3.27, .662), (5.395, 3.245, .662)], brass, "Table", 96, close=False)
ring_surface("Inner felt welt", [(5.23, 3.08, .65), (5.19, 3.04, .65)], walnut_edge, "Table", 96, close=False)

# Two splayed trestles, rather than a block beneath the tabletop.
for x in (-2.75, 2.75):
    bevel_box("Trestle crosshead", (x, .12, 0), (.42, .46, 3.9), walnut, "Table", .10)
    for z in (-1.55, 1.55):
        tube("Splayed trestle support", [(x, -.02, z * .60), (x, -1.48, z)], .18, walnut, "Table", 8)
        bevel_box("Brass furniture foot", (x, -1.79, z), (.36, .12, .39), brass, "Table", .035)
    bevel_box("Trestle floor rail", (x, -1.65, 0), (.43, .24, 3.6), walnut, "Table", .10)
bevel_box("Low central stretcher", (0, -1.25, 0), (5.65, .24, .27), walnut, "Table", .05)


def chair(name, center, angle):
    def p(point):
        return transformed([point], center, angle)[0]

    cushion(name + " seat", p((0, .01, 0)), 1.83, 1.68, .32, name, angle,
            fabric=chair_upholstery[name])
    bevel_box(name + " seat frame", p((0, -.21, 0)), (1.71, .22, 1.52), walnut, name, .07, angle)
    # The back curves slightly away from the sitter; exposed walnut uprights
    # give the fabric a clear frame and keep the chair visually light.
    for x in (-.72, .72):
        for z in (-.57, .57):
            start = p((x, -.23, z))
            end = p((x * 1.09, FLOOR + .08, z * 1.12))
            tube(name + " tapered leg", [start, end], .065, walnut, name, 8)
            tube(name + " leg shoe", [p((x * 1.09, FLOOR + .08, z * 1.12)),
                                        p((x * 1.09, FLOOR + .18, z * 1.12))], .069, brass, name, 8)
        tube(name + " bent back upright", [p((x, -.2, -.61)), p((x, .54, -.74)),
                                              p((x * .97, 1.36, -.89))], .075, walnut, name, 8)
    cushion(name + " back", p((0, .86, -.86)), 1.75, 1.26, .27, name, angle,
            upright=True, fabric=chair_upholstery[name])
    # Rear rail and side stretchers are below the fabric and stay unobtrusive.
    tube(name + " lower back rail", [p((-.73, .29, -.7)), p((.73, .29, -.7))], .055, walnut, name, 8)
    for x in (-.75, .75):
        tube(name + " side stretcher", [p((x, -.96, -.61)), p((x, -.96, .61))], .039, walnut, name, 6)


chair("ChairNorth", (0, 0, -4.45), 0)
chair("ChairSouth", (0, 0, 4.45), math.pi)
chair("ChairEast", (6.05, 0, 0), -math.pi / 2)
chair("ChairWest", (-6.05, 0, 0), math.pi / 2)

# A single floor mesh, with sparse fine joints; the rug covers the center.
bevel_box("Finite oak room floor", (0, FLOOR - .09, 0), (24, .18, 20), floor_mat, "Room", .06)
for z in range(-9, 10):
    bevel_box("Oak board joint", (0, FLOOR + .004, float(z)), (23.96, .004, .012), floor_edge, "Room", 0)
    for x in (-8.0 + (z % 3) * 1.8, -2.0 + (z % 3) * 1.8, 4.0 + (z % 3) * 1.8):
        bevel_box("Staggered plank end", (x, FLOOR + .005, z + .5), (.009, .004, .985), floor_edge, "Room", 0)

def window_wall(name, center, width, opening_width, angle=0):
    """Local wall faces +Z into the room; an orbit can hide each whole group."""
    bottom, top = -.92, 5.76
    middle = (bottom + top) / 2
    opening_height = top - bottom
    pier_width = (width - opening_width) / 2

    def part(label, at, size, mat, bevel=.018):
        return bevel_box(label, transformed([at], center, angle)[0], size, mat, name, bevel, angle)

    # Solid lower wall, broad plaster piers, and a header make real openings.
    part("Plaster wall below glazing", (0, (FLOOR + bottom) / 2, 0),
         (width, bottom - FLOOR, .30), wall_mat, .025)
    part("Plaster wall above glazing", (0, (top + WALL_TOP) / 2, 0),
         (width, WALL_TOP - top, .30), wall_mat, .025)
    for side in (-1, 1):
        part("Plaster window pier", (side * (width - pier_width) / 2, middle, 0),
             (pier_width, opening_height + .035, .30), wall_mat, .025)
    part("Continuous oak baseboard", (0, FLOOR + .13, .175), (width, .26, .08), walnut, .015)
    part("Oak ceiling edge", (0, WALL_TOP - .12, .18), (width, .24, .12), walnut, .025)
    part("Deep oak window sill", (0, bottom - .025, .13), (opening_width + .28, .12, .64), walnut, .025)
    part("Oak window lintel", (0, top + .045, .14), (opening_width + .20, .14, .12), walnut, .015)

    # Narrow modern frames, three mullions, and four single-surface panes.
    for side in (-1, 1):
        part("Outer window jamb", (side * (opening_width / 2 - .047), middle, .04),
             (.094, opening_height, .18), window_frame, .008)
    for y in (bottom + .046, top - .046):
        part("Horizontal window frame", (0, y, .04), (opening_width, .092, .18), window_frame, .008)
    pane_width = opening_width / 4
    for divider in (-1, 0, 1):
        part("Slender window mullion", (divider * pane_width, middle, .04),
             (.070, opening_height, .145), window_frame, .006)
    for pane in range(4):
        left = -opening_width / 2 + pane * pane_width + .048
        right = left + pane_width - .096
        points = [(left, bottom + .065, .035), (right, bottom + .065, .035),
                  (right, top - .065, .035), (left, top - .065, .035)]
        pane_obj = mesh("Clear architectural glass", transformed(points, center, angle),
                        [(0, 1, 2, 3)], glass, name)
        pane_obj["glazing"] = True


# Four complete walls keep the space finished from every table seat.
# The runtime hides only a wall between the orbit camera and the table.
window_wall("BackWall", (0, 0, -WALL_Z), 24, 18.5)
window_wall("FrontWall", (0, 0, WALL_Z), 24, 18.5, math.pi)
window_wall("LeftWall", (-WALL_X, 0, 0), 19.4, 14.5, math.pi / 2)
window_wall("RightWall", (WALL_X, 0, 0), 19.4, 14.5, -math.pi / 2)
for name, axis, coordinate in (("BackWall", "z", -WALL_Z), ("FrontWall", "z", WALL_Z),
                               ("LeftWall", "x", -WALL_X), ("RightWall", "x", WALL_X)):
    groups[name]["wall_axis"] = axis
    groups[name]["wall_coordinate"] = coordinate
    groups[name]["wall_top"] = WALL_TOP
groups["Exterior"]["casts_shadow"] = False

# A quiet garden is visible through the glass. This is one low-resolution
# smooth land mesh, five trees, and a narrow stone terrace, with no textures.
for x in (-13.45, 13.45):
    bevel_box("Limestone side terrace", (x, FLOOR - .17, 0), (2.9, .12, 25.8), terrace_mat, "Exterior", .03)
for z in (-11.45, 11.45):
    bevel_box("Limestone end terrace", (0, FLOOR - .17, z), (24, .12, 2.9), terrace_mat, "Exterior", .03)


def landscape_height(x, z):
    distance = math.hypot(x, z)
    influence = max(0, min(1, (distance - 19) / 13))
    hills = 0
    for cx, cz, height, spread in ((-36, -39, 5.3, 26), (35, -51, 7.0, 33),
                                   (56, 24, 6.8, 34), (-47, 39, 5.9, 31),
                                   (3, 70, 5.5, 35)):
        hills += height * math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / spread ** 2)
    return FLOOR - .30 + influence * hills


land_vertices = [(0, FLOOR - .30, 0)]
land_radii = (14, 18, 24, 32, 44, 60, 82, 110, 150, 230, 380)
land_segments = 96
for radius in land_radii:
    for i in range(land_segments):
        angle = i * TAU / land_segments
        x, z = radius * math.cos(angle), radius * math.sin(angle)
        land_vertices.append((x, landscape_height(x, z), z))
land_faces = []
for i in range(land_segments):
    j = (i + 1) % land_segments
    land_faces.append((0, 1 + j, 1 + i))
for row in range(len(land_radii) - 1):
    inner, outer = 1 + row * land_segments, 1 + (row + 1) * land_segments
    for i in range(land_segments):
        j = (i + 1) % land_segments
        land_faces.append((inner + i, inner + j, outer + j, outer + i))
land = mesh("Soft rolling garden landscape", land_vertices, land_faces, meadow_mat, "Exterior", smooth=True)
# Broad changes in grass color help the ground read as a landscape through
# clear glass. Vertex colors add no image download and no material draw call.
meadow_colors = land.data.color_attributes.new(name="MeadowTint", type="FLOAT_COLOR", domain="CORNER")
near_grass, far_grass = rgb("889472"), rgb("B5BA98")
for loop in land.data.loops:
    x, y, z = land_vertices[loop.vertex_index]
    distance = math.hypot(x, z)
    distance_mix = max(0, min(1, (distance - 16) / 68))
    broad_variation = .055 * math.sin(x * .115 + z * .08) + .035 * math.cos(z * .16 - x * .025)
    mix = max(0, min(1, distance_mix + broad_variation))
    meadow_colors.data[loop.index].color = (*tuple(a * (1 - mix) + b * mix
                                                 for a, b in zip(near_grass, far_grass)), 1)
vertex_color = meadow_mat.node_tree.nodes.new("ShaderNodeVertexColor")
vertex_color.layer_name = "MeadowTint"
meadow_mat.node_tree.links.new(vertex_color.outputs["Color"],
                              meadow_mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"])

# A single low-poly path curves behind the room, in front of the rear trees.
# Sample the actual land surface to keep the strip on the slopes.
bpy.context.view_layer.update()
path_vertices, path_faces = [], []
for i in range(41):
    x = -42 + i * 2.1
    z = -16.5 - 9 * (x / 42) ** 2
    slope = -18 * x / 42 ** 2
    normal = Vector((-slope, 1)).normalized()
    for side in (-1, 1):
        px, pz = x + side * normal.x * .74, z + side * normal.y * .74
        hit, location, _, _ = land.ray_cast(Vector((px, -pz, 100)), Vector((0, 0, -1)))
        height = location.z if hit else landscape_height(px, pz)
        path_vertices.append((px, height + .025, pz))
    if i:
        a = (i - 1) * 2
        path_faces.append((a, a + 1, a + 3, a + 2))
mesh("Curved limestone garden path", path_vertices, path_faces, terrace_mat, "Exterior")


def foliage_crown(name, center, radius, height, mat, seed=0):
    """A softly lobed botanical silhouette with a narrow tip, 160 triangles."""
    vertices = []
    segments = 16
    profiles = ((.10, 0), (.74, .14), (1.0, .37), (.90, .60), (.56, .82), (.045, 1.0))
    for profile_radius, t in profiles:
        for i in range(segments):
            a = i * TAU / segments
            irregularity = 1 + .10 * math.sin(a * 3 + seed) + .045 * math.cos(a * 5 - t * 3)
            r = radius * profile_radius * irregularity
            vertices.append((center[0] + math.cos(a) * r + t * .12 * math.sin(seed),
                             center[1] + height * t,
                             center[2] + math.sin(a) * r * .83))
    faces = []
    for row in range(len(profiles) - 1):
        for i in range(segments):
            j = (i + 1) % segments
            inner, outer = row * segments, (row + 1) * segments
            faces.append((inner + i, outer + i, outer + j, inner + j))
    faces += [tuple(range(segments)),
              tuple((len(profiles) - 1) * segments + i for i in reversed(range(segments)))]
    mesh(name, vertices, faces, mat, "Exterior", smooth=True)


for index, (x, z, height) in enumerate(((-6, -20, 4.2), (7, -24, 4.7), (-3, 22, 5.2))):
    ground = landscape_height(x, z)
    tube("Garden cypress trunk", [(x, ground, z), (x, ground + height * .52, z)], .15,
         tree_bark, "Exterior", 8)
    foliage_crown("Slender garden cypress", (x, ground + .6, z), height * .14, height,
                  tree_cypress, index * 1.7)
for index, (x, z) in enumerate(((19, 1), (-19, -1))):
    ground = landscape_height(x, z)
    tube("Sculpted olive trunk", [(x, ground, z), (x + .20, ground + 1.9, z - .12),
                                  (x - .10, ground + 3.5, z + .06)], .17, tree_bark, "Exterior", 8)
    for branch in range(3):
        a = branch * TAU / 3 + index * .70
        bx, bz = x + math.cos(a) * 1.18, z + math.sin(a) * 1.18
        tube("Open olive branch", [(x + .10, ground + 2.1, z), (bx, ground + 3.8, bz)],
             .085, tree_bark, "Exterior", 7)
        foliage_crown("Silver olive crown", (bx, ground + 3.0 + branch * .22, bz), 1.75, 3.0,
                      tree_olive, index + branch * 1.9)

# The rug uses one embedded color texture and two triangles on its top face.
bevel_box("Woven rug body", (0, -1.875, 0), (16.10, .042, 12.10), rug_edge, "Rug", .025)
mesh("Persian rug face", [(-8, -1.851, -6), (8, -1.851, -6),
                         (8, -1.851, 6), (-8, -1.851, 6)],
     [(3, 2, 1, 0)], rug_mat, "Rug", uv=[(0, 0), (1, 0), (1, 1), (0, 1)])
# Short flat grouped fringe gives the edge a woven silhouette at little cost.
for side in (-1, 1):
    verts, faces = [], []
    for i in range(96):
        x = -7.86 + i * 15.72 / 95
        z0 = side * 6.01
        z1 = side * (6.20 + .028 * math.sin(i * 2.4))
        n = len(verts)
        verts += [(x - .022, -1.868, z0), (x + .022, -1.868, z0),
                  (x + .018, -1.868, z1), (x - .018, -1.868, z1)]
        faces.append((n + 3, n + 2, n + 1, n) if side > 0 else (n, n + 1, n + 2, n + 3))
    mesh("Knotted rug fringe", verts, faces, rug_fringe, "Rug")


def leaf(name, start, direction, length, width, mat):
    """A pointed, bowed leaf with a central folded vein, not a sphere."""
    direction = Vector(direction).normalized()
    across = direction.cross(Vector((0, 1, 0)))
    if across.length < .01:
        across = Vector((1, 0, 0))
    across.normalize()
    root = Vector(start)
    verts = []
    sections = 7
    for i in range(sections):
        t = i / (sections - 1)
        center = root + direction * (length * t)
        center.y += math.sin(t * math.pi) * length * .18 - t * t * length * .15
        half = max(.008, math.sin(t * math.pi) ** .75 * width / 2)
        fold = math.sin(t * math.pi) * width * .08
        verts += [tuple(center - across * half - Vector((0, fold, 0))),
                  tuple(center + Vector((0, fold, 0))),
                  tuple(center + across * half - Vector((0, fold, 0)))]
    faces = []
    for i in range(sections - 1):
        a, b = i * 3, (i + 1) * 3
        faces += [(a, b, b + 1, a + 1), (a + 1, b + 1, b + 2, a + 2)]
    # Solid thickness costs very few triangles and exports reliably two-sided.
    count = len(verts)
    verts += [(x, y - .012, z) for x, y, z in verts]
    faces += [tuple(count + i for i in reversed(face)) for face in list(faces)]
    for side_index in (0, 2):
        for i in range(sections - 1):
            a, b = i * 3 + side_index, (i + 1) * 3 + side_index
            faces.append((a, b, count + b, count + a))
    mesh(name, verts, faces, mat, "Decor", smooth=True)


def plant(center, variant=0):
    x, z = center
    scale = 1 if variant == 0 else .85
    h = .88 * scale
    radius = .56 * scale
    ceramic = pot_mat if variant == 0 else pot_terra
    ring_surface("Hand thrown planter", [(radius * .69, radius * .69, FLOOR + .04),
                 (radius * .80, radius * .80, FLOOR + .09),
                 (radius, radius, FLOOR + h - .07),
                 (radius * .98, radius * .98, FLOOR + h),
                 (radius * .88, radius * .88, FLOOR + h),
                 (radius * .84, radius * .84, FLOOR + h - .14)], ceramic, "Decor", 32,
                 (x, 0, z), close=False)
    ring_surface("Pot foot", [(radius * .67, radius * .67, FLOOR + .02),
                 (radius * .69, radius * .69, FLOOR + .07)], ceramic, "Decor", 24, (x, 0, z))
    ring_surface("Soil surface", [(radius * .83, radius * .83, FLOOR + h - .09),
                 (radius * .83, radius * .83, FLOOR + h - .085)], soil, "Decor", 24, (x, 0, z))
    top = FLOOR + h - .04
    for branch in range(5):
        a = branch * 2.39996 + variant * .7
        height = (1.82 + .25 * math.sin(branch * 3.1)) * scale
        offset = .25 * scale
        tip = (x + math.cos(a) * offset, top + height, z + math.sin(a) * offset)
        mid = (x + math.cos(a) * .10, top + height * .5, z + math.sin(a) * .10)
        tube("Living plant stem", [(x, top, z), mid, tip], .022 * scale, stem_mat, "Decor", 6)
        for j in range(4):
            t = .30 + j * .205
            start = (x + math.cos(a) * offset * t, top + height * t, z + math.sin(a) * offset * t)
            azimuth = a + j * 2.15
            length = (.72 + .15 * math.sin(branch + j)) * scale
            direction = (math.cos(azimuth), .35 - j * .07, math.sin(azimuth))
            leaf("Sculpted botanical leaf", start, direction, length, .40 * scale,
                 leaf_dark if (branch + j) % 3 == 0 else leaf_light)


plant((-7.15, -4.75), 0)
plant((7.15, -4.75), 1)

# One warm reading lamp, quiet enough to leave the game as the focal point.
lamp_x, lamp_z = 7.5, 1.8
ring_surface("Lamp weighted foot", [(.53, .53, FLOOR + .02), (.57, .57, FLOOR + .06),
             (.55, .55, FLOOR + .12), (.35, .35, FLOOR + .16)], brass, "Decor", 40, (lamp_x, 0, lamp_z))
tube("Slender lamp standard", [(lamp_x, FLOOR + .14, lamp_z), (lamp_x, 1.86, lamp_z)], .047, brass, "Decor", 12)
# Open linen shade has a real inner wall; no expensive transparency.
ring_surface("Tapered linen lamp shade", [(.80, .80, 1.18), (.48, .48, 2.28),
             (.44, .44, 2.28), (.75, .75, 1.18), (.80, .80, 1.18)], linen, "Decor", 48,
             (lamp_x, 0, lamp_z), close=False)
for r, y in ((.79, 1.18), (.465, 2.28)):
    ring_surface("Shade rolled linen edge", [(r, r, y - .017), (r, r, y + .017)], upholstery, "Decor", 48,
                 (lamp_x, 0, lamp_z), close=False)

# Small walnut side stand with two cloth books and one ceramic bud vase.
sx, sz = -7.4, 1.2
ring_surface("Side stand top", [(.90, .90, -.64), (.94, .94, -.57), (.91, .91, -.50)], walnut, "Decor", 40,
             (sx, 0, sz))
for a in (0, TAU / 3, TAU * 2 / 3):
    tube("Side stand splayed leg", [(sx + math.cos(a) * .57, -.66, sz + math.sin(a) * .57),
                                    (sx + math.cos(a) * .69, FLOOR + .05, sz + math.sin(a) * .69)],
         .054, walnut, "Decor", 8)
for i, angle in enumerate((.08, -.11)):
    y = -.44 + i * .13
    center = (sx + .21, y, sz + .18)
    bevel_box("Clothbound book pages", center, (.66, .09, .47), book_pages, "Decor", .012, angle)
    for dy in (-.056, .056):
        bevel_box("Clothbound book cover", (center[0], y + dy, center[2]), (.70, .019, .50), book_red,
                   "Decor", .007, angle)
ring_surface("Glazed bud vase", [(.14, .14, -.49), (.24, .24, -.43), (.26, .26, -.22),
             (.18, .18, -.02), (.075, .075, .09), (.073, .073, .20),
             (.051, .051, .20), (.052, .052, .10)], pot_mat, "Decor", 24,
             (sx - .31, 0, sz - .22), close=False)

# Merge by shared material inside each semantic group. Transforms are baked
# into the meshes; named top-level groups remain easy to edit or hide.
bpy.ops.object.select_all(action="DESELECT")
for group_name, parent in groups.items():
    by_material = defaultdict(list)
    for obj in list(parent.children):
        if obj.type == "MESH":
            by_material[obj.data.materials[0].name].append(obj)
    for mat_name, objects in by_material.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects) > 1:
            bpy.ops.object.join()
        merged = bpy.context.view_layer.objects.active
        merged.name = group_name + " | " + mat_name.split(" | ")[-1]
        if group_name == "Room" and mat_name == floor_mat.name:
            previous_floor = bpy.data.objects.get("RoomFloor")
            if previous_floor and previous_floor.get("authored_for") == "Shelem browser game":
                previous_floor.name = "Previous lounge | RoomFloor"
            merged.name = "RoomFloor"
        merged.parent = parent
        merged["authored_for"] = "Shelem browser game"
        merged["static"] = True
        if mat_name == glass.name:
            merged["glazing"] = True
        if group_name == "Exterior" or mat_name == glass.name:
            merged["casts_shadow"] = False

# Configure a useful material-color preview without adding exported lights.
for window in bpy.context.window_manager.windows:
    for area in window.screen.areas:
        if area.type == "VIEW_3D":
            area.spaces.active.shading.type = "SOLID"
            area.spaces.active.shading.color_type = "MATERIAL"
            area.spaces.active.shading.light = "STUDIO"
            area.spaces.active.shading.show_shadows = True
            area.spaces.active.shading.show_cavity = True
            area.spaces.active.overlay.show_floor = False
            area.spaces.active.overlay.show_axis_x = False
            area.spaces.active.overlay.show_axis_y = False
            region_3d = area.spaces.active.region_3d
            region_3d.view_distance = 25
            region_3d.view_location = (0, 0, 0)
            # Look down across the table from the player's side.
            region_3d.view_rotation = Vector((0.65, -1.0, 1.2)).to_track_quat("Z", "Y")

bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = groups["Table"]
os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=MODEL_PATH, export_format="GLB", use_selection=True, use_active_scene=True,
                          export_yup=True, export_apply=True, export_materials="EXPORT",
                          export_texcoords=True, export_normals=True,
                          export_animations=False, export_cameras=False, export_lights=False,
                          export_extras=True, export_image_format="AUTO")
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

stats = {"asset": "Shelem Persian lounge", "glb_bytes": os.path.getsize(MODEL_PATH),
         "floor_y": FLOOR, "table_surface_y": .646, "groups": {},
         "mesh_count": 0, "triangles": 0, "vertices": 0,
         "rug_texture_embedded": os.path.exists(RUG_PATH),
         "room_bounds": {"x": [-WALL_X, WALL_X], "z": [-WALL_Z, WALL_Z],
                         "floor_y": FLOOR, "wall_top_y": WALL_TOP},
         "exterior_radius": 380}
for name, group in groups.items():
    entry = {"meshes": 0, "triangles": 0, "vertices": 0}
    for obj in group.children:
        if obj.type == "MESH":
            obj.data.calc_loop_triangles()
            entry["meshes"] += 1
            entry["triangles"] += len(obj.data.loop_triangles)
            entry["vertices"] += len(obj.data.vertices)
    stats["groups"][name] = entry
    stats["mesh_count"] += entry["meshes"]
    stats["triangles"] += entry["triangles"]
    stats["vertices"] += entry["vertices"]
with open(STATS_PATH, "w", encoding="utf-8") as handle:
    json.dump(stats, handle, indent=2)
print("SHELEM_LOUNGE_EXPORT_COMPLETE", json.dumps(stats))
