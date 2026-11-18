#!/usr/bin/env python3
"""Import footprints from the official KiCad library into public/library/footprints/*.json.

    python3 scripts/kicad-import.py scripts/kicad-parts.txt

Each line of the list is "Library/Footprint" (for example "Package_SO/SOIC-16_3.9x9.9mm_P1.27mm").
Files are fetched from gitlab.com/kicad/libraries/kicad-footprints, parsed, and written as
<Library>_<Footprint>.json in the format the app reads. Licence: CC-BY-SA-4.0 with the KiCad
libraries' design exception. 3D models are converted separately (scripts/kicad-models.py).
"""
import json
import math
import os
import re
import sys
import urllib.parse
import urllib.request

RAW = "https://gitlab.com/kicad/libraries/kicad-footprints/-/raw/master/{lib}.pretty/{name}.kicad_mod"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "library", "footprints")


# ---------- s-expressions ----------

def tokenize(s):
    i, n = 0, len(s)
    while i < n:
        c = s[i]
        if c in "()":
            yield c
            i += 1
        elif c.isspace():
            i += 1
        elif c == '"':
            j, buf = i + 1, []
            while s[j] != '"':
                if s[j] == "\\":
                    j += 1
                buf.append(s[j])
                j += 1
            yield ("str", "".join(buf))
            i = j + 1
        else:
            j = i
            while j < n and not s[j].isspace() and s[j] not in "()":
                j += 1
            yield s[i:j]
            i = j


def parse(s):
    stack = [[]]
    for t in tokenize(s):
        if t == "(":
            stack.append([])
        elif t == ")":
            done = stack.pop()
            stack[-1].append(done)
        else:
            stack[-1].append(t[1] if isinstance(t, tuple) else t)
    return stack[0][0]


def kids(node, name):
    return [k for k in node[1:] if isinstance(k, list) and k and k[0] == name]


def kid(node, name):
    k = kids(node, name)
    return k[0] if k else None


def nums(node, name, default=None):
    k = kid(node, name)
    if not k:
        return default
    out = []
    for v in k[1:]:
        try:
            out.append(float(v))
        except (TypeError, ValueError):
            pass
    return out


def width_of(node):
    stroke = kid(node, "stroke")
    w = nums(stroke, "width") if stroke else nums(node, "width")
    return round(w[0], 4) if w else 0.12


def layer_of(node):
    k = kid(node, "layer")
    return k[1] if k else ""


# ---------- conversion ----------

PAD_SHAPES = {"rect": "rect", "roundrect": "roundrect", "oval": "oval", "circle": "circle", "trapezoid": "rect", "custom": "rect"}
KEEP_LAYERS = {"F.SilkS", "F.Silkscreen", "F.CrtYd", "F.Courtyard", "F.Fab"}
LAYER_NAME = {"F.Silkscreen": "F.SilkS", "F.Courtyard": "F.CrtYd"}


def arc_points(start, mid, end, steps=16):
    """Circle through three points, sampled from start to end via mid."""
    (x1, y1), (x2, y2), (x3, y3) = start, mid, end
    d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2))
    if abs(d) < 1e-9:
        return [start, end]
    ux = ((x1 ** 2 + y1 ** 2) * (y2 - y3) + (x2 ** 2 + y2 ** 2) * (y3 - y1) + (x3 ** 2 + y3 ** 2) * (y1 - y2)) / d
    uy = ((x1 ** 2 + y1 ** 2) * (x3 - x2) + (x2 ** 2 + y2 ** 2) * (x1 - x3) + (x3 ** 2 + y3 ** 2) * (x2 - x1)) / d
    r = math.hypot(x1 - ux, y1 - uy)
    a1, a2, a3 = (math.atan2(p[1] - uy, p[0] - ux) for p in (start, mid, end))
    # go the way that passes through mid
    def norm(a):
        return a % (2 * math.pi)
    ccw = norm(a2 - a1) < norm(a3 - a1)
    span = norm(a3 - a1) if ccw else -norm(a1 - a3)
    return [(round(ux + r * math.cos(a1 + span * i / steps), 4), round(uy + r * math.sin(a1 + span * i / steps), 4)) for i in range(steps + 1)]


