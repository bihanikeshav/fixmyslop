"""Pick ~50 representative hosts for the small-scale visual-retrieval prototype.
Writes viz/layout-embeddings/sample-hosts.json (scratch artifact, not committed)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
MANIFEST = ROOT / "data/layout-crawl/layout-genome-manifest.v3.ndjson"
OUT = Path(__file__).resolve().parent / "sample-hosts.json"

hosts = []
with open(MANIFEST, encoding="utf8") as f:
    for line in f:
        d = json.loads(line)
        h = d["host"]
        if (ROOT / f"data/layout-crawl/screenshots/{h}/desktop-1440x900.png").exists():
            hosts.append(h)

REQUIRED = ["anthropic.com", "agenta.ai", "productivity.directory", "adva-soft.com"]
extra_saas = ["agentmail.to", "agentset.ai", "agentdock.ai", "adkit.so", "affogato.ai", "acade.ai"]

picked = set(REQUIRED) | set(h for h in extra_saas if h in hosts)
# Even spread across the full sorted host list for variety of layout families.
sorted_hosts = sorted(hosts)
step = max(1, len(sorted_hosts) // 50)
for i in range(0, len(sorted_hosts), step):
    if len(picked) >= 50:
        break
    picked.add(sorted_hosts[i])

picked = sorted(picked)[:50]
OUT.write_text(json.dumps(picked, indent=2), encoding="utf8")
print(f"Selected {len(picked)} hosts -> {OUT}")
print(picked)
