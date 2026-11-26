/* Higuera · demostración animada: cómo funciona la lista en un iPhone */
(() => {
const root = document.getElementById("demoPhone"), railEl = document.getElementById("demoRail");
if (!root) return;
const { L, onLang, onLive } = window.SITE || { L: (a) => a, onLang() {}, onLive() {} };
const $ = (s, r = root) => r.querySelector(s), $$ = (s, r = root) => [...r.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let live = { waiting: 3, estWait: 18 }, tol = 10;

/* ---------- teléfono ---------- */
const icons = `<i><svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M8 2.6c2.3 0 4.4.9 6 2.4l1.3-1.4A10.4 10.4 0 0 0 8 .6 10.4 10.4 0 0 0 .7 3.6L2 5c1.6-1.5 3.7-2.4 6-2.4zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.3-1.4A7 7 0 0 0 8 4.2a7 7 0 0 0-4.7 1.9l1.3 1.4c.9-.8 2.1-1.3 3.4-1.3zM8 9.6l2-2.1a3 3 0 0 0-4 0z"/></svg><svg width="26" height="12" viewBox="0 0 26 12" fill="none"><rect x=".5" y=".5" width="22" height="11" rx="3.5" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor"/><path d="M24 4v4c.8-.3 1.3-1.1 1.3-2S24.8 4.3 24 4z" fill="currentColor" opacity=".5"/></svg></i>`;
function phoneHTML() {
  return `<div class="dphone" id="dph"><div class="dscreen" id="dscr">
    <div class="disl"></div>
    <div class="dstat" id="dstat"><span id="dclock">10:42</span>${icons}</div>

    <section class="dsc d-cam" data-s="0">
      <div class="feed"></div>
      <div class="sign"><img src="/higuera/img/logo-dark.png" alt=""><b>${L("¿Hay espera?", "Is there a wait?")}</b><div class="qr" id="dqr"></div><small>${L("Anótate aquí", "Join here")}</small></div>
      <div class="bracket" id="dbr"><i></i><i></i><i></i><i></i></div>
      <div class="pill" id="dpill"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg><span>${L("Lista de espera de Higuera", "Higuera waitlist")}<small>higuera · ${L("abrir en Safari", "open in Safari")}</small></span></div>
      <div class="modes">${L("VIDEO <b>FOTO</b> RETRATO", "VIDEO <b>PHOTO</b> PORTRAIT")}</div>
      <div class="shutter"></div>
    </section>

    <section class="dsc d-form" data-s="1"><div class="clip"><div class="in2" id="dfin">
      <div class="d-top"><img src="/higuera/img/logo-dark.png" alt=""><span><i class="dot"></i>${L("En vivo", "Live")}</span></div>
      <div class="d-photo"></div>
      <div class="d-live"><b id="dlw">3</b><span><strong>${L("Grupos", "Parties")}</strong>${L("esperando", "waiting")}</span><i></i><b id="dle">~18</b><span><strong>${L("Minutos", "Minutes")}</strong>${L("aprox.", "approx.")}</span></div>
      <div class="d-h">${L("Espera donde quieras, <em>no en la banqueta</em>", "Wait wherever you like, <em>not on the sidewalk</em>")}</div>
      <p class="d-p">${L("Anótate y te avisamos cuando tu mesa esté lista.", "Join and we'll let you know when your table is ready.")}</p>
      <span class="d-lab">${L("Tu nombre", "Your name")}</span>
      <div class="d-in" id="dname"><span class="ph" id="dnph">${L("¿Cómo te llamamos?", "What should we call you?")}</span><span id="dntx"></span><span class="caret"></span></div>
      <span class="d-lab">${L("¿Cuántos son?", "Party size")}</span>
      <div class="d-step"><i>−</i><b id="dsz">2 ${L("personas", "people")}</b><i class="plus" id="dplus">+</i></div>
      <span class="d-lab">${L("¿Dónde prefieren?", "Seating")}</span>
      <div class="d-seg"><span class="on" id="dz0">${L("Lo primero que se libere", "First available")}</span><span>Interior</span><span id="dz2">${L("Terraza", "Terrace")}</span><span>${L("Barra", "Bar")}</span></div>
      <div class="d-btn" id="dgo">${L("Anotarme en la lista", "Join the waitlist")}</div>
    </div></div></section>

    <section class="dsc d-ticket" data-s="2"><div class="in2">
      <div class="d-tk"><small>${L("Tu turno", "Your spot")}</small><b>H-014</b><p>${L("Hola, Mariana. Ya estás en la lista.", "Hi, Mariana. You're on the list.")}</p><div class="chips"><span>3 ${L("personas", "people")}</span><span>${L("Terraza", "Terrace")}</span></div></div>
      <div class="d-two"><div><b id="dah">3</b><span>${L("grupos antes que tú", "parties ahead")}</span></div><div><b id="deta">~18</b><span>${L("min aprox.", "min approx.")}</span></div></div>
      <div class="d-ok"><b><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6 9 17l-5-5"/></svg>${L("Aviso activado en este celular", "Alert on for this phone")}</b>${L("Te avisamos aunque cierres la página.", "We'll notify you even if you close the page.")}</div>
      <div class="d-line"><small>${L("La lista ahora", "The list now")}</small><div class="row" id="drow"><span>D</span><span>S</span><span>R</span><span class="me">${L("Tú", "You")}</span></div><div class="bar"><i id="dbar"></i></div></div>
    </div></section>

    <section class="dsc d-lock" data-s="3">
      <div class="wall"></div>
      <div class="date" id="ddate">${L("Sábado 29 de noviembre", "Saturday, November 29")}</div>
      <div class="clock" id="dlclock">10:42</div>
      <div class="d-noti" id="dnoti1"><img src="/higuera/img/icon-192.png" alt=""><div class="t"><div><b>Higuera</b><span>${L("ahora", "now")}</span></div><strong>${L("Ya casi, Mariana", "Almost there, Mariana")}</strong><p>${L("Eres el siguiente en la lista. Ve acercándote a la entrada.", "You're next on the list. Start heading to the entrance.")}</p></div></div>
      <div class="d-noti" id="dnoti2"><img src="/higuera/img/icon-192.png" alt=""><div class="t"><div><b>Higuera</b><span>${L("ahora", "now")}</span></div><strong>${L("Tu mesa está lista, Mariana", "Your table is ready, Mariana")}</strong><p>${L(`Te esperamos en la entrada en los próximos ${tol} minutos. Turno H-014.`, `We'll be waiting at the entrance for the next ${tol} minutes. Spot H-014.`)}</p></div></div>
      <div class="fl"><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M8 2h8l-1 6H9zM9 9h6v11a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"/></svg></div>
      <div class="cm"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></div>
      <div class="hint">${L("Desliza hacia arriba para abrir", "Swipe up to open")}</div>
    </section>

    <section class="dsc d-call" data-s="4" id="dcall">
      <div class="ring"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M2 18h20M4 18a8 8 0 0 1 16 0M12 10V7M10 7h4"/></svg></div>
      <small>Higuera · Tampiquito</small>
      <h4>${L("Tu mesa está lista", "Your table is ready")}</h4>
      <div><span class="code">H-014</span></div>
      <div class="cd" id="dcd">${tol}:00</div><div class="cdl">${L("para llegar a la entrada", "to get to the entrance")}</div>
      <div class="b1" id="dotw">${L("Voy en camino", "On my way")}</div><div class="b2">${L("Ya estoy en la entrada", "I'm at the entrance")}</div>
      <div class="okm">${L("Listo, Mariana. Le avisamos al equipo que vas en camino.", "Done, Mariana. We told the team you're on your way.")}</div>
    </section>

    <div class="dfinger" id="dfg"></div>
    <div class="dhome" id="dhome"></div>
  </div></div>`;
}

/* ---------- pasos ---------- */
const STEPS = () => [
  { t: L("Escanea el QR", "Scan the QR"), d: L("En la entrada o desde el sitio. Sin descargar ninguna app.", "At the door or from the website. No app to download."), dur: 4200 },
  { t: L("Anótate en segundos", "Join in seconds"), d: L("Tu nombre, cuántos son y dónde prefieren sentarse.", "Your name, party size and where you'd like to sit."), dur: 6400 },
  { t: L("Mira tu turno en vivo", "Watch your spot live"), d: L("La lista avanza sola. Activa el aviso y date una vuelta por Tampiquito.", "The list moves on its own. Turn on the alert and take a walk around Tampiquito."), dur: 4600 },
  { t: L("Te llega el aviso", "Get notified"), d: L("Aunque tengas el celular bloqueado: primero «ya casi» y luego «tu mesa está lista».", "Even with your phone locked: first \"almost there\", then \"your table is ready\"."), dur: 5000 },
  { t: L("Llega a tu mesa", "Head to your table"), d: L(`Tienes ${tol} minutos para llegar. Avisa con un toque que vas en camino.`, `You have ${tol} minutes to arrive. Let them know you're on your way with one tap.`), dur: 5200 },
];
function railHTML() {
  const S = STEPS();
  return `<ol class="drail">${S.map((s, i) => `<li tabindex="0" data-ds="${i}"><i>0${i + 1}</i><b>${s.t}</b><p>${s.d}</p><div class="pb"><span></span></div></li>`).join("")}</ol>
    <div class="dmob" id="dmob"><div class="dots">${S.map((_, i) => `<button type="button" data-ds="${i}" aria-label="${L("Paso", "Step")} ${i + 1}"><span></span></button>`).join("")}</div><b id="dmt"></b><p id="dmd"></p></div>
    <div class="dctl"><button type="button" id="dplay" aria-label="${L("Pausar", "Pause")}"></button><span id="dctlt"></span></div>`;
}

/* ---------- motor ---------- */
let cur = 0, el = 0, last = null, paused = reduce, hover = false, visible = true, acts = [], fired = 0, scale = 1;
const PLAY = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>`, PAUSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;

function finger(sel, opt = {}) {
  const f = $("#dfg"), scr = $("#dscr");
  if (!sel) { f.classList.remove("on"); return; }
  const t = $(sel); if (!t) return;
  const sr = scr.getBoundingClientRect(), tr = t.getBoundingClientRect(), k = sr.width / 306;
  f.style.left = ((tr.left - sr.left + tr.width * (opt.x ?? 0.5)) / k) + "px";
  f.style.top = ((tr.top - sr.top + tr.height * (opt.y ?? 0.5)) / k) + "px";
  f.classList.add("on");
}
function tap(sel, cls) {
  const f = $("#dfg"); f.classList.remove("tap"); void f.offsetWidth; f.classList.add("tap");
  setTimeout(() => f.classList.remove("tap"), 260);
  if (sel && cls) { const t = $(sel); t.classList.add(cls); setTimeout(() => t.classList.remove(cls), 220); }
}
function at(t, fn) { acts.push([t, fn]); }
function timeStr() { const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Monterrey" })); return { hm: d.getHours() % 12 || 12, mm: String(d.getMinutes()).padStart(2, "0"), d }; }

function setup(i) {
  acts = []; fired = 0;
  const light = i === 0 || i === 3 || i === 4;
  $("#dstat").classList.toggle("light", light); $("#dhome").classList.toggle("light", light);
  $$(".dsc").forEach((s) => s.classList.toggle("on", +s.dataset.s === i));
  finger(null);
  if (i === 0) {
    $("#dbr").classList.remove("on"); $("#dpill").classList.remove("on");
    at(700, () => $("#dbr").classList.add("on"));
    at(1600, () => { $("#dpill").classList.add("on"); try { navigator.vibrate; } catch (e) {} });
    at(2500, () => finger("#dpill"));
    at(3250, () => tap());
  }
  if (i === 1) {
    $("#dfin").style.transform = "none"; $("#dntx").textContent = ""; $("#dnph").style.display = ""; $("#dname").classList.remove("focus");
    $("#dsz").textContent = "2 " + L("personas", "people"); $("#dz0").classList.add("on"); $("#dz2").classList.remove("on");
    at(400, () => finger("#dname", { x: 0.3 }));
    at(1050, () => { tap(); $("#dname").classList.add("focus"); $("#dnph").style.display = "none"; });
    "Mariana".split("").forEach((c, k) => at(1300 + k * 120, () => ($("#dntx").textContent += c)));
    at(2300, () => { $("#dname").classList.remove("focus"); finger("#dplus"); });
    at(2950, () => { tap(); $("#dsz").textContent = "3 " + L("personas", "people"); });
    at(3400, () => finger("#dz2"));
    at(4050, () => { tap(); $("#dz0").classList.remove("on"); $("#dz2").classList.add("on"); });
    at(4400, () => { $("#dfin").style.transform = "translateY(-60px)"; finger(null); });
    at(5200, () => finger("#dgo"));
    at(5850, () => tap("#dgo", "press"));
  }
  if (i === 2) {
    const a = Math.max(3, live.waiting || 0), e = Math.max(18, live.waiting > 3 ? live.estWait : 18);
    $("#dah").textContent = a; $("#deta").textContent = "~" + e; $("#dbar").style.width = "30%";
    const row = $("#drow"); row.innerHTML = Array.from({ length: Math.min(a, 6) }, (_, k) => `<span>${"DSRVAP"[k]}</span>`).join("") + `<span class="me">${L("Tú", "You")}</span>`;
    at(1800, () => { const nA = Math.max(0, a - 1); $("#dah").textContent = nA; $("#dah").classList.add("bump"); $("#deta").textContent = "~" + Math.max(3, Math.round(e * nA / a)); const f = row.querySelector("span:not(.gone):not(.me)"); if (f) f.classList.add("gone"); $("#dbar").style.width = "62%"; });
    at(2600, () => $("#dah").classList.remove("bump"));
  }
  if (i === 3) {
    const t = timeStr(); $("#dlclock").textContent = `${t.hm}:${t.mm}`;
    $("#dnoti1").classList.remove("on"); $("#dnoti2").classList.remove("on"); $("#dnoti1").style.top = "250px";
    at(600, () => { $("#dnoti1").classList.add("on"); buzz(); });
    at(2300, () => { $("#dnoti1").style.top = "340px"; $("#dnoti2").classList.add("on"); buzz(); });
    at(3700, () => finger("#dnoti2"));
    at(4350, () => tap("#dnoti2", "press"));
  }
  if (i === 4) {
    $("#dcall").classList.remove("done"); callStart = el;
    at(2400, () => finger("#dotw"));
    at(3050, () => { tap("#dotw", "press"); });
    at(3300, () => { $("#dcall").classList.add("done"); finger(null); });
  }
}
let callStart = 0;
function buzz() { const p = $("#dph"); p.classList.remove("buzz"); void p.offsetWidth; p.classList.add("buzz"); }
function go(i) {
  cur = (i + STEPS().length) % STEPS().length; el = 0; setup(cur); paintRail();
  if (reduce) { acts.forEach(([, fn]) => fn()); acts = []; finger(null); }
}
function paintRail() {
  if (!railEl) return;
  const S = STEPS();
  $$("li[data-ds]", railEl).forEach((li, k) => li.classList.toggle("on", k === cur));
  $$(".dots button", railEl).forEach((b, k) => b.classList.toggle("past", k < cur));
  const t = $("#dmt", railEl), d = $("#dmd", railEl); if (t) { t.textContent = `0${cur + 1} · ${S[cur].t}`; d.textContent = S[cur].d; }
  const pb = $("#dplay", railEl); if (pb) { pb.innerHTML = paused ? PLAY : PAUSE; pb.setAttribute("aria-label", paused ? L("Reproducir", "Play") : L("Pausar", "Pause")); }
  const ct = $("#dctlt", railEl); if (ct) ct.textContent = paused ? L("En pausa · toca un paso para verlo", "Paused · tap a step to see it") : L("Demostración · se repite sola", "Demo · loops automatically");
}
function frame(ts) {
  if (last == null) last = ts;
  const dt = Math.min(100, ts - last); last = ts;
  if (!paused && !hover && visible) {
    el += dt;
    while (fired < acts.length) { acts.sort((a, b) => a[0] - b[0]); if (acts[fired][0] <= el) { acts[fired][1](); fired++; } else break; }
    const dur = STEPS()[cur].dur, p = Math.min(1, el / dur);
    const bar = railEl && railEl.querySelector(`li[data-ds="${cur}"] .pb span`); if (bar) bar.style.width = (p * 100) + "%";
    const dot = railEl && railEl.querySelectorAll(".dots button span")[cur]; if (dot) dot.style.width = (p * 100) + "%";
    if (cur === 4) { const left = Math.max(0, tol * 60 - Math.floor((el - callStart) / 1000) - 1); $("#dcd").textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`; }
    if (el >= dur) go(cur + 1);
  }
  requestAnimationFrame(frame);
}

