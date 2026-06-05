"""Project the 384-d DINOv2 font embeddings to 2D (UMAP) and emit a self-contained
interactive map (viz/font-projector.html). AI-slop fonts (high display saturation)
glow as additive red clouds; fresh fonts are cool dots colored by category."""
import json
from pathlib import Path
import numpy as np
import umap

ROOT = Path(__file__).resolve().parent.parent
CATS = ["serif", "sans-serif", "display", "monospace", "handwriting"]
SUPS = ["google", "fontshare", "velvetyne", "uncut"]

TEMPLATE = r"""<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Slop Font Map</title>
<link rel="stylesheet" href="__GFLINK__">
<style>
  html,body{margin:0;height:100%;background:#07070d;color:#e8e8f0;font:13px/1.4 system-ui,sans-serif;overflow:hidden}
  #c{display:block;cursor:grab}#c:active{cursor:grabbing}
  #hud{position:fixed;top:16px;left:16px;max-width:300px;pointer-events:none}
  #hud h1{margin:0 0 2px;font-size:19px;letter-spacing:-.02em}
  #hud .sub{color:#8a8aa0;margin-bottom:12px}
  .legend{background:rgba(15,15,26,.7);border:1px solid #23233a;border-radius:10px;padding:10px 12px;backdrop-filter:blur(8px);pointer-events:auto}
  .legend .row{display:flex;align-items:center;gap:8px;margin:3px 0;color:#c4c4d6}
  .dot{width:10px;height:10px;border-radius:50%}
  .cloud{width:14px;height:14px;border-radius:50%;background:radial-gradient(circle,rgba(255,45,45,.95),rgba(255,45,45,0))}
  #search{margin-top:10px;width:100%;box-sizing:border-box;background:#11111c;border:1px solid #2a2a42;color:#e8e8f0;border-radius:8px;padding:7px 10px;font-size:13px;pointer-events:auto}
  #search::placeholder{color:#6a6a82}
  .hint{margin-top:8px;color:#6a6a82;font-size:11px}
  #tip{position:fixed;pointer-events:none;background:rgba(12,12,20,.95);border:1px solid #2e2e48;border-radius:8px;padding:7px 10px;display:none;max-width:240px;box-shadow:0 6px 24px rgba(0,0,0,.5);z-index:9}
  #tip .fam{font-weight:600;font-size:14px}#tip .meta{color:#9a9ab0;font-size:11px;margin-top:2px}
  #tip .slop{color:#ff6b6b}#tip .fresh{color:#54e6b0}
</style></head><body>
<canvas id="c"></canvas>
<div id="hud">
  <h1>AI Slop Font Map</h1>
  <div class="sub">__COUNT__ fonts · DINOv2 visual embedding · UMAP</div>
  <div class="legend">
    <div class="row"><span class="cloud"></span> red clouds = over-used (AI slop)</div>
    <div class="row"><span class="dot" style="background:#5b8cff"></span> sans &nbsp;<span class="dot" style="background:#c084fc"></span> serif &nbsp;<span class="dot" style="background:#fbbf24"></span> display</div>
    <div class="row"><span class="dot" style="background:#34d399"></span> mono &nbsp;<span class="dot" style="background:#f472b6"></span> script</div>
    <input id="search" placeholder="search a font…" autocomplete="off">
    <div class="hint">scroll = zoom · drag = pan · hover a point</div>
  </div>
</div>
<div id="tip"></div>
<script>
const POINTS=/*__POINTS__*/, CATS=/*__CATS__*/, SUPS=/*__SUPS__*/;
const CC=['#c084fc','#5b8cff','#fbbf24','#34d399','#f472b6'];
const cv=document.getElementById('c'),ctx=cv.getContext('2d'),tip=document.getElementById('tip');
let W,H,DPR=Math.min(2,devicePixelRatio||1),view={s:1,px:0,py:0},initS=1,hover=null;
const ranked=[...POINTS].sort((a,b)=>b[2]-a[2]);
const rankOf=new Map(ranked.map((p,i)=>[p,i+1])), totalRanked=ranked.filter(p=>p[2]>0).length;
const labeled=ranked.filter(p=>p[2]>0.2).slice(0,54);
const SX=x=>x*view.s+view.px, SY=y=>y*view.s+view.py;
function resize(){W=innerWidth;H=innerHeight;cv.style.width=W+'px';cv.style.height=H+'px';cv.width=W*DPR;cv.height=H*DPR;draw();}
function fit(){const pad=70,s=Math.min((W-2*pad)/100,(H-2*pad)/100);view.s=s;view.px=(W-100*s)/2;view.py=(H-100*s)/2;initS=s;}
function draw(){
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.fillStyle='#07070d';ctx.fillRect(0,0,W,H);
  ctx.globalCompositeOperation='lighter';
  const zr=Math.min(2.4,Math.max(.5,view.s/initS));
  for(const p of POINTS){const s=p[2];if(s<=0.16)continue;const x=SX(p[0]),y=SY(p[1]);if(x<-220||x>W+220||y<-220||y>H+220)continue;
    const r=(12+s*72)*zr*.9,a=Math.min(.62,.12+s*.52),g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(255,46,46,'+a+')');g.addColorStop(1,'rgba(255,46,46,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();}
  ctx.globalCompositeOperation='source-over';
  for(const p of POINTS){const x=SX(p[0]),y=SY(p[1]);if(x<-8||x>W+8||y<-8||y>H+8)continue;
    ctx.fillStyle=CC[p[3]];ctx.globalAlpha=p[2]>0.16?.95:.6;ctx.beginPath();ctx.arc(x,y,p[2]>0.16?2.7:1.8,0,7);ctx.fill();}
  ctx.globalAlpha=1;ctx.textBaseline='middle';
  for(const p of labeled){const x=SX(p[0]),y=SY(p[1]);if(x<0||x>W||y<0||y>H)continue;
    ctx.font='600 '+Math.max(11,Math.min(21,9+p[2]*16))+'px "'+p[5]+'",system-ui,sans-serif';
    ctx.fillStyle='rgba(255,228,228,.96)';ctx.fillText(p[5],x+6,y);}
  if(view.s>initS*3.2){ctx.font='11px system-ui';ctx.fillStyle='rgba(200,220,255,.7)';let n=0;
    for(const p of POINTS){if(p[2]>0.2)continue;const x=SX(p[0]),y=SY(p[1]);if(x<0||x>W||y<0||y>H)continue;if(n++>340)break;ctx.fillText(p[5],x+4,y);}}
  if(hover){const x=SX(hover[0]),y=SY(hover[1]);ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,8,0,7);ctx.stroke();}
}
function pick(mx,my){let best=null,bd=110;for(const p of POINTS){const dx=SX(p[0])-mx,dy=SY(p[1])-my,d=dx*dx+dy*dy;if(d<bd){bd=d;best=p;}}return best;}
cv.addEventListener('mousemove',e=>{
  hover=pick(e.clientX,e.clientY);draw();
  if(hover){const sat=hover[2],r=rankOf.get(hover),sup=SUPS[hover[4]];
    tip.style.display='block';tip.style.left=Math.min(W-250,e.clientX+14)+'px';tip.style.top=(e.clientY+14)+'px';
    tip.innerHTML='<div class="fam" style="font-family:\''+hover[5]+'\',system-ui">'+hover[5]+'</div>'+
      '<div class="meta">'+(sat>0?'<span class="slop">● over-used — #'+r+' of '+totalRanked+' · '+(sat*100).toFixed(0)+'% saturation</span>':'<span class="fresh">● fresh</span>')+
      '<br>'+CATS[hover[3]]+(sup!=='google'?' · free · '+sup:' · google fonts')+'</div>';
  }else tip.style.display='none';
});
cv.addEventListener('mouseleave',()=>{hover=null;tip.style.display='none';draw();});
let drag=null;
cv.addEventListener('mousedown',e=>drag={x:e.clientX,y:e.clientY,px:view.px,py:view.py});
addEventListener('mouseup',()=>drag=null);
addEventListener('mousemove',e=>{if(drag){view.px=drag.px+(e.clientX-drag.x);view.py=drag.py+(e.clientY-drag.y);draw();}});
cv.addEventListener('wheel',e=>{e.preventDefault();const f=Math.exp(-e.deltaY*0.0015),wx=(e.clientX-view.px)/view.s,wy=(e.clientY-view.py)/view.s;
  view.s=Math.max(initS*.5,Math.min(initS*40,view.s*f));view.px=e.clientX-wx*view.s;view.py=e.clientY-wy*view.s;draw();},{passive:false});
document.getElementById('search').addEventListener('keydown',e=>{if(e.key!=='Enter')return;
  const q=e.target.value.toLowerCase().trim();if(!q)return;const p=POINTS.find(p=>p[5].toLowerCase().includes(q));
  if(p){view.s=initS*6;view.px=W/2-p[0]*view.s;view.py=H/2-p[1]*view.s;hover=p;draw();}});
addEventListener('resize',resize);
resize();fit();draw();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(draw);
</script></body></html>"""

