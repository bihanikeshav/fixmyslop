"""Fetch the GitHub-hosted subset of Uncut.wtf's curated 'non-slop' library.
Uncut is a directory (dl links point off-site); ~55 entries live on GitHub and
are ingestible. Download each repo's archive zip (no API rate limit), extract one
upright representative weight. Real category labels come straight from Uncut."""
import urllib.request, json, zipfile, io, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "fonts-cache"
OUT = ROOT / "data" / "external" / "uncut"
UA = {"User-Agent": "Mozilla/5.0 (fixmyslop)"}
WEIGHTS = {"thin": 100, "extralight": 200, "ultralight": 200, "light": 300, "book": 400, "roman": 400,
           "regular": 400, "normal": 400, "text": 400, "medium": 500, "semibold": 600, "demibold": 600,
           "bold": 700, "extrabold": 800, "black": 900, "heavy": 900}

def slug(s): return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
def weight_of(f):
    b = re.sub(r"\.(ttf|otf)$", "", f.lower().split("/")[-1])
    for k, v in WEIGHTS.items():
        if k in b: return v
    return 400

def pick(names):
    c = [n for n in names if n.lower().endswith((".ttf", ".otf")) and "italic" not in n.lower()
         and not any(x in n.lower() for x in ("variablefont", "-vf", "[wght]"))]
    if not c:
        c = [n for n in names if n.lower().endswith((".ttf", ".otf")) and "italic" not in n.lower()]
    if not c: return None
    # nearest 400; prefer static TTF; prefer a fonts/ttf dir; shorter path
    return min(c, key=lambda n: (abs(weight_of(n) - 400), not n.lower().endswith(".ttf"),
                                 "source" in n.lower() or "ufo" in n.lower(), len(n)))

def fetch_zip(owner, repo):
    for branch in ("main", "master"):
        try:
            req = urllib.request.Request(f"https://codeload.github.com/{owner}/{repo}/zip/refs/heads/{branch}", headers=UA)
            return urllib.request.urlopen(req, timeout=90).read()
        except Exception:
            continue
    return None

def main():
    raw = json.loads((OUT / "list.json").read_text(encoding="utf8"))
    arr = raw if isinstance(raw, list) else next((v for v in raw.values() if isinstance(v, list)), [])
    ours = {f["id"] for f in json.loads((ROOT / "data" / "fonts.index.json").read_text(encoding="utf8"))}

    meta, ok, skip = [], 0, 0
    for f in arr:
        m = re.search(r"github\.com/([^/]+)/([^/#?]+)", f["dl"])
        if not m: continue
        sid = slug(f["name"])
        if sid in ours or any(x["id"] == sid for x in meta):
            skip += 1; continue
        owner, repo = m.group(1), re.sub(r"\.git$", "", m.group(2))
        try:
            data = fetch_zip(owner, repo)
            if not data: skip += 1; print(f"  ! {f['name']}: no archive"); continue
            z = zipfile.ZipFile(io.BytesIO(data))
            p = pick(z.namelist())
            if not p: skip += 1; print(f"  ! {f['name']}: no static font"); continue
            (CACHE / f"{sid}.ttf").write_bytes(z.read(p))
            meta.append({"id": sid, "family": f["name"], "category": f.get("category", "display"),
                         "source": "uncut", "license": "ofl", "tags": [], "slug": f["slug"]})
            ok += 1; print(f"  ok {f['name']}  <- {owner}/{repo}")
        except Exception as e:
            skip += 1; print(f"  ! {f['name']}: {e}")
    (OUT / "families.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf8")
    print(f"Done. {ok} cached, {skip} skipped.")

if __name__ == "__main__":
    main()
