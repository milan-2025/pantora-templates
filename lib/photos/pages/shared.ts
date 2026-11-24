/** Bits shared by the photo gallery pages (landing, guest gallery, couple dashboard). Plain HTML + CSS, no framework. */

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
/** JSON safe to put inside a <script> tag. */
export const jsonScript = (v: unknown) =>
  JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029");

export const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Mukta:wght@400;500;700&display=swap">`;

export const BASE_CSS = `
:root{--paper:#f7ece8;--card:#fffaf8;--ink:#2b1a1c;--mut:#6f5a58;--line:#e6d3cd;--sindoor:#7a1424;--marigold:#e8a317;--mehndi:#2f5d4a;--ok:#2f7d4f;--bad:#b3261e}
*,*::before,*::after{box-sizing:border-box}
[hidden]{display:none!important}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.55 Mukta,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--sindoor)}
:focus-visible{outline:3px solid var(--marigold);outline-offset:3px;border-radius:6px}
h1,h2,h3{font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;line-height:1.1;margin:0}
p{margin:0 0 12px}
.w{max-width:1120px;margin:0 auto;padding:0 20px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 22px;border-radius:999px;font:600 16px Mukta,sans-serif;text-decoration:none;border:2px solid transparent;cursor:pointer;background:none;color:inherit}
.btn:disabled{opacity:.55;cursor:default}
.btn-p{background:var(--sindoor);color:#fff}.btn-p:hover:not(:disabled){background:#5e0f1b}
.btn-g{border-color:var(--sindoor);color:var(--sindoor)}.btn-g:hover:not(:disabled){background:#7a14240d}
.btn-w{background:#25d366;color:#0b3d1f}
.btn-s{min-height:38px;padding:0 16px;font-size:15px}
.btn-x{min-height:36px;padding:0 12px;font-size:15px;color:var(--mut)}
input,select,textarea{font:inherit;color:inherit;width:100%;padding:11px 14px;border:1.5px solid var(--line);border-radius:12px;background:#fff}
input:focus,select:focus,textarea:focus{border-color:var(--sindoor);outline:none}
label{display:block;font-weight:500;margin:0 0 6px}
.field{margin-bottom:14px}
.hint{font-size:14px;color:var(--mut)}
.err{color:var(--bad);font-size:15px;min-height:1em}
.card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:22px}
.toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:var(--ink);color:#fff;padding:12px 20px;border-radius:999px;font-weight:500;z-index:99;opacity:0;pointer-events:none;transition:opacity .2s;max-width:92vw;text-align:center}
.toast.on{opacity:1}
dialog{border:0;border-radius:22px;padding:0;max-width:min(520px,94vw);width:100%;background:var(--card);color:var(--ink);box-shadow:0 20px 60px #0004}
dialog::backdrop{background:#1a0d0fb3}
.dlg{padding:24px}
.dlg h3{font-size:30px;margin-bottom:10px}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.sp{flex:1}
`;

