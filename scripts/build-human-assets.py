#!/usr/bin/env python3
"""
Packs the Quaternius "Universal Base Characters" and "Universal Animation Library"
(Standard, free, CC0) into the web-sized files used by the 3D explore view.

Usage (macOS, needs `sips`):
  python3 scripts/build-human-assets.py <base-characters-dir> <animation-library-dir>

where the two directories are the extracted zips, e.g.
  "Universal Base Characters[Standard]" and "Universal Animation Library[Standard]".

Output: apps/web/public/models/explore3d/humans/
  human-male.glb, human-female.glb   body + eyes + eyebrows, 1024 px textures
  skin-male-light.jpg, skin-female-light.jpg   alternative skin textures
  hair-*.glb                          hairstyles (static meshes, 512 px textures)
  human-animations.glb                only the clips the scene uses
"""
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile

KEEP_CLIPS = [
    "A_TPose", "Idle_Loop", "Idle_Talking_Loop", "Walk_Loop", "Walk_Formal_Loop",
    "Jog_Fwd_Loop", "Sprint_Loop", "Punch_Jab", "Punch_Cross", "Interact",
    "Swim_Fwd_Loop", "Swim_Idle_Loop", "Sitting_Idle_Loop", "Sitting_Talking_Loop",
    "Driving_Loop", "Dance_Loop", "Sword_Attack", "Push_Loop", "Crouch_Idle_Loop",
]
HAIRS = ["Hair_SimpleParted", "Hair_Buzzed", "Hair_Beard", "Hair_Long", "Hair_Buns", "Hair_BuzzedFemale"]

OUT = os.path.join(os.path.dirname(__file__), "..", "apps", "web", "public", "models", "explore3d", "humans")


def resize_image(src, size, fmt, tmp):
    """Returns (bytes, mime) for `src` scaled to fit `size` px."""
    ext = "jpg" if fmt == "jpeg" else "png"
    dst = os.path.join(tmp, os.path.basename(src) + "." + ext)
    cmd = ["sips", "-s", "format", fmt]
    if fmt == "jpeg":
        cmd += ["-s", "formatOptions", "82"]
    cmd += ["-Z", str(size), src, "--out", dst]
    subprocess.run(cmd, check=True, capture_output=True)
    return open(dst, "rb").read(), "image/jpeg" if fmt == "jpeg" else "image/png"


def pad4(data, fill=b"\x00"):
    return data + fill * ((4 - len(data) % 4) % 4)


def write_glb(path, gltf, binary):
    gltf["buffers"] = [{"byteLength": len(binary)}]
    j = pad4(json.dumps(gltf, separators=(",", ":")).encode(), b" ")
    b = pad4(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(j) + 8 + len(b)))
        f.write(struct.pack("<II", len(j), 0x4E4F534A) + j)
        f.write(struct.pack("<II", len(b), 0x004E4942) + b)
    print(f"  {os.path.relpath(path)}  {os.path.getsize(path) / 1024:.0f} KB")


def pack_gltf(gltf_path, out_path, image_rule, tmp, normal_dir=None):
    """Embeds the .bin and re-encodes every image (image_rule(name) -> (size, fmt))."""
    base = os.path.dirname(gltf_path)
    gltf = json.load(open(gltf_path))
    binary = bytearray(open(os.path.join(base, gltf["buffers"][0]["uri"]), "rb").read())
    for image in gltf.get("images", []):
        name = image["uri"]
        size, fmt = image_rule(name)
        src = os.path.join(base, name)
        if normal_dir and "Normal" in name:
            # glTF uses OpenGL normals (+Y up); the pack's Unity/Godot folder has those,
            # the UE copy next to the glTF is flipped and makes the skin look scaly.
            src = os.path.join(normal_dir, name.replace("_png.png", ".png"))
        elif not os.path.exists(src):
            # Some glTFs name textures "X_png.png" while the pack ships "X.png".
            src = os.path.join(base, name.replace("_png.png", ".png"))
        data, mime = resize_image(src, size, fmt, tmp)
        while len(binary) % 4:
            binary.append(0)
        gltf.setdefault("bufferViews", []).append(
            {"buffer": 0, "byteOffset": len(binary), "byteLength": len(data)}
        )
        binary += data
        del image["uri"]
        image["bufferView"] = len(gltf["bufferViews"]) - 1
        image["mimeType"] = mime
    write_glb(out_path, gltf, bytes(binary))


