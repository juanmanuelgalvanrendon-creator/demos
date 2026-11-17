/* Motor "citas": servicios con duración, personal o recursos con su horario, horarios libres reales,
   agenda por persona y panel del dueño. Extensible: window.CITAS expone estado y eventos para módulos por negocio. */
(()=>{
const {$,rnd,pick,peso,cap,iso,mty,fmtD,fmtL,esc,V,modal,closeModal,toast,feed,bump,setView,refresh,demobar,wire,ticket,welcome,topbar,hero,footer}=CN;
const D=window.DEMO;const L=D.labels||["Agenda","Dueño"];
const SV=Object.fromEntries(D.services.map(s=>[s.id,s]));
const ST=D.staff;const STM=Object.fromEntries(ST.map(s=>[s.id,s]));
const VAR=D.variant||null;const VM=VAR?Object.fromEntries(VAR.opts.map(o=>[o.id,o])):{};
const ZN=D.zones||null;const ZM=ZN?Object.fromEntries(ZN.list.map(z=>[z.id,z])):{};
const STEP=D.step||30,AHEAD=D.ahead||14,LEAD=D.lead==null?60:D.lead,BUF=D.buffer||0;
const COLORS=["var(--g-d)","var(--acc-d)","#6b5b95","#3f7a8c","#a0522d","#5a7d4f"];
const ampm=m=>{const h=Math.floor(m/60),mm=m%60;return `${h%12||12}:${String(mm).padStart(2,"0")} ${h<12?"am":"pm"}`};
const short=m=>{const h=Math.floor(m/60),mm=m%60;return `${h%12||12}${mm?":"+String(mm).padStart(2,"0"):""}`};
const durTxt=m=>m>=60?`${Math.floor(m/60)} h${m%60?" "+m%60+" min":""}`:`${m} min`;
const ini=n=>n.replace(/^(Dra?\.|Lic\.|MVZ)\s*/,"").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
const now=()=>{const t=mty();return {d:iso(t),m:t.getHours()*60+t.getMinutes(),wd:t.getDay()}};
const addDays=(d,n)=>{const t=new Date(d+"T12:00:00");t.setDate(t.getDate()+n);return iso(t)};
const wd=d=>new Date(d+"T12:00:00").getDay();
const ev={};const on=(k,f)=>(ev[k]=ev[k]||[]).push(f);const emit=(k,x)=>(ev[k]||[]).forEach(f=>f(x));

const S={add:[],svc:D.services[0].id,v:VAR?VAR.opts[VAR.def||0].id:null,who:"any",zone:ZN?ZN.list[0].id:null,qty:1,date:null,slot:null,bk:[],seq:1000,ag:null,cat:D.cats?D.cats[0].id:null};
const hoursOf=(s,d)=>{const h=(s.hours||D.hours)[wd(d)];return h||null};
const works=(s,d)=>!!hoursOf(s,d)&&!(s.off||[]).includes(wd(d));
const canDo=(s,svc)=>!s.svcs||s.svcs.includes(svc);
const zoneOk=(z,d)=>!ZN||!z||ZM[z].days.includes(wd(d));
const AD=Object.fromEntries((D.addons||[]).map(a=>[a.id,a]));
function durOf(svc,v,q,ad=[]){const s=SV[svc];let m=s.min+((v&&VM[v]&&VM[v].add)||0)+ad.reduce((a,x)=>a+(AD[x]?AD[x].min||0:0),0);if(q>1)m+=(q-1)*(s.each||Math.round(s.min*.6));return Math.ceil(m/STEP)*STEP}
function priceOf(svc,v,q,ad=[]){const s=SV[svc];const extra=ad.reduce((a,x)=>a+(AD[x]?Math.round(AD[x].p*(AD[x].fixed?1:((v&&VM[v]&&VM[v].mult)||1))):0),0);const one=Math.round(s.p*((v&&VM[v]&&VM[v].mult)||1)+((v&&VM[v]&&VM[v].addP)||0));if(q>1&&s.p2)return Math.floor(q/2)*Math.round(s.p2*((v&&VM[v]&&VM[v].mult)||1))+(q%2)*one+extra;return one*q+extra}
const dayBk=(st,d)=>S.bk.filter(b=>b.staff===st&&b.date===d&&b.st!=="no"&&b.st!=="x");
function freeAt(st,d,start,dur){const s=STM[st];const h=hoursOf(s,d);if(!h||!works(s,d))return false;if(start<h[0]||start+dur>h[1])return false;const n=now();if(d===n.d&&start<n.m+LEAD)return false;return !dayBk(st,d).some(b=>start<b.start+b.dur+BUF&&b.start<start+dur+BUF)}
const eligible=(svc,d)=>ST.filter(s=>canDo(s,svc)&&works(s,d));
function slotsFor(d,svc=S.svc,who=S.who,v=S.v,q=S.qty,z=S.zone,ad=S.add){if(!zoneOk(z,d))return [];const dur=durOf(svc,v,q,ad);const pool=who==="any"?eligible(svc,d):[STM[who]].filter(s=>s&&canDo(s,svc)&&works(s,d));const set=new Map();pool.forEach(s=>{const h=hoursOf(s,d);for(let t=h[0];t+dur<=h[1];t+=STEP){if(!set.has(t)&&freeAt(s.id,d,t,dur))set.set(t,s.id)}});return [...set.entries()].sort((a,b)=>a[0]-b[0])}
const firstStaff=(d,t,svc,dur,who)=>{const pool=who&&who!=="any"?[STM[who]]:eligible(svc,d);const f=pool.find(s=>freeAt(s.id,d,t,dur));return f?f.id:null};
function addBk(o){const b={id:++S.seq,code:String(rnd(1000,9999)),st:"ok",src:"link",rem:false,x:{},...o};S.bk.push(b);emit("book",b);return b}

/* ---------- interfaz ---------- */
const hasStaffPick=ST.length>1&&D.pickStaff!==false;
document.body.innerHTML=`<main id="v-cliente">${topbar(D,D.topBtn||"Mi cita")}${hero(D)}
<section class="section" id="servicios"><div class="wrap"><div class="sec-head"><div><span class="eyebrow"><span class="step-num">1</span>${D.svcHead.kicker}</span><h2 class="display">${D.svcHead.title}</h2></div><p>${D.svcHead.note}</p></div>
${D.cats?`<div class="chips cats" id="cats">${D.cats.map((c,i)=>`<button class="${i?"":"on"}" data-cat="${c.id}">${c.n}</button>`).join("")}</div>`:""}
<div class="svcs" id="svcs"></div></div></section>
<section class="section" style="padding-top:0" id="agendar"><div class="wrap two">
<div class="panel"><span class="eyebrow"><span class="step-num">2</span>${D.pickHead||"Día y hora"}</span>
${VAR?`<div class="field"><label>${VAR.label}</label><div class="chips" id="vars">${VAR.opts.map(o=>`<button data-v="${o.id}">${o.n}${o.sub?`<small>${o.sub}</small>`:""}</button>`).join("")}</div></div>`:""}
${D.addons?`<div class="field"><label>${D.addonsLabel||"Adicionales"}</label><div class="chips" id="adds">${D.addons.map(a=>`<button data-ad="${a.id}">${a.n}<small>+${peso(a.p)}${a.fixed?"":" aprox."}${a.min?" · "+durTxt(a.min):""}</small></button>`).join("")}</div></div>`:""}
${D.qty?`<div class="field"><label>${D.qty.label}</label><div class="ppl"><span id="qTxt"></span><div class="stepper"><button data-q="-1" aria-label="Menos">&minus;</button><span id="qN">1</span><button data-q="1" aria-label="Más">+</button></div></div></div>`:""}
${ZN?`<div class="field"><label for="zone">${ZN.label}</label><select id="zone">${ZN.list.map(z=>`<option value="${z.id}">${z.n}</option>`).join("")}</select><small id="zNote" style="color:var(--muted);font-size:12.5px;line-height:1.4"></small></div>`:""}
${hasStaffPick?`<div class="field"><label>${D.staffLabel||"¿Con quién?"}</label><div class="who-chips" id="who"></div></div>`:""}
<div class="field"><label>Día</label><div class="days" id="days"></div></div>
<div class="field"><label>Horario</label><div id="slots"></div></div>
</div>
<div class="panel summ" id="summ"><h3>${D.sumTitle||"Tu cita"}</h3><div id="sumBody"></div>
${(D.fields||[]).map(f=>`<div class="field"><label for="x_${f.id}">${f.label}</label>${f.opts?`<select id="x_${f.id}">${f.opts.map(o=>`<option>${o}</option>`).join("")}</select>`:`<input id="x_${f.id}" placeholder="${esc(f.ph||"")}" autocomplete="off">`}</div>`).join("")}
<div class="grid2"><div class="field"><label for="fName">Nombre</label><input id="fName" placeholder="¿A nombre de quién?" autocomplete="off"></div><div class="field"><label for="fPhone">WhatsApp</label><input id="fPhone" inputmode="tel" placeholder="10 dígitos" maxlength="14" autocomplete="off"></div></div>
<div class="totals"><span>${D.totalLabel||"Total"}</span><b id="tot">$0</b></div><div id="depo"></div>
<button class="btn btn-g" id="book" style="width:100%;margin-top:12px;background:var(--g-dd)">${D.bookBtn||"Confirmar cita"}</button><div class="err" id="err"></div>
<div class="remind"><span>📲</span><span>${D.remind||"<b>Recordatorio automático</b> por WhatsApp un día antes, con opción de confirmar o reagendar."}</span></div></div>
</div></section>
<div id="xClient"></div>
${footer(D)}</main>
<main id="v-cocina" class="kds" hidden><div class="kds-top"><h2><small>${L[0]}</small>${D.agendaTitle||"Citas del día"}</h2><div class="kds-ctrl"><button id="agAdd">+ Registrar cita de ${D.manualSrc||"WhatsApp"}</button></div></div>
<div class="days" id="agDays" style="padding:4px 20px 0"></div><div class="kds-stats" id="agStats"></div><div id="xAgendaTop"></div><div class="cols" id="cols"></div><div id="xAgenda"></div></main>
<main id="v-dueno" class="own" hidden><div class="own-top"><div class="wrap"><h2><small>Panel ${L[1]==="Dueña"?"de la dueña":"del dueño"}</small>${D.ownerTitle||"Esta semana"}</h2><span class="chip live"><span class="dot pulse"></span>En vivo</span></div></div><div class="wrap">
<div class="kpis"><div class="kpi"><span>Citas de la semana</span><b id="kN">0</b><em id="kNe"></em></div><div class="kpi"><span>Ingreso agendado</span><b id="kI">$0</b><em>Servicios confirmados</em></div><div class="kpi"><span>Ocupación de la agenda</span><b id="kO">0%</b><em id="kOe"></em></div><div class="kpi"><span>${D.kpi4?D.kpi4[0]:"Recordatorios enviados"}</span><b id="k4">0</b><em id="k4e">${D.kpi4?D.kpi4[1]:"Menos citas olvidadas"}</em></div></div>
<div class="own-grid"><div class="card"><h3>${hasStaffPick?"Ingreso por persona":"Citas por día"} <small>semana</small></h3><div class="bars" id="bStaff"></div></div><div class="card"><h3>Servicios más pedidos <small>semana</small></h3><div class="bars" id="bSvc"></div></div><div class="card"><h3>¿Cómo agendan? <small>origen</small></h3><div class="bars" id="bSrc"></div></div><div id="xOwner"></div><div class="card" style="grid-column:1/-1"><h3>Movimientos <small>en tiempo real</small></h3><div class="feed" id="feed"></div></div></div>
<div class="own-foot">Cifras de ejemplo para la demo.</div></div></main>${demobar(L)}`;
wire();

/* ---------- cliente ---------- */
function renderSvcs(){const list=D.services.filter(s=>!D.cats||!S.cat||s.cat===S.cat);$("#svcs").innerHTML=list.map(s=>`<button class="svc ${S.svc===s.id?"on":""}" data-s="${s.id}">${s.tag?`<span class="tag">${s.tag}</span>`:""}<h3>${s.n}</h3><p>${s.d}</p><div class="meta"><b>${s.from?"desde ":""}${peso(s.p)}</b><span>${s.durTxt||durTxt(s.min)}</span></div></button>`).join("")}
function renderWho(){if(!hasStaffPick)return;const ok=ST.filter(s=>canDo(s,S.svc));if(S.who!=="any"&&!canDo(STM[S.who],S.svc))S.who="any";
  $("#who").innerHTML=`<button class="${S.who==="any"?"on":""}" data-who="any"><i style="background:var(--ink)">✓</i><span>${D.anyLabel||"Quien esté libre"}<small>Más horarios</small></span></button>`+ST.map((s,i)=>`<button class="${S.who===s.id?"on":""} ${ok.includes(s)?"":"off"}" data-who="${s.id}"><i style="background:${s.color||COLORS[i%COLORS.length]}">${ini(s.n)}</i><span>${s.n}<small>${s.role||""}</small></span></button>`).join("")}
function dayList(){const n=now();const out=[];for(let i=0;i<AHEAD;i++){const d=addDays(n.d,i);out.push(d)}return out}
function renderDays(){const ds=dayList();if(!S.date||!ds.includes(S.date)||!slotsFor(S.date).length){S.date=ds.find(d=>slotsFor(d).length)||ds[0];S.slot=null}
  $("#days").innerHTML=ds.map(d=>{const t=new Date(d+"T12:00:00");const n=slotsFor(d).length;const zOff=ZN&&!zoneOk(S.zone,d);const el=eligible(S.svc,d);const closed=!el.length;const nn=now();const shut=d===nn.d&&el.every(s=>hoursOf(s,d)[1]<=nn.m+LEAD+30);const lbl=zOff?(ZN.offTxt||"Sin ruta"):closed?"Cerrado":n?`${n} ${n===1?"libre":"libres"}`:shut?"Ya cerró":"Lleno";return `<button class="${S.date===d?"on":""} ${n?"":"full"}" data-d="${d}"><span>${t.toLocaleDateString("es-MX",{weekday:"short"}).replace(".","")}</span><b>${t.getDate()}</b><small>${lbl}</small></button>`}).join("")}
function renderSlots(){const sl=slotsFor(S.date);if(S.slot!=null&&!sl.some(x=>x[0]===S.slot))S.slot=null;
  if(!sl.length){$("#slots").innerHTML=`<div class="nosl">${ZN&&!zoneOk(S.zone,S.date)?ZN.offMsg||"Ese día no hay ruta por tu zona.":"No quedan horarios este día. Elige otro día."}</div>`;return}
  const parts=[["Mañana",0,720],["Tarde",720,1080],["Noche",1080,1440]];
  $("#slots").innerHTML=parts.map(([n,a,b])=>{const xs=sl.filter(x=>x[0]>=a&&x[0]<b);return xs.length?`<div class="slotlbl">${n}</div><div class="slotgrid">${xs.map(([t])=>`<button class="${S.slot===t?"on":""}" data-t="${t}">${ampm(t)}</button>`).join("")}</div>`:""}).join("")}
function summary(){const s=SV[S.svc];const dur=durOf(S.svc,S.v,S.qty,S.add);const pr=priceOf(S.svc,S.v,S.qty,S.add);const who=S.slot!=null?(S.who==="any"?firstStaff(S.date,S.slot,S.svc,dur):S.who):null;
  const rows=[["Servicio",s.n+(S.qty>1?` × ${S.qty}`:"")]];if(VAR)rows.push([VAR.short||VAR.label,VM[S.v].n]);if(S.add.length)rows.push([D.addonsLabel||"Adicionales",S.add.map(x=>AD[x].n).join(", ")]);if(ZN)rows.push(["Zona",ZM[S.zone].n]);if(hasStaffPick)rows.push([D.staffShort||"Con",who?STM[who].n:(S.who==="any"?D.anyLabel||"Quien esté libre":STM[S.who].n)]);rows.push(["Duración",durTxt(dur)]);
  $("#sumBody").innerHTML=`<div class="big">${S.slot!=null?`${fmtL(S.date)}<br>${ampm(S.slot)} a ${ampm(S.slot+dur)}`:"Elige día y horario"}</div>${rows.map(r=>`<div class="sum-line"><span>${r[0]}</span><b>${r[1]}</b></div>`).join("")}`;
  $("#tot").textContent=peso(pr);$("#depo").innerHTML=D.deposit&&pr>=(D.deposit.over||0)?`<div class="sum-line" style="border:0"><span>${D.deposit.label||"Anticipo para apartar"}</span><b>${peso(Math.round(pr*D.deposit.pct/100))}</b></div>`:"";
  if(D.qty){$("#qN").textContent=S.qty;$("#qTxt").textContent=D.qty.txt?D.qty.txt(S.qty):S.qty}
  if(ZN)$("#zNote").textContent=ZM[S.zone].note||`Visitamos tu zona: ${ZM[S.zone].days.map(x=>["dom","lun","mar","mié","jue","vie","sáb"][x]).join(", ")}.`;
  $("#topBadge").textContent=S.bk.filter(b=>b.mine).length;emit("summary",{dur,pr,who})}
function renderVars(){if(VAR)document.querySelectorAll("#vars [data-v]").forEach(b=>b.classList.toggle("on",b.dataset.v===S.v));document.querySelectorAll("#adds [data-ad]").forEach(b=>b.classList.toggle("on",S.add.includes(b.dataset.ad)))}
function renderClient(){renderSvcs();renderVars();renderWho();renderDays();renderSlots();summary()}

document.addEventListener("click",e=>{const t=e.target.closest("[data-s],[data-cat],[data-v],[data-who],[data-d],[data-t],[data-q],[data-ad]");if(!t||!t.closest("#v-cliente"))return;
  if(t.dataset.s){S.svc=t.dataset.s;S.slot=null;renderClient();if(innerWidth<980)$("#agendar").scrollIntoView({behavior:"smooth"})}
  else if(t.dataset.cat){S.cat=t.dataset.cat;document.querySelectorAll("#cats [data-cat]").forEach(b=>b.classList.toggle("on",b===t));renderSvcs()}
  else if(t.dataset.v){S.v=t.dataset.v;S.slot=null;renderClient()}
  else if(t.dataset.ad){const a=t.dataset.ad;S.add=S.add.includes(a)?S.add.filter(x=>x!==a):[...S.add,a];S.slot=null;renderClient()}
  else if(t.dataset.who){S.who=t.dataset.who;S.slot=null;renderClient()}
  else if(t.dataset.d){S.date=t.dataset.d;S.slot=null;renderDays();renderSlots();summary()}
  else if(t.dataset.t){S.slot=+t.dataset.t;renderSlots();summary()}
  else if(t.dataset.q){S.qty=Math.max(1,Math.min(D.qty.max||4,S.qty+ +t.dataset.q));S.slot=null;renderClient()}});
if(ZN)$("#zone").onchange=e=>{S.zone=e.target.value;S.date=null;S.slot=null;renderClient()};
$("#topBtn").onclick=()=>{const m=S.bk.filter(b=>b.mine);if(!m.length){$("#agendar").scrollIntoView({behavior:"smooth"});return}const b=m[m.length-1];showTicket(b)};
function showTicket(b){const s=SV[b.svc];const rows=[[ "Servicio",s.n+(b.qty>1?` × ${b.qty}`:"")]];if(b.v)rows.push([VAR.short||VAR.label,VM[b.v].n]);if(b.add&&b.add.length)rows.push([D.addonsLabel||"Adicionales",b.add.map(x=>AD[x].n).join(", ")]);if(b.zone)rows.push(["Zona",ZM[b.zone].n]);if(hasStaffPick||D.showStaff)rows.push([D.staffShort||"Con",STM[b.staff].n]);(D.fields||[]).forEach(f=>{if(b.x&&b.x[f.id])rows.push([f.short||f.label,esc(b.x[f.id])])});rows.push(["Total",peso(b.price)]);
  modal(ticket({chip:D.okChip||"Cita confirmada",title:`${fmtL(b.date)}`,sub:`${ampm(b.start)} a ${ampm(b.start+b.dur)}`,rows,code:b.code,codeLabel:"Código de tu cita",codeNote:D.codeNote||"Muéstralo al llegar",wa:D.waTicket||"En el sistema real te llega esta confirmación por WhatsApp y un recordatorio un día antes para confirmar o reagendar.",go:"cocina",goLabel:`Ver cómo le llega al negocio →`}))}
$("#book").onclick=()=>{const err=$("#err");err.textContent="";const nm=$("#fName").value.trim(),ph=$("#fPhone").value.replace(/\D/g,"");
  if(S.slot==null){err.textContent="Elige un horario.";return}if(nm.length<2){err.textContent="Escribe tu nombre.";return}if(ph.length<10){err.textContent="Escribe tu WhatsApp a 10 dígitos.";return}
  const x={};for(const f of D.fields||[]){const v=$("#x_"+f.id).value.trim();if(f.req&&!v){err.textContent=`Completa: ${f.label.toLowerCase()}.`;return}x[f.id]=v}
  const dur=durOf(S.svc,S.v,S.qty,S.add);const st=S.who==="any"?firstStaff(S.date,S.slot,S.svc,dur):(freeAt(S.who,S.date,S.slot,dur)?S.who:null);if(!st){err.textContent="Ese horario se acaba de ocupar. Elige otro.";renderClient();return}
  const b=addBk({svc:S.svc,v:S.v,qty:S.qty,add:[...S.add],zone:S.zone,staff:st,date:S.date,start:S.slot,dur,price:priceOf(S.svc,S.v,S.qty,S.add),name:nm,phone:ph,x,mine:true,src:"link",fresh:true});
  feed(`<b>${ampm(b.start)}</b> ${esc(nm)} agendó ${SV[b.svc].n} · ${fmtD(b.date)}`);bump();S.ag=b.date;S.slot=null;renderClient();showTicket(b)};

/* ---------- agenda ---------- */
const stBadge={ok:["Confirmada","ok"],in:[D.inTxt||"Llegó","in"],done:["Terminada",""],no:["No asistió","no"]};
function renderAg(){const n=now();const ds=[0,1,2,3,4,5,6].map(i=>addDays(n.d,i));if(!S.ag||!ds.includes(S.ag))S.ag=ds.find(x=>ST.some(s=>works(s,x))&&S.bk.some(b=>b.date===x&&b.st!=="x"))||n.d;const d=S.ag;
  $("#agDays").innerHTML=ds.map(x=>{const t=new Date(x+"T12:00:00");const c=S.bk.filter(b=>b.date===x&&b.st!=="x").length;return `<button class="${x===d?"on":""}" data-ag="${x}"><span>${t.toLocaleDateString("es-MX",{weekday:"short"}).replace(".","")}</span><b>${t.getDate()}</b><small>${c} citas</small></button>`}).join("");
  const day=S.bk.filter(b=>b.date===d&&b.st!=="x").sort((a,b)=>a.start-b.start);const inc=day.filter(b=>b.st!=="no").reduce((s,b)=>s+b.price,0);
  const gaps=[];ST.forEach(s=>{if(!works(s,d))return;const h=hoursOf(s,d);let t=Math.max(h[0],d===n.d?Math.ceil((n.m+30)/STEP)*STEP:h[0]);const mine=dayBk(s.id,d).sort((a,b)=>a.start-b.start);for(const b of mine){if(b.start-t>=60)gaps.push([s.id,t,b.start]);t=Math.max(t,b.start+b.dur+BUF)}if(h[1]-t>=60)gaps.push([s.id,t,h[1]])});
  $("#agStats").innerHTML=`<div><b>${day.filter(b=>b.st!=="no").length}</b>citas</div><div><b>${peso(inc)}</b>del día</div><div><b>${day.filter(b=>b.rem).length}</b>confirmadas por WhatsApp</div><div><b>${gaps.length}</b>huecos libres</div>`;
  $("#cols").innerHTML=ST.filter(s=>works(s,d)||day.some(b=>b.staff===s.id)).map((s,i)=>{const mine=day.filter(b=>b.staff===s.id);const h=hoursOf(s,d)||[0,1];const usedM=mine.filter(b=>b.st!=="no").reduce((a,b)=>a+b.dur,0);const g=gaps.filter(x=>x[0]===s.id);
    const items=[...mine.map(b=>({t:b.start,h:lnBk(b)})),...g.map(x=>({t:x[1],h:`<div class="gap"><span>Libre ${ampm(x[1])} a ${ampm(x[2])}</span><button data-fill="${s.id}|${x[1]}">${D.gapBtn||"Avisar a lista de espera"}</button></div>`}))].sort((a,b)=>a.t-b.t);
    return `<div class="col"><header><i style="background:${s.color||COLORS[ST.indexOf(s)%COLORS.length]}">${ini(s.n)}</i><div><b>${s.n}</b><span>${s.role?s.role+" · ":""}${works(s,d)?`${ampm(h[0])} a ${ampm(h[1])}`:"Descansa"}</span></div></header><div class="capbar"><i style="width:${Math.min(100,usedM/(h[1]-h[0])*100)}%"></i></div>${items.map(x=>x.h).join("")||`<p class="kempty" style="margin-top:8px">Sin citas.</p>`}</div>`}).join("")||`<div class="col"><p class="kempty">Día de descanso.</p></div>`;
  emit("agenda",d)}
function lnBk(b){const s=SV[b.svc];const bd=stBadge[b.st];const src={link:["Link","wa"],wa:["WhatsApp","wa"],dm:["DM","dm"],tel:["Teléfono","p"]}[b.src]||["Link","wa"];
  const det=[s.n+(b.qty>1?` × ${b.qty}`:""),b.v?VM[b.v].n:"",...(b.add||[]).map(x=>"+ "+AD[x].n),b.zone?ZM[b.zone].n:"",...(D.fields||[]).filter(f=>f.inAg&&b.x&&b.x[f.id]).map(f=>esc(b.x[f.id]))].filter(Boolean).join(" · ");
  const act=b.st==="ok"?`<button data-st="${b.id}|in">${D.inBtn||"Llegó"}</button><button class="alt" data-st="${b.id}|no">No vino</button>`:b.st==="in"?`<button data-st="${b.id}|done">${D.doneBtn||"Terminar"}</button>`:"";
  const fr=b.fresh;b.fresh=false;
  return `<div class="ln ${b.st==="done"||b.st==="no"?"done":""} ${fr?"fresh":""}"><div><div class="who"><span class="tm">${ampm(b.start)}</span>${esc(b.name)}${b.mine?` <span class="mine">(tu cita)</span>`:""}<span class="bdg ${bd[1]}">${bd[0]}</span><span class="bdg ${src[1]}">${src[0]}</span></div><div class="det">${det} · ${durTxt(b.dur)} · ${peso(b.price)}${b.rem?" · ✓ confirmó":""}${b.note?` · ${esc(b.note)}`:""}</div></div><div class="acts">${act}</div></div>`}
document.addEventListener("click",e=>{const a=e.target.closest("[data-ag]");if(a){S.ag=a.dataset.ag;renderAg();return}
  const s=e.target.closest("[data-st]");if(s){const [id,st]=s.dataset.st.split("|");const b=S.bk.find(x=>x.id==id);b.st=st;emit("status",b);if(st==="done")toast(D.doneToast?D.doneToast(b):`Listo: se le envía a ${esc(b.name)} su recibo y una encuesta por WhatsApp.`);if(st==="no")toast("Marcado como no asistió. Ese horario queda libre para la lista de espera.");feed(`<b>${ampm(b.start)}</b> ${esc(b.name)}: ${stBadge[st][0].toLowerCase()}`);renderAg();return}
  const f=e.target.closest("[data-fill]");if(f){const [st,t]=f.dataset.fill.split("|");toast(D.fillToast||`Aviso enviado a la lista de espera: "Se liberó un lugar ${ampm(+t)} con ${STM[st].n}". El primero en contestar lo aparta.`);f.disabled=true;f.textContent="Aviso enviado";return}});
$("#agAdd").onclick=()=>{const d=S.ag;modal(`<div class="welcome"><span class="eyebrow">Registrar cita</span><h3 style="font-family:var(--display);text-transform:none;font-weight:var(--dw)">Cita que llegó por ${D.manualSrc||"WhatsApp"}</h3><p>Se guarda en la misma agenda, así ya no se empalma con las del link.</p><div class="qform"><select id="qS">${D.services.map(s=>`<option value="${s.id}">${s.n}</option>`).join("")}</select>${VAR?`<select id="qV">${VAR.opts.map(o=>`<option value="${o.id}">${o.n}</option>`).join("")}</select>`:""}${ZN?`<select id="qZ">${ZN.list.map(z=>`<option value="${z.id}">${z.n}</option>`).join("")}</select>`:""}<input id="qName" placeholder="Nombre del cliente"></div><button class="btn btn-g" id="qOk" style="margin-top:14px;background:var(--g-dd)">Buscar primer horario libre ${fmtD(d)}</button><div class="err" id="qErr"></div><button class="btn btn-w" data-close>Cancelar</button></div>`);
  $("#qOk").onclick=()=>{const svc=$("#qS").value,v=VAR?$("#qV").value:null,z=ZN?$("#qZ").value:null,nm=$("#qName").value.trim()||"Cliente de "+(D.manualSrc||"WhatsApp");const sl=slotsFor(d,svc,"any",v,1,z,[]);if(!sl.length){$("#qErr").textContent=ZN&&!zoneOk(z,d)?"Ese día no hay ruta por esa zona.":"Ya no hay horarios libres ese día.";return}const [t,st]=sl[0];const b=addBk({svc,v,qty:1,zone:z,staff:st,date:d,start:t,dur:durOf(svc,v,1),price:priceOf(svc,v,1),name:nm,src:D.manualKey||"wa",fresh:true});closeModal();feed(`<b>${ampm(t)}</b> ${esc(nm)} (${D.manualSrc||"WhatsApp"}) · ${SV[svc].n}`);toast(`Agendado ${ampm(t)} con ${STM[st].n}. Se le manda la confirmación por WhatsApp.`);renderAg()}};

/* ---------- dueño ---------- */
function renderOwn(){const n=now();const wk=[0,1,2,3,4,5,6].map(i=>addDays(n.d,i));const W=S.bk.filter(b=>wk.includes(b.date)&&b.st!=="no"&&b.st!=="x");
  $("#kN").textContent=W.length;$("#kNe").textContent=`${W.filter(b=>b.src==="link").length} desde el link`;$("#kI").textContent=peso(W.reduce((s,b)=>s+b.price,0));
  let capM=0,used=0;wk.forEach(d=>ST.forEach(s=>{if(works(s,d)){const h=hoursOf(s,d);capM+=h[1]-h[0];used+=dayBk(s.id,d).reduce((a,b)=>a+b.dur,0)}}));$("#kO").textContent=Math.round(used/Math.max(capM,1)*100)+"%";$("#kOe").textContent=`${Math.round((capM-used)/60)} h libres por llenar`;
  if(!D.kpi4){$("#k4").textContent=S.bk.filter(b=>b.rem).length+W.length}else if(D.kpi4[2])$("#k4").textContent=D.kpi4[2](S,W);
  const bar=(l,v,m,txt)=>`<div class="bar"><span>${l}</span><div class="track"><div class="fill" style="width:${m?v/m*100:0}%;background:var(--g-d)"></div></div><span class="v">${txt}</span></div>`;
  if(hasStaffPick){const r=ST.map(s=>[s.n,W.filter(b=>b.staff===s.id).reduce((a,b)=>a+b.price,0)]);const m=Math.max(...r.map(x=>x[1]));$("#bStaff").innerHTML=r.map(x=>bar(x[0].split(" ")[0],x[1],m,peso(x[1]))).join("")}
  else{const r=wk.map(d=>[cap(new Date(d+"T12:00:00").toLocaleDateString("es-MX",{weekday:"short"}).replace(".","")),W.filter(b=>b.date===d).length]);const m=Math.max(...r.map(x=>x[1]));$("#bStaff").innerHTML=r.map(x=>bar(x[0],x[1],m,x[1])).join("")}
  const sv=D.services.map(s=>[s.n,W.filter(b=>b.svc===s.id).length]).sort((a,b)=>b[1]-a[1]).slice(0,5);const ms=Math.max(...sv.map(x=>x[1]));$("#bSvc").innerHTML=sv.map(x=>bar(x[0].length>14?x[0].slice(0,13)+"…":x[0],x[1],ms,x[1])).join("");
  const src=[["Link",W.filter(b=>b.src==="link").length],["WhatsApp",W.filter(b=>b.src==="wa").length],[D.src3||"DM",W.filter(b=>b.src==="dm"||b.src==="tel").length]];const mr=Math.max(...src.map(x=>x[1]));$("#bSrc").innerHTML=src.map(x=>bar(x[0],x[1],mr,x[1])).join("");
  emit("owner",W)}
V.onView={cliente:renderClient,cocina:renderAg,dueno:renderOwn};

/* ---------- datos de ejemplo ---------- */
(function seed(){const n=now();const names=D.seed.names;let k=0;const fill=D.seed.fill||.5;
  for(let i=0;i<7;i++){const d=addDays(n.d,i);ST.forEach(s=>{if(!works(s,d))return;const h=hoursOf(s,d);let t=h[0];while(t<h[1]){if(Math.random()<fill){const opts=D.services.filter(x=>canDo(s,x.id)&&!x.noSeed);const sv=pick(opts);const v=VAR?pick(VAR.opts).id:null;const zs=ZN?ZN.list.filter(z=>z.days.includes(wd(d))):[];const z=ZN?(zs.length?pick(zs).id:null):null;if(ZN&&!z)break;const dur=durOf(sv.id,v,1);
    if(t+dur<=h[1]&&!dayBk(s.id,d).some(b=>t<b.start+b.dur+BUF&&b.start<t+dur+BUF)){const past=d===n.d&&t+dur<n.m,cur=d===n.d&&t<=n.m&&t+dur>=n.m;const x={};(D.fields||[]).forEach(f=>{if(D.seed[f.id])x[f.id]=pick(D.seed[f.id])});
      S.bk.push({id:++S.seq,code:String(rnd(1000,9999)),svc:sv.id,v,qty:1,zone:z,staff:s.id,date:d,start:t,dur,price:priceOf(sv.id,v,1),name:names[(k++)%names.length],x,st:past?(Math.random()<.08?"no":"done"):cur?"in":"ok",src:pick(["link","link","wa","wa","dm"]),rem:i<=1&&Math.random()<.7});t+=dur+BUF;continue}}t+=STEP}})}
  emit("seed",S)})();

window.CITAS={D,S,SV,STM,ZM,VM,AD,on,emit,addBk,priceOf,durOf,slotsFor,ampm,durTxt,addDays,now,renderAll:()=>refresh()};
setTimeout(()=>{renderClient();welcome(D,D.welcome.steps)},0);
})();
