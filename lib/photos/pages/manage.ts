import "server-only";
import { trackingScript } from "@/lib/tracking";
import { esc, jsonScript, page } from "@/lib/photos/pages/shared";

/** /p/<link>/manage: the couple's dashboard. The private key arrives after "#k=" (never sent to the server in the URL). */
export function manageHtml(o: { slug: string; names: string }) {
  const body = `
<div id="gate" class="gate" hidden><div class="card mini"><h1>${esc(o.names)}</h1><p class="hint">Sign in with the email you used for this gallery. We'll send a 6-digit code.</p>
 <div id="g1"><div class="field"><input id="gEmail" type="email" autocomplete="email" placeholder="you@example.com"></div><p class="err" id="gErr"></p><button class="btn btn-p" id="gSend" type="button">Send code</button></div>
 <div id="g2" hidden><div class="field"><input id="gCode" inputmode="numeric" maxlength="6" placeholder="123456" autocomplete="one-time-code"></div><p class="err" id="gErr2"></p><button class="btn btn-p" id="gVerify" type="button">Open dashboard</button></div>
</div></div>

<div id="app" hidden>
<header class="bar"><div class="w bar-in"><a class="logo" href="/photos"><img src="/icon.svg" alt="" width="26" height="26"></a>
 <div class="sp"><h1 id="tNames"></h1><p class="hint" id="tPlan"></p></div>
 <a class="btn btn-g btn-s" id="viewBtn" target="_blank" rel="noopener">View gallery</a></div>
 <nav class="w nav" role="tablist"><button type="button" data-tab="photos" aria-selected="true">Photos</button><button type="button" data-tab="share">Share</button><button type="button" data-tab="settings">Settings</button><button type="button" data-tab="plan">Plan</button></nav>
</header>
<div class="w"><div id="notice" class="notice" hidden></div></div>

<main class="w">
<section id="tab-photos">
 <div class="card upl" id="drop">
  <div class="row"><div class="sp"><h2>Add photos & videos</h2><p class="hint" id="useText"></p></div></div>
  <div class="meter"><i id="useBar"></i></div><p class="hint" id="vidText"></p>
  <div class="row upl-row">
   <div class="field sp"><label for="upAlbum">Into album</label><select id="upAlbum"></select></div>
   <label class="chk" id="origWrap" hidden><input type="checkbox" id="upOrig"> Keep full-size originals</label>
  </div>
  <div class="row"><label class="btn btn-p" for="fileIn">Choose photos/videos</label><input id="fileIn" type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple hidden><span class="hint hide-s">or drop them anywhere here</span></div>
  <div id="q" class="q" hidden><div class="row"><b id="qText" class="sp"></b><button class="btn btn-x" id="qStop" type="button">Stop</button></div><div class="meter"><i id="qBar"></i></div><p class="err" id="qErr"></p></div>
 </div>
 <div class="chips" id="chips"></div>
 <div class="selbar" id="selbar" hidden><b id="selN"></b><span class="sp"></span>
  <select id="moveTo" aria-label="Move to album"><option value="">Move to…</option></select>
  <button class="btn btn-s btn-g" id="sApprove" type="button">Approve</button>
  <button class="btn btn-s btn-g" id="sHide" type="button">Hide</button>
  <button class="btn btn-s btn-g" id="sShow" type="button">Show</button>
  <button class="btn btn-s btn-g" id="sCover" type="button">Set as cover</button>
  <button class="btn btn-s btn-g danger" id="sDel" type="button">Delete</button>
  <button class="btn btn-x" id="sClear" type="button">Clear</button></div>
 <div id="grid" class="grid"></div><p id="empty" class="hint empty" hidden>Nothing here yet.</p>
</section>

<section id="tab-share" hidden>
 <div class="two">
  <div class="card"><h2>Your gallery link</h2><p class="lnk" id="link"></p>
   <div class="row"><button class="btn btn-p btn-s" id="copyBtn" type="button">Copy link</button><a class="btn btn-w btn-s" id="waBtn" target="_blank" rel="noopener">Send on WhatsApp</a></div>
   <p class="hint" style="margin-top:14px">Your photographer can upload too: share this dashboard's address (it includes your private key) only with people you trust.</p>
   <button class="btn btn-g btn-s" id="copyManage" type="button">Copy dashboard link for photographer</button></div>
  <div class="card qr-card"><h2>QR code for the venue</h2><div id="qr" class="qr"></div><p class="hint">Print it on table cards or a standee. Guests scan and see the photos.</p>
   <button class="btn btn-g btn-s" id="qrDl" type="button">Download QR card</button></div>
 </div>
 <div class="card"><h2>Private PIN</h2><p class="hint" id="pinState"></p>
  <div class="row"><input id="pinIn" inputmode="numeric" maxlength="8" placeholder="4–8 digits" style="max-width:200px"><button class="btn btn-p btn-s" id="pinSave" type="button">Save PIN</button><button class="btn btn-x" id="pinOff" type="button">Remove PIN</button></div></div>
</section>

<section id="tab-settings" hidden>
 <div class="card"><h2>Details</h2>
  <div class="field"><label for="sNames">Names</label><input id="sNames" maxlength="80"></div>
  <div class="field"><label for="sDate">Wedding date</label><input id="sDate" type="date"></div>
  <div class="field"><label for="sMsg">Message to guests (optional)</label><textarea id="sMsg" rows="3" maxlength="600" placeholder="Thank you for being part of our day!"></textarea></div>
  <label class="chk"><input type="checkbox" id="sDl"> Guests can download photos</label>
  <label class="chk" id="sGuWrap"><input type="checkbox" id="sGu"> Guests can add their photos (you approve them)</label>
  <p class="err" id="sErr"></p><button class="btn btn-p" id="sSave" type="button">Save</button></div>
 <div class="card"><h2>Albums</h2><p class="hint">Rename, reorder or add albums. An album can be removed once it's empty.</p><div id="albList"></div>
  <div class="row"><input id="albNew" maxlength="40" placeholder="New album, e.g. Engagement" style="max-width:280px"><button class="btn btn-g btn-s" id="albAdd" type="button">Add</button></div>
  <p class="err" id="albErr"></p><button class="btn btn-p" id="albSave" type="button">Save albums</button></div>
</section>

<section id="tab-plan" hidden>
 <div class="card" id="planNow"></div>
 <div class="plans" id="plans"></div>
 <div class="card"><div class="row"><div class="field sp"><label for="coupon">Have a code?</label><input id="coupon" maxlength="30" placeholder="CODE" style="text-transform:uppercase"></div></div><p class="hint">It's applied when you choose a plan.</p></div>
</section>
</main>
</div>`;

  const css = `
.gate{min-height:100vh;display:grid;place-items:center;padding:20px}.mini{max-width:420px;width:100%}.mini h1{font-size:36px;margin-bottom:8px}
.bar{background:var(--card);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:10}
.bar-in{display:flex;align-items:center;gap:14px;padding-top:12px;padding-bottom:8px}.bar h1{font-size:28px}.bar .hint{margin:0}
.nav{display:flex;gap:4px;overflow-x:auto}.nav button{border:0;background:none;font:600 16px Mukta,sans-serif;padding:10px 14px;border-bottom:3px solid transparent;cursor:pointer;color:var(--mut)}
.nav button[aria-selected=true]{color:var(--sindoor);border-color:var(--sindoor)}
main{padding-top:20px;padding-bottom:80px}main .card{margin-bottom:16px}h2{font-size:28px;margin-bottom:6px}
.notice{background:#fff4dc;border:1px solid #f0d58a;border-radius:14px;padding:12px 16px;margin-top:14px}
.meter{height:8px;background:var(--line);border-radius:99px;overflow:hidden;margin:6px 0 8px}.meter i{display:block;height:100%;width:0;background:var(--sindoor);transition:width .3s}
.upl.drag{outline:3px dashed var(--sindoor);outline-offset:4px}.upl-row{align-items:flex-end;margin-top:6px}
.chk{display:flex;gap:8px;align-items:center;font-weight:400;margin:8px 0}.chk input{width:auto}
.q{margin-top:14px;border-top:1px solid var(--line);padding-top:12px}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 12px}.chip{border:1.5px solid var(--line);background:#fff;border-radius:999px;padding:4px 14px;font:500 15px Mukta,sans-serif;cursor:pointer;color:var(--ink)}
.chip[aria-pressed=true]{background:var(--sindoor);border-color:var(--sindoor);color:#fff}.chip.warn{border-color:var(--marigold)}
.selbar{position:sticky;top:96px;z-index:9;display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:var(--ink);color:#fff;padding:10px 14px;border-radius:16px;margin-bottom:12px}
.selbar select{width:auto;padding:6px 10px}.selbar .btn-g{border-color:#fff;color:#fff}.selbar .btn-x{color:#fff}.selbar .danger{border-color:#ff8a80;color:#ffb4ab}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
.tile{position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;background:#e9dcd6;border:0;padding:0;cursor:pointer}
.tile img{width:100%;height:100%;object-fit:cover;display:block}.tile .tick{position:absolute;top:6px;left:6px;width:24px;height:24px;border-radius:50%;border:2px solid #fff;background:#0004}
.tile.on{outline:3px solid var(--sindoor);outline-offset:-3px}.tile.on .tick{background:var(--sindoor)}.tile.on .tick::after{content:"✓";color:#fff;font-size:14px;display:grid;place-items:center;height:100%}
.tile .lab{position:absolute;left:6px;bottom:6px;right:6px;display:flex;gap:4px;flex-wrap:wrap}.tile .lab span{background:#000b;color:#fff;font-size:12px;border-radius:6px;padding:0 6px}
.tile.hid img{opacity:.35}.empty{text-align:center;padding:30px}
.two{display:grid;grid-template-columns:1.2fr .8fr;gap:16px}@media (max-width:820px){.two{grid-template-columns:1fr}}
.lnk{font-weight:600;word-break:break-all;background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.qr{background:#fff;border-radius:14px;padding:14px;display:grid;place-items:center;margin:8px 0}.qr svg{width:200px;height:200px}
.alb{display:flex;gap:6px;align-items:center;margin-bottom:8px}.alb input{flex:1}.alb .n{font-size:14px;color:var(--mut);min-width:70px}
.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px}@media (max-width:900px){.plans{grid-template-columns:1fr}}
.plan{background:#fff;border:1.5px solid var(--line);border-radius:20px;padding:20px;display:flex;flex-direction:column}.plan.cur{border-color:var(--mehndi)}
.plan h3{font-size:28px}.plan .price{font-size:28px;font-weight:700;margin:4px 0}.plan ul{padding-left:18px;font-size:15px;flex:1}
@media (max-width:640px){.hide-s{display:none}.bar h1{font-size:22px}.selbar{top:92px}}
`;

  const js = `
var SLUG=${jsonScript(o.slug)},TK="pt-photos:"+SLUG,token="",M=null,filter="all",sel=new Set(),albEdit=[],stop=false;
(function(){var h=location.hash.match(/k=([a-f0-9]{16,64})/);if(h){token=h[1];lsSet(TK,token);history.replaceState(null,"",location.pathname+location.search)}else token=lsGet(TK)||""})();
function A(p,body){return api("manage/"+encodeURIComponent(SLUG)+(p?"/"+p:""),{headers:{"x-edit-token":token},body:body})}
function boot(){if(!token){gate();return}A("").then(function(r){M=r;$("gate").hidden=true;$("app").hidden=false;render()}).catch(function(e){if(e.status===403){lsDel(TK);token="";gate()}else toast(e.message)})}
function gate(){$("gate").hidden=false;$("app").hidden=true}
$("gSend").onclick=function(){$("gErr").textContent="";api("auth/start",{body:{email:$("gEmail").value}}).then(function(r){$("g1").hidden=true;$("g2").hidden=false;if(r.devCode)$("gCode").value=r.devCode}).catch(function(e){$("gErr").textContent=e.message})};
$("gVerify").onclick=function(){$("gErr2").textContent="";api("auth/verify",{body:{email:$("gEmail").value,code:$("gCode").value}}).then(function(r){r.galleries.forEach(function(g){lsSet("pt-photos:"+g.slug,g.token)});
 var mine=r.galleries.find(function(g){return g.slug===SLUG});if(mine){token=mine.token;boot()}else if(r.galleries[0]){location.href="/p/"+r.galleries[0].slug+"/manage"}else $("gErr2").textContent="This email has no gallery."}).catch(function(e){$("gErr2").textContent=e.message})};

document.querySelectorAll(".nav button").forEach(function(b){b.onclick=function(){document.querySelectorAll(".nav button").forEach(function(x){x.setAttribute("aria-selected",x===b)});
 ["photos","share","settings","plan"].forEach(function(t){$("tab-"+t).hidden=t!==b.dataset.tab});if(b.dataset.tab==="share")drawQr()}});
function tab(t){document.querySelector('.nav button[data-tab="'+t+'"]').click()}

function render(){var g=M.gallery,p=M.plan,u=M.usage;$("tNames").textContent=g.names;document.title=g.names+" · Gallery dashboard";
 var until=g.expiresAt?new Date(g.expiresAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"";
 $("tPlan").textContent=p.name+" plan"+(until?(g.online?" · online until ":" · expired on ")+until:"");$("viewBtn").href="/p/"+g.slug;
 var days=g.expiresAt?Math.ceil((new Date(g.expiresAt)-Date.now())/864e5):999;
 $("notice").hidden=!( !g.online || days<=14 || !g.paid);
 $("notice").innerHTML=!g.online?'Your gallery is offline for guests. <a href="#" data-go="plan">'+(g.paid?"Renew it":"Choose a plan")+"</a> to bring it back.":days<=14?"Your gallery goes offline in "+days+' day'+(days===1?"":"s")+'. <a href="#" data-go="plan">'+(g.paid?"Renew":"Choose a plan")+"</a>":'You are on the free trial ('+p.maxPhotos+' photos, '+days+' days left). <a href="#" data-go="plan">See plans</a>';
 $("notice").querySelectorAll("[data-go]").forEach(function(a){a.onclick=function(e){e.preventDefault();tab(a.dataset.go)}});
 $("useText").textContent=u.photos.toLocaleString("en-IN")+" of "+p.maxPhotos.toLocaleString("en-IN")+" photos used";$("useBar").style.width=Math.min(100,u.photos/p.maxPhotos*100)+"%";
 $("vidText").textContent=p.videoGb>0?"Video: "+fmtBytes(u.videoBytes)+" of "+p.videoGb+" GB":"Videos: available on Premium and Royal";
 $("origWrap").hidden=!p.originals;
 var opts=g.albums.map(function(a){return '<option value="'+esc(a.id)+'">'+esc(a.name)+"</option>"}).join("");$("upAlbum").innerHTML=opts;$("moveTo").innerHTML='<option value="">Move to…</option>'+opts;
 chips();grid();share();settings();plans()}

function chips(){var g=M.gallery,c={all:0,review:0,hidden:0};M.items.forEach(function(it){c.all++;c[it.a]=(c[it.a]||0)+1;if(it.s==="review")c.review++;if(it.s==="hidden")c.hidden++});
 var list=[["all","All",c.all]].concat(g.albums.map(function(a){return[a.id,a.name,c[a.id]||0]}));if(c.review)list.push(["review","To approve",c.review]);if(c.hidden)list.push(["hidden","Hidden",c.hidden]);
 $("chips").innerHTML=list.map(function(x){return '<button type="button" class="chip'+(x[0]==="review"?" warn":"")+'" aria-pressed="'+(filter===x[0])+'" data-f="'+esc(x[0])+'">'+esc(x[1])+" ("+x[2]+")</button>"}).join("");
 $("chips").querySelectorAll(".chip").forEach(function(b){b.onclick=function(){filter=b.dataset.f;sel.clear();chips();grid()}})}
function shown(){return M.items.filter(function(it){return filter==="all"||(filter==="review"?it.s==="review":filter==="hidden"?it.s==="hidden":it.a===filter)})}
function grid(){var list=shown(),albName={};M.gallery.albums.forEach(function(a){albName[a.id]=a.name});
 $("grid").innerHTML=list.map(function(it){var lab=[];if(it.k==="video")lab.push(it.e?"▶ video (HD)":"▶ video");if(it.s==="review")lab.push("from "+(it.g||"a guest"));if(it.s==="hidden")lab.push("hidden");if(M.gallery.cover===it.i)lab.push("cover");
  return '<button type="button" class="tile'+(sel.has(it.i)?" on":"")+(it.s==="hidden"?" hid":"")+'" data-i="'+esc(it.i)+'" title="'+esc((it.n||"")+(filter==="all"?" · "+(albName[it.a]||""):""))+'"><img loading="lazy" alt="" src="'+esc(it.t)+'"><span class="tick"></span><span class="lab">'+lab.map(function(l){return"<span>"+esc(l)+"</span>"}).join("")+"</span></button>"}).join("");
 $("empty").hidden=list.length>0;
 $("grid").querySelectorAll(".tile").forEach(function(t){t.onclick=function(){var i=t.dataset.i;if(sel.has(i))sel.delete(i);else sel.add(i);t.classList.toggle("on");selbar()}});selbar()}
function selbar(){$("selbar").hidden=!sel.size;$("selN").textContent=sel.size+" selected";var its=M.items.filter(function(it){return sel.has(it.i)});
 $("sApprove").hidden=!its.some(function(it){return it.s==="review"});$("sHide").hidden=!its.some(function(it){return it.s==="ready"});$("sShow").hidden=!its.some(function(it){return it.s==="hidden"});
 $("sCover").hidden=!(its.length===1&&its[0].k==="photo")}
function act(action,extra){var ids=Array.from(sel);var body={action:action,ids:ids};for(var k in extra||{})body[k]=extra[k];
 return A("items",body).then(function(){sel.clear();return A("")}).then(function(r){M=r;render();toast("Done")}).catch(function(e){toast(e.message)})}
$("sApprove").onclick=function(){act("approve")};$("sHide").onclick=function(){act("hide")};$("sShow").onclick=function(){act("show")};
$("sDel").onclick=function(){if(confirm("Delete "+sel.size+" item"+(sel.size>1?"s":"")+" for good?"))act("delete")};
$("sClear").onclick=function(){sel.clear();grid()};
$("moveTo").onchange=function(){var a=$("moveTo").value;$("moveTo").value="";if(a)act("move",{album:a})};
$("sCover").onclick=function(){var id=Array.from(sel)[0];A("settings",{cover:id}).then(function(){M.gallery.cover=id;sel.clear();grid();toast("Cover photo set")}).catch(function(e){toast(e.message)})};

/* ---------- uploading ---------- */
var queue=[],busy=false,doneN=0,totalN=0,failN=0;
$("fileIn").onchange=function(){enqueue([].slice.call($("fileIn").files));$("fileIn").value=""};
(function(){var d=$("drop");["dragenter","dragover"].forEach(function(t){document.addEventListener(t,function(e){e.preventDefault();d.classList.add("drag")})});
 ["dragleave","drop"].forEach(function(t){document.addEventListener(t,function(e){e.preventDefault();if(t==="drop"||e.target===document.documentElement)d.classList.remove("drag")})});
 document.addEventListener("drop",function(e){if(e.dataTransfer&&e.dataTransfer.files.length)enqueue([].slice.call(e.dataTransfer.files))})})();
function enqueue(files){if(!M.gallery.online){toast("Your gallery has expired. Renew it to add photos.");tab("plan");return}
 var album=$("upAlbum").value,orig=$("upOrig").checked&&M.plan.originals,skipped=0;
 files.forEach(function(f){var vid=/^video\\//.test(f.type),img=/^image\\//.test(f.type)||/\\.(heic|heif)$/i.test(f.name);
  if(vid&&M.plan.videoGb<=0){skipped++;return}if(!vid&&!img){skipped++;return}queue.push({f:f,vid:vid,album:album,orig:orig})});
 if(skipped)toast(skipped+" file"+(skipped>1?"s":"")+" skipped"+(M.plan.videoGb<=0?" (videos need Premium or Royal)":""));
 totalN+=files.length-skipped;stop=false;$("q").hidden=false;$("qErr").textContent="";if(!busy)pump()}
function prog(extra){$("qText").textContent=busy?"Uploading "+Math.min(doneN+1,totalN)+" of "+totalN+(extra?" · "+extra:""):"Uploaded "+doneN+" of "+totalN+(failN?" · "+failN+" failed":"");$("qBar").style.width=(totalN?doneN/totalN*100:0)+"%"}
$("qStop").onclick=function(){stop=true;queue=[];toast("Stopped after the current files")};
function pump(){if(stop||!queue.length){busy=false;prog();if(doneN)A("").then(function(r){M=r;render()});return}busy=true;
 var vids=queue.filter(function(x){return x.vid});var batch=vids.length&&queue[0].vid?[queue.shift()]:queue.splice(0,Math.min(8,queue.length)).filter(function(x){if(x.vid){queue.unshift(x);return false}return true});
 prog("preparing");
 Promise.all(batch.map(function(x){return(x.vid?prepVideo(x.f).then(function(p){p.v=x.f;return p}):prepPhoto(x.f,x.orig)).then(function(p){p.x=x;return p}).catch(function(e){failN++;$("qErr").textContent=e.message;return null})}))
 .then(function(ps){ps=ps.filter(Boolean);if(!ps.length)return;
  return A("upload",{files:ps.map(function(p){var x=p.x;return x.vid?{kind:"video",name:x.f.name,album:x.album,type:x.f.type||"video/mp4",v:x.f.size,t:p.t.size,w:p.w,h:p.h,dur:p.dur,takenAt:x.f.lastModified}
    :{kind:"photo",name:x.f.name,album:x.album,d:p.d.size,t:p.t.size,o:p.o?p.o.size:undefined,w:p.w,h:p.h,takenAt:x.f.lastModified}})})
  .then(function(r){var ids=[];return Promise.all(r.items.map(function(it,k){var p=ps[k];return Promise.all(it.puts.map(function(u){var blob=u.part==="v"?p.v:p[u.part];
    return putFile(u.url,blob,u.type,u.part==="v"?function(n){prog(Math.round(n/blob.size*100)+"% of "+fmtBytes(blob.size))}:null)})).then(function(){ids.push(it.id)}).catch(function(e){failN++;$("qErr").textContent=e.message})}))
   .then(function(){return ids.length?A("done",{ids:ids}):{done:[],failed:[]}}).then(function(d){doneN+=d.done.length;failN+=d.failed.length})})})
 .catch(function(e){$("qErr").textContent=e.message;if(e.status===402){stop=true;queue=[];tab("plan")}})
 .then(function(){prog();pump()})}

/* ---------- share ---------- */
function share(){var g=M.gallery;$("link").textContent=g.link;
 $("waBtn").href="https://wa.me/?text="+encodeURIComponent("Our wedding photos are here 💛 "+g.link+(g.hasPin?" (PIN: ask us)":""));
 $("pinState").textContent=g.hasPin?"A PIN is on. Guests type it once on each phone.":"No PIN: anyone with the link can see the photos.";$("pinOff").hidden=!g.hasPin}
$("copyBtn").onclick=function(){navigator.clipboard.writeText(M.gallery.link).then(function(){toast("Link copied")})};
$("copyManage").onclick=function(){navigator.clipboard.writeText(location.origin+"/p/"+SLUG+"/manage#k="+token).then(function(){toast("Dashboard link copied. Share it only with your photographer.")})};
var qrLoaded=false;function drawQr(){if(!M)return;if(!window.qrcode){if(!qrLoaded){qrLoaded=true;var s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";s.onload=drawQr;document.head.appendChild(s)}return}
 var q=qrcode(0,"M");q.addData(M.gallery.link);q.make();$("qr").innerHTML=q.createSvgTag(6,0)}
$("qrDl").onclick=function(){if(!window.qrcode)return;var q=qrcode(0,"H");q.addData(M.gallery.link);q.make();var n=q.getModuleCount(),c=document.createElement("canvas"),W=1200,H=1650;c.width=W;c.height=H;var x=c.getContext("2d");
 x.fillStyle="#fffaf8";x.fillRect(0,0,W,H);x.strokeStyle="#7a1424";x.lineWidth=10;x.strokeRect(40,40,W-80,H-80);x.fillStyle="#7a1424";x.textAlign="center";
 x.font="600 92px 'Cormorant Garamond', Georgia, serif";x.fillText(M.gallery.names,W/2,230);x.font="48px Mukta, sans-serif";x.fillStyle="#2b1a1c";x.fillText("Scan to see our wedding photos",W/2,320);
 var size=760,cell=size/n,ox=(W-size)/2,oy=420;x.fillStyle="#000";for(var r=0;r<n;r++)for(var k=0;k<n;k++)if(q.isDark(r,k))x.fillRect(ox+k*cell,oy+r*cell,Math.ceil(cell),Math.ceil(cell));
 x.font="40px Mukta, sans-serif";x.fillStyle="#6f5a58";x.fillText(M.gallery.link.replace(/^https?:\\/\\//,""),W/2,1300);if(M.gallery.hasPin){x.fillText("Ask the couple for the PIN",W/2,1370)}
 c.toBlob(function(b){var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="wedding-photos-qr.png";a.click()},"image/png")};
$("pinSave").onclick=function(){A("settings",{pin:$("pinIn").value}).then(function(){$("pinIn").value="";M.gallery.hasPin=true;share();toast("PIN saved")}).catch(function(e){toast(e.message)})};
$("pinOff").onclick=function(){A("settings",{pin:""}).then(function(){M.gallery.hasPin=false;share();toast("PIN removed")}).catch(function(e){toast(e.message)})};

/* ---------- settings ---------- */
function settings(){var g=M.gallery;$("sNames").value=g.names;$("sDate").value=g.weddingDate?g.weddingDate.slice(0,10):"";$("sMsg").value=g.message;$("sDl").checked=g.allowDownload;
 $("sGu").checked=g.guestUploads;$("sGu").disabled=!M.plan.guestUploads;$("sGuWrap").title=M.plan.guestUploads?"":"Premium and Royal";
 if(!M.plan.guestUploads)$("sGuWrap").lastChild.textContent=" Guests can add their photos (Premium and Royal)";
 albEdit=g.albums.map(function(a){return{id:a.id,name:a.name}});albs()}
function albs(){var c={};M.items.forEach(function(it){c[it.a]=(c[it.a]||0)+1});
 $("albList").innerHTML=albEdit.map(function(a,i){return '<div class="alb"><input value="'+esc(a.name)+'" data-i="'+i+'" maxlength="40" aria-label="Album name"><span class="n">'+(c[a.id]||0)+' items</span><button class="btn btn-x" data-up="'+i+'" type="button" aria-label="Move up">↑</button><button class="btn btn-x" data-del="'+i+'" type="button" aria-label="Remove"'+(c[a.id]?" disabled":"")+'>✕</button></div>'}).join("");
 $("albList").querySelectorAll("input").forEach(function(inp){inp.oninput=function(){albEdit[+inp.dataset.i].name=inp.value}});
 $("albList").querySelectorAll("[data-up]").forEach(function(b){b.onclick=function(){var i=+b.dataset.up;if(i>0){var t=albEdit[i-1];albEdit[i-1]=albEdit[i];albEdit[i]=t;albs()}}});
 $("albList").querySelectorAll("[data-del]").forEach(function(b){b.onclick=function(){albEdit.splice(+b.dataset.del,1);albs()}})}
$("albAdd").onclick=function(){var n=$("albNew").value.trim();if(!n)return;albEdit.push({id:"",name:n});$("albNew").value="";albs()};
$("albSave").onclick=function(){$("albErr").textContent="";A("settings",{albums:albEdit}).then(function(){return A("")}).then(function(r){M=r;render();toast("Albums saved")}).catch(function(e){$("albErr").textContent=e.message})};
$("sSave").onclick=function(){$("sErr").textContent="";var body={names:$("sNames").value,weddingDate:$("sDate").value||null,message:$("sMsg").value,allowDownload:$("sDl").checked};if(M.plan.guestUploads)body.guestUploads=$("sGu").checked;
 A("settings",body).then(function(){return A("")}).then(function(r){M=r;render();toast("Saved")}).catch(function(e){$("sErr").textContent=e.message})};

/* ---------- plan ---------- */
function plans(){var g=M.gallery,p=M.plan,rank=["free","basic","premium","royal"];
 var until=g.expiresAt?new Date(g.expiresAt).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"}):"";
 $("planNow").innerHTML="<h2>"+esc(p.name)+" plan</h2><p>"+(g.online?"Online until ":"Went offline on ")+esc(until)+".</p>"+(g.paid?'<button class="btn btn-p btn-s" id="renewBtn" type="button">Add 1 more year · '+inr(M.renewalPrice)+"</button>":"");
 if(g.paid)$("renewBtn").onclick=function(){buy("renew")};
 $("plans").innerHTML=M.plans.filter(function(x){return x.id!=="free"}).map(function(x){var cur=x.id===p.id,lower=rank.indexOf(x.id)<rank.indexOf(p.id);
  var price=g.paid&&!cur&&!lower?Math.max(1,x.price-p.price):x.price;
  return '<div class="plan'+(cur?" cur":"")+'"><h3>'+esc(x.name)+'</h3><p class="price">'+inr(price)+(g.paid&&!cur&&!lower?' <small class="hint">to upgrade</small>':"")+'</p><p class="hint">'+esc(x.tagline)+"</p><ul>"+x.features.map(function(f){return"<li>"+esc(f)+"</li>"}).join("")+"</ul>"
   +(cur?'<p><b>Your plan</b></p>':lower?"":'<button class="btn btn-p" type="button" data-buy="'+esc(x.id)+'">'+(g.paid?"Upgrade":"Choose "+esc(x.name))+"</button>")+"</div>"}).join("");
 $("plans").querySelectorAll("[data-buy]").forEach(function(b){b.onclick=function(){buy(b.dataset.buy)}})}
function loadRzp(){return window.Razorpay?Promise.resolve():new Promise(function(res,rej){var s=document.createElement("script");s.src="https://checkout.razorpay.com/v1/checkout.js";s.onload=res;s.onerror=function(){rej(new Error("Couldn't load the payment window"))};document.body.appendChild(s)})}
function buy(plan){var coupon=$("coupon").value.trim();
 A("checkout",{plan:plan,coupon:coupon,email:M.gallery.email,phone:M.gallery.phone}).then(function(o){
  if(o.provider==="mock"){return A("verify",{}).then(paid)}
  return loadRzp().then(function(){return new Promise(function(res,rej){var r=new Razorpay(Object.assign({},o.clientData,{order_id:o.orderId,name:"Pandora Templates",theme:{color:"#7a1424"},handler:res,modal:{ondismiss:function(){rej(new Error("Payment cancelled"))}}}));r.open()})})
   .then(function(pay){return A("verify",pay)}).then(paid)}).catch(function(e){toast(e.message)})}
function paid(){toast("Payment received. Thank you!");return A("").then(function(r){M=r;render()})}

boot();
`;

  return page({ title: `${o.names} · Gallery dashboard`, body, css, js, noindex: true, head: trackingScript("photos", { view: false }) });
}