visual = json.loads((ROOT / "data" / "font-visual-deep.json").read_text(encoding="utf8"))
index = {f["id"]: f for f in json.loads((ROOT / "data" / "fonts.index.json").read_text(encoding="utf8"))}
sat = {s["fontId"]: s.get("display", 0) for s in json.loads((ROOT / "data" / "saturation.json").read_text(encoding="utf8"))}

ids = [i for i in visual if i in index]
X = np.array([visual[i] for i in ids], dtype="float32")
print(f"Projecting {len(ids)} fonts ({X.shape[1]}-d) with UMAP ...")

reducer = umap.UMAP(n_neighbors=18, min_dist=0.12, metric="cosine", random_state=42, n_jobs=1)
Y = reducer.fit_transform(X)
Y = (Y - Y.min(0)) / (Y.max(0) - Y.min(0)) * 100  # normalize to 0..100

points = []
for k, i in enumerate(ids):
    f = index[i]
    cat = f.get("category", "display")
    points.append([round(float(Y[k, 0]), 2), round(float(Y[k, 1]), 2), round(float(sat.get(i, 0)), 3),
                   CATS.index(cat) if cat in CATS else 1, SUPS.index(f.get("supplier", "google")) if f.get("supplier") in SUPS else 0, f["family"]])

# Google families to webfont-load for in-font labels (the slop names)
slop = sorted([p for p in points if p[4] == 0 and p[2] > 0.2], key=lambda p: -p[2])[:54]
gf = "|".join(sorted({p[5].replace(" ", "+") for p in slop}))
gflink = f"https://fonts.googleapis.com/css?family={gf}&display=swap"

(ROOT / "data" / "font-projection.json").write_text(json.dumps(points), encoding="utf8")
html = (TEMPLATE.replace("/*__POINTS__*/", json.dumps(points)).replace("/*__CATS__*/", json.dumps(CATS))
        .replace("/*__SUPS__*/", json.dumps(SUPS)).replace("__GFLINK__", gflink).replace("__COUNT__", str(len(points))))
out = ROOT / "viz" / "font-projector.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf8")
print(f"Wrote {out} ({len(points)} fonts). Open it in a browser.")
