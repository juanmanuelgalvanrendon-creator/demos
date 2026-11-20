/* Code Nova · Formulario de pedido v2 (catálogo con fotos, fecha, resumen y envío a WhatsApp).
   Se configura con window.Q antes de cargar este archivo. Sin servidor: arma el mensaje y abre wa.me.
   Q = {
     brand:{name, sub, ig, city},  wa:"52..."  | waLink:"https://wa.me/message/..." (copia el texto),
     theme:{bg, paper, ink, accent, soft, softInk, line, display, body, fonts:"family=...", radius:"arch"|"round"},
     hero:{eyebrow, title(html), lead, imgs:[2-4], cta1, cta2:{label, tab}, trust:[[grande, chico],...], badge:[titulo, texto]},
     tabs:[{id, label, img|icon, title, hint, head, items:[{id,name,d,img}], unit:["pieza","piezas"], max,
            fields:[{id,type:"chips"|"multi"|"num"|"text"|"area"|"refs", label, req, options, def, min, max, step, unit, ph, help, out, refs:[{name,sub,img}]}],
            aside:{img|icon, title, text}, delivery:true|false, date:true|false}],
     date:{title, hint, label, days, minDays, req},  delivery:{options:[..], zone:"opción que pide colonia", zoneHint},
     contact:{nameLabel, notePh, noteHint, noteLabel},  closing, steps:[t1,t2,t3]
   } */
