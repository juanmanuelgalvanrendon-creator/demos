/* Higuera · fila virtual — cliente de la API (compartido por las páginas) */
(function () {
  // la demostración vive en /higuera-demo/ con su propia base de datos; el sistema real en /higuera/
  const DEMO = location.pathname.startsWith("/higuera-demo/");
  const ROOM = DEMO ? "higuera-demo" : "higuera";
  const PFX = DEMO ? "hgd_" : "hg_";
  const BASE = "/api/fila/" + ROOM;

  async function api(path, opt = {}) {
    const h = { "content-type": "application/json" };
    if (opt.pin) h["x-pin"] = opt.pin;
    if (opt.dev) h["x-dev"] = opt.dev;
    let r;
    try { r = await fetch(BASE + path, { method: opt.body ? "POST" : opt.method || "GET", headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined, cache: "no-store" }); }
    catch (e) { const err = new Error("Sin conexión. Revisa tu internet e intenta de nuevo."); err.status = 0; throw err; }
    let d = {};
    try { d = await r.json(); } catch (e) {}
    if (!r.ok) { const err = new Error(d.error || "No se pudo conectar"); err.status = r.status; throw err; }
    return d;
  }

  // Conexión en vivo: WebSocket con reconexión y, si falla, consulta cada pocos segundos.
  function live({ role = "guest", mine = null, pin = null, onData, onStatus }) {
    let ws = null, alive = false, stopped = false, retry = 0, pollT = null, pingT = null, polling = false;
    const status = (s) => onStatus && onStatus(s);
    // una sola cadena de consultas a la vez (antes se multiplicaba con cada reconexión fallida)
    const poll = async () => {
      if (stopped || alive || polling) return;
      polling = true; clearTimeout(pollT);
      try {
        const d = role === "host" ? await api("/host/state", { pin }) : await api("/state" + (mine ? "?mine=" + mine : ""));
        onData(d); status("poll");
      } catch (e) { status("off"); if (e.status === 401) onData({ authError: true }); }
      polling = false;
      if (!stopped && !alive) pollT = setTimeout(poll, document.hidden ? 15000 : 4000);
    };
    const open = () => {
      if (stopped) return;
      const u = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + BASE + "/ws?role=" + role + (mine ? "&mine=" + mine : "");
      try { ws = new WebSocket(u); } catch (e) { ws = null; poll(); return; }
      const t = setTimeout(() => { if (!alive) { try { ws.close(); } catch (e) {} } }, 6000);
      ws.onopen = () => {
        clearTimeout(t); alive = true; retry = 0; clearTimeout(pollT); status("live");
        if (role === "host") ws.send(JSON.stringify({ t: "auth", pin }));
        clearInterval(pingT); pingT = setInterval(() => { try { ws.send('{"t":"ping"}'); } catch (e) {} }, 25000);
      };
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === "pub" || m.t === "host") onData(m.d);
        else if (m.t === "err") onData({ authError: true });
      };
      ws.onclose = () => {
        clearTimeout(t); clearInterval(pingT); const was = alive; alive = false;
        if (stopped) return;
        status("off"); retry++;
        if (!was) poll();
        setTimeout(open, Math.min(15000, 800 * retry));
      };
      ws.onerror = () => {};
    };
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !alive && !stopped) { clearTimeout(pollT); poll(); if (!ws || ws.readyState > 1) open(); }
    });
    open();
    return {
      setMine(id) { mine = id; if (alive) ws.send(JSON.stringify({ t: "mine", id })); },
      refresh() { if (alive) ws.send(JSON.stringify(role === "host" ? { t: "auth", pin } : { t: "mine", id: mine })); else { clearTimeout(pollT); poll(); } },
      stop() { stopped = true; clearTimeout(pollT); clearInterval(pingT); try { ws && ws.close(); } catch (e) {} },
    };
  }

  const store = {
    // en la demostración el equipo entra sin PIN
    get(k) { try { return localStorage.getItem(PFX + k) || (DEMO && k === "pin" ? "demo" : null); } catch (e) { return DEMO && k === "pin" ? "demo" : null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(PFX + k) : localStorage.setItem(PFX + k, v); } catch (e) {} },
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ago = (t, now = Date.now()) => { const m = Math.max(0, Math.floor((now - t) / 60000)); return m < 1 ? "ahora" : m < 60 ? m + " min" : Math.floor(m / 60) + " h " + (m % 60) + " min"; };
  const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const ZONES = { any: "Lo primero que se libere", interior: "Interior", terraza: "Terraza", barra: "Barra" };

  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); document.body.append(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600);
  }

  let actx = null, master = null;
  // volumen: "alto" pasa por un compresor para sonar fuerte aun con bocinas de tablet
  function ctx() {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (!master) {
      const comp = actx.createDynamicsCompressor();
      comp.threshold.value = -24; comp.knee.value = 10; comp.ratio.value = 8; comp.attack.value = 0.002; comp.release.value = 0.2;
      master = actx.createGain(); master.gain.value = 1;
      master.connect(comp); comp.connect(actx.destination);
    }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  function tone(f, st, dur, vol, type) {
    const a = ctx(), o = a.createOscillator(), g = a.createGain();
    o.type = type || "square"; o.frequency.value = f; o.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(vol, st + 0.015); g.gain.setValueAtTime(vol, st + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
    o.start(st); o.stop(st + dur + 0.02);
  }
  // patrones: "pedido" (tres notas que suben), "llamado" (timbre de dos tonos), "alerta" (sirena corta), "suave" (el de antes)
  function alarm(kind = "pedido", vol = 0.9) {
    try {
      const a = ctx(), t = a.currentTime + 0.02;
      if (kind === "suave") { [660, 880].forEach((f, j) => tone(f, t + j * 0.16, 0.28, 0.25 * vol, "sine")); return; }
      if (kind === "pedido") { for (let r = 0; r < 2; r++) [784, 988, 1319].forEach((f, j) => tone(f, t + r * 0.75 + j * 0.15, 0.17, vol, "square")); return; }
      if (kind === "llamado") { for (let r = 0; r < 3; r++) { tone(1175, t + r * 0.6, 0.22, vol, "square"); tone(880, t + r * 0.6 + 0.24, 0.3, vol, "square"); } return; }
      if (kind === "alerta") { for (let r = 0; r < 6; r++) tone(r % 2 ? 740 : 1480, t + r * 0.2, 0.19, vol, "sawtooth"); return; }
    } catch (e) {}
  }
  function beep(n = 3) { alarm(n >= 3 ? "llamado" : "pedido"); }
  function unlockAudio() { try { ctx(); } catch (e) {} }
  // aviso por voz (español de México si existe)
  function say(text) {
    try {
      if (!window.speechSynthesis) return;
      const u = new SpeechSynthesisUtterance(text);
      const v = speechSynthesis.getVoices().find((x) => /es[-_]MX/i.test(x.lang)) || speechSynthesis.getVoices().find((x) => /^es/i.test(x.lang));
      if (v) u.voice = v; u.lang = v ? v.lang : "es-MX"; u.rate = 1; u.volume = 1;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  // mantener la pantalla encendida (tablets de cocina y barra)
  let wl = null;
  async function wake() {
    try { if ("wakeLock" in navigator && !wl) { wl = await navigator.wakeLock.request("screen"); wl.addEventListener("release", () => { wl = null; }); } } catch (e) {}
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && wake._on) wake(); });

  function qrSvg(text, opts = {}) {
    if (!window.qrcode) return "";
    const q = window.qrcode(0, "M"); q.addData(text); q.make();
    const n = q.getModuleCount(), m = opts.margin ?? 2, size = n + m * 2;
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="Código QR"><rect width="${size}" height="${size}" fill="${opts.bg || "#fff"}"/><path d="${d}" fill="${opts.fg || "#1c1b17"}"/></svg>`;
  }

  const b64ToU8 = (b) => { const p = "=".repeat((4 - (b.length % 4)) % 4); const x = atob((b + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...x].map((c) => c.charCodeAt(0))); };
  // suscribe este navegador a notificaciones push y regresa la suscripción
  async function pushSubscribe() {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    if (ios && !standalone) throw new Error("En iPhone los avisos solo funcionan desde el ícono de la pantalla de inicio: toca Compartir, elige «Agregar a inicio», abre Higuera desde ese ícono, entra con tu PIN y activa aquí los avisos.");
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) throw new Error("Este navegador no permite notificaciones. Usa Chrome en Android o Safari en iPhone (desde el ícono de inicio).");
    const perm = await Notification.requestPermission();
    const reg = await navigator.serviceWorker.register("/higuera/sw.js", { scope: "/higuera/" });
    await navigator.serviceWorker.ready;
    if (perm !== "granted") throw new Error(perm === "denied" ? "Las notificaciones están bloqueadas en este navegador" : "No se dio permiso");
    const { key } = await api("/push/key");
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      try { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(key) }); }
      catch (e) { throw new Error("Este celular no permite avisos con la pantalla bloqueada (pasa en algunos Huawei sin servicios de Google). La pantalla sigue sonando mientras esté abierta."); }
    }
    return sub;
  }

  /* ----- acceso del equipo: cada persona entra con su PIN y tiene su sesión ----- */
  const ROLE_NAMES = { dueno: "Dueño", gerente: "Gerente", mesero: "Mesero", cocina: "Cocina", entrada: "Entrada" };
  const ACCESS = "/higuera/acceso/";
  function goAccess() { location.href = ACCESS + "?next=" + encodeURIComponent(location.pathname + location.search); }
  async function logout() {
    const t = store.get("pin");
    try {
      const reg = "serviceWorker" in navigator && (await navigator.serviceWorker.getRegistration("/higuera/"));
      const sub = reg && reg.pushManager && (await reg.pushManager.getSubscription());
      if (t && sub) await api("/host/push/off", { pin: t, body: { endpoint: sub.endpoint } });
    } catch (e) {}
    try { if (t) await api("/auth/logout", { pin: t, body: {} }); } catch (e) {}
    store.set("pin", null); location.href = ACCESS;
  }
  // en la barra de pantallas, cada quien ve solo las de su puesto
  const NAV_ROLES = { host: ["dueno", "gerente", "mesero", "entrada"], cocina: ["dueno", "gerente", "cocina"], meseros: ["dueno", "gerente", "mesero"], club: ["dueno", "gerente"] };
  function trimNav(u) {
    document.querySelectorAll("nav.panels, nav.pnav").forEach((nav) => {
      let shown = 0;
      nav.querySelectorAll("a").forEach((a) => {
        const k = (a.getAttribute("href") || "").replace(/\/$/, "").split("/").pop() || "";
        const key = k === "." || k === "" ? null : k === ".." ? null : k;
        const roles = key && NAV_ROLES[key];
        const ok = !roles || roles.includes(u.role) || a.classList.contains("cur");
        a.style.display = ok ? "" : "none"; if (ok) shown++;
      });
      if (shown <= 1) nav.style.display = "none";
    });
  }
  function mountUser(u) {
    try { trimNav(u); } catch (e) {}
    if (document.getElementById("hgUser")) return;
    const host = document.querySelector("[data-user-slot]") || document.querySelector("header");
    if (!host) return;
    const el = document.createElement("span");
    el.id = "hgUser";
    el.style.cssText = "display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 6px 0 12px;border-radius:99px;background:rgba(127,127,127,.18);font-size:12.5px;font-weight:700;white-space:nowrap;flex:0 0 auto";
    const small = innerWidth < 760;
    el.innerHTML = `<span><b style="font-weight:800">${esc(small ? u.name.split(" ")[0] : u.name)}</b>${small ? "" : " · " + esc(u.roleName || ROLE_NAMES[u.role] || "")}</span>${small ? "" : `<a href="${ACCESS}" style="color:inherit;text-decoration:underline;text-underline-offset:3px">Mis pantallas</a>`}<button type="button" style="height:28px;padding:0 10px;border-radius:99px;background:rgba(127,127,127,.28);color:inherit;font-weight:800;font-size:12px">Salir</button>`;
    el.querySelector("button").onclick = logout;
    host.appendChild(el);
  }
  function denied(u) {
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;inset:0;z-index:200;background:#1f231b;color:#f4f1ea;display:grid;place-items:center;padding:24px;text-align:center;font-family:var(--sans,system-ui)";
    d.innerHTML = `<div style="max-width:380px"><p style="font:400 34px/1.05 var(--serif,Georgia)">Esta pantalla no es para tu puesto</p><p style="margin:14px 0 22px;color:rgba(244,241,234,.8);font-size:15px">${esc(u.name)}, entraste como ${esc(u.roleName)}. Abre tus pantallas desde el inicio.</p><a href="${ACCESS}" style="display:flex;justify-content:center;align-items:center;height:52px;border-radius:99px;background:#f4f1ea;color:#1f231b;font-weight:800;text-decoration:none">Ir a mis pantallas</a><button type="button" style="margin-top:12px;color:#f4f1ea;font-weight:800;text-decoration:underline;background:none;border:0;font-size:14px;cursor:pointer">Entrar con otro PIN</button></div>`;
    d.querySelector("button").onclick = logout;
    document.body.appendChild(d);
  }
  // silent = la sesión guardada; si no, p es el PIN que escribió la persona
  async function signin(p, silent, roles) {
    let r;
    // las pantallas del equipo ya no piden PIN por su cuenta: se entra en Acceso con nombre y PIN
    if (!silent) { goAccess(); const x = new Error("acceso"); x.denied = true; throw x; }
    try { r = await api("/auth/me", { pin: p, dev: store.get("dev") }); }
    catch (e) { if (e.status === 401) { store.set("pin", null); goAccess(); const x = new Error("acceso"); x.denied = true; throw x; } throw e; }
    if (r.dev) store.set("dev", r.dev);
    const tok = silent ? p : r.tok;
    store.set("pin", tok);
    if (roles && !roles.includes(r.user.role)) { denied(r.user); const x = new Error("denied"); x.denied = true; throw x; }
    mountUser(r.user);
    return { tok, user: r.user, state: r.state };
  }

  // vibrar solo después de que la persona tocó la pantalla (si no, el navegador lo bloquea con un aviso)
  try {
    if (navigator.vibrate) {
      const vib = navigator.vibrate.bind(navigator);
      navigator.vibrate = (pt) => { try { if (!navigator.userActivation || navigator.userActivation.hasBeenActive) return vib(pt); } catch (e) {} return false; };
    }
  } catch (e) {}

  // pantalla del equipo sin sesión: directo a Acceso (nombre y PIN)
  document.addEventListener("DOMContentLoaded", () => {
    const gf = document.getElementById("gf");
    if (!gf) return;
    const h = gf.querySelector("h1"), img = gf.querySelector("img");
    gf.innerHTML = "";
    if (img) gf.append(img); if (h) gf.append(h);
    const pp = document.createElement("p"); pp.textContent = "Entra con tu nombre y tu PIN."; gf.append(pp);
    const a = document.createElement("a"); a.className = "btn btn-ink btn-block"; a.href = ACCESS + "?next=" + encodeURIComponent(location.pathname + location.search); a.textContent = "Entrar"; gf.append(a);
    const er = document.createElement("p"); er.className = "err"; er.id = "gerr"; er.setAttribute("role", "alert"); gf.append(er);
    if (!DEMO && !store.get("pin")) goAccess();
  });

  window.HG = { DEMO, signin, logout, goAccess, ROLE_NAMES, api, live, store, esc, ago, mmss, ZONES, toast, beep, alarm, say, wake: () => { wake._on = true; return wake(); }, unlockAudio, qrSvg, pushSubscribe, ROOM };
})();
