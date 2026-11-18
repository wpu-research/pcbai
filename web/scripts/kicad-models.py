#!/usr/bin/env python3
"""Convert the KiCad 3D models of imported footprints from STEP to GLB.

Needs OpenCascade's Python bindings (pip install cadquery-ocp), e.g. in a venv:
    <venv>/bin/python scripts/kicad-models.py scripts/kicad-parts.txt

For each "Library/Footprint" line, the footprint JSON (from kicad-import.py) names its model; the STEP
file is fetched from gitlab.com/kicad/libraries/kicad-packages3D, meshed, and written with its colours
to public/library/models/<Library>_<Footprint>.glb in metres, Y up (the convention the app loads),
plus a lighter .lo.glb meshed more coarsely for phones.
"""
import json
import os
import sys
import tempfile
import urllib.parse
import urllib.request

from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.Message import Message_ProgressRange
from OCP.RWGltf import RWGltf_CafWriter
from OCP.RWMesh import RWMesh_CoordinateSystem
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TCollection import TCollection_AsciiString, TCollection_ExtendedString
from OCP.OCP.collections import IndexedDataMap_TCollection_AsciiString_TCollection_AsciiString as FileInfo
from OCP.OCP.collections import Sequence_TDF_Label as TDF_LabelSequence
from OCP.TDocStd import TDocStd_Document
from OCP.XCAFDoc import XCAFDoc_DocumentTool

RAW = "https://gitlab.com/kicad/libraries/kicad-packages3D/-/raw/master/{lib}.3dshapes/{file}"
HERE = os.path.dirname(os.path.abspath(__file__))
FOOTPRINTS = os.path.join(HERE, "..", "public", "library", "footprints")
MODELS = os.path.join(HERE, "..", "public", "library", "models")
# Footprints whose own STEP is missing from kicad-packages3D: borrow a model of the same body.
STAND_INS = {
    "Sensor_Motion/InvenSense_QFN-24_4x4mm_P0.5mm": "Package_DFN_QFN/QFN-24-1EP_4x4mm_P0.5mm_EP2.7x2.7mm.step",
    "Package_DFN_QFN/DFN-8-1EP_2x2mm_P0.5mm_EP0.9x1.3mm": "Package_DFN_QFN/DFN-8-1EP_2x2mm_P0.5mm_EP0.6x1.2mm.step",
}


def step_to_glb(step_path, out, deflection):
    doc = TDocStd_Document(TCollection_ExtendedString("pcbai"))
    reader = STEPCAFControl_Reader()
    reader.SetColorMode(True)
    reader.SetNameMode(True)
    if reader.ReadFile(step_path) != 1 or not reader.Transfer(doc):
        raise RuntimeError("STEP read failed")
    tool = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
    labels = TDF_LabelSequence()
    tool.GetFreeShapes(labels)
    for i in range(1, labels.Length() + 1):
        BRepMesh_IncrementalMesh(tool.GetShape_s(labels.Value(i)), deflection, False, 0.35, True)
    writer = RWGltf_CafWriter(TCollection_AsciiString(out), True)
    conv = writer.ChangeCoordinateSystemConverter()
    conv.SetInputLengthUnit(0.001)  # STEP in millimetres
    conv.SetInputCoordinateSystem(RWMesh_CoordinateSystem.RWMesh_CoordinateSystem_Zup)  # KiCad Z up -> glTF Y up
    if not writer.Perform(doc, FileInfo(), Message_ProgressRange()):
        raise RuntimeError("glTF write failed")


def main(listfile):
    os.makedirs(MODELS, exist_ok=True)
    items = [l.split("#")[0].strip() for l in open(listfile, encoding="utf-8")]
    done, failed = 0, []
    for item in filter(None, items):
        lib, name = item.split("/", 1)
        fp_path = os.path.join(FOOTPRINTS, f"{lib}_{name}.json")
        if not os.path.exists(fp_path):
            continue
        fp = json.load(open(fp_path, encoding="utf-8"))
        model = fp.get("model") or {}
        if not model.get("file"):
            failed.append(f"{item}: no model")
            continue
        model_lib = model["id"].split("/")[1]
        step_name = os.path.splitext(model["file"])[0] + ".step"
        if item in STAND_INS:
            model_lib, step_name = STAND_INS[item].split("/", 1)
        out = os.path.join(MODELS, f"{lib}_{name}.glb")
        if os.path.exists(out):
            done += 1
            continue
        url = RAW.format(lib=urllib.parse.quote(model_lib), file=urllib.parse.quote(step_name))
        try:
            with tempfile.NamedTemporaryFile(suffix=".step") as tmp:
                tmp.write(urllib.request.urlopen(url, timeout=120).read())
                tmp.flush()
                step_to_glb(tmp.name, out, 0.02)
                step_to_glb(tmp.name, out.replace(".glb", ".lo.glb"), 0.08)
            done += 1
            print(f"ok   {item}  {os.path.getsize(out) // 1024} KB")
        except Exception as e:  # noqa: BLE001
            failed.append(f"{item}: {e}")
    for f in failed:
        print("FAIL", f)
    print(f"{done} models, {len(failed)} failed")


if __name__ == "__main__":
    main(sys.argv[1])
