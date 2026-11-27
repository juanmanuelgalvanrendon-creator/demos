/* Higuera · página — encabezado, menú móvil, pie, idioma y horario (compartido). Sin lista de espera ni sistema. */
(() => {
document.documentElement.classList.add("js");
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const R = "/higuera/pagina/";
const PAGES = [
  ["inicio", R, "Inicio", "Home"],
  ["menu", R + "menu/", "Menú", "Menu"],
  ["casa", R + "la-casa/", "La casa", "The house"],
  ["visita", R + "visitanos/", "Visítanos", "Visit us"],
];
const SHORT = {};
const page = document.body.dataset.page || "inicio";

/* ---------- textos compartidos ---------- */
const SHARED_EN = {
  "c.addr": "Address", "c.hours": "Hours", "c.pages": "Pages", "c.follow": "Follow", "c.wd": "Monday to Friday", "c.we": "Saturday & Sunday",
  "c.cn": "Sample site prepared by Code Nova for Higuera.", "c.up": "Back to top",
  "c.photos": "Photos: @higuera_mx",
};
const T = { es: {}, en: Object.assign({}, SHARED_EN, window.T_EN || {}) };
let lang = "es";
try { lang = localStorage.getItem("hg_lang") || "es"; } catch (e) {}
const subs = [];
const L = (es, en) => (lang === "es" ? es : en);

/* ---------- encabezado, menú móvil, pie y barra móvil ---------- */
function chrome() {
  const nm = (k, es, en) => (SHORT[k] ? L(...SHORT[k]) : L(es, en));
  const nav = PAGES.slice(1).map(([k, u, es, en]) => `<a href="${u}" class="${k === page ? "cur" : ""}">${nm(k, es, en)}</a>`).join("");
  const strip = PAGES.map(([k, u, es, en]) => `<a href="${u}" class="${k === page ? "cur" : ""}"${k === page ? ' aria-current="page"' : ""}>${nm(k, es, en)}</a>`).join("");
  const top = $("#top");
  if (top) top.innerHTML = `<div class="wrap">
    <a href="${R}" aria-label="Higuera, inicio"><img class="logo" src="/higuera/img/logo-sm.png" alt="Higuera" width="94" height="34"></a>
    <nav aria-label="${L("Principal", "Main")}">${nav}</nav>
    <div class="lang" role="group" aria-label="Idioma"><button type="button" data-lang="es" class="${lang === "es" ? "on" : ""}"><span>ES</span></button><button type="button" data-lang="en" class="${lang === "en" ? "on" : ""}"><span>EN</span></button></div>
    <a class="pill" href="${R}menu/" style="padding:6px"><b>${L("Ver el menú", "See the menu")}</b></a>
    <button class="burger" type="button" id="burger" aria-label="${L("Más opciones", "More options")}"><i></i></button>
  </div>
  <div class="mstrip" role="navigation" aria-label="${L("Secciones", "Sections")}"><div class="mrow">${strip}</div></div>`;
  requestAnimationFrame(() => { const c = top && top.querySelector(".mstrip .cur"); if (c) c.parentElement.scrollLeft = c.offsetLeft - 20; setHH(); });
  let d = $("#drawer");
  if (!d) { d = document.createElement("div"); d.id = "drawer"; d.className = "drawer"; d.setAttribute("role", "dialog"); d.setAttribute("aria-hidden", "true"); document.body.append(d); }
  d.setAttribute("aria-label", L("Menú", "Menu"));
  d.innerHTML = `<div class="dh"><img src="/higuera/img/logo-sm.png" alt="Higuera" width="83" height="30"><button class="x" type="button" id="dx" aria-label="${L("Cerrar menú", "Close menu")}">×</button></div>
    <nav aria-label="${L("Todas las páginas", "All pages")}">${PAGES.map(([k, u, es, en], i) => `<a href="${u}" class="${k === page ? "cur" : ""}">${L(es, en)}<span aria-hidden="true">0${i + 1}</span></a>`).join("")}</nav>
    <div class="df"><div class="lang" role="group" aria-label="Idioma"><button type="button" data-lang="es" class="${lang === "es" ? "on" : ""}"><span>ES</span></button><button type="button" data-lang="en" class="${lang === "en" ? "on" : ""}"><span>EN</span></button></div>
    <span>Plutarco Elías Calles 419, Tampiquito · <a href="https://www.instagram.com/higuera_mx/" target="_blank" rel="noopener" style="color:#f4f1ea">@higuera_mx</a></span>
    <a class="btn btn-terra btn-block" href="${R}visitanos/">${L("Cómo llegar", "Get directions")}</a></div>`;
  const f = $("#foot");
  if (f) f.innerHTML = `<div class="wrap">
    <img class="big" src="/higuera/img/logo-dark.png" alt="Higuera" width="712" height="259" loading="lazy">
    <div class="cols">
      <div><b>${L("Dirección", "Address")}</b>Plutarco Elías Calles 419<br>Tampiquito, San Pedro Garza García, N.L.</div>
      <div><b>${L("Horario", "Hours")}</b>${L("Lunes a viernes", "Monday to Friday")} 8 – 4<br>${L("Sábado y domingo", "Saturday & Sunday")} 8 – 5</div>
      <div class="links"><b>${L("Páginas", "Pages")}</b>${PAGES.map(([, u, es, en]) => `<a href="${u}">${L(es, en)}</a>`).join("")}</div>
      <div class="links"><b>${L("Síguenos", "Follow")}</b><a href="https://www.instagram.com/higuera_mx/" target="_blank" rel="noopener">Instagram</a><a href="https://www.rappi.com.mx/restaurantes/1930063909-cocina-higuera" target="_blank" rel="noopener">Rappi</a><a href="https://www.ubereats.com/mx/store/cocina-higuera/KLVI_U3pXb20CwlV5h75RQ" target="_blank" rel="noopener">Uber Eats</a></div>
    </div>
    <div class="cn"><span>${L("Sitio de muestra preparado por Code Nova para Higuera.", "Sample site prepared by Code Nova for Higuera.")}</span><a href="#" id="toTop">${L("Volver arriba", "Back to top")}</a></div>
  </div>`;
}

function landmarks() {
  if (document.querySelector(".skip")) return;
  const top = $("#top"), foot = $("#foot");
  if (!top || !foot) return;
  let m = document.querySelector("main");
  if (m) { if (!m.id) m.id = "main"; }
  else {
    m = document.createElement("main"); m.id = "main";
    let n = top.nextSibling;
    while (n && n !== foot) { const nx = n.nextSibling; if (!(n.nodeType === 1 && /^(SCRIPT|STYLE)$/.test(n.tagName))) m.append(n); n = nx; }
    foot.before(m);
  }
  m.tabIndex = -1;
  const sk = document.createElement("a"); sk.className = "skip"; sk.href = "#" + m.id; sk.textContent = L("Saltar al contenido", "Skip to content");
  document.body.prepend(sk);
}

function setHH() { const t = $("#top"); if (t) document.documentElement.style.setProperty("--hh", t.offsetHeight + "px"); }
addEventListener("resize", setHH);

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

/* ---------- aparición, encabezado, menú móvil ---------- */
const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("vis"); io.unobserve(en.target); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
function reveal(root = document) { $$(".rv:not(.vis)", root).forEach((el) => io.observe(el)); }
const scrollSubs = [];
function onScroll() {
  const y = scrollY, vh = innerHeight, top = $("#top");
  const th = document.body.dataset.solidAt ? +document.body.dataset.solidAt : vh * 0.6;
  if (top) top.classList.toggle("solid", y > th);
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
  onLang(f) { subs.push(f); }, onScroll(f) { scrollSubs.push(f); },
};
landmarks();
chrome();
if (lang !== "es") setLang(lang); else hello();
reveal();
addEventListener("scroll", onScroll, { passive: true }); addEventListener("resize", onScroll);
onScroll(); setInterval(hello, 60000);
const cover = $("#cover"); if (cover) { try { if (sessionStorage.getItem("hg_intro")) cover.remove(); else { sessionStorage.setItem("hg_intro", "1"); setTimeout(() => cover.classList.add("out"), 1100); } } catch (e) { cover.remove(); } }
})();