def character_rule(name):
    if "Eye" in name:
        return 256, "png"
    if "Hair" in name:
        return 512, "jpeg"
    return 1024, "jpeg"


def build_characters(base_dir, tmp):
    gltf_dir = os.path.join(base_dir, "Base Characters", "Godot - UE")
    tex_dir = os.path.join(base_dir, "Base Characters", "Textures")
    for gender in ("Male", "Female"):
        pack_gltf(
            os.path.join(gltf_dir, f"Superhero_{gender}_FullBody.gltf"),
            os.path.join(OUT, f"human-{gender.lower()}.glb"),
            character_rule,
            tmp,
            os.path.join(tex_dir, "Normals Unity - Godot"),
        )
    # Light skin variants (the packed characters use the dark texture).
    for gender, name in (("male", "T_Superhero_Male_Ligh.png"), ("female", "T_Superhero_Female_Light_BaseColor.png")):
        data, _ = resize_image(os.path.join(tex_dir, name), 1024, "jpeg", tmp)
        open(os.path.join(OUT, f"skin-{gender}-light.jpg"), "wb").write(data)
        print(f"  skin-{gender}-light.jpg  {len(data) / 1024:.0f} KB")


def build_hair(base_dir, tmp):
    hair_dir = os.path.join(base_dir, "Hairstyles", "Origin at 0", "glTF (Godot)")
    normals = os.path.join(base_dir, "Hairstyles", "Textures", "Normals Unity - Godot")
    for name in HAIRS:
        pack_gltf(os.path.join(hair_dir, name + ".gltf"), os.path.join(OUT, name.lower().replace("_", "-") + ".glb"), character_rule, tmp, normals)


def build_animations(anim_dir):
    path = os.path.join(anim_dir, "Unreal-Godot", "UAL1_Standard.glb")
    data = open(path, "rb").read()
    jlen = struct.unpack("<I", data[12:16])[0]
    gltf = json.loads(data[20:20 + jlen])
    bin_start = 20 + jlen + 8
    binary = data[bin_start:]

    gltf["animations"] = [a for a in gltf["animations"] if a["name"] in KEEP_CLIPS]
    missing = set(KEEP_CLIPS) - {a["name"] for a in gltf["animations"]}
    if missing:
        raise SystemExit(f"clips not found: {missing}")

    # Keep only the accessors the clips read, re-packed into a fresh buffer.
    used = sorted({s[k] for a in gltf["animations"] for s in a["samplers"] for k in ("input", "output")})
    remap = {}
    new_binary = bytearray()
    new_views, new_accessors = [], []
    for old in used:
        acc = dict(gltf["accessors"][old])
        view = gltf["bufferViews"][acc["bufferView"]]
        start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
        comps = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc["type"]]
        size = {5126: 4, 5123: 2, 5121: 1, 5120: 1, 5122: 2, 5125: 4}[acc["componentType"]]
        length = acc["count"] * comps * size
        while len(new_binary) % 4:
            new_binary.append(0)
        new_views.append({"buffer": 0, "byteOffset": len(new_binary), "byteLength": length})
        new_binary += binary[start:start + length]
        acc["bufferView"] = len(new_views) - 1
        acc.pop("byteOffset", None)
        remap[old] = len(new_accessors)
        new_accessors.append(acc)
    for a in gltf["animations"]:
        for s in a["samplers"]:
            s["input"], s["output"] = remap[s["input"]], remap[s["output"]]
    gltf["accessors"], gltf["bufferViews"] = new_accessors, new_views
    for key in ("meshes", "skins", "materials", "textures", "images", "samplers"):
        gltf.pop(key, None)
    for node in gltf["nodes"]:
        node.pop("mesh", None)
        node.pop("skin", None)
    write_glb(os.path.join(OUT, "human-animations.glb"), gltf, bytes(new_binary))


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    base_dir, anim_dir = sys.argv[1], sys.argv[2]
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        build_characters(base_dir, tmp)
        build_hair(base_dir, tmp)
    build_animations(anim_dir)
    for name, src in (("LICENSE-quaternius-base-characters.txt", os.path.join(base_dir, "License_Standard.txt")),
                      ("LICENSE-quaternius-animation-library.txt", os.path.join(anim_dir, "License.txt"))):
        shutil.copy(src, os.path.join(OUT, name))


if __name__ == "__main__":
    main()