function build() {
  root.innerHTML = `<div class="dwrap">${phoneHTML()}</div>`;
  if (window.HG && window.qrcode) $("#dqr").innerHTML = HG.qrSvg(location.origin + "/higuera/fila/", { margin: 0 });
  if (railEl) railEl.innerHTML = railHTML();
  const t = timeStr(); $("#dclock").textContent = `${t.hm}:${t.mm}`;
  const D = L(["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"], ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"])[t.d.getDay()];
  const M = L(["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"], ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"])[t.d.getMonth()];
  $("#ddate").textContent = L(`${D} ${t.d.getDate()} de ${M}`, `${D}, ${M} ${t.d.getDate()}`);
  paintLive(); go(cur);
}
function paintLive() {
  const w = $("#dlw"); if (!w) return;
  w.textContent = live.waiting; $("#dle").textContent = live.waiting ? "~" + live.estWait : "0";
}
document.addEventListener("click", (e) => {
  const s = e.target.closest("[data-ds]"); if (s && (railEl.contains(s))) { paused = true; go(+s.dataset.ds); return; }
  if (e.target.closest("#dplay")) { paused = !paused; if (!paused && el >= STEPS()[cur].dur) go(cur + 1); paintRail(); }
});
document.addEventListener("keydown", (e) => { const s = e.target.closest && e.target.closest("li[data-ds]"); if (s && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); paused = true; go(+s.dataset.ds); } });
root.addEventListener("mouseenter", () => (hover = true)); root.addEventListener("mouseleave", () => (hover = false));
new IntersectionObserver((es) => es.forEach((en) => (visible = en.isIntersecting)), { threshold: 0.25 }).observe(root);
onLive((d) => { live = d; const ch = d.tolerance && d.tolerance !== tol; if (d.tolerance) tol = d.tolerance; if (ch) build(); else paintLive(); });
onLang(() => build());
build();
requestAnimationFrame(frame);
})();
