"""Visual layout-retrieval prototype: embed full-page screenshots with the
repo's existing DINOv2 ViT-S/14 (frozen, torch.hub, same model as
scripts/embed_visual.py's font pipeline) under two crop strategies.

  python viz/layout-embeddings/embed_layout.py --hosts viz/layout-embeddings/sample-hosts.json

  # full corpus, incremental/resumable (skips hosts already in --out):
  python viz/layout-embeddings/embed_layout.py --hosts viz/layout-embeddings/all-hosts.json --out viz/layout-embeddings/layout-visual-embeddings.full.json

Writes to --out (default viz/layout-embeddings/layout-visual-embeddings.json):
  { host: { "top": [384 floats], "tiled": [384 floats] } }
Incremental: hosts already present in --out are skipped, new ones are appended.
The file is flushed atomically every --save-every hosts, so a killed/interrupted
run can simply be re-invoked with the same command to resume where it left off.

Strategy A "top": crop the first viewport (1440x900, the fold), letterboxed
to a square canvas (no squish) and resized to a DINOv2 patch-14 multiple.

Strategy B "tiled": slice the full page into 1440x1440 tiles (last tile
padded), embed each tile, mean-pool + renormalize into one vector.
"""
import json, argparse
from pathlib import Path

import numpy as np
import torch
from PIL import Image

# Our own trusted full-page screenshots; very tall pages (Awwwards infinite-scroll)
# legitimately exceed PIL's default decompression-bomb limit. Disable the guard.
Image.MAX_IMAGE_PIXELS = None

ROOT = Path(__file__).resolve().parent.parent.parent
OUT_DIR = Path(__file__).resolve().parent
MEAN = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
STD = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)
SIZE = 518  # 37 * 14, DINOv2 patch=14, close to the model's native training res
VIEWPORT_W, VIEWPORT_H = 1440, 900


def to_tensor(img: Image.Image) -> torch.Tensor:
    arr = np.asarray(img.convert("RGB"), dtype="float32") / 255.0
    return torch.from_numpy(arr).permute(2, 0, 1)


def letterbox_square(img: Image.Image, bg=(255, 255, 255)) -> Image.Image:
    w, h = img.size
    side = max(w, h)
    canvas = Image.new("RGB", (side, side), bg)
    canvas.paste(img, ((side - w) // 2, (side - h) // 2))
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


def top_viewport_crop(full: Image.Image) -> Image.Image:
    w, h = full.size
    crop = full.crop((0, 0, w, min(VIEWPORT_H, h)))
    return letterbox_square(crop)


def tiles(full: Image.Image, tile_w: int = 1440):
    w, h = full.size
    n = max(1, -(-h // tile_w))  # ceil
    out = []
    for i in range(n):
        top, bot = i * tile_w, min((i + 1) * tile_w, h)
        t = full.crop((0, top, w, bot))
        if t.size[1] < tile_w:
            canvas = Image.new("RGB", (w, tile_w), (255, 255, 255))
            canvas.paste(t, (0, 0))
            t = canvas
        out.append(t.resize((SIZE, SIZE), Image.LANCZOS))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hosts", default=str(OUT_DIR / "sample-hosts.json"))
    ap.add_argument("--out", default=str(OUT_DIR / "layout-visual-embeddings.json"))
    ap.add_argument("--max-tiles", type=int, default=8, help="cap tiles per page for cost/consistency")
    ap.add_argument("--save-every", type=int, default=10, help="flush --out to disk every N newly-embedded hosts (resumability)")
    a = ap.parse_args()

    hosts = json.loads(Path(a.hosts).read_text(encoding="utf8"))
    out_path = Path(a.out)
    out = json.loads(out_path.read_text(encoding="utf8")) if out_path.exists() else {}
    already = set(out.keys())
    todo = [h for h in hosts if h not in already]
    print(f"Hosts requested: {len(hosts)} | already embedded: {len(already)} | to do: {len(todo)}")
    hosts = todo
    if not hosts:
        print("Nothing to do — all requested hosts already embedded.")
        return

    dev = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {dev}")
    model = torch.hub.load("facebookresearch/dinov2", "dinov2_vits14", trust_repo=True, verbose=False).eval().to(dev)

    def embed_batch(imgs):
        x = torch.stack([to_tensor(im) for im in imgs]).to(dev)
        x = (x - MEAN.to(dev)) / STD.to(dev)
        with torch.no_grad():
            feats = torch.nn.functional.normalize(model(x), dim=1).cpu().numpy()
        return feats

    def flush_out():
        tmp = out_path.with_suffix(out_path.suffix + ".tmp")
        tmp.write_text(json.dumps(out), encoding="utf8")
        tmp.replace(out_path)  # atomic on POSIX and Windows (same volume)

    since_flush = 0
    for i, host in enumerate(hosts):
        path = ROOT / f"data/layout-crawl/screenshots/{host}/desktop-1440x900.png"
        if not path.exists():
            print(f"  [skip] {host}: no screenshot")
            continue
        full = Image.open(path)

        top_img = top_viewport_crop(full)
        top_vec = embed_batch([top_img])[0]

        tile_imgs = tiles(full)[: a.max_tiles]
        tile_vecs = embed_batch(tile_imgs)
        pooled = tile_vecs.mean(axis=0)
        pooled = pooled / (np.linalg.norm(pooled) or 1.0)

        out[host] = {
            "top": [round(float(v), 5) for v in top_vec],
            "tiled": [round(float(v), 5) for v in pooled],
            "page_h": full.size[1],
            "n_tiles": len(tile_imgs),
        }
        print(f"  [{i+1}/{len(hosts)}] {host}  page_h={full.size[1]} tiles={len(tile_imgs)}  (total embedded: {len(out)})")

        since_flush += 1
        if since_flush >= a.save_every:
            flush_out()
            since_flush = 0

    flush_out()
    print(f"Wrote {a.out}: {len(out)} hosts total, dim={len(next(iter(out.values()))['top'])}")


if __name__ == "__main__":
    main()
