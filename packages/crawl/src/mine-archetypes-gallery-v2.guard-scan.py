"""
Screenshot luminance scan for the FIX 1 blank/over-tall guard used by mine-archetypes-gallery-v2.ts.

Reads data/layout-crawl/layout-genome-manifest.gallery-final.ndjson, opens each host's desktop
screenshot, downsamples it to a fixed 240px width (aspect-preserved) for speed, and records cheap
luminance stats: mean, stdev, and the fraction of pixels within 10 levels of pure black or pure
white ("frac_extreme") — a near-uniform screenshot (blank / failed capture) has frac_extreme near
1 AND a low stdev, which the guard in the .ts orchestrator checks.

Writes data/layout-crawl/screenshot-luminance.gallery.v2.json:
  { "<host>": { "page_w", "page_h", "mean", "std", "frac_white", "frac_black", "frac_extreme" } }

Usage:
  python mine-archetypes-gallery-v2.guard-scan.py
"""
import json
import sys
from pathlib import Path

from PIL import Image
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
MANIFEST = ROOT / "data/layout-crawl/layout-genome-manifest.gallery-final.ndjson"
OUT = ROOT / "data/layout-crawl/screenshot-luminance.gallery.v2.json"

TARGET_W = 240


def main():
    lines = [l for l in MANIFEST.read_text(encoding="utf8").split("\n") if l.strip()]
    results = {}
    for i, line in enumerate(lines):
        rec = json.loads(line)
        host = rec["host"]
        rel_path = rec.get("screenshots", {}).get("desktop")
        if not rel_path:
            results[host] = {"error": "no-desktop-screenshot"}
            continue
        path = ROOT / rel_path
        try:
            im = Image.open(path)
            w, h = im.size
            scale = TARGET_W / w
            target_h = max(1, int(h * scale))
            im_small = im.convert("L").resize((TARGET_W, target_h), Image.BILINEAR)
            arr = np.asarray(im_small, dtype=np.float64)
            mean = float(arr.mean())
            std = float(arr.std())
            frac_white = float((arr > 245).mean())
            frac_black = float((arr < 10).mean())
            results[host] = {
                "page_w": w, "page_h": h,
                "mean": round(mean, 2), "std": round(std, 2),
                "frac_white": round(frac_white, 4), "frac_black": round(frac_black, 4),
                "frac_extreme": round(frac_white + frac_black, 4),
            }
        except Exception as e:  # noqa: BLE001 - report and continue
            results[host] = {"error": str(e)}
        if (i + 1) % 50 == 0:
            print(f"...{i + 1}/{len(lines)}", file=sys.stderr)

    OUT.write_text(json.dumps(results, indent=2), encoding="utf8")
    print(f"wrote {len(results)} -> {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