def convert(lib, name, src):
    root = parse(src)
    pads, graphics = [], []
    for p in kids(root, "pad"):
        number, kind, shape = p[1], p[2], p[3]
        at = nums(p, "at", [0, 0])
        size = nums(p, "size", [0, 0])
        layers = kid(p, "layers")
        pad = {
            "number": number,
            "kind": {"thru_hole": "tht", "np_thru_hole": "npth", "smd": "smd", "connect": "smd"}.get(kind, "smd"),
            "shape": PAD_SHAPES.get(shape, "rect"),
            "x": round(at[0], 4),
            "y": round(at[1], 4),
            "rotation": round(at[2], 3) if len(at) > 2 else 0,
            "w": round(size[0], 4),
            "h": round(size[1], 4),
            "layers": [l for l in (layers[1:] if layers else [])],
        }
        drill = kid(p, "drill")
        if drill:
            vals = [v for v in drill[1:] if not isinstance(v, list)]
            oval = "oval" in vals
            d = [float(v) for v in vals if v != "oval"]
            if d:
                pad["drill"] = {"w": d[0], "h": d[1] if oval and len(d) > 1 else d[0]}
        pads.append(pad)

    for kind in ("fp_line", "fp_rect", "fp_poly", "fp_circle", "fp_arc"):
        for g in kids(root, kind):
            layer = LAYER_NAME.get(layer_of(g), layer_of(g))
            if layer not in KEEP_LAYERS:
                continue
            w = width_of(g)
            if kind == "fp_line":
                s, e = nums(g, "start"), nums(g, "end")
                graphics.append({"kind": "line", "layer": layer, "x1": s[0], "y1": s[1], "x2": e[0], "y2": e[1], "width": w})
            elif kind == "fp_rect":
                s, e = nums(g, "start"), nums(g, "end")
                graphics.append({"kind": "rect", "layer": layer, "x1": s[0], "y1": s[1], "x2": e[0], "y2": e[1], "width": w})
            elif kind == "fp_poly":
                pts = [[float(x[1]), float(x[2])] for x in kid(g, "pts")[1:] if isinstance(x, list) and x[0] == "xy"]
                fill = kid(g, "fill")
                graphics.append({"kind": "poly", "layer": layer, "points": pts, "width": w, "fill": bool(fill and fill[1] in ("yes", "solid"))})
            elif kind == "fp_circle":
                c, e = nums(g, "center"), nums(g, "end")
                graphics.append({"kind": "circle", "layer": layer, "cx": c[0], "cy": c[1], "r": round(math.hypot(e[0] - c[0], e[1] - c[1]), 4), "width": w})
            elif kind == "fp_arc":
                s, m, e = nums(g, "start"), nums(g, "mid"), nums(g, "end")
                if s and m and e:
                    graphics.append({"kind": "poly", "layer": layer, "points": [list(p) for p in arc_points(s, m, e)], "width": w, "fill": False})

    # courtyard extent, else pads
    xs, ys = [], []
    for g in graphics:
        if g["layer"] != "F.CrtYd":
            continue
        if g["kind"] in ("line", "rect"):
            xs += [g["x1"], g["x2"]]
            ys += [g["y1"], g["y2"]]
        elif g["kind"] == "poly":
            xs += [p[0] for p in g["points"]]
            ys += [p[1] for p in g["points"]]
        elif g["kind"] == "circle":
            xs += [g["cx"] - g["r"], g["cx"] + g["r"]]
            ys += [g["cy"] - g["r"], g["cy"] + g["r"]]
    if not xs:
        for p in pads:
            xs += [p["x"] - p["w"] / 2, p["x"] + p["w"] / 2]
            ys += [p["y"] - p["h"] / 2, p["y"] + p["h"] / 2]
    bbox = [round(min(xs), 3), round(min(ys), 3), round(max(xs), 3), round(max(ys), 3)]

    model = None
    m = kid(root, "model")
    if m:
        fit = lambda key: [float(v) for v in (kid(kid(m, key), "xyz") or [None, 0, 0, 0])[1:]] if kid(m, key) else None
        model = {"id": f"kicad/{lib}/{name}", "offset": fit("offset") or [0, 0, 0], "rotate": fit("rotate") or [0, 0, 0], "scale": fit("scale") or [1, 1, 1], "file": os.path.basename(m[1])}

    descr = kid(root, "descr")
    tags = kid(root, "tags")
    return {
        "id": f"kicad/{lib}/{name}",
        "name": name,
        "library": lib,
        "source": "kicad",
        "description": descr[1] if descr else "",
        "tags": tags[1] if tags else "",
        "type": "tht" if any(p["kind"] == "tht" for p in pads) else "smd",
        "pads": pads,
        "graphics": graphics,
        "keepouts": [],
        "bbox": bbox,
        "model": model,
        "licence": "CC-BY-SA-4.0 with the KiCad libraries' design exception",
        "attribution": "KiCad Libraries Team, https://gitlab.com/kicad/libraries",
    }


def main(listfile):
    os.makedirs(OUT, exist_ok=True)
    wanted = [l.split("#")[0].strip() for l in open(listfile, encoding="utf-8")]
    ok, missing = 0, []
    for item in filter(None, wanted):
        lib, name = item.split("/", 1)
        url = RAW.format(lib=urllib.parse.quote(lib), name=urllib.parse.quote(name))
        try:
            src = urllib.request.urlopen(url, timeout=60).read().decode("utf-8")
        except Exception as e:  # noqa: BLE001
            missing.append(f"{item} ({e})")
            continue
        data = convert(lib, name, src)
        with open(os.path.join(OUT, f"{lib}_{name}.json"), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        ok += 1
        print(f"ok   {lib}/{name}  pads={len(data['pads'])}  bbox={data['bbox']}")
    for m in missing:
        print("MISS", m)
    print(f"{ok} imported, {len(missing)} missing")


if __name__ == "__main__":
    main(sys.argv[1])
