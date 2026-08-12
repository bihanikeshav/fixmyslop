"""Generate the full-corpus host list (all 1,259 hosts with a screenshot on disk)
for scaling the visual layout-embedding prototype beyond the 50-host sample.

  python viz/layout-embeddings/make_all_hosts.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
MANIFEST = ROOT / "data/layout-crawl/layout-genome-manifest.v3.ndjson"
OUT = Path(__file__).resolve().parent / "all-hosts.json"

hosts = []
with open(MANIFEST, encoding="utf8") as f:
    for line in f:
        d = json.loads(line)
        h = d["host"]
        if (ROOT / f"data/layout-crawl/screenshots/{h}/desktop-1440x900.png").exists():
            hosts.append(h)

OUT.write_text(json.dumps(hosts, indent=2), encoding="utf8")
print(f"Wrote {len(hosts)} hosts -> {OUT}")
