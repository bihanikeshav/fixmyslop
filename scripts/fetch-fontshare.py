"""Fetch Fontshare families (ITF Free Font License, free for commercial use) and
cache one upright Regular weight per family alongside our Google Fonts, so they
become first-class fresh candidates in the closeness index + swaps."""
import urllib.request, json, zipfile, io, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "fonts-cache"
OUT = ROOT / "data" / "external" / "fontshare"
OUT.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (ai-slop-font)"}

def slug(s): return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def category_of(c):
    c = (c or "").lower()
    if "mono" in c: return "monospace"
    if "serif" in c and "sans" not in c: return "serif"
    if "sans" in c: return "sans-serif"
    if "display" in c: return "display"
    if any(x in c for x in ("hand", "script", "brush")): return "handwriting"
    return "sans-serif"

def list_families():
    out, off = [], 0
    while True:
        req = urllib.request.Request(f"https://api.fontshare.com/v2/fonts?limit=100&offset={off}", headers=UA)
        d = json.load(urllib.request.urlopen(req, timeout=30))
        out += d["fonts"]
        if len(d["fonts"]) < 100: break
        off += 100
    return out

def pick_ttf(names):
    cand = [n for n in names if n.lower().endswith((".ttf", ".otf")) and "italic" not in n.lower() and "variable" not in n.lower()]
    if not cand: return None
    # prefer a static Regular TTF, then any Regular, then weight nearest 400
    for pref in (lambda n: n.lower().endswith("regular.ttf"),
                 lambda n: "regular" in n.lower() and n.lower().endswith(".ttf"),
                 lambda n: "regular" in n.lower(),
                 lambda n: n.lower().endswith(".ttf")):
        hit = [n for n in cand if pref(n)]
        if hit: return sorted(hit, key=len)[0]
    return sorted(cand, key=len)[0]

def main():
    ours = {f["id"] for f in json.loads((ROOT / "data" / "fonts.index.json").read_text(encoding="utf8"))}
    fams = list_families()
    print(f"Fontshare families: {len(fams)}")
    meta, ok, skipped, dup = [], 0, 0, 0
    for f in fams:
        sid = slug(f["name"])
        if sid in ours: dup += 1; continue
        try:
            req = urllib.request.Request(f"https://api.fontshare.com/v2/fonts/download/{f['slug']}", headers=UA)
            z = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(req, timeout=60).read()))
            pick = pick_ttf(z.namelist())
            if not pick: skipped += 1; continue
            (CACHE / f"{sid}.ttf").write_bytes(z.read(pick))
            meta.append({"id": sid, "family": f["name"], "category": category_of(f["category"]),
                         "source": "fontshare", "license": f["license_type"],
                         "tags": [t["name"] for t in f.get("font_tags", [])], "slug": f["slug"]})
            ok += 1
            if ok % 20 == 0: print(f"  {ok} fetched ...")
        except Exception as e:
            skipped += 1; print(f"  ! {f['name']}: {e}")
    (OUT / "families.json").write_text(json.dumps(meta, indent=2), encoding="utf8")
    print(f"Done. {ok} cached, {dup} skipped (already a Google Font), {skipped} failed.")
    print("Sample:", ", ".join(m["family"] for m in meta[:12]))

if __name__ == "__main__":
    main()
