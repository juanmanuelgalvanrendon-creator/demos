/* Motor "experiencias": talleres o eventos con cupo, eventos privados, encargos opcionales */
(()=>{
const {$,rnd,pick,peso,cap,iso,mty,fmtD,fmtL,esc,V,modal,toast,feed,bump,setView,refresh,demobar,wire,ticket,welcome,topbar,hero,footer}=CN;
const D=window.DEMO;const U=D.unit||["lugar","lugares"];const L=D.labels||["Agenda","Dueño"];
const WS=D.events.map(w=>{const d=new Date(w.date+"T12:00:00");return {...w,day:cap(d.toLocaleDateString("es-MX",{weekday:"long"})),num:d.getDate(),mon:d.toLocaleDateString("es-MX",{month:"short"}).replace(".","")}});
const WM=Object.fromEntries(WS.map(w=>[w.id,w]));
const SHOP=D.shop?Object.fromEntries(D.shop.items.map(i=>[i.id,i])):{};
let NI=0;const nextName=()=>D.seed.names[(NI++)%D.seed.names.length];
const S={w:WS[0].id,ppl:Math.min(2,D.maxPer||8),res:[],cart:{},orders:[],priv:[],pt:D.priv.types[0],pa:(D.priv.acts||[""])[0],wait:D.waitlist?D.waitlist.start||18:0,seq:100};
if(D.shop)D.shop.items.forEach(i=>S.cart[i.id]=0);
const used=id=>S.res.filter(r=>r.w===id).reduce((s,r)=>s+r.ppl,0);
const left=id=>WM[id].cap-used(id);
const un=n=>n+" "+(n===1?U[0]:U[1]);

document.body.innerHTML=`<main id="v-cliente">${topbar(D,D.topBtn||"Reservar")}${hero(D)}
<section class="section" id="eventos"><div class="wrap"><div class="sec-head"><div><span class="eyebrow"><span class="step-num">1</span>${D.eventsHead.kicker}</span><h2 class="display">${D.eventsHead.title}</h2></div><p>${D.eventsHead.note}</p></div>
<div class="ws" id="ws"></div>
${D.waitlist?`<div class="soon" style="margin-top:16px"><div><h3>${D.waitlist.title}</h3><p>${D.waitlist.text}</p></div><form id="wait"><input id="waitPh" inputmode="tel" placeholder="Tu WhatsApp" maxlength="14"><button class="btn btn-g" type="submit" style="height:48px">Avísame</button></form></div>`:""}
</div></section>
<section class="section" style="padding-top:0"><div class="wrap two">
<div class="panel" id="bookPanel"><h3 id="bkTitle"></h3><p id="bkSub"></p>
<div class="field"><label>¿Cuántos ${U[1]}?</label><div class="ppl"><span id="pplTxt"></span><div class="stepper"><button data-ppl="-1" aria-label="Menos">&minus;</button><span id="pplN"></span><button data-ppl="1" aria-label="Más">+</button></div></div></div>
<div class="grid2"><div class="field"><label for="fName">Nombre</label><input id="fName" placeholder="¿A nombre de quién?" autocomplete="off"></div><div class="field"><label for="fPhone">WhatsApp</label><input id="fPhone" inputmode="tel" placeholder="10 dígitos" maxlength="14" autocomplete="off"></div></div>
<div class="field"><label>Pago</label><div class="chips" id="pay">${(D.pay||[["l","En el lugar"],["a","Anticipo en línea (fase 2)"]]).map((p,i)=>`<button class="${i?"":"on"}" data-pay="${i}">${p[1]}</button>`).join("")}</div></div>
<div class="totals"><span>Total</span><b id="bkTotal">$0</b></div>
<button class="btn btn-g" id="sendRes" style="width:100%;margin-top:12px;background:var(--g-dd)">${D.bookBtn||"Apartar mi lugar"}</button><div class="err" id="err"></div></div>
${D.shop?`<div class="panel" id="shop"><h3>${D.shop.title}</h3><p>${D.shop.text}</p><div class="shop" id="shopItems"></div><div class="field"><label for="shDay">${D.shop.dayLabel||"Día para recoger"}</label><select id="shDay"></select></div><div class="totals"><span>Total</span><b id="shTotal">$0</b></div><button class="btn btn-w" id="sendSh" style="width:100%;margin-top:12px">${D.shop.btn}</button><div class="err" id="shErr"></div></div>`:`<div class="panel" style="background:var(--acc-l);box-shadow:none"><h3>${D.side[0]}</h3><p>${D.side[1]}</p>${(D.side[2]||[]).map(r=>`<div class="sum-line"><span>${r[0]}</span><b>${r[1]}</b></div>`).join("")}</div>`}
</div></section>
<section class="section dark" id="privado"><div class="wrap"><div class="sec-head"><div><span class="eyebrow">${D.priv.kicker}</span><h2 class="display">${D.priv.title}</h2></div><p>${D.priv.text}</p></div>
<div class="ev-grid"><div class="dpanel"><h3>${D.priv.typeLabel||"¿Qué celebras?"}</h3><div class="chips" id="pType">${D.priv.types.map((t,i)=>`<button class="${i?"":"on"}" data-pt="${t}">${t}</button>`).join("")}</div>
${D.priv.acts?`<h3 style="margin-top:16px">${D.priv.actLabel||"Actividad"}</h3><div class="chips" id="pAct">${D.priv.acts.map((t,i)=>`<button class="${i?"":"on"}" data-pa="${t}">${t}</button>`).join("")}</div>`:""}</div>
<div class="dpanel"><div class="grid2"><div class="field"><label for="pDate">Fecha</label><input id="pDate" type="date"></div><div class="field"><label for="pPpl">Personas</label><input id="pPpl" type="number" min="${D.priv.min||4}" max="200" value="${D.priv.def||12}"></div></div>
<div class="field"><label for="pName">Nombre y WhatsApp</label><input id="pName" placeholder="Ej. Paola Garza · 81 1234 5678" autocomplete="off"></div>
<button class="btn btn-g" id="pSend" style="width:100%;margin-top:14px">${D.priv.btn||"Pedir cotización"}</button><div class="err" id="pErr" style="color:#ffb3aa"></div></div></div></div></section>
${footer(D)}</main>
<main id="v-cocina" class="kds" hidden><div class="kds-top"><h2><small>${L[0]}</small>${D.agendaTitle||"Lo que viene"}</h2><div class="kds-ctrl"><button id="agDm">+ Registrar reserva de DM</button></div></div><div class="kds-stats" id="agStats"></div><div class="agw" id="agw"></div></main>
<main id="v-dueno" class="own" hidden><div class="own-top"><div class="wrap"><h2><small>Panel ${L[1]==="Dueña"?"de la dueña":"del dueño"}</small>${D.ownerTitle||"Este mes"}</h2><span class="chip live"><span class="dot pulse"></span>En vivo</span></div></div><div class="wrap">
<div class="kpis"><div class="kpi"><span>${cap(U[1])} vendidos</span><b id="kSeats">0</b><em id="kSeatsE"></em></div><div class="kpi"><span>Ingreso de ${D.eventsHead.kicker.toLowerCase()}</span><b id="kInc">$0</b><em>${cap(U[1])} × precio</em></div><div class="kpi"><span>Eventos privados por cotizar</span><b id="kEv">0</b><em>${D.priv.types.slice(0,2).join(" y ")}</em></div><div class="kpi"><span>${D.shop?D.shop.kpi:"Lista de espera"}</span><b id="kX">0</b><em id="kXE"></em></div></div>
<div class="own-grid"><div class="card"><h3>Ocupación <small>${U[1]}</small></h3><div class="bars" id="occ"></div></div><div class="card"><h3>¿De dónde llegan? <small>reservas</small></h3><div class="bars" id="src"></div></div><div class="card" style="grid-column:1/-1"><h3>Movimientos <small>en tiempo real</small></h3><div class="feed" id="feed"></div></div></div>
<div class="own-foot">Cifras de ejemplo para la demo.</div></div></main>${demobar(L)}`;
wire();

function renderWS(){$("#ws").innerHTML=WS.map(w=>{const l=left(w.id),full=l<=0;return `<button class="w ${S.w===w.id?"on":""} ${full?"full":""}" data-w="${w.id}">${w.tag&&!full?`<span class="tag">${w.tag}</span>`:l>0&&l<=4?`<span class="tag">Últimos ${U[1]}</span>`:""}
<div class="date"><span>${w.day.slice(0,3)}</span><b>${w.num}</b><small>${w.mon} · ${w.short||w.hrs}</small></div>
<div class="bd"><h3>${w.n}</h3><p>${w.desc}</p>${w.inc?`<div class="inc">${w.inc.map(i=>`<span>${i}</span>`).join("")}</div>`:""}<div class="capb"><i style="width:${Math.min(100,used(w.id)/w.cap*100)}%"></i></div>
<div class="foot"><span class="price">${w.p?peso(w.p):"Gratis"}</span><span class="left">${full?"Lleno · lista de espera":"Quedan "+l+" de "+w.cap}</span></div></div></button>`}).join("");$("#topBadge").textContent=WS.filter(w=>left(w.id)>0).length}
function renderBook(){const w=WM[S.w],l=left(w.id),mx=Math.min(D.maxPer||8,Math.max(1,l));if(S.ppl>mx)S.ppl=mx;
  $("#bkTitle").textContent=w.n;$("#bkSub").textContent=`${w.day} ${w.num} de ${w.mon} · ${w.hrs}${w.p?" · "+peso(w.p)+" por "+U[0]:""}.`;
  $("#pplN").textContent=S.ppl;$("#pplTxt").textContent=un(S.ppl);$("#bkTotal").textContent=peso(w.p*S.ppl);
  $("#sendRes").disabled=l<=0;$("#sendRes").textContent=l<=0?"Lleno":(D.bookBtn||"Apartar mi lugar");}
function renderShop(){if(!D.shop)return;$("#shopItems").innerHTML=D.shop.items.map(i=>`<div class="sk"><b>${i.n}</b><small>${peso(i.p)} ${i.per||"c/u"}</small><div class="stepper"><button data-sk="${i.id}" data-n="-${i.step||1}" aria-label="Menos">&minus;</button><span>${S.cart[i.id]}</span><button data-sk="${i.id}" data-n="${i.step||1}" aria-label="Más">+</button></div></div>`).join("");$("#shTotal").textContent=peso(D.shop.items.reduce((s,i)=>s+i.p*S.cart[i.id],0))}
if(D.shop){const t=mty();const o=[];for(let i=1;i<=9&&o.length<6;i++){const d=new Date(t);d.setDate(d.getDate()+i);if(!(D.shop.closed||[1]).includes(d.getDay()))o.push(`<option value="${iso(d)}">${d.toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"short"})}</option>`)}$("#shDay").innerHTML=o.join("")}
(()=>{const t=mty();t.setDate(t.getDate()+(D.priv.minDays||7));$("#pDate").min=iso(t);$("#pDate").value=D.priv.defDate||iso(t)})();
document.addEventListener("click",e=>{
  const w=e.target.closest("[data-w]");if(w){S.w=w.dataset.w;renderWS();renderBook();$("#bookPanel").scrollIntoView({behavior:"smooth",block:"center"});return}
  const p=e.target.closest("[data-ppl]");if(p){S.ppl=Math.max(1,Math.min(Math.max(1,left(S.w)),D.maxPer||8,S.ppl+ +p.dataset.ppl));renderBook();return}
  const k=e.target.closest("[data-sk]");if(k){S.cart[k.dataset.sk]=Math.max(0,S.cart[k.dataset.sk]+ +k.dataset.n);renderShop();return}
  const py=e.target.closest("[data-pay]");if(py&&py.dataset.pay!=="0"){toast("El pago en línea con tarjeta se activa en la fase 2.");return}
  const pt=e.target.closest("[data-pt]");if(pt){S.pt=pt.dataset.pt;document.querySelectorAll("[data-pt]").forEach(b=>b.classList.toggle("on",b===pt));return}
  const pa=e.target.closest("[data-pa]");if(pa){S.pa=pa.dataset.pa;document.querySelectorAll("[data-pa]").forEach(b=>b.classList.toggle("on",b===pa));return}
  if(e.target.closest("[data-in]")){const r=S.res.find(x=>x.id===e.target.closest("[data-in]").dataset.in);r.in=!r.in;renderAg();return}
  const q=e.target.closest("[data-q]");if(q){const x=S.priv.find(y=>y.id===q.dataset.q);if(x.st!=="ok"){x.st="ok";toast(`Cotización enviada por WhatsApp a ${x.name} (simulado)`)}renderAg();return}
  const r=e.target.closest("[data-ready]");if(r){const o=S.orders.find(y=>y.id===r.dataset.ready);if(!o.done){o.done=true;toast("Aviso enviado: el encargo está listo (simulado)")}renderAg();return}
});
$("#topBtn").onclick=()=>$("#eventos").scrollIntoView({behavior:"smooth"});
["#fPhone","#waitPh"].forEach(id=>{const el=$(id);if(el)el.addEventListener("input",e=>{e.target.value=e.target.value.replace(/[^\d ]/g,"")})});
$("#sendRes").onclick=()=>{const err=$("#err");err.textContent="";const name=$("#fName").value.trim(),ph=$("#fPhone").value.replace(/\D/g,"");
  if(name.length<2){err.textContent="Escribe tu nombre.";return}if(ph.length!==10){err.textContent="El WhatsApp debe tener 10 dígitos.";return}
  const r=addRes({w:S.w,ppl:S.ppl,name,src:"web",mine:true});$("#fName").value="";$("#fPhone").value="";const w=WM[r.w];
  modal(ticket({chip:"Lugar apartado",title:`¡Nos vemos, ${esc(name.split(" ")[0])}!`,sub:`${w.n} · ${w.day} ${w.num} de ${w.mon} · ${w.hrs}`,rows:[[cap(U[1]),r.ppl],...(w.inc?[["Incluye",w.inc.join(", ")]]:[]),["Total",peso(w.p*r.ppl)]],code:r.code,codeLabel:"Reserva "+r.id,codeNote:"Muéstralo al llegar.",wa:"En el sistema real llega la confirmación por WhatsApp y un recordatorio un día antes. Si alguien cancela, el lugar pasa solo a la lista de espera.",go:"cocina",goLabel:"Ver cómo le aparece al equipo"}))};
if(D.shop)$("#sendSh").onclick=()=>{const err=$("#shErr");err.textContent="";const n=Object.values(S.cart).reduce((a,b)=>a+b,0);if(!n){err.textContent="Agrega al menos un producto.";return}
  S.seq++;const o={id:"E-"+S.seq,items:{...S.cart},day:$("#shDay").value,name:"Tu encargo",mine:true,done:false,fresh:true};S.orders.push(o);feed(`<b>${o.id}</b> · ${D.shop.title} · ${n} ${D.shop.unit||"pzas"} · ${fmtD(o.day)}`);
  modal(ticket({chip:"Listo",title:"Encargo recibido",sub:`${n} ${D.shop.unit||"pzas"} · ${fmtL(o.day)}`,wa:"En el sistema real llega la confirmación por WhatsApp y un aviso cuando esté listo."}));D.shop.items.forEach(i=>S.cart[i.id]=0);renderShop();refresh();bump()};
$("#pSend").onclick=()=>{const err=$("#pErr");err.textContent="";const nm=$("#pName").value.trim(),d=$("#pDate").value,p=+$("#pPpl").value;
  if(!d||d<$("#pDate").min){err.textContent=`Elige una fecha con al menos ${D.priv.minDays||7} días de anticipación.`;return}if(nm.length<3){err.textContent="Escribe tu nombre y WhatsApp.";return}if(!(p>=(D.priv.min||4))){err.textContent=`Mínimo ${D.priv.min||4} personas.`;return}
  S.seq++;const ev={id:"P-"+S.seq,type:S.pt,act:S.pa,date:d,ppl:p,name:nm.split("·")[0].trim(),st:"pend",mine:true,fresh:true};S.priv.push(ev);feed(`<b>${ev.id}</b> · ${ev.type}${ev.act?" · "+ev.act:""} · ${p} pers. · ${fmtD(d)}`);$("#pName").value="";
  modal(ticket({bg:"var(--acc-d)",chip:"Solicitud enviada",title:"¡Gracias!",sub:`${ev.type}${ev.act?" · "+ev.act:""} · ${p} personas · ${fmtD(d)}`,wa:`${D.brand.name} recibe la solicitud completa para cotizar, y tú la confirmación por WhatsApp.`,go:"cocina",goLabel:"Ver cómo le llega al equipo"}));refresh();bump()};
if(D.waitlist)$("#wait").onsubmit=e=>{e.preventDefault();if($("#waitPh").value.replace(/\D/g,"").length!==10){toast("Escribe un WhatsApp de 10 dígitos.");return}S.wait++;$("#waitPh").value="";toast(D.waitlist.ok||"Listo: te avisamos en cuanto salga la nueva fecha.");refresh()};
function addRes({w,ppl,name,src="web",mine=false}){S.seq++;const r={id:"R-"+S.seq,code:String(rnd(1000,9999)),w,ppl,name,src,mine,in:false,fresh:true};S.res.push(r);
  feed(`<b>${r.id}</b> · ${WM[w].n} · ${un(ppl)} · ${esc(name)}${src==="dm"?" (DM)":""}`);renderWS();renderBook();refresh();bump();setTimeout(()=>{r.fresh=false;if(V.view==="cocina")renderAg()},6000);return r}
$("#agDm").onclick=()=>{const w=pick(WS.filter(x=>left(x.id)>=2));if(!w){toast("Todo está lleno.");return}addRes({w:w.id,ppl:2,name:nextName(),src:"dm"});toast("Reserva del DM registrada: el cupo de la página ya se actualizó.")};
function renderAg(){const seats=S.res.reduce((s,r)=>s+r.ppl,0);
  $("#agStats").innerHTML=`<div><b>${seats}</b>${U[1]} apartados</div><div><b>${S.priv.filter(e=>e.st==="pend").length}</b>por cotizar</div>${D.shop?`<div><b>${S.orders.filter(o=>!o.done).length}</b>encargos</div>`:""}`;
  const h=WS.map(w=>{const rs=S.res.filter(r=>r.w===w.id),u=used(w.id);return `<section class="ag"><header><b>${w.n}</b><span>${w.day} ${w.num} ${w.mon} · ${u} de ${w.cap} ${U[1]}</span><div class="capbar"><i style="width:${u/w.cap*100}%"></i></div></header>${rs.map(r=>`<div class="ln ${r.in?"done":""} ${r.fresh?"fresh":""}"><div><span class="who">${esc(r.name)}</span><span class="bdg ${r.src==="dm"?"dm":""}">${r.src==="dm"?"DM":"En línea"}</span>${r.mine?' <span class="mine">(tu reserva)</span>':""}<div class="det">${un(r.ppl)} · código ${r.code}</div></div><button data-in="${r.id}">${r.in?"Llegó":"Marcar llegada"}</button></div>`).join("")||'<div class="kempty">Sin reservas</div>'}</section>`}).join("");
  const pv=`<section class="ag"><header><b>${D.priv.agTitle||"Eventos privados"}</b><span>Solicitudes para cotizar</span></header>${S.priv.map(e=>`<div class="ln ${e.st==="ok"?"done":""} ${e.fresh?"fresh":""}"><div><span class="who">${esc(e.name)}</span><span class="bdg">${e.type}</span>${e.mine?' <span class="mine">(tu solicitud)</span>':""}<div class="det">${e.act?e.act+" · ":""}${e.ppl} personas · ${fmtD(e.date)}</div></div><button data-q="${e.id}">${e.st==="ok"?"Cotizado":"Enviar cotización"}</button></div>`).join("")||'<div class="kempty">Sin solicitudes</div>'}</section>`;
  const sh=D.shop?`<section class="ag"><header><b>${D.shop.title}</b><span>Encargos</span></header>${S.orders.map(o=>`<div class="ln ${o.done?"done":""} ${o.fresh?"fresh":""}"><div><span class="who">${esc(o.name)}</span>${o.mine?' <span class="mine">(tu encargo)</span>':""}<div class="det">${Object.entries(o.items).filter(([,q])=>q).map(([k,q])=>q+" "+SHOP[k].n).join(" · ")} · ${fmtD(o.day)}</div></div><button data-ready="${o.id}">${o.done?"Entregado":"Marcar listo"}</button></div>`).join("")||'<div class="kempty">Sin encargos</div>'}</section>`:"";
  $("#agw").innerHTML=h+pv+sh;}
function renderOwn(){const seats=S.res.reduce((s,r)=>s+r.ppl,0),inc=S.res.reduce((s,r)=>s+WM[r.w].p*r.ppl,0);
  $("#kSeats").textContent=seats;$("#kSeatsE").textContent=`de ${WS.reduce((s,w)=>s+w.cap,0)} disponibles`;$("#kInc").textContent=peso(inc);$("#kEv").textContent=S.priv.filter(e=>e.st==="pend").length;
  if(D.shop){const n=S.orders.filter(o=>!o.done).reduce((s,o)=>s+Object.values(o.items).reduce((a,b)=>a+b,0),0);$("#kX").textContent=n;$("#kXE").textContent=`${S.orders.filter(o=>!o.done).length} encargos`}else{$("#kX").textContent=S.wait;$("#kXE").textContent="personas esperando aviso"}
  $("#occ").innerHTML=WS.map(w=>`<div class="bar"><span>${w.n.length>22?w.n.slice(0,21)+"…":w.n}</span><div class="track"><div class="fill" style="width:${used(w.id)/w.cap*100}%;background:var(--acc)"></div></div><span class="v">${used(w.id)}/${w.cap}</span></div>`).join("");
  const wb=S.res.filter(r=>r.src==="web").length,dm=S.res.filter(r=>r.src==="dm").length,m=Math.max(1,wb,dm);
  $("#src").innerHTML=[["Reserva en línea",wb],["Registrada del DM",dm]].map(([l,v])=>`<div class="bar"><span>${l}</span><div class="track"><div class="fill" style="width:${v/m*100}%;background:var(--g-d)"></div></div><span class="v">${v}</span></div>`).join("");}
V.onView={cocina:renderAg,dueno:renderOwn,cliente:()=>{renderWS();renderBook()}};
/* datos de ejemplo */
Object.entries(D.seed.fill).forEach(([w,n])=>{let k=0;while(k<n){const p=Math.min(rnd(1,3),n-k);S.res.push({id:"R-"+(++S.seq),code:String(rnd(1000,9999)),w,ppl:p,name:nextName(),src:Math.random()<.55?"web":"dm",in:false,fresh:false});k+=p}});
(D.seed.priv||[]).forEach(p=>S.priv.push({id:"P-"+(++S.seq),st:"pend",...p}));
(D.seed.orders||[]).forEach(o=>S.orders.push({id:"E-"+(++S.seq),done:false,...o}));
S.res.slice(-6).forEach(r=>feed(`<b>${r.id}</b> · ${WM[r.w].n} · ${un(r.ppl)} · ${esc(r.name)}`));
renderWS();renderBook();renderShop();
setInterval(()=>{if(document.hidden)return;const w=pick(WS.filter(x=>left(x.id)>=1));if(!w)return;const r=addRes({w:w.id,ppl:1,name:nextName(),src:"web"});if(V.view==="cliente")toast(`${r.name} acaba de apartar en ${WM[r.w].n}`)},32000);
welcome(D,D.welcome.steps);
})();
