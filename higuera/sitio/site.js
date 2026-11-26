/* Higuera · sitio — encabezado, menú móvil, pie, idioma, horario y lista en vivo (compartido) */
(() => {
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = window.HG ? HG.esc : (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const R = "/higuera/sitio/";
const PAGES = [
  ["inicio", R, "Inicio", "Home"],
  ["menu", R + "menu/", "Menú", "Menu"],
  ["casa", R + "la-casa/", "La casa", "The house"],
  ["lista", R + "lista/", "Lista de espera", "Waitlist"],
  ["visita", R + "visitanos/", "Visítanos", "Visit us"],
];
const page = document.body.dataset.page || "inicio";

/* ---------- textos compartidos ---------- */
const SHARED_EN = {
  "c.join": "Join", "c.joinList": "Join the waitlist", "c.groups": "parties waiting", "c.mins": "min approx.",
  "c.addr": "Address", "c.hours": "Hours", "c.pages": "Pages", "c.follow": "Follow", "c.wd": "Monday to Friday", "c.we": "Saturday & Sunday",
  "c.cn": "Sample site prepared by Code Nova for Higuera.", "c.up": "Back to top", "c.priv": "Privacy notice", "c.mbar": "We'll let you know when your table is ready",
  "c.photos": "Photos: @higuera_mx",
};
const T = { es: {}, en: Object.assign({}, SHARED_EN, window.T_EN || {}) };
let lang = "es";
try { lang = localStorage.getItem("hg_lang") || "es"; } catch (e) {}
const subs = [];
const L = (es, en) => (lang === "es" ? es : en);

/* ---------- encabezado, menú móvil, pie y barra móvil ---------- */
function chrome() {
  const nav = PAGES.slice(1).map(([k, u, es, en]) => `<a href="${u}" class="${k === page ? "cur" : ""}">${L(es, en)}</a>`).join("");
  const top = $("#top");
  if (top) top.innerHTML = `<div class="wrap">
    <a href="${R}" aria-label="Higuera, inicio"><img class="logo" src="/higuera/img/logo-dark.png" alt="Higuera" width="94" height="34"></a>
    <nav>${nav}</nav>
    <div class="lang" role="group" aria-label="Idioma"><button type="button" data-lang="es" class="${lang === "es" ? "on" : ""}"><span>ES</span></button><button type="button" data-lang="en" class="${lang === "en" ? "on" : ""}"><span>EN</span></button></div>
    <a class="pill" href="/higuera/fila/"><span class="dot" id="pdot"></span><span id="pillTxt">${L("Lista de espera", "Waitlist")}</span><b>${L("Anotarme", "Join")}</b></a>
    <button class="burger" type="button" id="burger" aria-label="${L("Abrir menú", "Open menu")}"><i></i></button>
  </div>`;
  let d = $("#drawer");
  if (!d) { d = document.createElement("div"); d.id = "drawer"; d.className = "drawer"; d.setAttribute("aria-hidden", "true"); document.body.append(d); }
  d.innerHTML = `<div class="dh"><img src="/higuera/img/logo-dark.png" alt="Higuera"><button class="x" type="button" id="dx" aria-label="${L("Cerrar menú", "Close menu")}">×</button></div>
    <nav>${PAGES.map(([k, u, es, en], i) => `<a href="${u}" class="${k === page ? "cur" : ""}">${L(es, en)}<span>0${i + 1}</span></a>`).join("")}</nav>
    <div class="df"><div class="lang" role="group"><button type="button" data-lang="es" class="${lang === "es" ? "on" : ""}"><span>ES</span></button><button type="button" data-lang="en" class="${lang === "en" ? "on" : ""}"><span>EN</span></button></div>
    <span>Plutarco Elías Calles 419, Tampiquito · <a href="https://www.instagram.com/higuera_mx/" target="_blank" rel="noopener" style="color:#f4f1ea">@higuera_mx</a></span>
    <a class="btn btn-terra btn-block" href="/higuera/fila/">${L("Anotarme en la lista", "Join the waitlist")}</a></div>`;
  const f = $("#foot");
  if (f) f.innerHTML = `<div class="wrap">
    <img class="big" src="/higuera/img/logo-dark.png" alt="Higuera">
    <div class="cols">
      <div><b>${L("Dirección", "Address")}</b>Plutarco Elías Calles 419<br>Tampiquito, San Pedro Garza García, N.L.</div>
      <div><b>${L("Horario", "Hours")}</b>${L("Lunes a viernes", "Monday to Friday")} 8 – 4<br>${L("Sábado y domingo", "Saturday & Sunday")} 8 – 5</div>
      <div class="links"><b>${L("Páginas", "Pages")}</b>${PAGES.map(([, u, es, en]) => `<a href="${u}">${L(es, en)}</a>`).join("")}</div>
      <div class="links"><b>${L("Síguenos", "Follow")}</b><a href="https://www.instagram.com/higuera_mx/" target="_blank" rel="noopener">Instagram</a><a href="https://www.rappi.com.mx/restaurantes/1930063909-cocina-higuera" target="_blank" rel="noopener">Rappi</a><a href="https://www.ubereats.com/mx/store/cocina-higuera/KLVI_U3pXb20CwlV5h75RQ" target="_blank" rel="noopener">Uber Eats</a><a href="${R}privacidad/">${L("Aviso de privacidad", "Privacy notice")}</a></div>
    </div>
    <div class="cn"><span>${L("Sitio de muestra preparado por Code Nova para Higuera.", "Sample site prepared by Code Nova for Higuera.")}</span><a href="#" id="toTop">${L("Volver arriba", "Back to top")}</a></div>
  </div>`;
  let mb = $("#mbar");
  if (!mb && page !== "lista") { mb = document.createElement("div"); mb.id = "mbar"; mb.className = "mbar"; document.body.append(mb); }
  if (mb) mb.innerHTML = `<div><b id="mW">${L("Lista de espera", "Waitlist")}</b><span>${L("Te avisamos cuando tu mesa esté lista", "We'll let you know when your table is ready")}</span></div><a href="/higuera/fila/">${L("Anotarme", "Join")}</a>`;
  paintLive();
}

/* ---------- idioma ---------- */
function setLang(l) {
  lang = l; document.documentElement.lang = l;
  try { localStorage.setItem("hg_lang", l); } catch (e) {}
  $$("[data-i]").forEach((el) => { const v = T[l][el.dataset.i] ?? T.es[el.dataset.i]; if (v != null) el.innerHTML = v; });
  chrome(); hello();
  subs.forEach((f) => f(l));
}

/* ---------- horario (hora de Monterrey) ---------- */
const H = [[8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [8, 17], [8, 17]];
const DAYS = { es: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"], en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] };
const mty = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Monterrey" }));
function state() { const n = mty(), di = (n.getDay() + 6) % 7, h = n.getHours() + n.getMinutes() / 60, [o, c] = H[di]; return { di, h, o, c, open: h >= o && h < c }; }
const hr = (x) => (x > 12 ? x - 12 : x) + (x >= 12 ? " pm" : " am");
function hello() {
  const el = $("#hello"); const on = $("#openNow");
  const s = state();
  if (el) {
    const g = s.h < 12 ? L("Buenos días", "Good morning") : s.h < 19 ? L("Buenas tardes", "Good afternoon") : L("Buenas noches", "Good evening");
    const t = s.open ? L(`la cocina está abierta hasta las ${hr(s.c)}`, `kitchen open until ${hr(s.c)}`) : s.h < s.o ? L(`abrimos a las ${hr(s.o)}`, `we open at ${hr(s.o)}`) : L("te esperamos mañana desde las 8 am", "see you tomorrow from 8 am");
    el.textContent = g + " · " + t;
  }
  if (on) {
    on.classList.toggle("cl", !s.open);
    on.innerHTML = `<span class="dot"></span><span>${s.open ? L(`Abierto ahora · cierra a las ${hr(s.c)}`, `Open now · closes at ${hr(s.c)}`) : L("Cerrado ahora · abre a las 8 am", "Closed now · opens at 8 am")}</span>`;
  }
}
function hoursTable(el) {
  const s = state();
  el.innerHTML = H.map(([o, c], i) => `<tr class="${i === s.di ? "today" : ""}"><td>${DAYS[lang][i]}${i === s.di ? L(" · hoy", " · today") : ""}</td><td>${hr(o)} – ${hr(c)}</td></tr>`).join("");
}

/* ---------- lista en vivo ---------- */
let LV = null; const liveSubs = [];
function paintLive() {
  if (!LV) return;
  const w = LV.waiting, e = LV.estWait;
  const pt = $("#pillTxt"); if (pt) pt.textContent = !LV.open && LV.reason === "hours" ? L("Lista cerrada", "List closed") : w ? L(`Espera ~${e} min`, `~${e} min wait`) : L("Sin espera", "No wait");
  $$('[data-i="c.groups"]').forEach((el) => (el.textContent = L(w === 1 ? "grupo esperando" : "grupos esperando", w === 1 ? "party waiting" : "parties waiting")));
  const mw = $("#mW"); if (mw) mw.textContent = w ? `${w} ${L(w === 1 ? "grupo" : "grupos", w === 1 ? "party" : "parties")} · ~${e} min` : L("Sin espera ahorita", "No wait right now");
  liveSubs.forEach((f) => f(LV));
}
function startLive() {
  if (!window.HG) return;
  HG.live({ role: "guest", onData(d) { if (!d || d.authError) return; LV = d; paintLive(); }, onStatus(s) { const p = $("#pdot"); if (p) p.className = "dot" + (s === "off" ? " off" : ""); } });
}

/* ---------- aparición, encabezado, menú móvil ---------- */
const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("vis"); io.unobserve(en.target); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
function reveal(root = document) { $$(".rv:not(.vis)", root).forEach((el) => io.observe(el)); }
const scrollSubs = [];
function onScroll() {
  const y = scrollY, vh = innerHeight, top = $("#top"), mb = $("#mbar");
  const th = document.body.dataset.solidAt ? +document.body.dataset.solidAt : vh * 0.6;
  if (top) top.classList.toggle("solid", y > th);
  if (mb) mb.classList.toggle("show", y > vh * 0.8);
  const bg = $(".hero .bg, .phero .bg"); if (bg && y < vh) bg.style.translate = `0 ${(y * 0.22).toFixed(1)}px`;
  scrollSubs.forEach((f) => f(y));
}
document.addEventListener("click", (e) => {
  const lb = e.target.closest("[data-lang]"); if (lb) { setLang(lb.dataset.lang); return; }
  if (e.target.closest("#burger")) { $("#drawer").classList.add("on"); $("#drawer").setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; return; }
  if (e.target.closest("#dx") || (e.target.closest("#drawer a"))) { $("#drawer").classList.remove("on"); $("#drawer").setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; if (e.target.closest("#dx")) return; }
  if (e.target.closest("#toTop")) { e.preventDefault(); scrollTo({ top: 0, behavior: "smooth" }); }
});
addEventListener("keydown", (e) => { if (e.key === "Escape") { const d = $("#drawer"); if (d && d.classList.contains("on")) $("#dx").click(); } });

/* ---------- vista previa de foto que sigue al cursor ---------- */
function peek(selector) {
  let pk = $("#peek");
  if (!pk) { pk = document.createElement("div"); pk.id = "peek"; pk.className = "peek"; pk.innerHTML = `<img alt="">`; document.body.append(pk); }
  const img = pk.querySelector("img");
  let px = 0, py = 0, tx = 0, ty = 0, run = false;
  document.addEventListener("mousemove", (e) => {
    tx = e.clientX + 150; ty = e.clientY;
    const it = e.target.closest(selector);
    if (it && innerWidth > 960 && it.dataset.ph) {
      const src = "/higuera/img/" + it.dataset.ph + ".webp";
      if (img.getAttribute("src") !== src) img.setAttribute("src", src);
      pk.classList.add("on");
      if (!run) { run = true; px = tx; py = ty; loop(); }
    } else pk.classList.remove("on");
  });
  function loop() { px += (tx - px) * 0.18; py += (ty - py) * 0.18; pk.style.left = px + "px"; pk.style.top = py + "px"; if (pk.classList.contains("on") || Math.abs(tx - px) > 1) requestAnimationFrame(loop); else run = false; }
}

/* ---------- inicio ---------- */
$$("[data-i]").forEach((el) => { if (!(el.dataset.i in T.es)) T.es[el.dataset.i] = el.innerHTML; });
window.SITE = {
  get lang() { return lang; }, L, esc, state, hr, DAYS, H, hoursTable, reveal, peek,
  onLang(f) { subs.push(f); }, onLive(f) { liveSubs.push(f); if (LV) f(LV); }, onScroll(f) { scrollSubs.push(f); },
};
chrome();
if (lang !== "es") setLang(lang); else hello();
reveal();
addEventListener("scroll", onScroll, { passive: true }); addEventListener("resize", onScroll);
onScroll(); startLive(); setInterval(hello, 60000);
const cover = $("#cover"); if (cover) { if (sessionStorage.getItem("hg_intro")) cover.remove(); else { sessionStorage.setItem("hg_intro", "1"); setTimeout(() => cover.classList.add("out"), 1100); } }
})();
