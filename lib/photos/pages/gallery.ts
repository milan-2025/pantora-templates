import "server-only";
import { esc, jsonScript, page } from "@/lib/photos/pages/shared";

/** /p/<link>: what guests see. The page is a shell; photos load from /api/photos/public/<link>. */
export function galleryHtml(o: { slug: string; names: string; cover: string | null; site: string; dateText: string }) {
  const title = `${o.names} · Wedding photos`;
  const body = `
<div id="pinScreen" class="screen" hidden><div class="card mini"><h1>${esc(o.names)}</h1><p class="hint">This gallery is private. Type the PIN the couple shared.</p>
 <div class="field"><input id="pinIn" inputmode="numeric" maxlength="8" placeholder="PIN" autocomplete="off"></div><p class="err" id="pinErr"></p><button class="btn btn-p" id="pinGo" type="button">Open gallery</button></div></div>
<div id="expired" class="screen" hidden><div class="card mini"><h1>${esc(o.names)}</h1><p>This gallery is resting for now. Please ask the couple to renew it.</p></div></div>
<div id="app" hidden>
 <header class="hero" id="hero"><div class="hero-in"><p class="kicker">Wedding photos</p><h1 id="hNames">${esc(o.names)}</h1><p id="hDate">${esc(o.dateText)}</p><p id="hMsg" class="msg"></p>
  <div class="row hero-btns"><button class="btn btn-l btn-s" id="shareBtn" type="button">Share</button><button class="btn btn-l btn-s" id="addBtn" type="button" hidden>Add your photos</button></div></div></header>
 <nav class="tabs" id="tabs" aria-label="Albums"></nav>
 <main class="wrap"><div id="grid" class="grid"></div><div id="more" class="more"></div><p id="empty" class="empty" hidden>Photos are on their way. Check back soon!</p></main>
 <footer class="foot" id="foot"></footer>
</div>
<div id="lb" class="lb" hidden role="dialog" aria-modal="true" aria-label="Photo viewer">
 <div class="lb-top"><span id="lbCount"></span><span class="sp"></span><button class="lbb" id="lbDl" type="button" aria-label="Download">⤓</button><button class="lbb" id="lbShare" type="button" aria-label="Share">↗</button><button class="lbb" id="lbClose" type="button" aria-label="Close">✕</button></div>
 <div class="lb-stage" id="lbStage"></div>
 <button class="lbn prev" id="lbPrev" type="button" aria-label="Previous">‹</button><button class="lbn next" id="lbNext" type="button" aria-label="Next">›</button>
</div>
<dialog id="up"><div class="dlg"><h3>Add your photos</h3>
 <div id="upForm"><p class="hint">Share the photos you clicked. The couple sees them first, then adds them to the gallery.</p>
  <div class="field"><label for="upName">Your name</label><input id="upName" maxlength="60" autocomplete="name" placeholder="Riya (bride's cousin)"></div>
  <div class="field"><label class="pick" for="upFiles">Choose photos</label><input id="upFiles" type="file" accept="image/*" multiple></div>
  <p class="err" id="upErr"></p><div class="row"><button class="btn btn-p" id="upGo" type="button">Send</button><button class="btn btn-x" type="button" data-close>Cancel</button></div></div>
 <div id="upProg" hidden><p id="upText">Preparing…</p><div class="bar"><i id="upBar"></i></div></div>
 <div id="upDone" hidden><p>Thank you! The couple will add your photos soon.</p><button class="btn btn-p" type="button" data-close>Done</button></div>
</div></dialog>`;

  const css = `
.screen{min-height:100vh;display:grid;place-items:center;padding:20px}.mini{max-width:420px;width:100%;text-align:center}.mini h1{font-size:40px;margin-bottom:8px}
.hero{position:relative;min-height:62vh;display:flex;align-items:flex-end;background:#2b1a1c center/cover no-repeat;color:#fff}
.hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#0000 30%,#000b)}
.hero-in{position:relative;z-index:1;padding:28px 22px 30px;max-width:1120px;margin:0 auto;width:100%}
.hero h1{font-size:clamp(44px,8vw,88px);text-shadow:0 2px 20px #0006}
.kicker{text-transform:uppercase;letter-spacing:.12em;font-size:13px;font-weight:700;opacity:.9;margin-bottom:4px}
.msg{max-width:40em;opacity:.95}.hero-btns{margin-top:12px}
.btn-l{background:#ffffffe6;color:var(--ink)}.btn-l:hover{background:#fff}
.tabs{position:sticky;top:0;z-index:5;display:flex;gap:8px;overflow-x:auto;padding:12px 16px;background:#f7ece8f2;backdrop-filter:blur(8px);border-bottom:1px solid var(--line);scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tab{flex:none;border:1.5px solid var(--line);background:#fff;border-radius:999px;padding:6px 16px;font:500 15px Mukta,sans-serif;cursor:pointer;color:var(--ink)}
.tab[aria-selected=true]{background:var(--sindoor);border-color:var(--sindoor);color:#fff}.tab small{opacity:.75;margin-left:4px}
.wrap{max-width:1500px;margin:0 auto;padding:12px}
.grid{columns:2;column-gap:8px}@media (min-width:700px){.grid{columns:3}}@media (min-width:1100px){.grid{columns:4;column-gap:10px}}@media (min-width:1500px){.grid{columns:5}}
.cell{display:block;width:100%;margin:0 0 8px;break-inside:avoid;border:0;padding:0;background:#e9dcd6;border-radius:10px;overflow:hidden;cursor:zoom-in;position:relative}
.cell img{display:block;width:100%;height:auto;opacity:0;transition:opacity .3s}.cell img.ld{opacity:1}
.cell .play{position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-size:42px;text-shadow:0 2px 12px #0008;pointer-events:none}
.cell .dur{position:absolute;right:8px;bottom:8px;background:#000a;color:#fff;border-radius:6px;padding:0 6px;font-size:13px}
.more{text-align:center;padding:20px}.empty{text-align:center;color:var(--mut);padding:40px}
.foot{text-align:center;color:var(--mut);padding:30px 16px 40px;font-size:15px}
.lb{position:fixed;inset:0;z-index:50;background:#0d0708;color:#fff;display:flex;flex-direction:column;touch-action:pan-y}
.lb-top{display:flex;align-items:center;gap:6px;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top))}
.lbb{background:#ffffff1a;color:#fff;border:0;border-radius:999px;width:42px;height:42px;font-size:20px;cursor:pointer}
.lb-stage{flex:1;display:grid;place-items:center;min-height:0;padding:0 8px 16px}
.lb-stage img,.lb-stage video{max-width:100%;max-height:100%;object-fit:contain;border-radius:4px}
.lb-stage iframe{width:min(100%,1200px);aspect-ratio:16/9;border:0;max-height:100%}
.lbn{position:absolute;top:50%;transform:translateY(-50%);background:#ffffff1f;color:#fff;border:0;width:48px;height:64px;font-size:36px;cursor:pointer;border-radius:12px}
.lbn.prev{left:8px}.lbn.next{right:8px}@media (max-width:700px){.lbn{display:none}}
.pick{border:2px dashed var(--line);border-radius:14px;padding:18px;text-align:center;cursor:pointer;color:var(--sindoor)}
.bar{height:10px;background:var(--line);border-radius:99px;overflow:hidden}.bar i{display:block;height:100%;width:0;background:var(--sindoor);transition:width .2s}
`;

  const js = `
var SLUG=${jsonScript(o.slug)},PASSK="pt-photos-pass:"+SLUG,pass=lsGet(PASSK)||"",D=null,items=[],album=null,page=1,loading=false,cur=-1;
function hdr(){return pass?{"x-gallery-pass":pass}:{}}
function load(reset){if(loading)return;loading=true;
 api("public/"+encodeURIComponent(SLUG)+"?page="+page+(album?"&album="+encodeURIComponent(album):""),{headers:hdr()}).then(function(r){loading=false;
  if(r.expired){$("expired").hidden=false;return}
  if(r.needPin){lsDel(PASSK);pass="";$("pinScreen").hidden=false;$("pinIn").focus();return}
  D=r;$("pinScreen").hidden=true;$("app").hidden=false;if(!album)album=r.album;
  if(reset){items=[];$("grid").innerHTML=""}
  if(page===1)head();
  r.items.forEach(add);items=items.concat(r.items);
  $("empty").hidden=items.length>0;
  $("more").innerHTML=r.more?'<button class="btn btn-g" id="moreBtn" type="button">Load more</button>':"";
  if(r.more){$("moreBtn").onclick=next;obs.observe($("moreBtn"))}
 }).catch(function(e){loading=false;toast(e.message)})}
function next(){if(D&&D.more&&!loading){page++;load(false)}}
var obs=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)next()})},{rootMargin:"800px"});
function head(){if(D.cover)$("hero").style.backgroundImage="url("+JSON.stringify(D.cover)+")";$("hMsg").textContent=D.message||"";
 $("addBtn").hidden=!D.guestUploads;
 $("tabs").innerHTML=D.albums.map(function(a){return '<button class="tab" role="tab" type="button" data-a="'+esc(a.id)+'" aria-selected="'+(a.id===album)+'">'+esc(a.name)+'<small>'+a.n+'</small></button>'}).join("");
 $("tabs").hidden=D.albums.length<2;
 $("tabs").querySelectorAll(".tab").forEach(function(t){t.onclick=function(){album=t.dataset.a;page=1;load(true);var top=$("tabs").getBoundingClientRect().top+scrollY;if(scrollY>top)scrollTo({top:top})}});
 $("foot").innerHTML=D.branding?'Made with love on <a href="/photos">Pandora Templates</a>. Share your wedding photos too.':'<a href="/photos">Pandora Templates</a>'}
function add(it){var b=document.createElement("button");b.type="button";b.className="cell";b.setAttribute("aria-label",it.k==="video"?"Play video":"Open photo");
 var ratio=it.w&&it.h?(it.h/it.w):0.75;var img=document.createElement("img");img.loading="lazy";img.decoding="async";img.alt="";img.width=400;img.height=Math.round(400*ratio);img.src=it.t;img.onload=function(){img.classList.add("ld")};
 b.appendChild(img);if(it.k==="video"){b.insertAdjacentHTML("beforeend",'<span class="play">▶</span>'+(it.dur?'<span class="dur">'+Math.floor(it.dur/60)+":"+String(Math.round(it.dur%60)).padStart(2,"0")+"</span>":""))}
 var idx=$("grid").children.length;b.onclick=function(){open(idx)};$("grid").appendChild(b)}
function open(i){cur=i;$("lb").hidden=false;document.body.style.overflow="hidden";show();history.pushState({lb:1},"")}
function close(){if($("lb").hidden)return;$("lb").hidden=true;$("lbStage").innerHTML="";document.body.style.overflow=""}
function show(){var it=items[cur];if(!it)return;$("lbCount").textContent=(cur+1)+" / "+(D.more?items.length+"+":items.length);
 var st=$("lbStage");st.innerHTML="";
 if(it.k==="video"){if(it.e){st.innerHTML='<iframe src="'+esc(it.e)+'" allow="autoplay;fullscreen;picture-in-picture" allowfullscreen></iframe>'}else{var v=document.createElement("video");v.controls=true;v.playsInline=true;v.preload="metadata";v.poster=it.t;v.src=it.v;st.appendChild(v)}}
 else{var im=document.createElement("img");im.alt="";im.src=it.t;st.appendChild(im);var full=new Image();full.onload=function(){if(items[cur]===it)im.src=it.d};full.src=it.d;
  var n=items[cur+1];if(n&&n.d){(new Image()).src=n.d}}
 $("lbDl").hidden=!D.download;if(cur>=items.length-3)next()}
function step(d){var n=cur+d;if(n<0||n>=items.length)return;cur=n;show()}
$("lbPrev").onclick=function(){step(-1)};$("lbNext").onclick=function(){step(1)};$("lbClose").onclick=function(){history.back()};
addEventListener("popstate",close);
addEventListener("keydown",function(e){if($("lb").hidden)return;if(e.key==="ArrowRight")step(1);if(e.key==="ArrowLeft")step(-1);if(e.key==="Escape")history.back()});
(function(){var x0=null,y0=0;$("lbStage").addEventListener("touchstart",function(e){x0=e.touches[0].clientX;y0=e.touches[0].clientY},{passive:true});
 $("lbStage").addEventListener("touchend",function(e){if(x0===null)return;var dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy))step(dx<0?1:-1);else if(dy>90)history.back();x0=null},{passive:true})})();
$("lbDl").onclick=function(){var it=items[cur];if(!it)return;var u=it.k==="video"?it.v:(it.o||it.d);download(u,(D.names||"wedding").replace(/[^a-z0-9]+/gi,"-")+"-"+(cur+1)+(it.k==="video"?".mp4":".jpg"))};
function share(url){var data={title:D?D.names+" · Wedding photos":document.title,url:url};if(navigator.share)navigator.share(data).catch(function(){});else{navigator.clipboard.writeText(url).then(function(){toast("Link copied")})}}
$("shareBtn").onclick=function(){share(location.origin+"/p/"+SLUG)};$("lbShare").onclick=function(){share(location.origin+"/p/"+SLUG)};
$("pinGo").onclick=function(){$("pinErr").textContent="";var pin=$("pinIn").value;api("public/"+encodeURIComponent(SLUG)+"/pin",{body:{pin:pin}}).then(function(r){pass=r.pass;lsSet(PASSK,pass);page=1;load(true)}).catch(function(e){$("pinErr").textContent=e.message})};
$("pinIn").onkeydown=function(e){if(e.key==="Enter")$("pinGo").click()};
document.querySelectorAll("[data-close]").forEach(function(b){b.onclick=function(){b.closest("dialog").close()}});
$("addBtn").onclick=function(){$("upForm").hidden=false;$("upProg").hidden=true;$("upDone").hidden=true;$("upErr").textContent="";$("upName").value=lsGet("pt-guest-name")||"";$("up").showModal()};
$("upFiles").onchange=function(){var n=$("upFiles").files.length;document.querySelector(".pick").textContent=n?n+" photo"+(n>1?"s":"")+" chosen":"Choose photos"};
$("upGo").onclick=function(){var files=[].slice.call($("upFiles").files),name=$("upName").value.trim();$("upErr").textContent="";
 if(name.length<2){$("upErr").textContent="Please add your name";return}if(!files.length){$("upErr").textContent="Choose some photos";return}
 if(files.length>100){$("upErr").textContent="Up to 100 photos at a time, please";return}
 lsSet("pt-guest-name",name);$("upForm").hidden=true;$("upProg").hidden=false;var sent=0,fail=0;
 function batch(i){if(i>=files.length){$("upProg").hidden=true;if(sent){$("upDone").hidden=false}else{$("upForm").hidden=false;$("upErr").textContent="Those photos couldn't be sent. Please try again."}return}
  var chunk=files.slice(i,i+10);$("upText").textContent="Sending "+(i+1)+"–"+(i+chunk.length)+" of "+files.length+"…";
  Promise.all(chunk.map(function(f){return prepPhoto(f,false).then(function(p){p.f=f;return p}).catch(function(){fail++;return null})})).then(function(ps){ps=ps.filter(Boolean);if(!ps.length)return batch(i+10);
   return api("public/"+encodeURIComponent(SLUG)+"/upload",{headers:hdr(),body:{name:name,files:ps.map(function(p){return{kind:"photo",name:p.f.name,d:p.d.size,t:p.t.size,w:p.w,h:p.h,takenAt:p.f.lastModified}})}}).then(function(r){
    return Promise.all(r.items.map(function(it,k){var p=ps[k];return Promise.all(it.puts.map(function(u){return putFile(u.url,p[u.part],u.type)})).then(function(){return it.id}).catch(function(){fail++;return null})})).then(function(ids){ids=ids.filter(Boolean);
     return ids.length?api("public/"+encodeURIComponent(SLUG)+"/done",{headers:hdr(),body:{ids:r.items.map(function(x){return x.id}),ticket:r.ticket}}).then(function(d){sent+=d.done.length}):null})})
  }).then(function(){$("upBar").style.width=Math.round(Math.min(1,(i+10)/files.length)*100)+"%";batch(i+10)}).catch(function(e){$("upProg").hidden=true;$("upForm").hidden=false;$("upErr").textContent=e.message})}
 batch(0)};
load(true);
`;

  return page({ title, description: `Wedding photos of ${o.names}`, body, css, js, noindex: true, ogImage: o.cover, canonical: `${o.site}/p/${o.slug}` });
}