(()=>{
const Q=window.Q,T=Q.theme||{};
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ICON={
 cake:'<path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M5 16c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 5 0M12 12V8M12 5.5c.8 0 1.2-.9.6-1.5L12 3l-.6 1c-.6.6-.2 1.5.6 1.5z"/>',
 table:'<path d="M3 11h18M5 11v9M19 11v9M7 11V8a2 2 0 0 1 4 0v3M13 11V6.5a2.5 2.5 0 0 1 5 0V11"/>',
 house:'<path d="M3 10.5 12 4l9 6.5M5 9v11h14V9M10 20v-5h4v5"/>',
 flower:'<path d="M12 21v-8M12 13c-3 0-5-2-5-5 2 0 3 .6 3.6 1.4M12 13c3 0 5-2 5-5-2 0-3 .6-3.6 1.4M9.2 7.6a2.8 2.8 0 1 1 5.6 0c0 1.8-1.3 3-2.8 3s-2.8-1.2-2.8-3zM8 21h8"/>',
 gift:'<path d="M4 11h16v10H4zM3 7h18v4H3zM12 7v14M12 7S10.5 3 8 3.5 7.5 7 12 7zM12 7s1.5-4 4-3.5S16.5 7 12 7z"/>',
 balloon:'<path d="M12 15c3.3 0 6-3 6-6.5S15.3 2 12 2 6 5 6 8.5 8.7 15 12 15zM12 15l-1 2h2l-1-2zM12 17c0 2-2 2-2 4"/>',
 party:'<path d="m4 20 5-14 9 9-14 5zM9 6l9 9M14 4c1 1 1 2 0 3M20 10c-1 1-2 1-3 0M17 3v2M21 7h-2"/>',
 cup:'<path d="M5 8h12v5a6 6 0 0 1-12 0V8zM17 9h1.5a2.5 2.5 0 0 1 0 5H17M8 3c0 1 1 1 1 2M12 3c0 1 1 1 1 2"/>',
 camera:'<path d="M4 7h3l2-3h6l2 3h3v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>',
 music:'<path d="M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>',
 heart:'<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
 spa:'<path d="M12 21c-4.5 0-8-3-8-7 3 0 6 1.5 8 4 2-2.5 5-4 8-4 0 4-3.5 7-8 7zM12 18c-2-3-2-7 0-11 2 4 2 8 0 11z"/>',
 scissors:'<path d="M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.1 7.9 20 20M8.1 16.1 20 4"/>',
 brush:'<path d="M18 3l3 3-9 9-3-3 9-9zM9 12c-3 0-5 2-5 5 0 1.5-1 2.5-2 3 4 1 9 0 9-5"/>',
 star4:'',
 tag:'<path d="M3 12V4h8l10 10-8 8L3 12zM7.5 7.5h.01"/>',
 truck:'<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>',
 calendar:'<path d="M4 5h16v16H4zM4 9h16M8 3v4M16 3v4"/>',
 check:'<path d="M20 6 9 17l-5-5"/>'};
const ico=(n,s=17)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICON[n]||ICON.tag}</svg>`;
const WAICON='<svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.6-.1 1.2z"/></svg>';

/* ---------- fuentes y estilos ---------- */
if(T.fonts){const l=document.createElement("link");l.rel="stylesheet";l.href=`https://fonts.googleapis.com/css2?${T.fonts}&display=swap`;document.head.append(l)}
const ARCH=T.radius==="round"?"22px":"200px 200px 20px 20px",ARCHS=T.radius==="round"?"18px":"160px 160px 14px 14px";
const css=document.createElement("style");css.textContent=`
:root{--bg:${T.bg||"#fbf6f1"};--paper:${T.paper||"#fffdfb"};--ink:${T.ink||"#3a2e2c"};--ac:${T.accent||"#c4687f"};--soft:${T.soft||"#e6ebdf"};--softInk:${T.softInk||"#66775a"};--line:${T.line||"#eadfd8"};--mut:${T.mut||"#8b7d78"};--disp:${T.display||'"Playfair Display",Georgia,serif'}}
*{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{font:16px/1.55 ${T.body||'"DM Sans",system-ui,sans-serif'};color:var(--ink);background:var(--bg);overflow-x:hidden}
button,input,textarea{font:inherit;color:inherit}button{cursor:pointer;border:0;background:none}img{display:block;max-width:100%}a{color:inherit}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
.bar{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.bar .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;height:64px}
.logo{display:flex;flex-direction:column;line-height:1;text-decoration:none;min-width:0;overflow:hidden}.logo b{font:600 24px var(--disp);letter-spacing:-.01em;white-space:nowrap}
.logo small{font-size:9.5px;letter-spacing:.38em;text-transform:uppercase;color:var(--mut);margin-top:5px;padding-left:2px;white-space:nowrap}
.pill{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--softInk);background:var(--soft);padding:7px 12px;border-radius:999px;white-space:nowrap}
.pill i{width:7px;height:7px;border-radius:50%;background:#4caf50;box-shadow:0 0 0 3px rgba(76,175,80,.2)}
.hero{padding:44px 0 20px}.hero .wrap{display:grid;grid-template-columns:1.02fr 1fr;gap:46px;align-items:center}
.eyebrow{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--ac)}
h1{font:500 clamp(38px,5.2vw,60px)/1.03 var(--disp);letter-spacing:-.02em;margin:14px 0 18px}h1 em{font-style:italic;color:var(--ac)}
.lead{font-size:17px;color:color-mix(in srgb,var(--ink) 75%,var(--bg));max-width:480px}
.cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}
.btn{white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:9px;height:52px;padding:0 24px;border-radius:999px;font-weight:700;font-size:15.5px;text-decoration:none;transition:transform .15s}
.btn:active{transform:scale(.98)}.btn-dark{background:var(--ink);color:var(--paper);box-shadow:0 12px 26px -14px rgba(0,0,0,.6)}.btn-ghost{box-shadow:inset 0 0 0 1.5px var(--line)}
.trust{display:flex;gap:22px;margin-top:30px;flex-wrap:wrap}.trust div{font-size:13px;color:var(--mut);line-height:1.35}.trust b{display:block;font:600 22px var(--disp);color:var(--ink)}
.mosaic{display:grid;grid-template-columns:1fr 1fr;gap:14px;position:relative}
.mosaic figure{border-radius:${ARCH};overflow:hidden;background:var(--soft);box-shadow:0 22px 40px -28px rgba(0,0,0,.55);aspect-ratio:4/5}
.mosaic figure:nth-child(even){transform:translateY(34px)}.mosaic img{width:100%;height:100%;object-fit:cover}
.mosaic.m2 figure:nth-child(2){transform:translateY(48px)}
.mosaic.m1{grid-template-columns:1fr}.mosaic.m1 figure{aspect-ratio:5/4;border-radius:28px}
.tagc{position:absolute;left:-18px;bottom:20px;background:var(--paper);border-radius:16px;padding:12px 14px;box-shadow:0 18px 34px -20px rgba(0,0,0,.5);display:flex;gap:10px;align-items:center;font-size:13px;max-width:250px;z-index:2}
.tagc span{width:34px;height:34px;flex:none;border-radius:50%;background:var(--soft);color:var(--softInk);display:grid;place-items:center}.tagc b{display:block;font-size:13.5px}
.sec{padding:52px 0 0}.sh{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap}
.num{font:italic 500 15px var(--disp);color:var(--ac)}h2{font:500 clamp(28px,3.6vw,38px)/1.1 var(--disp);letter-spacing:-.015em;margin-top:4px}.sh p{color:var(--mut);font-size:14.5px;max-width:420px}
.tabs{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 6px;scrollbar-width:none;margin-bottom:22px}.tabs::-webkit-scrollbar{display:none}
.tabs button{flex:none;display:flex;align-items:center;gap:9px;padding:9px 16px 9px 9px;border-radius:999px;background:var(--paper);box-shadow:inset 0 0 0 1px var(--line);font-weight:600;font-size:14.5px;white-space:nowrap}
.tabs button img{width:32px;height:32px;border-radius:50%;object-fit:cover}.tabs .ic{width:32px;height:32px;border-radius:50%;background:var(--soft);display:grid;place-items:center;color:var(--softInk)}
.tabs button.on{background:var(--ink);color:var(--paper);box-shadow:none}.tabs button.on .ic{background:rgba(255,255,255,.15);color:var(--paper)}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.grid.g3{grid-template-columns:repeat(3,1fr)}.grid.g2{grid-template-columns:repeat(2,1fr);max-width:760px}
.card{background:var(--paper);border-radius:26px;padding:10px 10px 14px;box-shadow:0 1px 0 var(--line),0 20px 36px -30px rgba(0,0,0,.5);position:relative;display:flex;flex-direction:column}
.card.sel{box-shadow:0 0 0 2px var(--ac),0 22px 40px -28px var(--ac)}
.card .ph{border-radius:${ARCHS};overflow:hidden;aspect-ratio:4/5;background:var(--soft)}.card .ph img{width:100%;height:100%;object-fit:cover;transition:transform .5s}.card:hover .ph img{transform:scale(1.04)}
.card h3{font:500 20px/1.2 var(--disp);margin:12px 6px 3px}.card p{font-size:13px;color:var(--mut);margin:0 6px 12px;line-height:1.45;flex:1}
.badge{position:absolute;top:16px;right:16px;min-width:30px;height:30px;padding:0 9px;border-radius:999px;background:var(--ac);color:#fff;font-weight:700;font-size:14px;display:grid;place-items:center;transform:scale(0);transition:transform .25s cubic-bezier(.3,1.6,.5,1)}.card.sel .badge{transform:scale(1)}
.step{display:flex;align-items:center;justify-content:space-between;background:var(--bg);border-radius:999px;padding:4px;margin:0 4px}
.step button{width:40px;height:40px;flex:none;border-radius:50%;background:var(--paper);box-shadow:0 1px 2px rgba(0,0,0,.1);font-size:20px;font-weight:600;display:grid;place-items:center}
.step button.plus{background:var(--ink);color:var(--paper)}.step button:disabled{opacity:.35;cursor:default}
.step>div{flex:1;text-align:center}.step b{display:block;font:600 19px/1.1 var(--disp)}.step small{font-size:11.5px;color:var(--mut);display:block;line-height:1;margin-top:2px;font-weight:600}
.pick{margin:0 4px;height:46px;border-radius:999px;font-weight:700;font-size:14.5px;background:var(--bg);box-shadow:inset 0 0 0 1px var(--line)}.card.sel .pick{background:var(--ink);color:var(--paper);box-shadow:none}
.panel{background:var(--paper);border-radius:28px;padding:26px;box-shadow:0 1px 0 var(--line),0 20px 36px -30px rgba(0,0,0,.5)}
.two{display:grid;grid-template-columns:1.1fr .9fr;gap:30px;align-items:start}.fld+.fld{margin-top:22px}.panel+.panel{margin-top:16px}
.lab{display:block;font-size:12px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--mut);margin-bottom:10px}.lab em{color:var(--ac);font-style:normal}
.chips{display:flex;flex-wrap:wrap;gap:8px}.chips button{padding:10px 16px;border-radius:999px;background:var(--bg);box-shadow:inset 0 0 0 1px var(--line);font-weight:600;font-size:14.5px}
.chips button.on{background:var(--softInk);color:#fff;box-shadow:none}
.cnt{display:flex;align-items:center;gap:14px}.cnt .step{margin:0;width:200px}.cnt span{font-size:13.5px;color:var(--mut)}
input[type=text],input[type=tel],input[type=date],textarea{width:100%;border:0;border-radius:16px;background:var(--bg);box-shadow:inset 0 0 0 1px var(--line);padding:14px 16px;font-size:15.5px;outline:none}
input:focus,textarea:focus{box-shadow:inset 0 0 0 2px var(--softInk)}textarea{min-height:96px;resize:vertical}.hint{font-size:12.5px;color:var(--mut);margin-top:7px}
.refs{display:grid;grid-template-columns:1fr 1fr;gap:12px}.refs button{text-align:left;border-radius:20px;overflow:hidden;background:var(--bg);box-shadow:inset 0 0 0 1px var(--line)}
.refs button.on{box-shadow:0 0 0 2px var(--ac)}.refs img{width:100%;aspect-ratio:1/1;object-fit:cover}.refs span{display:block;padding:9px 12px 11px;font-size:13px;font-weight:600}.refs small{display:block;font-weight:500;color:var(--mut);font-size:12px}
.aside{border-radius:22px;overflow:hidden;background:linear-gradient(160deg,var(--soft),color-mix(in srgb,var(--ac) 14%,var(--bg)));display:flex;flex-direction:column}
.aside img{width:100%;aspect-ratio:4/3;object-fit:cover}@media(max-width:900px){.aside img{aspect-ratio:16/9}}.aside .ai{display:grid;place-items:center;padding:34px 0 6px;color:var(--softInk)}.aside div.tx{padding:16px 20px 20px}
.aside b{display:block;font:500 21px/1.15 var(--disp)}.aside p{font-size:13.5px;color:var(--mut);margin-top:6px}
.days{display:flex;gap:9px;overflow-x:auto;padding:4px 2px 10px;scroll-snap-type:x mandatory;scrollbar-width:thin}
.days button{flex:none;width:76px;padding:12px 0 11px;border-radius:20px;background:var(--bg);box-shadow:inset 0 0 0 1px var(--line);text-align:center;scroll-snap-align:start}
.days small{display:block;font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}.days b{display:block;font:600 26px/1.15 var(--disp)}.days span{display:block;font-size:12px;color:var(--mut)}
.days button.on{background:var(--ink);box-shadow:none;color:var(--paper)}.days button.on small,.days button.on span{color:inherit;opacity:.7}
.other{display:flex;align-items:center;gap:10px;margin-top:6px;font-size:13.5px;color:var(--mut)}.other input{width:auto;padding:9px 12px;font-size:14px}
.order{display:grid;grid-template-columns:1fr 400px;gap:28px;align-items:start}
.ticket{position:sticky;top:84px;background:var(--paper);border-radius:28px;overflow:hidden;box-shadow:0 1px 0 var(--line),0 28px 50px -34px rgba(0,0,0,.65)}
.ticket header{padding:22px 24px 18px;background:var(--ink);color:var(--paper)}.ticket header small{font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;opacity:.65;font-weight:700}.ticket header h3{font:500 25px/1.15 var(--disp);margin-top:4px}
.tbody{padding:18px 24px 6px;position:relative}.tbody::before{content:"";position:absolute;left:0;right:0;top:-9px;height:18px;background:radial-gradient(circle at 9px -2px,transparent 9px,var(--paper) 9.5px) 0 0/18px 18px repeat-x}
.line{display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px dashed var(--line);font-size:14.5px}.line img{width:42px;height:42px;border-radius:12px;object-fit:cover;flex:none}.line .q{margin-left:auto;font:600 17px var(--disp);white-space:nowrap}
.kv{display:flex;justify-content:space-between;gap:16px;padding:8px 0;font-size:14px;border-bottom:1px dashed var(--line)}.kv span{color:var(--mut);flex:none}.kv b{font-weight:600;text-align:right;overflow-wrap:anywhere}
.empty{padding:14px 0 16px;color:var(--mut);font-size:14px;text-align:center}.tfoot{padding:16px 24px 22px}
.wa{width:100%;height:58px;border-radius:999px;background:#1faa59;color:#fff;font-weight:700;font-size:16.5px;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 14px 26px -14px rgba(31,170,89,.9)}.wa:active{transform:scale(.98)}
.note{font-size:12.5px;color:var(--mut);text-align:center;margin-top:10px}.note.bad{color:#c2413b;font-weight:600}
.peek{margin-top:14px;border-radius:18px;background:color-mix(in srgb,var(--line) 70%,var(--bg));padding:12px}.peek small{display:block;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);margin-bottom:7px}
.bub{background:#dcf7d0;color:#1d2a1d;border-radius:14px 14px 4px 14px;padding:10px 12px;font-size:13px;white-space:pre-wrap;line-height:1.45;box-shadow:0 1px 1px rgba(0,0,0,.08);max-height:280px;overflow:auto}
.err-ring{animation:shake .4s;box-shadow:0 0 0 2px #c2413b!important;border-radius:16px}@keyframes shake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.dock{display:none}footer{padding:60px 0 40px;text-align:center;color:var(--mut);font-size:13px}footer .logo{align-items:center;margin-bottom:10px;color:var(--ink)}footer a{color:var(--ac);font-weight:600;text-decoration:none}footer .cn{display:block;margin-top:14px;font-size:11.5px;opacity:.75}
@media(max-width:900px){.hero{padding-top:18px}.hero .wrap{grid-template-columns:1fr;gap:26px}.hero .wrap>div:first-child{order:2}
 .mosaic{order:1;max-width:300px;margin:0 auto 14px;width:100%;gap:9px}.mosaic figure{aspect-ratio:4/4.4}.mosaic figure:nth-child(even){transform:translateY(18px)}
 .mosaic.m1{max-width:none}.mosaic.m2{max-width:330px}.tagc{display:none}
 h1{font-size:37px;margin:10px 0 14px}.lead{font-size:16px}.cta{margin-top:20px}.cta .btn{flex:1;height:50px;padding:0 14px;font-size:14.5px}
 .trust{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:24px}.trust div{font-size:12px}.trust b{font-size:19px}
 .grid,.grid.g3{grid-template-columns:1fr 1fr;gap:12px}.two,.order{grid-template-columns:1fr}.ticket{position:static}.panel{padding:20px}
 .dock{display:flex;position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:30;background:var(--ink);color:var(--paper);border-radius:999px;padding:7px 7px 7px 20px;align-items:center;gap:10px;box-shadow:0 18px 36px -14px rgba(0,0,0,.55);transform:translateY(140%);transition:transform .35s cubic-bezier(.2,.9,.3,1)}
 .dock.show{transform:none}.dock div{flex:1;min-width:0;line-height:1.2}.dock small{display:block;font-size:11.5px;opacity:.7}.dock b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .dock button{height:46px;padding:0 18px;border-radius:999px;background:#1faa59;color:#fff;font-weight:700;font-size:14.5px;display:flex;align-items:center;gap:7px;flex:none}body{padding-bottom:90px}}
@media(max-width:420px){.card h3{font-size:18px}.card p{font-size:12.5px}.step button{width:36px;height:36px}.logo b{font-size:21px}.pill{font-size:11.5px;padding:6px 10px}.logo small{letter-spacing:.22em}}`;
document.head.append(css);

/* ---------- estado ---------- */
const B=Q.brand,TABS=Q.tabs;
const S={tab:TABS[0].id,q:{},v:{},fecha:"",entrega:(Q.delivery&&Q.delivery.options[0])||"",col:""};
TABS.forEach(t=>{(t.items||[]).forEach(i=>S.q[t.id+"."+i.id]=0);(t.fields||[]).forEach(f=>{const k=t.id+"."+f.id;
  S.v[k]=f.type==="multi"?new Set(f.def||[]):f.type==="num"?(f.def??f.min??1):(f.def??"")})});
const tab=()=>TABS.find(t=>t.id===S.tab);
const ST=Q.steps||["¿Qué se te antoja?","¿Para cuándo?","Revisa y envía"];
const D=Q.date||{},DL=Q.delivery,C=Q.contact||{};
const imgs=(Q.hero.imgs||[]).slice(0,4);
document.title=`${B.name} · ${Q.tabTitle||"Haz tu pedido"}`;

document.body.innerHTML=`
<header class="bar"><div class="wrap"><a class="logo" href="#top"><b>${esc(B.name)}</b>${B.sub?`<small>${esc(B.sub)}</small>`:""}</a><span class="pill"><i></i>${esc(Q.pill||"Pedidos abiertos")}</span></div></header>
<section class="hero" id="top"><div class="wrap">
 <div><span class="eyebrow">${esc(Q.hero.eyebrow||"")}</span><h1>${Q.hero.title}</h1><p class="lead">${esc(Q.hero.lead)}</p>
  <div class="cta"><a class="btn btn-dark" href="#elige">${esc(Q.hero.cta1||"Empezar mi pedido")}</a>${Q.hero.cta2?`<a class="btn btn-ghost" href="#elige" data-go="${Q.hero.cta2.tab}">${esc(Q.hero.cta2.label)}</a>`:""}</div>
  ${Q.hero.trust?`<div class="trust">${Q.hero.trust.map(([a,b])=>`<div><b>${esc(a)}</b>${esc(b)}</div>`).join("")}</div>`:""}</div>
 <div class="mosaic m${imgs.length>=4?4:imgs.length}">${imgs.map((s,i)=>`<figure><img src="${s}" alt="${esc(B.name)} ${i+1}" ${i>1?'loading="lazy"':""}></figure>`).join("")}
  <div class="tagc"><span>${ico("check",18)}</span><div><b>${esc((Q.hero.badge||[])[0]||"Sin esperar respuesta")}</b>${esc((Q.hero.badge||[])[1]||"Tu pedido llega completo a su WhatsApp")}</div></div></div>
</div></section>
<section class="sec" id="elige"><div class="wrap"><div class="sh"><div><span class="num">Paso 1</span><h2>${esc(ST[0])}</h2></div><p id="tabHint"></p></div>
 ${TABS.length>1?'<div class="tabs" id="tabs" role="tablist"></div>':""}<div id="pane"></div></div></section>
<section class="sec" id="sFecha"><div class="wrap"><div class="sh"><div><span class="num">Paso 2</span><h2>${esc(D.title||ST[1])}</h2></div><p>${esc(D.hint||`Elige el día. ${B.short||B.name} te confirma disponibilidad por WhatsApp.`)}</p></div>
 <div class="panel"><div class="fld" id="fFecha"><span class="lab">${esc(D.label||"Fecha")} <em>*</em></span><div class="days" id="days"></div><label class="other">¿Otra fecha? <input type="date" id="otherDate"></label></div>
 ${DL?`<div class="fld" id="fEntrega"><span class="lab">${esc(DL.label||"Entrega")}</span><div class="chips" id="entrega"></div><div id="colWrap" style="display:none;margin-top:12px"><input type="text" id="col" maxlength="90" placeholder="${esc(DL.zonePh||"Colonia y municipio")}"><p class="hint">${esc(DL.zoneHint||"El costo de envío te lo confirman por WhatsApp.")}</p></div></div>`:""}</div></div></section>
<section class="sec"><div class="wrap"><div class="sh"><div><span class="num">Paso 3</span><h2>${esc(ST[2])}</h2></div><p>Así le llega tu pedido a ${esc(B.short||B.name)}.</p></div>
 <div class="order"><div class="panel"><div class="fld" id="fNombre"><label class="lab" for="nombre">${esc(C.nameLabel||"Tu nombre")} <em>*</em></label><input type="text" id="nombre" maxlength="60" placeholder="Nombre y apellido" autocomplete="name"></div>
  <div class="fld"><label class="lab" for="nota">${esc(C.noteLabel||"Nota o comentarios")}</label><textarea id="nota" maxlength="300" placeholder="${esc(C.notePh||"Algo más que debamos saber…")}"></textarea><p class="hint">${esc(C.noteHint||"Si tienes foto de referencia, la mandas en el mismo chat.")}</p></div></div>
  <aside class="ticket"><header><small>Tu pedido</small><h3 id="tTitle"></h3></header><div class="tbody" id="tbody"></div>
   <div class="tfoot"><button class="wa" id="send" type="button">${WAICON}${esc(Q.sendLabel||"Enviar por WhatsApp")}</button><p class="note" id="note"></p><div class="peek"><small>Vista previa del mensaje</small><div class="bub" id="bub"></div></div></div></aside></div></div></section>
<footer><div class="wrap"><div class="logo"><b>${esc(B.name)}</b>${B.sub?`<small>${esc(B.sub)}</small>`:""}</div>${esc(B.city||"Monterrey, N.L.")}${B.ig?` · <a href="https://www.instagram.com/${B.ig}/" target="_blank" rel="noopener">@${esc(B.ig)}</a>`:""}
 <span class="cn">Formulario de muestra preparado por Code Nova para ${esc(B.name)}.</span></div></footer>
<div class="dock" id="dock"><div><small id="dSmall"></small><b id="dBig"></b></div><button type="button" id="dSend"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg>Enviar</button></div>`;
const NOTE_OK=Q.wa?"Se abre WhatsApp con tu pedido ya escrito. Solo das enviar.":"Copiamos tu pedido y abrimos su WhatsApp: solo pégalo y envía.";

/* ---------- Paso 1 ---------- */
const stepper=(key,val,min,max,unit)=>`<div class="step"><button type="button" data-st="${key}" data-d="-1" ${val<=min?"disabled":""} aria-label="Menos">−</button><div><b>${val}</b>${unit?`<small>${esc(unit)}</small>`:""}</div><button type="button" class="plus" data-st="${key}" data-d="1" ${val>=max?"disabled":""} aria-label="Más">+</button></div>`;
const unitOf=(t,q)=>{const u=t.unit||["pieza","piezas"];return q===1?u[0]:u[1]};
function field(t,f){const k=t.id+"."+f.id,v=S.v[k],req=f.req?" <em>*</em>":"",h=f.help?`<p class="hint">${esc(f.help)}</p>`:"";
  if(f.type==="chips"||f.type==="multi")return `<div class="fld" id="f_${f.id}"><span class="lab">${esc(f.label)}${req}</span><div class="chips">${f.options.map(o=>`<button type="button" class="${(f.type==="multi"?v.has(o):v===o)?"on":""}" data-ch="${k}" data-o="${esc(o)}">${esc(o)}</button>`).join("")}</div>${h}</div>`;
  if(f.type==="num")return `<div class="fld" id="f_${f.id}"><span class="lab">${esc(f.label)}${req}</span><div class="cnt">${stepper("v."+k,v,f.min??1,f.max??999,f.unit)}${f.side?`<span>${esc(f.side)}</span>`:""}</div>${h}</div>`;
  if(f.type==="refs")return `<div class="fld" id="f_${f.id}"><span class="lab">${esc(f.label)}${req}</span><div class="refs">${f.refs.map(r=>`<button type="button" class="${v===r.name?"on":""}" data-ref="${k}" data-o="${esc(r.name)}"><img src="${r.img}" alt="${esc(r.name)}" loading="lazy"><span>${esc(r.name)}${r.sub?`<small>${esc(r.sub)}</small>`:""}</span></button>`).join("")}</div>${h||'<p class="hint">Opcional. Toca uno para usarlo de referencia.</p>'}</div>`;
  if(f.type==="area")return `<div class="fld" id="f_${f.id}"><label class="lab" for="i_${f.id}">${esc(f.label)}${req}</label><textarea id="i_${f.id}" data-in="${k}" maxlength="${f.max||300}" placeholder="${esc(f.ph||"")}">${esc(v)}</textarea>${h}</div>`;
  return `<div class="fld" id="f_${f.id}"><label class="lab" for="i_${f.id}">${esc(f.label)}${req}</label><input type="${f.type==="tel"?"tel":"text"}" id="i_${f.id}" data-in="${k}" maxlength="${f.max||90}" placeholder="${esc(f.ph||"")}" value="${esc(v)}">${h}</div>`}
const shown=(t,f)=>!f.when||Object.entries(f.when).every(([id,val])=>{const v=S.v[t.id+"."+id];return Array.isArray(val)?val.includes(v):v===val});
function tabsUI(){const el=$("#tabs");if(el)el.innerHTML=TABS.map(t=>`<button type="button" role="tab" aria-selected="${S.tab===t.id}" class="${S.tab===t.id?"on":""}" data-tab="${t.id}">${t.img?`<img src="${t.img}" alt="">`:`<span class="ic">${ico(t.icon)}</span>`}${esc(t.label)}</button>`).join("");$("#tabHint").textContent=tab().hint||""}
function pane(){const t=tab();let h="";
  if(t.items){const n=t.items.length,cls=n%3===0&&n<=6?"g3":n===2?"g2":"";const single=t.single||t.multiPick;
    h+=`<div class="grid ${cls}">${t.items.map(i=>{const k=t.id+"."+i.id,q=S.q[k];return `<article class="card ${q?"sel":""}"><span class="badge">${single?ico("check",15):q}</span><div class="ph"><img src="${i.img}" alt="${esc(i.name)}" loading="lazy"></div><h3>${esc(i.name)}</h3><p>${esc(i.d||"")}</p>${single?`<button type="button" class="pick" data-pick="${k}">${q?(t.multiPick?"Agregado":"Elegido"):(t.multiPick?"Agregar":"Elegir")}</button>`:stepper("q."+k,q,0,t.max||30,unitOf(t,q))}</article>`}).join("")}</div>`}
  const fs=(t.fields||[]).filter(f=>shown(t,f));
  if(fs.length){const body=fs.map(f=>field(t,f)).join("");
    const side=t.aside?`<div class="aside">${t.aside.img?`<img src="${t.aside.img}" alt="" loading="lazy">`:`<div class="ai">${ico(t.aside.icon||"tag",64)}</div>`}<div class="tx"><b>${esc(t.aside.title)}</b><p>${esc(t.aside.text)}</p></div></div>`:"";
    h+=`<div class="panel ${side?"two":""}" style="${t.items?"margin-top:16px":""}"><div>${body}</div>${side}</div>`}
  $("#pane").innerHTML=h}

/* ---------- Paso 2 ---------- */
const DN=["dom","lun","mar","mié","jue","vie","sáb"],MN=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const md=D.minDays??1;
function days(){const t=new Date(),out=[];for(let i=md;i<md+(D.days||21);i++)out.push(new Date(t.getFullYear(),t.getMonth(),t.getDate()+i));
  const lab=d=>{const k=Math.round((d-new Date(t.getFullYear(),t.getMonth(),t.getDate()))/864e5);return k===0?"hoy":k===1?"mañana":DN[d.getDay()]};
  $("#days").innerHTML=out.map(d=>{const v=iso(d);return `<button type="button" class="${S.fecha===v?"on":""}" data-day="${v}"><small>${lab(d)}</small><b>${d.getDate()}</b><span>${MN[d.getMonth()]}</span></button>`}).join("");
  const od=$("#otherDate");od.min=iso(new Date(t.getFullYear(),t.getMonth(),t.getDate()+md));if(!S.fecha||out.some(d=>iso(d)===S.fecha))od.value="";else od.value=S.fecha}
const useDelivery=()=>DL&&tab().delivery!==false;
function entrega(){$("#sFecha").style.display=tab().date===false?"none":"";if(!DL)return;const show=useDelivery();$("#fEntrega").style.display=show?"":"none";
  $("#entrega").innerHTML=DL.options.map(o=>`<button type="button" class="${S.entrega===o?"on":""}" data-ent="${esc(o)}">${esc(o)}</button>`).join("");
  $("#colWrap").style.display=show&&DL.zone&&S.entrega===DL.zone?"":"none"}
const fmtDate=v=>v?new Date(v+"T12:00").toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"}):"";

/* ---------- resumen y mensaje ---------- */
const rows=()=>{const t=tab();return (t.items||[]).filter(i=>S.q[t.id+"."+i.id]).map(i=>({img:i.img,k:i.name,q:S.q[t.id+"."+i.id]}))};
const total=()=>rows().reduce((a,r)=>a+r.q,0);
const valOf=(t,f)=>{const v=S.v[t.id+"."+f.id];if(f.type==="multi")return [...v].join(", ");if(f.type==="num")return `${v}${f.unit?" "+f.unit:""}`;return String(v||"").trim()};
function kvs(){const t=tab(),K=[];(t.fields||[]).filter(f=>shown(t,f)).forEach(f=>{const v=valOf(t,f);if(v)K.push([f.out||f.label,v])});
  if(t.date!==false&&S.fecha)K.push([D.out||"Fecha",fmtDate(S.fecha)]);
  if(useDelivery())K.push([DL.out||"Entrega",S.entrega+(DL.zone&&S.entrega===DL.zone&&S.col.trim()?` (${S.col.trim()})`:"")]);
  const n=$("#nombre").value.trim();if(n)K.push([C.nameOut||"Nombre",n]);const no=$("#nota").value.trim();if(no)K.push([C.noteOut||"Nota",no]);return K}
function text(){const t=tab(),L=[t.head||`Hola, ${B.short||B.name}. Quiero hacer un pedido:`,""];
  if(t.items&&!t.single){const r=rows();if(r.length)r.forEach(x=>L.push(t.multiPick?`• ${x.k}`:`• ${x.q} × ${x.k}`));else L.push("• (sin elegir)");L.push("")}
  if(t.items&&t.single){const r=rows();if(r.length)L.push(`${t.itemsOut||"Estilo"}: ${r[0].k}`)}
  kvs().forEach(([k,v])=>L.push(`${k}: ${v}`));L.push("",Q.closing||"¡Gracias! Quedo pendiente.");return L.join("\n")}
function ticket(){const t=tab();$("#tTitle").textContent=t.title||t.label;let h="";
  if(t.items){const r=rows();h+=r.length?r.map(x=>`<div class="line"><img src="${x.img}" alt=""><span>${esc(x.k)}</span>${t.single||t.multiPick?"":`<span class="q">× ${x.q}</span>`}</div>`).join(""):`<div class="empty">${esc(t.emptyMsg||"Aún no eliges nada. Toca + en tus favoritos.")}</div>`}
  h+=kvs().map(([k,v])=>`<div class="kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("");$("#tbody").innerHTML=h;$("#bub").textContent=text();dock()}
function dock(){const t=tab();let big,small="Tu pedido";
  if(t.items&&t.multiPick){const r=rows();big=r.length?r.map(x=>x.k).join(", "):(t.dockEmpty||"Elige qué necesitas");small=S.fecha?fmtDate(S.fecha):"Tu pedido"}
  else if(t.items&&!t.single){const n=total();big=n?`${n} ${unitOf(t,n)}${S.fecha?" · "+fmtDate(S.fecha).split(",")[0]:""}`:(t.dockEmpty||"Elige tu pedido")}
  else if(t.items&&t.single){const r=rows();big=r.length?r[0].k:(t.dockEmpty||"Elige una opción");small=S.fecha?fmtDate(S.fecha):"Tu pedido"}
  else{big=t.title||t.label;small=S.fecha?fmtDate(S.fecha):"Falta elegir fecha"}
  $("#dBig").textContent=big;$("#dSmall").textContent=small;$("#dock").classList.toggle("show",scrollY>innerHeight*.6)}

/* ---------- validar y enviar ---------- */
function missing(){const t=tab(),M=[];
  if(t.items&&!total()&&t.itemsReq!==false)M.push(["#pane",t.missMsg||"elegir al menos una opción"]);
  (t.fields||[]).filter(f=>f.req&&shown(t,f)&&!valOf(t,f)).forEach(f=>M.push(["#f_"+f.id,f.label.toLowerCase().replace(/[¿?]/g,"")]));
  if(t.date!==false&&D.req!==false&&!S.fecha)M.push(["#fFecha","la fecha"]);
  if(useDelivery()&&DL.zone&&DL.zoneReq&&S.entrega===DL.zone&&!S.col.trim())M.push(["#fEntrega","la colonia"]);
  if(!$("#nombre").value.trim())M.push(["#fNombre","tu nombre"]);return M}
function send(){const M=missing(),note=$("#note");
  if(M.length){note.textContent="Falta: "+M.map(m=>m[1]).join(", ")+".";note.className="note bad";const el=$(M[0][0]);el.scrollIntoView({behavior:"smooth",block:"center"});el.classList.remove("err-ring");void el.offsetWidth;el.classList.add("err-ring");setTimeout(()=>el.classList.remove("err-ring"),1600);return}
  note.textContent=NOTE_OK;note.className="note";const msg=text();
  if(Q.wa)window.open(`https://wa.me/${Q.wa}?text=${encodeURIComponent(msg)}`,"_blank","noopener");
  else{navigator.clipboard&&navigator.clipboard.writeText(msg).catch(()=>{});window.open(Q.waLink||"https://wa.me/","_blank","noopener")}}

/* ---------- eventos ---------- */
function all(){tabsUI();pane();days();entrega();ticket()}
document.addEventListener("click",e=>{
  const go=e.target.closest("[data-go]");if(go&&TABS.some(t=>t.id===go.dataset.go)){S.tab=go.dataset.go;all()}
  const tb=e.target.closest("[data-tab]");if(tb){S.tab=tb.dataset.tab;tabsUI();pane();entrega();ticket();return}
  const st=e.target.closest("[data-st]");if(st&&!st.disabled){const[kind,...rest]=st.dataset.st.split(".");const k=rest.join("."),d=+st.dataset.d,t=tab();
    if(kind==="q"){S.q[k]=Math.max(0,Math.min(t.max||30,S.q[k]+d))}else{const f=t.fields.find(x=>t.id+"."+x.id===k);S.v[k]=Math.max(f.min??1,Math.min(f.max??999,S.v[k]+d*(f.step||1)))}pane();ticket();return}
  const pk=e.target.closest("[data-pick]");if(pk){const t=tab(),k=pk.dataset.pick,on=!S.q[k];if(!t.multiPick)(t.items||[]).forEach(i=>S.q[t.id+"."+i.id]=0);S.q[k]=on?1:0;pane();ticket();return}
  const ch=e.target.closest("[data-ch]");if(ch){const k=ch.dataset.ch,o=ch.dataset.o,v=S.v[k];const t=tab(),f=t.fields.find(x=>t.id+"."+x.id===k);
    if(v instanceof Set){v.has(o)?v.delete(o):(!f.maxSel||v.size<f.maxSel)&&v.add(o)}else S.v[k]=v===o&&!f.req?"":o;pane();ticket();return}
  const rf=e.target.closest("[data-ref]");if(rf){const k=rf.dataset.ref;S.v[k]=S.v[k]===rf.dataset.o?"":rf.dataset.o;pane();ticket();return}
  const dy=e.target.closest("[data-day]");if(dy){S.fecha=dy.dataset.day;days();ticket();return}
  const en=e.target.closest("[data-ent]");if(en){S.entrega=en.dataset.ent;entrega();ticket();return}
  if(e.target.closest("#send")||e.target.closest("#dSend"))send()});
document.addEventListener("input",e=>{const i=e.target;if(i.dataset.in)S.v[i.dataset.in]=i.value;if(i.id==="otherDate"){S.fecha=i.value;days()}if(i.id==="col")S.col=i.value;ticket()});
addEventListener("scroll",dock,{passive:true});
$("#note").textContent=NOTE_OK;all();
})();
