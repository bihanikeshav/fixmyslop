"""Fetch Velvetyne Type Foundry fonts (libre, OFL) from their GitLab group.
One upright representative weight per repo, cached like our other fonts."""
import urllib.request, urllib.parse, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "fonts-cache"
OUT = ROOT / "data" / "external" / "velvetyne"
OUT.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (ai-slop-font)"}
WEIGHTS = {"thin": 100, "extralight": 200, "light": 300, "book": 400, "roman": 400,
           "regular": 400, "normal": 400, "medium": 500, "semibold": 600, "demibold": 600,
           "bold": 700, "extrabold": 800, "black": 900, "heavy": 900}

def slug(s): return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
def api(u): return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40))

def category_of(name):
    n = name.lower()
    if "mono" in n: return "monospace"
    if any(x in n for x in ("grotesk", "grotesque", "sans", "gothic", "neue")): return "sans-serif"
    if any(x in n for x in ("serif", "antiqua", "roman", "didone")): return "serif"
    return "display"  # Velvetyne skews experimental/display

def weight_of(fname):
    base = re.sub(r"\.(ttf|otf)$", "", fname.lower())
    for k, v in WEIGHTS.items():
        if k in base: return v
    return 400

def pick(files):
    cand = [f for f in files if f.lower().endswith((".ttf", ".otf")) and "italic" not in f.lower()]
    if not cand: return None
    return min(cand, key=lambda f: (abs(weight_of(f) - 400), "webfont" in f.lower(), len(f)))

def tree(pid):
    out, page = [], 1
    while True:
        t = api(f"https://gitlab.com/api/v4/projects/{pid}/repository/tree?recursive=true&per_page=100&page={page}")
        out += t
        if len(t) < 100: break
        page += 1
    return out

def main():
    ours = {f["id"] for f in json.loads((ROOT / "data" / "fonts.index.json").read_text(encoding="utf8"))}
    projs, page = [], 1
    while True:
        p = api(f"https://gitlab.com/api/v4/groups/velvetyne/projects?per_page=100&page={page}&include_subgroups=true&simple=true")
        projs += p
        if len(p) < 100: break
        page += 1
    print(f"Velvetyne repos: {len(projs)}")

    meta, ok, skip = [], 0, 0
    for pr in projs:
        sid = slug(pr["name"])
        if sid in ours or any(m["id"] == sid for m in meta):
            skip += 1; continue
        try:
            files = [x["path"] for x in tree(pr["id"]) if x["type"] == "blob"]
            f = pick(files)
            if not f:
                skip += 1; continue
            raw = f"https://gitlab.com/api/v4/projects/{pr['id']}/repository/files/{urllib.parse.quote(f, safe='')}/raw?ref={pr['default_branch']}"
            data = urllib.request.urlopen(urllib.request.Request(raw, headers=UA), timeout=60).read()
            (CACHE / f"{sid}.ttf").write_bytes(data)
            meta.append({"id": sid, "family": pr["name"], "category": category_of(pr["name"]),
                         "source": "velvetyne", "license": "ofl", "tags": [], "slug": pr["path"]})
            ok += 1
        except Exception as e:
            skip += 1; print(f"  ! {pr['name']}: {e}")
    (OUT / "families.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf8")
    print(f"Done. {ok} cached, {skip} skipped/failed.")
    print("Sample:", ", ".join(m["family"] for m in meta[:14]))

if __name__ == "__main__":
    main()
