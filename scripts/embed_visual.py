"""Deep visual font embedding (the 'fontjoy method, 2026 edition').

Render each font's glyphs to an image, push through a frozen DINOv2 ViT-S/14,
take the CLS embedding (384-d). One consistent vector space over ALL our fonts
(Google + Fontshare), incl. the modern grotesks fontjoy's 2018 set lacked.

  python scripts/embed_visual.py --sample                          # A/B validate on curated set
  python scripts/embed_visual.py --specimen "Ragbenfy" --size 224  # full run, tight specimen
  python scripts/embed_visual.py --specimen "Hamburgefontsiv\\nHAMBQRGES 0123" --size 392
"""
import json, sys, argparse
from pathlib import Path
import numpy as np
import torch
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "fonts-cache"
MEAN = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
STD = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)

# Curated A/B set: Didones, slabs, grotesks (incl. Fontshare), condensed, mono, script.
SAMPLE = ["playfair-display", "bodoni-moda", "prata", "cinzel", "gilda-display", "italiana",
          "roboto-slab", "zilla-slab", "arvo", "inter", "roboto", "open-sans",
          "general-sans", "switzer", "synonym", "oswald", "bebas-neue",
          "jetbrains-mono", "roboto-mono", "lobster", "pacifico"]

def render(ttf: Path, specimen: str, size: int):
    try:
        lines = specimen.split("\n")
        fs = 130
        font = ImageFont.truetype(str(ttf), fs)
        widest = max(font.getbbox(l)[2] for l in lines) or 1
        fs = max(24, min(220, int(fs * 0.85 * size / widest)))
        font = ImageFont.truetype(str(ttf), fs)
        img = Image.new("RGB", (size, size), "white")
        d = ImageDraw.Draw(img)
        bb = d.multiline_textbbox((0, 0), specimen, font=font, align="center", spacing=6)
        w, h = bb[2] - bb[0], bb[3] - bb[1]
        d.multiline_text(((size - w) / 2 - bb[0], (size - h) / 2 - bb[1]), specimen, fill="black", font=font, align="center", spacing=6)
        return img
    except Exception:
        return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--specimen", default="Ragbenfy")
    ap.add_argument("--size", type=int, default=224)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--sample", action="store_true")
    ap.add_argument("--out", default="data/font-visual-deep.json")
    a = ap.parse_args()
    a.specimen = a.specimen.replace("\\n", "\n")
    if a.size % 14:
        a.size = (a.size // 14) * 14  # DINOv2 patch=14

    index = json.loads((ROOT / "data" / "fonts.index.json").read_text(encoding="utf8"))
    by_id = {f["id"]: f for f in index}
    if a.sample:
        fonts = [(i, by_id[i]["family"]) for i in SAMPLE if i in by_id and (CACHE / f"{i}.ttf").exists()]
    else:
        fonts = [(f["id"], f["family"]) for f in index if (CACHE / f"{f['id']}.ttf").exists()]
        if a.limit: fonts = fonts[:a.limit]
    print(f"Fonts: {len(fonts)} | specimen={a.specimen!r} size={a.size}")

    dev = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {dev}" + (f" ({torch.cuda.get_device_name(0)})" if dev == "cuda" else ""))
    model = torch.hub.load("facebookresearch/dinov2", "dinov2_vits14", trust_repo=True, verbose=False).eval().to(dev)

    out, ids, batch = {}, [], []
    def flush():
        if not batch: return
        x = (torch.stack(batch).to(dev) - MEAN.to(dev)) / STD.to(dev)
        with torch.no_grad():
            feats = torch.nn.functional.normalize(model(x), dim=1).cpu()
        for fid, vec in zip(ids, feats):
            out[fid] = [round(v, 5) for v in vec.tolist()]
        ids.clear(); batch.clear()

    done = 0
    for fid, fam in fonts:
        img = render(CACHE / f"{fid}.ttf", a.specimen, a.size)
        if img is None: continue
        batch.append(torch.from_numpy(np.asarray(img, dtype="float32") / 255.0).permute(2, 0, 1)); ids.append(fid)
        if len(batch) >= 32: flush()
        done += 1
        if done % 256 == 0: print(f"  {done}/{len(fonts)} ...")
    flush()

    if a.sample:
        import numpy as _np
        M = {k: _np.array(v) for k, v in out.items()}
        for anchor in ["playfair-display", "inter", "general-sans", "oswald"]:
            if anchor not in M: continue
            sims = sorted(((by_id[k]["family"], float(M[anchor] @ M[k])) for k in M if k != anchor), key=lambda t: -t[1])[:5]
            print(f"  {anchor:18} -> " + ", ".join(f"{f}({s:.3f})" for f, s in sims))
    else:
        Path(ROOT / a.out).write_text(json.dumps(out), encoding="utf8")
        print(f"Wrote {a.out}: {len(out)} fonts, dim={len(next(iter(out.values())))}")

if __name__ == "__main__":
    main()