/** Tiny browser helpers used by the gallery pages. */
export const BASE_JS = `
var $=function(id){return document.getElementById(id)};
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function toast(t){var el=$("toast");el.textContent=t;el.classList.add("on");clearTimeout(toast._t);toast._t=setTimeout(function(){el.classList.remove("on")},3200)}
function api(path,opts){opts=opts||{};var h={"content-type":"application/json"};for(var k in (opts.headers||{}))h[k]=opts.headers[k];
 return fetch("/api/photos/"+path,{method:opts.body?"POST":"GET",headers:h,body:opts.body?JSON.stringify(opts.body):undefined,cache:"no-store"})
 .then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok){var e=new Error(j.error||"Something went wrong");e.status=r.status;throw e}return j})})}
function inr(n){return "₹"+Math.round(n).toLocaleString("en-IN")}
function fmtBytes(b){if(b<1048576)return Math.max(1,Math.round(b/1024))+" KB";if(b<1073741824)return (b/1048576).toFixed(b<10485760?1:0)+" MB";return (b/1073741824).toFixed(2)+" GB"}
function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function lsDel(k){try{localStorage.removeItem(k)}catch(e){}}
/* Shrinks a photo in the browser: a display copy (long edge 2560px) and a thumbnail (640px). Nothing big is uploaded. */
function loadBitmap(file){
 if(window.createImageBitmap)return createImageBitmap(file,{imageOrientation:"from-image"}).catch(function(){return createImageBitmap(file)}).catch(viaImg);
 return viaImg();
 function viaImg(){return new Promise(function(res,rej){var u=URL.createObjectURL(file),i=new Image();i.onload=function(){res(i)};i.onerror=function(){URL.revokeObjectURL(u);rej(new Error("Can't read "+file.name+". If it's a HEIC photo, export it as JPG first."))};i.src=u})}}
function shrink(src,max,q){var w=src.width,h=src.height,s=Math.min(1,max/Math.max(w,h)),cw=Math.max(1,Math.round(w*s)),ch=Math.max(1,Math.round(h*s));
 var c=document.createElement("canvas");c.width=cw;c.height=ch;var x=c.getContext("2d");x.imageSmoothingQuality="high";x.drawImage(src,0,0,cw,ch);
 return new Promise(function(res,rej){c.toBlob(function(b){b?res({blob:b,w:cw,h:ch}):rej(new Error("Couldn't prepare the photo"))},"image/jpeg",q)})}
function prepPhoto(file,original){return loadBitmap(file).then(function(bmp){
 return shrink(bmp,2560,.86).then(function(d){return shrink(bmp,640,.76).then(function(t){
  var out={d:d.blob,t:t.blob,w:d.w,h:d.h};
  if(original){out.o=file.type==="image/jpeg"?file:null;if(!out.o)return shrink(bmp,10000,.93).then(function(o){out.o=o.blob;return out})}
  return out})})})}
/* A video's thumbnail: a frame from near the start (a plain card if the browser can't play this format). */
function prepVideo(file){return new Promise(function(res){var u=URL.createObjectURL(file),v=document.createElement("video"),done=false;v.muted=true;v.preload="metadata";v.playsInline=true;
 function plain(){if(done)return;done=true;var c=document.createElement("canvas");c.width=640;c.height=360;var x=c.getContext("2d");x.fillStyle="#3b1f2a";x.fillRect(0,0,640,360);x.fillStyle="#fff";x.beginPath();x.moveTo(290,140);x.lineTo(290,220);x.lineTo(360,180);x.fill();
  c.toBlob(function(b){URL.revokeObjectURL(u);res({t:b,w:640,h:360,dur:isFinite(v.duration)?v.duration:0})},"image/jpeg",.8)}
 v.onloadedmetadata=function(){v.currentTime=Math.min(1.5,(v.duration||2)/3)};
 v.onseeked=function(){if(done)return;try{var w=v.videoWidth||640,h=v.videoHeight||360,s=Math.min(1,640/Math.max(w,h)),c=document.createElement("canvas");c.width=Math.round(w*s);c.height=Math.round(h*s);c.getContext("2d").drawImage(v,0,0,c.width,c.height);
  c.toBlob(function(b){if(!b)return plain();done=true;URL.revokeObjectURL(u);res({t:b,w:w,h:h,dur:v.duration||0})},"image/jpeg",.8)}catch(e){plain()}};
 v.onerror=plain;setTimeout(plain,8000);v.src=u})}
/* PUT one file to storage with progress. */
function putFile(url,blob,type,onProgress){return new Promise(function(res,rej){var x=new XMLHttpRequest();x.open("PUT",url);x.setRequestHeader("content-type",type);
 x.upload.onprogress=function(e){if(onProgress&&e.lengthComputable)onProgress(e.loaded)};
 x.onload=function(){x.status>=200&&x.status<300?res():rej(new Error("Upload failed ("+x.status+")"))};x.onerror=function(){rej(new Error("Upload failed. Check your connection."))};x.send(blob)})}
function download(url,name){fetch(url).then(function(r){return r.blob()}).then(function(b){var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name||"photo.jpg";document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},2000)}).catch(function(){window.open(url,"_blank")})}
`;

export const page = (o: { title: string; description?: string; head?: string; body: string; css?: string; js?: string; noindex?: boolean; canonical?: string; ogImage?: string | null; theme?: string }) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(o.title)}</title>
${o.description ? `<meta name="description" content="${esc(o.description)}">` : ""}
${o.noindex ? `<meta name="robots" content="noindex,nofollow">` : ""}
${o.canonical ? `<link rel="canonical" href="${esc(o.canonical)}">` : ""}
<meta property="og:title" content="${esc(o.title)}">${o.description ? `<meta property="og:description" content="${esc(o.description)}">` : ""}
${o.ogImage ? `<meta property="og:image" content="${esc(o.ogImage)}"><meta name="twitter:card" content="summary_large_image">` : ""}
<meta property="og:site_name" content="Pandora Templates">
<meta name="theme-color" content="${o.theme ?? "#7a1424"}">
<link rel="icon" href="/icon.svg">
${FONTS}
${o.head ?? ""}
<style>${BASE_CSS}${o.css ?? ""}</style></head>
<body>${o.body}<div id="toast" class="toast" role="status" aria-live="polite"></div>
<script>${BASE_JS}${o.js ?? ""}</script></body></html>`;

export const htmlResponse = (html: string, status = 200) =>
  new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
