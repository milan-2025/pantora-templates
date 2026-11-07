function makeDb(){
  const api=(m,r,x,b)=>fetch("api.php?r="+r+(x||""),{method:m,headers:{"Content-Type":"application/json"},body:b?JSON.stringify(b):undefined,credentials:"same-origin"}).then(res=>{if(res.status===401){location.href="login.html";throw new Error("Session expired")}if(!res.ok)throw new Error("Server error "+res.status);return res.json()});
  const watch=(r,x,cb,err,mk)=>{let last="";const tick=async()=>{try{const j=await api("GET",r,x);const s=JSON.stringify(j);if(s!==last){last=s;cb(mk(j))}}catch(e){err&&err({message:e.message})}};tick();const iv=setInterval(tick,5000);window.addEventListener("poke",tick);return()=>clearInterval(iv)};
  const poke=()=>setTimeout(()=>window.dispatchEvent(new Event("poke")),200);
  const key=p=>"&k="+p.split("/")[1];
  return{
    collection:()=>({
      onSnapshot:(cb,err)=>watch("leads","",cb,err,j=>({docs:j.map(l=>({id:l.id,data:()=>{const{id,...d}=l;return d}}))})),
      add:async d=>{const r=await api("POST","leads_add","",d);poke();return r},
      doc:i=>({update:async d=>{await api("POST","leads_update","&id="+i,d);poke()},delete:async()=>{await api("POST","leads_delete","&id="+i);poke()}})
    }),
    doc:p=>({onSnapshot:(cb,err)=>watch("settings",key(p),cb,err,j=>({exists:!!j,data:()=>j||{}})),set:async d=>{await api("POST","settings_set",key(p),d);poke()}})
  };
}
