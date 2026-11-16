/* Code Nova demo engine: utilidades compartidas */
(()=>{
const $=s=>document.querySelector(s);
const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const pick=a=>a[Math.floor(Math.random()*a.length)];
const peso=n=>"$"+Math.round(n).toLocaleString("es-MX");
const cap=t=>t.charAt(0).toUpperCase()+t.slice(1);
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const hm=m=>{const h=Math.floor(m/60),mm=m%60;return `${h>12?h-12:h}:${String(mm).padStart(2,"0")}`};
const mty=()=>new Date(new Date().toLocaleString("en-US",{timeZone:"America/Monterrey"}));
const fmtD=d=>new Date(d+"T12:00:00").toLocaleDateString("es-MX",{weekday:"short",day:"numeric",month:"short"});
const fmtL=d=>cap(new Date(d+"T12:00:00").toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"}));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const V={view:"cliente",unseen:0,onView:{}};
function modal(h){$("#layer").innerHTML=`<div class="scrim" role="dialog" aria-modal="true"><div class="modal">${h}</div></div>`}
function closeModal(){$("#layer").innerHTML=""}
let tT;function toast(m){document.querySelector(".toast")?.remove();const t=document.createElement("div");t.className="toast";t.innerHTML=`<span>${m}</span>`;document.body.append(t);clearTimeout(tT);tT=setTimeout(()=>t.remove(),4200)}
function feed(h){const f=$("#feed");if(!f)return;const d=document.createElement("div");d.innerHTML=`<span>${h}</span>`;f.prepend(d);while(f.children.length>10)f.lastChild.remove()}
function badge(){const b=$("#badgeK");if(!b)return;b.hidden=!V.unseen;b.textContent=V.unseen}
function bump(){if(V.view!=="cocina"){V.unseen++;badge()}}
function setView(v){V.view=v;["cliente","cocina","dueno"].forEach(k=>{const el=$("#v-"+k);if(el)el.hidden=k!==v});document.querySelectorAll(".demobar [data-v]").forEach(b=>b.classList.toggle("on",b.dataset.v===v));if(v==="cocina"){V.unseen=0;badge()}(V.onView[v]||(()=>{}))();window.scrollTo(0,0)}
function refresh(){(V.onView[V.view]||(()=>{}))()}
function demobar(labels){return `<nav class="demobar" aria-label="Vistas de la demo"><span class="lbl"><b>Demo</b>Code Nova</span><button data-v="cliente" class="on">Cliente</button><button data-v="cocina">${labels[0]}<span class="badge" id="badgeK" hidden>0</span></button><button data-v="dueno">${labels[1]}</button></nav><div id="layer"></div>`}
function wire(){document.querySelectorAll(".demobar [data-v]").forEach(b=>b.onclick=()=>setView(b.dataset.v));
  document.addEventListener("click",e=>{const g=e.target.closest("[data-go]");if(g){closeModal();setView(g.dataset.go);return}if(e.target.closest("[data-close]")||e.target.classList.contains("scrim"))closeModal()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});}
function ticket({bg,chip,title,sub,rows=[],code,codeLabel,codeNote,wa,go,goLabel}){
  return `<div class="ticket-top" style="background:${bg||"var(--g-dd)"}"><span class="chip" style="background:rgba(255,255,255,.18)"><span class="dot"></span>${chip}</span><h3 style="font-family:var(--display);text-transform:none;font-weight:var(--dw)">${title}</h3><div style="opacity:.92;margin-top:6px">${sub||""}</div></div>
  <div class="ticket-body">${rows.map((r,i)=>`<div class="tk-row"${i===rows.length-1?' style="border:0"':""}><span>${r[0]}</span><b>${r[1]}</b></div>`).join("")}
  ${code?`<div class="tk-code" style="justify-content:center;text-align:center"><div><span>${codeLabel||""}</span><b>${code}</b><span>${codeNote||""}</span></div></div>`:""}
  ${wa?`<div class="tk-wa"><span>${wa}</span></div>`:""}
  ${go?`<button class="btn btn-g" data-go="${go}" style="background:var(--g-d)">${goLabel}</button>`:""}<button class="btn btn-w" data-close>Seguir viendo la demo</button></div>`}
function welcome(D,steps){modal(`<div class="welcome"><span class="eyebrow">Demo para ${D.brand.name}</span><h3 style="font-family:var(--display);text-transform:none;font-weight:var(--dw)">${D.welcome.title}</h3><p>Demo funcional preparada por Code Nova. Pruébela como cliente:</p><ol>${steps.map((s,i)=>`<li><b class="n">${i+1}</b><span>${s}</span></li>`).join("")}</ol><button class="btn btn-g" data-close style="background:var(--g-dd)">Empezar</button><p style="font-size:12px;margin-top:12px;text-align:center">${D.welcome.note||"Precios y cifras de ejemplo."}</p></div>`)}
function topbar(D,btn){return `<div class="topbar"><div class="wrap"><div class="brand"><div class="brand-mark">${D.brand.mark}</div><div class="brand-name">${D.brand.name}<small>${D.brand.tag}</small></div></div><button class="cart-btn" id="topBtn">${btn} <b id="topBadge">0</b></button></div></div>`}
function hero(D){const H=D.hero;return `<section class="hero"><div class="wrap"><div><span class="chip status"><span class="dot pulse"></span><span id="openTxt">${H.chip}</span></span><h1 class="display">${H.h1a} <span>${H.h1b}</span></h1><p class="lead">${H.lead}</p><div class="actions"><a class="btn btn-g" href="${H.cta1[1]}">${H.cta1[0]}</a><a class="btn btn-w" href="${H.cta2[1]}">${H.cta2[0]}</a></div></div>
  <div class="hero-art"><div class="since"><div><b>${H.badge[0]}</b><span>${H.badge[1]}</span></div></div><figure class="hero-photo"><img src="img/hero.webp" alt="${esc(H.alt)}" width="800" height="533"><figcaption>Foto ilustrativa</figcaption></figure><div class="note-card"><s>${H.old}</s><br><b>${H.now}</b></div></div></div></section>
  <div class="ticker" aria-hidden="true"><div>${Array(2).fill(D.ticker.join("<i>•</i>")+"<i>•</i>").join("")}</div></div>`}
function footer(D){return `<section class="section" style="padding-top:0"><div class="wrap loc-card"><div class="panel"><h3>${D.loc[0][0]}</h3><p>${D.loc[0][1]}</p></div><div class="panel"><h3>${D.loc[1][0]}</h3><p>${D.loc[1][1]}</p></div></div></section>
  <footer class="site wrap"><b>Demo concepto preparada por Code Nova para ${D.brand.name}.</b><br>No es el sitio oficial. ${D.disclaimer} Fotos ilustrativas.<br>Code Nova · Nuevo León · WhatsApp 826 261 3262</footer>`}
window.CN={$,rnd,pick,peso,cap,iso,hm,mty,fmtD,fmtL,esc,V,modal,closeModal,toast,feed,badge,bump,setView,refresh,demobar,wire,ticket,welcome,topbar,hero,footer};
})();
