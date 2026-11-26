// Code Nova · servidor de las demos
// Sirve las páginas estáticas y la API de fila virtual (/api/fila/<negocio>/...).
// Cada negocio tiene su propia fila guardada en un Durable Object.

const ROOMS = {
  higuera: {
    name: "Higuera", prefix: "H", tz: "America/Monterrey", minsPerGroup: 6,
    // horario por día (lunes=0 … domingo=6), en horas
    hours: [[8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [8, 17], [8, 17]],
    site: "https://codenova.code-nova-on.workers.dev/higuera/fila/",
  },
};

// Cambiar este valor borra el PIN del equipo una vez (para cuando se olvida)
const PIN_RESET = "2026-11-26-1";

// Servicios de notificaciones push a los que sí se permite enviar
const PUSH_HOSTS = [/\.googleapis\.com$/, /\.push\.apple\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /\.push\.services\.mozilla\.com$/];

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/api\/fila\/([a-z0-9-]+)(\/.*)?$/);
    if (m) {
      const room = m[1];
      if (!ROOMS[room]) return json({ error: "Negocio no encontrado" }, 404);
      const id = env.FILA.idFromName(room);
      const stub = env.FILA.get(id);
      const fwd = new URL(request.url);
      fwd.pathname = m[2] || "/";
      fwd.searchParams.set("room", room);
      const req = new Request(fwd.toString(), request);
      req.headers.set("x-ip", request.headers.get("cf-connecting-ip") || "");
      return stub.fetch(req);
    }
    if (url.pathname === "/api/ping") return json({ ok: true, t: Date.now() });
    if (url.pathname === "/higuera/cocina" || url.pathname === "/higuera/meseros") return Response.redirect(url.origin + url.pathname + "/" + url.search, 301);
    if (url.pathname === "/higuera/cocina/" || url.pathname === "/higuera/meseros/") {
      const r = await env.ASSETS.fetch(new Request(new URL("/higuera/barra/", url).toString(), request));
      const out = new Response(r.body, r);
      out.headers.set("cache-control", "no-cache");
      return out;
    }
    const res = await env.ASSETS.fetch(request);
    // el service worker necesita poder controlar todo /higuera/
    if (url.pathname === "/higuera/sw.js") {
      const r = new Response(res.body, res);
      r.headers.set("service-worker-allowed", "/higuera/");
      r.headers.set("cache-control", "no-cache");
      return r;
    }
    return res;
  },
};

/* ---------------- utilidades ---------------- */
const enc = new TextEncoder();
async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const rid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
const digits = (s) => String(s ?? "").replace(/\D/g, "").slice(-10);
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uStr = (s) => b64u(enc.encode(s));
function parts(tz, t = Date.now()) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(t));
  const g = (k) => f.find((x) => x.type === k)?.value;
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(g("weekday"));
  return { wd, h: (+g("hour") % 24) + +g("minute") / 60 };
}
function dayKey(tz, t = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
}
function hourOf(tz, t) {
  return +new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date(t)) % 24;
}
const hhmm = (x) => { const h = Math.floor(x), m = Math.round((x - h) * 60); return (h > 12 ? h - 12 : h) + (m ? ":" + String(m).padStart(2, "0") : "") + (h >= 12 ? " pm" : " am"); };
const ACTIVE = ["waiting", "called"];
const NEEDS = ["bebe", "mascota", "accesible"];

/* ---------------- Durable Object ---------------- */
export class Fila {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.s = null;
    this.fails = 0;
    this.lockUntil = 0;
    this.sqlReady = false;
  }

  async load(room) {
    if (this.s) return this.s;
    const cfg = ROOMS[room] || ROOMS.higuera;
    const base = {
      room, name: cfg.name, tz: cfg.tz, open: true, minsPerGroup: cfg.minsPerGroup,
      pinHash: null, salt: rid(), counter: 0, day: dayKey(cfg.tz), entries: [], history: [], v: 1,
      autoHours: true, lastCall: 30, tolerance: 10, maxSize: 10,
      mesas: { on: true, mode: "pedir", count: 12, keys: {}, rewardVisits: 5, rewardText: "Tu latte va por la casa", onlyHours: false, reviewUrl: "https://www.google.com/maps/search/?api=1&query=Cocina%20Higuera%20San%20Pedro%20Garza%20Garc%C3%ADa" },
      orders: [], calls: [], orderSeq: 0, promos: [], reviews: [], staff: [], freed: [],
      site: { notice: "", season: { on: true, title: "Buttermilk waffle con moras", text: "El destacado de la semana. El equipo lo cambia cuando quiera desde su panel.", img: "waffle" }, soldout: [], soldDay: "" },
    };
    this.s = { ...base, ...((await this.ctx.storage.get("s")) || {}) };
    this.cfg = cfg;
    // restablecer el PIN del equipo: al cambiar esta marca, el PIN se borra una sola vez
    // y el siguiente que entre al panel crea uno nuevo
    if (this.s.pinReset !== PIN_RESET) { this.s.pinHash = null; this.s.pinReset = PIN_RESET; this.lockUntil = 0; this.fails = 0; await this.ctx.storage.put("s", this.s); }
    this.s.mesas = { ...base.mesas, ...(this.s.mesas || {}) };
    this.ensureKeys();
    this.rollDay();
    return this.s;
  }

  sql() {
    if (!this.sqlReady) {
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS contacts (phone TEXT PRIMARY KEY, name TEXT, first TEXT, last TEXT, visits INTEGER DEFAULT 1)");
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, kind TEXT, created INTEGER, status TEXT, data TEXT, ipH TEXT)");
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, tok TEXT, phone TEXT UNIQUE, name TEXT, created INTEGER, visits INTEGER DEFAULT 0, total INTEGER DEFAULT 0, lastDay TEXT, optin INTEGER DEFAULT 0, push TEXT, pmsg TEXT, rewards INTEGER DEFAULT 0, rcode TEXT, rexp INTEGER, demo INTEGER DEFAULT 0)");
      this.sqlReady = true;
    }
    return this.ctx.storage.sql;
  }
  addContact(e) {
    if (!e.optin || !e.phone || e.demo) return;
    const d = this.s.day;
    this.sql().exec(
      "INSERT INTO contacts (phone,name,first,last,visits) VALUES (?,?,?,?,1) ON CONFLICT(phone) DO UPDATE SET name=excluded.name, visits=visits+(CASE WHEN last<>excluded.last THEN 1 ELSE 0 END), last=excluded.last",
      e.phone, e.name, d, d,
    );
  }
  contactCount() { try { return this.sql().exec("SELECT COUNT(*) AS n FROM contacts").one().n; } catch (e) { return 0; } }

  rollDay() {
    const s = this.s;
    const today = dayKey(s.tz);
    if (s.day === today) return;
    const st = { ...this.statsFor(s.entries, s.day), ...this.mesaStats() };
    if (st.joined || st.orders || st.calls) s.history = [...s.history.filter((h) => h.day !== s.day), st].slice(-60);
    s.orders = []; s.calls = []; s.orderSeq = 0; s.freed = [];
    (s.reviews || []).forEach((r) => { r.closed = true; delete r.ipH; });
    // los datos personales de la lista se borran al cambiar el día
    s.entries = [];
    s.counter = 0;
    s.day = today;
    s.open = true;
    s.v++;
  }

  async save() {
    this.s.v++;
    await this.ctx.storage.put("s", this.s);
    this.broadcast();
  }

  /* ----- horario ----- */
  hoursInfo() {
    const s = this.s, H = this.cfg.hours;
    const { wd, h } = parts(s.tz);
    const [o, c] = H[wd];
    const cutoff = c - (s.lastCall || 0) / 60;
    const inHours = h >= o && h < c;
    const accepting = h >= o - 0.5 && h < cutoff; // se puede anotar desde media hora antes de abrir
    let next = "";
    if (h >= cutoff) { const [no] = H[(wd + 1) % 7]; next = "mañana desde las " + hhmm(no); }
    else if (h < o - 0.5) next = "hoy desde las " + hhmm(o - 0.5);
    return { inHours, accepting, open: o, close: c, cutoff, cutoffTxt: hhmm(cutoff), closeTxt: hhmm(c), next };
  }
  acceptState() {
    const s = this.s;
    if (!s.open) return { ok: false, reason: "paused" };
    if (s.autoHours) { const hi = this.hoursInfo(); if (!hi.accepting) return { ok: false, reason: "hours", next: hi.next }; }
    return { ok: true };
  }

  statsFor(entries, day) {
    const real = entries;
    const seated = real.filter((e) => e.status === "seated");
    const lost = real.filter((e) => e.status === "noshow" || e.status === "cancelled");
    const waits = seated.map((e) => (e.tDone - e.t0) / 60000).filter((x) => x >= 0);
    const avg = waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0;
    const byHour = {};
    real.forEach((e) => { const h = hourOf(this.s.tz, e.t0); byHour[h] = (byHour[h] || 0) + 1; });
    const people = seated.reduce((a, e) => a + e.size, 0);
    const optin = real.filter((e) => e.optin && e.phone).length;
    const pushed = real.filter((e) => e.push).length;
    return { day, joined: real.length, seated: seated.length, people, lost: lost.length, avgWait: avg, byHour, optin, pushed };
  }

  queue() {
    return this.s.entries.filter((e) => ACTIVE.includes(e.status)).sort((a, b) => a.t0 - b.t0);
  }

  estimate() {
    const s = this.s;
    const seated = s.entries.filter((e) => e.status === "seated");
    let per = s.minsPerGroup;
    if (seated.length >= 3) {
      const waits = seated.slice(-6).map((e) => (e.tDone - e.t0) / 60000);
      const q = seated.slice(-6).map((e) => e.posAtJoin || 1);
      const rate = waits.reduce((a, b) => a + b, 0) / Math.max(1, q.reduce((a, b) => a + b, 0));
      if (rate > 1 && rate < 30) per = Math.round((per + rate) / 2);
    }
    return per;
  }

  siteState() {
    const st = this.s.site || {};
    return {
      notice: st.notice || "",
      season: st.season && st.season.on && st.season.title ? { title: st.season.title, text: st.season.text || "", img: st.season.img || "waffle" } : null,
      soldout: st.soldDay === this.s.day ? st.soldout || [] : [],
    };
  }
  newRequests() { try { return this.sql().exec("SELECT COUNT(*) AS n FROM requests WHERE status='nuevo'").one().n; } catch (e) { return 0; } }
  hoursStats() {
    const days = [0, 0, 0, 0, 0, 0, 0], sum = Array.from({ length: 7 }, () => ({}));
    for (const h of this.s.history || []) {
      const wd = (new Date(h.day + "T12:00:00Z").getUTCDay() + 6) % 7;
      days[wd]++;
      for (const [hr, n] of Object.entries(h.byHour || {})) sum[wd][hr] = (sum[wd][hr] || 0) + n;
    }
    const avg = sum.map((o, wd) => Object.fromEntries(Object.entries(o).map(([hr, n]) => [hr, Math.round((n / Math.max(1, days[wd])) * 10) / 10])));
    return { days, avg, today: this.statsFor(this.s.entries, this.s.day).byHour, wd: parts(this.s.tz).wd };
  }

  publicState(mineId) {
    const s = this.s;
    const q = this.queue();
    const per = this.estimate();
    const waitingAhead = q.filter((e) => e.status === "waiting").length;
    const acc = this.acceptState();
    const hi = this.hoursInfo();
    const out = {
      v: s.v, name: s.name, open: acc.ok, reason: acc.reason || null, next: acc.next || "", now: Date.now(),
      tolerance: s.tolerance, maxSize: s.maxSize, cutoffTxt: s.autoHours ? hi.cutoffTxt : "", inHours: hi.inHours,
      waiting: waitingAhead, estWait: waitingAhead ? Math.max(5, Math.round((waitingAhead + 1) * per)) : 0,
      queue: q.map((e) => ({ code: e.code, size: e.size, status: e.status, initial: (e.name[0] || "").toUpperCase() })),
      site: this.siteState(),
    };
    if (mineId) {
      const me = s.entries.find((e) => e.id === mineId);
      if (me) {
        const ahead = q.filter((e) => e.status === "waiting" && e.t0 < me.t0).length;
        out.mine = {
          id: me.id, code: me.code, name: me.name, size: me.size, zone: me.zone, status: me.status, otw: !!me.otw, here: !!me.here, mesa: me.mesa || 0,
          hasPhone: !!me.phone, hasPush: !!me.push, needs: me.needs || [],
          t0: me.t0, tCalled: me.tCalled || null, ahead, eta: me.status === "waiting" ? Math.max(3, Math.round((ahead + 1) * per)) : 0,
        };
      } else out.mine = { gone: true };
    }
    return out;
  }

  hostEntry(e) {
    const { push, ipH, pushMsg, ...rest } = e;
    return { ...rest, hasPush: !!push, pushFail: !!e.pushFail };
  }

  hostState() {
    const s = this.s;
    const hi = this.hoursInfo();
    return {
      v: s.v, name: s.name, open: s.open, accepting: this.acceptState(), minsPerGroup: s.minsPerGroup, now: Date.now(), per: this.estimate(),
      autoHours: s.autoHours, lastCall: s.lastCall, tolerance: s.tolerance, maxSize: s.maxSize,
      hours: { cutoffTxt: hi.cutoffTxt, closeTxt: hi.closeTxt, inHours: hi.inHours, next: hi.next },
      queue: this.queue().map((e) => this.hostEntry(e)),
      done: s.entries.filter((e) => !ACTIVE.includes(e.status)).sort((a, b) => b.tDone - a.tDone).slice(0, 30).map((e) => this.hostEntry(e)),
      today: this.statsFor(s.entries, s.day), history: s.history.slice(-14), contacts: this.contactCount(),
      site: { ...(s.site || {}), soldout: this.siteState().soldout }, newRequests: this.newRequests(),
      mesas: s.mesas, tables: this.tablesView(),
      orders: s.orders.filter((o) => !o.closed || Date.now() - o.tUpd < 3600000).map((o) => ({ ...this.orderView(o), closed: !!o.closed, tReady: o.tReady || null })),
      calls: s.calls.filter((c) => c.status === "open").map((c) => ({ id: c.id, m: c.m, kind: c.kind, t0: c.t0, demo: !!c.demo, stars: c.stars || 0, text: c.text || "" })),
      freed: (s.freed || []).filter((f) => Date.now() - f.t < 30 * 60000), staffPush: { cocina: (s.staff || []).filter((x) => x.role === "cocina").length, meseros: (s.staff || []).filter((x) => x.role === "meseros").length, gerente: (s.staff || []).filter((x) => x.role === "gerente").length },
      reviews: (s.reviews || []).slice(-40).reverse(), mesaToday: this.mesaStats(true), club: this.clubSummary(), promos: (s.promos || []).slice(-8).reverse(),
    };
  }

  /* ----- mesas, pedidos y llamados ----- */
  ensureKeys() {
    const M = this.s.mesas;
    M.keys = M.keys || {};
    for (let i = 1; i <= M.count; i++) if (!M.keys[i]) M.keys[i] = rid().slice(0, 6);
  }
  // si el gerente activa "solo en horario", fuera de horario no se aceptan pedidos ni llamados
  closedMsg() {
    if (!this.s.mesas.onlyHours) return "";
    const hi = this.hoursInfo();
    return hi.inHours ? "" : "Higuera está cerrado en este momento. Abrimos " + (hi.next || "mañana") + ".";
  }
  tableOk(m, k) {
    const n = parseInt(m, 10);
    if (!(n >= 1 && n <= this.s.mesas.count)) return 0;
    return this.s.mesas.keys[n] === String(k || "") ? n : 0;
  }
  orderView(o) { return { id: o.id, n: o.n, m: o.m, items: o.items, note: o.note, status: o.status, t0: o.t0, tUpd: o.tUpd, who: o.who || "", member: !!o.mid, demo: !!o.demo }; }
  mesaState(m) {
    const s = this.s, M = s.mesas;
    return {
      v: s.v, now: Date.now(), name: s.name, m, on: M.on, mode: M.mode, reward: { visits: M.rewardVisits, text: M.rewardText },
      orders: s.orders.filter((o) => o.m === m && !o.closed).map((o) => this.orderView(o)),
      calls: s.calls.filter((c) => c.m === m && c.status === "open" && c.kind !== "alerta").map((c) => ({ id: c.id, kind: c.kind, t0: c.t0 })),
      site: this.siteState(), reviewUrl: M.reviewUrl, closed: this.closedMsg(),
      reviewed: (s.reviews || []).some((r) => r.m === m && !r.closed),
    };
  }
  tablesView() {
    const s = this.s, out = [];
    for (let m = 1; m <= s.mesas.count; m++) {
      const os = s.orders.filter((o) => o.m === m && !o.closed);
      const cs = s.calls.filter((c) => c.m === m && c.status === "open");
      out.push({ m, orders: os.length, pending: os.filter((o) => ["nuevo", "prep", "listo"].includes(o.status)).length, since: os.length ? Math.min(...os.map((o) => o.t0)) : 0, mesero: cs.some((c) => c.kind === "mesero"), cuenta: cs.some((c) => c.kind === "cuenta"), alerta: cs.some((c) => c.kind === "alerta") });
    }
    return out;
  }
  // withDemo: en el panel se cuentan también los de ejemplo para que la demo se vea viva; el historial nunca los guarda
  mesaStats(withDemo) {
    const s = this.s;
    const real = (s.orders || []).filter((o) => (withDemo || !o.demo) && o.status !== "cancelado");
    const counts = {};
    real.forEach((o) => o.items.forEach((it) => { counts[it.n] = (counts[it.n] || 0) + it.q; }));
    const prep = real.filter((o) => o.tReady).map((o) => (o.tReady - o.t0) / 60000);
    const calls = (s.calls || []).filter((c) => (withDemo || !c.demo) && c.kind !== "alerta");
    const revs = (s.reviews || []).filter((r) => r.day === s.day && (withDemo || !r.demo));
    const resp = calls.filter((c) => c.tDone).map((c) => (c.tDone - c.t0) / 60000);
    const avg = (a) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : 0);
    return {
      orders: real.length, items: Object.values(counts).reduce((a, b) => a + b, 0),
      top: Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8),
      prepAvg: avg(prep), calls: calls.length, callsMesero: calls.filter((c) => c.kind === "mesero").length, callsCuenta: calls.filter((c) => c.kind === "cuenta").length, callAvg: avg(resp),
      byMember: real.filter((o) => o.mid).length,
      reviews: revs.length, rating: revs.length ? Math.round((revs.reduce((a, r) => a + r.stars, 0) / revs.length) * 10) / 10 : 0, low: revs.filter((r) => r.stars <= 3).length,
    };
  }
  /* ----- avisos al celular del equipo (cocina, meseros, gerente) ----- */
  notifyStaff(roles, msg) {
    const subs = (this.s.staff || []).filter((x) => roles.includes(x.role));
    if (!subs.length) return;
    const t = Date.now();
    subs.forEach((x) => { x.msg = { ...msg, t }; });
    const job = (async () => {
      let changed = false;
      await Promise.all(subs.map(async (x) => {
        const st = await this.webPush(x.ep, "hgstaff" + x.role);
        if (st === 404 || st === 410) { this.s.staff = this.s.staff.filter((y) => y !== x); changed = true; }
      }));
      await this.ctx.storage.put("s", this.s);
      if (changed) this.broadcast();
    })();
    try { this.ctx.waitUntil(job); } catch (e) {}
  }
  itemsTxt(items) { return items.map((it) => it.q + "× " + it.n).join(", ").slice(0, 120); }
  async ipHash(request) { return (await sha(this.s.salt + (request.headers.get("x-ip") || ""))).slice(0, 16); }

  /* ----- club ----- */
  memberRow(id, tok) {
    if (!id || !tok) return null;
    try { const r = this.sql().exec("SELECT * FROM members WHERE id=?", String(id)).toArray()[0]; return r && r.tok === String(tok) ? r : null; } catch (e) { return null; }
  }
  memberView(r) {
    const M = this.s.mesas;
    return { id: r.id, name: r.name, first: (r.name || "").split(" ")[0], visits: r.visits, total: r.total, need: M.rewardVisits, rewardText: M.rewardText, ready: r.visits >= M.rewardVisits, rewards: r.rewards, optin: !!r.optin, hasPush: !!r.push, today: r.lastDay === this.s.day, since: r.created };
  }
  // cuenta una visita por día como máximo
  visitFor(r) {
    if (!r || r.lastDay === this.s.day) return false;
    this.sql().exec("UPDATE members SET visits=visits+1, total=total+1, lastDay=? WHERE id=?", this.s.day, r.id);
    r.visits++; r.total++; r.lastDay = this.s.day;
    return true;
  }
  clubSummary() {
    try {
      const a = this.sql().exec("SELECT COUNT(*) AS n, SUM(optin) AS o, SUM(CASE WHEN push IS NOT NULL AND optin=1 THEN 1 ELSE 0 END) AS p, SUM(CASE WHEN visits>=? THEN 1 ELSE 0 END) AS r, SUM(CASE WHEN lastDay=? THEN 1 ELSE 0 END) AS t FROM members", this.s.mesas.rewardVisits, this.s.day).one();
      return { members: a.n || 0, optin: a.o || 0, reachable: a.p || 0, ready: a.r || 0, today: a.t || 0 };
    } catch (e) { return { members: 0, optin: 0, reachable: 0, ready: 0, today: 0 }; }
  }
  async pushMember(r, msg) {
    if (!r.push) return false;
    this.sql().exec("UPDATE members SET pmsg=? WHERE id=?", JSON.stringify({ ...msg, t: Date.now() }), r.id);
    const st = await this.webPush(r.push, "hgclub");
    if (st === 404 || st === 410) { this.sql().exec("UPDATE members SET push=NULL WHERE id=?", r.id); return false; }
    return st >= 200 && st < 300;
  }

  broadcast() {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const a = ws.deserializeAttachment() || {};
        if (a.role === "host") { if (a.ok) ws.send(JSON.stringify({ t: "host", d: this.hostState() })); }
        else if (a.role === "mesa") { if (a.m) ws.send(JSON.stringify({ t: "mesa", d: this.mesaState(a.m) })); }
        else ws.send(JSON.stringify({ t: "pub", d: this.publicState(a.mine) }));
      } catch (e) {}
    }
  }

  async checkPin(pin) {
    const s = this.s;
    if (!s.pinHash) return { ok: false, unset: true };
    if (Date.now() < this.lockUntil) return { ok: false, locked: true };
    const ok = (await sha(s.salt + ":" + String(pin || ""))) === s.pinHash;
    if (!ok) { this.fails++; if (this.fails >= 5) { this.lockUntil = Date.now() + 60000; this.fails = 0; } }
    else this.fails = 0;
    return { ok };
  }

  newEntry(b, src) {
    const s = this.s;
    const name = clean(b.name, 40);
    const size = Math.max(1, Math.min(30, parseInt(b.size, 10) || 2));
    if (!name) return { error: "Escribe tu nombre" };
    const zones = ["any", "interior", "terraza", "barra"];
    s.counter++;
    const e = {
      id: rid(), code: (this.cfg.prefix || "H") + "-" + String(s.counter).padStart(3, "0"), name, size,
      phone: digits(b.phone), zone: zones.includes(b.zone) ? b.zone : "any", optin: !!b.optin,
      needs: Array.isArray(b.needs) ? b.needs.filter((x) => NEEDS.includes(x)) : [],
      note: clean(b.note, 80),
      status: "waiting", t0: Date.now(), src, demo: !!b.demo,
      posAtJoin: this.queue().filter((x) => x.status === "waiting").length + 1,
    };
    s.entries.push(e);
    this.addContact(e);
    return { e };
  }

  /* ----- notificaciones push ----- */
  async vapid() {
    if (this._vapid) return this._vapid;
    let v = await this.ctx.storage.get("vapid");
    if (!v) {
      const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      v = { priv: await crypto.subtle.exportKey("jwk", kp.privateKey), pub: b64u(await crypto.subtle.exportKey("raw", kp.publicKey)) };
      await this.ctx.storage.put("vapid", v);
    }
    v.key = await crypto.subtle.importKey("jwk", v.priv, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    this._vapid = v;
    return v;
  }
  // envía un push vacío (el service worker pide el texto a /push/msg); regresa el código HTTP o 0
  async webPush(endpoint, topic) {
    try {
      const v = await this.vapid();
      const ep = new URL(endpoint);
      const head = b64uStr(JSON.stringify({ typ: "JWT", alg: "ES256" }));
      const body = b64uStr(JSON.stringify({ aud: ep.origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "https://codenova.code-nova-on.workers.dev" }));
      const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, v.key, enc.encode(head + "." + body));
      const jwt = head + "." + body + "." + b64u(sig);
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 5000);
      const r = await fetch(endpoint, { method: "POST", signal: ctl.signal, headers: { TTL: "3600", Urgency: "normal", Topic: topic, Authorization: `vapid t=${jwt}, k=${v.pub}`, "Content-Length": "0" } });
      clearTimeout(to);
      return r.status;
    } catch (err) { return 0; }
  }
  async sendPush(e, msg) {
    if (!e.push || !e.push.endpoint) return false;
    e.pushMsg = { ...msg, t: Date.now() };
    try {
      const v = await this.vapid();
      const ep = new URL(e.push.endpoint);
      const head = b64uStr(JSON.stringify({ typ: "JWT", alg: "ES256" }));
      const body = b64uStr(JSON.stringify({ aud: ep.origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "https://codenova.code-nova-on.workers.dev" }));
      const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, v.key, enc.encode(head + "." + body));
      const jwt = head + "." + body + "." + b64u(sig);
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 5000);
      const r = await fetch(e.push.endpoint, {
        method: "POST", signal: ctl.signal,
        headers: { TTL: "900", Urgency: "high", Topic: "hg" + e.code.replace(/\W/g, ""), Authorization: `vapid t=${jwt}, k=${v.pub}`, "Content-Length": "0" },
      });
      clearTimeout(to);
      if (r.status === 404 || r.status === 410) { delete e.push; e.pushFail = true; return false; }
      e.pushFail = !r.ok;
      e.pushStatus = r.status;
      return r.ok;
    } catch (err) { e.pushFail = true; return false; }
  }
  // avisar a quien acaba de quedar primero en la fila
  async notifyNext() {
    const first = this.queue().find((e) => e.status === "waiting");
    if (first && first.push && !first.nextPushed && (first.posAtJoin || 1) > 1) {
      first.nextPushed = true;
      await this.sendPush(first, { kind: "next", title: "Ya casi, " + first.name, body: "Eres el siguiente en la lista de " + this.s.name + ". Ve acercándote a la entrada.", url: this.cfg.site + "?t=" + first.id });
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const room = url.searchParams.get("room");
    await this.load(room);
    this.rollDay();
    const p = url.pathname;
    const method = request.method;

    if (p === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") return json({ error: "ws" }, 426);
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const rq = url.searchParams.get("role");
      const role = rq === "host" ? "host" : rq === "mesa" ? "mesa" : "guest";
      const m = role === "mesa" ? this.tableOk(url.searchParams.get("m"), url.searchParams.get("k")) : 0;
      server.serializeAttachment({ role, room, mine: url.searchParams.get("mine") || null, ok: false, m });
      if (role === "guest") server.send(JSON.stringify({ t: "pub", d: this.publicState(url.searchParams.get("mine")) }));
      if (role === "mesa") server.send(JSON.stringify(m ? { t: "mesa", d: this.mesaState(m) } : { t: "err", d: "mesa" }));
      return new Response(null, { status: 101, webSocket: client });
    }

    let body = {};
    if (method === "POST") { try { body = await request.json(); } catch (e) { body = {}; } }

    // ---- invitado ----
    if (p === "/state" && method === "GET") return json(this.publicState(url.searchParams.get("mine")));

    if (p === "/join" && method === "POST") {
      const acc = this.acceptState();
      if (!acc.ok) return json({ error: acc.reason === "hours" ? "La lista en línea está cerrada por hoy" + (acc.next ? ". Abre " + acc.next + "." : ".") : "La lista está en pausa por el momento. Pregunta en la entrada." }, 409);
      if (this.queue().length >= 80) return json({ error: "La lista está llena, intenta en unos minutos." }, 409);
      const size = parseInt(body.size, 10) || 2;
      if (size > this.s.maxSize) return json({ error: `Para grupos de más de ${this.s.maxSize} personas, pregunta directamente en la entrada.` }, 400);
      // mismo WhatsApp ya en la lista: regresamos su turno en vez de duplicarlo
      const ph = digits(body.phone);
      if (ph) {
        const dup = this.queue().find((e) => e.phone === ph);
        if (dup) return json({ id: dup.id, code: dup.code, existing: true });
      }
      // límite por conexión para evitar que alguien llene la lista
      const ipH = (await sha(this.s.salt + (request.headers.get("x-ip") || ""))).slice(0, 16);
      if (request.headers.get("x-ip") && this.queue().filter((e) => e.ipH === ipH).length >= 3) return json({ error: "Ya hay varios turnos anotados desde este celular. Pregunta en la entrada." }, 429);
      const r = this.newEntry(body, "qr");
      if (r.error) return json({ error: r.error }, 400);
      r.e.ipH = ipH;
      await this.save();
      return json({ id: r.e.id, code: r.e.code });
    }

    const meM = p.match(/^\/me\/([a-z0-9]+)$/);
    if (meM && method === "POST") {
      const e = this.s.entries.find((x) => x.id === meM[1]);
      if (!e) return json({ error: "No encontramos tu turno" }, 404);
      if (body.action === "otw" && ACTIVE.includes(e.status)) e.otw = true;
      else if (body.action === "here" && ACTIVE.includes(e.status)) e.here = true;
      else if (body.action === "cancel" && ACTIVE.includes(e.status)) { e.status = "cancelled"; e.tDone = Date.now(); await this.notifyNext(); }
      await this.save();
      return json({ ok: true });
    }

    // ---- datos para "la mejor hora" ----
    if (p === "/stats/hours" && method === "GET") return json(this.hoursStats());

    // ---- solicitudes: eventos y oficinas, empleo ----
    if (p === "/request" && method === "POST") {
      const kind = body.kind === "empleo" ? "empleo" : body.kind === "evento" ? "evento" : null;
      if (!kind) return json({ error: "Solicitud inválida" }, 400);
      if (clean(body.website, 50)) return json({ ok: true }); // trampa para robots
      const name = clean(body.name, 60), phone = digits(body.phone);
      if (!name) return json({ error: "Escribe tu nombre" }, 400);
      if (phone.length !== 10) return json({ error: "Escribe un WhatsApp de 10 dígitos" }, 400);
      const ipH = (await sha(this.s.salt + (request.headers.get("x-ip") || ""))).slice(0, 16);
      const since = Date.now() - 24 * 3600 * 1000;
      const recent = this.sql().exec("SELECT COUNT(*) AS n FROM requests WHERE ipH=? AND created>?", ipH, since).one().n;
      if (recent >= 5) return json({ error: "Ya recibimos varias solicitudes desde este celular. Te contactamos pronto." }, 429);
      const data = kind === "evento"
        ? { name, phone, company: clean(body.company, 80), type: clean(body.type, 40), date: clean(body.date, 20), time: clean(body.time, 20), people: Math.max(1, Math.min(500, parseInt(body.people, 10) || 0)), notes: clean(body.notes, 500) }
        : { name, phone, role: clean(body.role, 40), availability: clean(body.availability, 60), experience: clean(body.experience, 500) };
      const id = rid();
      this.sql().exec("INSERT INTO requests (id,kind,created,status,data,ipH) VALUES (?,?,?,?,?,?)", id, kind, Date.now(), "nuevo", JSON.stringify(data), ipH);
      this.sql().exec("DELETE FROM requests WHERE created<?", Date.now() - 120 * 24 * 3600 * 1000);
      this.broadcast();
      return json({ ok: true, id });
    }

    // ---- mesa: carta, pedido, llamar mesero, pedir la cuenta ----
    if (p === "/mesa/state" && method === "GET") {
      const m = this.tableOk(url.searchParams.get("m"), url.searchParams.get("k"));
      if (!m) return json({ error: "Este QR no es válido. Pide ayuda al equipo." }, 404);
      return json(this.mesaState(m));
    }
    if (p === "/mesa/order" && method === "POST") {
      const M = this.s.mesas;
      const m = this.tableOk(body.m, body.k);
      if (!m) return json({ error: "Este QR no es válido. Pide ayuda al equipo." }, 404);
      if (this.closedMsg()) return json({ error: this.closedMsg() }, 409);
      if (!M.on) return json({ error: "Los pedidos desde la mesa están pausados. Llama al mesero, por favor." }, 409);
      if (M.mode !== "pedir") return json({ error: "En este momento el mesero toma tu orden. Usa el botón de llamar al mesero." }, 409);
      const sold = this.siteState().soldout;
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, 30).map((it) => ({ n: clean(it.n, 60), q: Math.max(1, Math.min(20, parseInt(it.q, 10) || 1)), note: clean(it.note, 80) })).filter((it) => it.n);
      if (!items.length) return json({ error: "Tu pedido está vacío." }, 400);
      const gone = items.find((it) => sold.includes(it.n));
      if (gone) return json({ error: gone.n + " se agotó hoy. Quítalo de tu pedido, por favor." }, 409);
      const ipH = await this.ipHash(request);
      if (request.headers.get("x-ip") && this.s.orders.filter((o) => o.ipH === ipH && Date.now() - o.t0 < 10 * 60000).length >= 6) return json({ error: "Ya enviaste varios pedidos seguidos. Llama al mesero si necesitas algo más." }, 429);
      this.s.orderSeq++;
      const o = { id: rid(), n: this.s.orderSeq, m, items, note: clean(body.note, 120), status: "nuevo", t0: Date.now(), tUpd: Date.now(), ipH };
      const r = this.memberRow(body.mid, body.mt);
      let visit = false;
      if (r) { o.mid = r.id; o.who = (r.name || "").split(" ")[0]; visit = this.visitFor(r); }
      this.s.orders.push(o);
      await this.save();
      this.notifyStaff(["cocina"], { title: "Nuevo pedido · Mesa " + m, body: this.itemsTxt(items), url: "/higuera/cocina/" });
      return json({ ok: true, order: this.orderView(o), member: r ? this.memberView(r) : null, visit });
    }
    if (p === "/mesa/call" && method === "POST") {
      const m = this.tableOk(body.m, body.k);
      if (!m) return json({ error: "Este QR no es válido. Pide ayuda al equipo." }, 404);
      const kind = body.kind === "cuenta" ? "cuenta" : "mesero";
      if (!body.cancel && this.closedMsg()) return json({ error: this.closedMsg() }, 409);
      if (body.cancel) {
        const c = this.s.calls.find((x) => x.id === body.cancel && x.m === m && x.status === "open");
        if (c) { c.status = "cancel"; c.tDone = Date.now(); await this.save(); }
        return json({ ok: true });
      }
      let c = this.s.calls.find((x) => x.m === m && x.kind === kind && x.status === "open");
      if (!c) {
        c = { id: rid(), m, kind, t0: Date.now(), status: "open" }; this.s.calls.push(c); await this.save();
        this.notifyStaff(["meseros"], { title: "Mesa " + m + (kind === "cuenta" ? " pide la cuenta" : " llama al mesero"), body: kind === "cuenta" ? "Lleva la cuenta a la mesa " + m + "." : "Pasa a la mesa " + m + ".", url: "/higuera/meseros/" });
      }
      return json({ ok: true, id: c.id });
    }

    if (p === "/mesa/review" && method === "POST") {
      const m = this.tableOk(body.m, body.k);
      if (!m) return json({ error: "Este QR no es válido. Pide ayuda al equipo." }, 404);
      const stars = Math.max(1, Math.min(5, parseInt(body.stars, 10) || 0));
      if (!parseInt(body.stars, 10)) return json({ error: "Elige de 1 a 5 estrellas." }, 400);
      const ipH = await this.ipHash(request);
      const s = this.s; s.reviews = s.reviews || [];
      // una calificación por mesa hasta que se cierre; si la cambia, se actualiza
      let r = s.reviews.find((x) => x.m === m && !x.closed && x.ipH === ipH);
      const mem = this.memberRow(body.mid, body.mt);
      if (!r) {
        if (request.headers.get("x-ip") && s.reviews.filter((x) => x.ipH === ipH && Date.now() - x.t < 3600000).length >= 4) return json({ error: "Ya recibimos tu calificación, gracias." }, 429);
        r = { id: rid(), m, t: Date.now(), day: s.day, ipH };
        s.reviews.push(r);
      }
      r.stars = stars; r.text = clean(body.text, 300); r.who = mem ? (mem.name || "").split(" ")[0] : ""; r.tUpd = Date.now();
      // calificación baja: alerta al gerente para que pase a la mesa antes de que el cliente se vaya
      const al = s.calls.find((c) => c.kind === "alerta" && c.rid === r.id && c.status === "open");
      if (stars <= 3 && !al) {
        s.calls.push({ id: rid(), m, kind: "alerta", t0: Date.now(), status: "open", rid: r.id, stars, text: r.text });
        this.notifyStaff(["meseros", "gerente"], { title: "Mesa " + m + " calificó " + stars + " de 5", body: (r.text ? "\"" + r.text + "\". " : "") + "Que pase el gerente a la mesa.", url: "/higuera/meseros/" });
      }
      else if (al) { if (stars > 3) { al.status = "done"; al.tDone = Date.now(); } else { al.stars = stars; al.text = r.text; } }
      s.reviews = s.reviews.slice(-300);
      await this.save();
      return json({ ok: true, low: stars <= 3, reviewUrl: s.mesas.reviewUrl });
    }

    // ---- club: registro, tarjeta, notificaciones ----
    if (p === "/club/join" && method === "POST") {
      const name = clean(body.name, 40), phone = digits(body.phone);
      if (name.length < 2) return json({ error: "Escribe tu nombre." }, 400);
      if (phone.length !== 10) return json({ error: "Escribe tu WhatsApp a 10 dígitos." }, 400);
      if (!body.privacy) return json({ error: "Acepta el aviso de privacidad para unirte." }, 400);
      const ex = this.sql().exec("SELECT id FROM members WHERE phone=?", phone).toArray()[0];
      if (ex) return json({ error: "Ese número ya tiene tarjeta del club. Pide en barra un código para recuperarla en este celular.", exists: true }, 409);
      const ipH = await this.ipHash(request);
      this.joinIps = (this.joinIps || []).filter((x) => Date.now() - x.t < 3600000);
      if (request.headers.get("x-ip") && this.joinIps.filter((x) => x.h === ipH).length >= 5) return json({ error: "Demasiados registros desde este celular. Intenta más tarde." }, 429);
      this.joinIps.push({ h: ipH, t: Date.now() });
      const id = rid(), tok = rid() + rid();
      this.sql().exec("INSERT INTO members (id,tok,phone,name,created,visits,total,lastDay,optin) VALUES (?,?,?,?,?,0,0,'',?)", id, tok, phone, name, Date.now(), body.optin ? 1 : 0);
      const r = this.memberRow(id, tok);
      // si se registra desde una mesa, esa visita ya cuenta
      if (this.tableOk(body.m, body.k)) this.visitFor(r);
      this.broadcast();
      return json({ ok: true, id, tok, member: this.memberView(r) });
    }
    if (p === "/club/me" && method === "POST") {
      const r = this.memberRow(body.id, body.tok);
      if (!r) return json({ error: "No encontramos tu tarjeta." }, 404);
      if (typeof body.optin === "boolean") { this.sql().exec("UPDATE members SET optin=? WHERE id=?", body.optin ? 1 : 0, r.id); r.optin = body.optin ? 1 : 0; this.broadcast(); }
      return json({ member: this.memberView(r) });
    }
    if (p === "/club/push" && method === "POST") {
      const r = this.memberRow(body.id, body.tok);
      if (!r) return json({ error: "No encontramos tu tarjeta." }, 404);
      let ep;
      try { ep = new URL(body.sub?.endpoint); } catch (x) { return json({ error: "Suscripción inválida" }, 400); }
      if (ep.protocol !== "https:" || !PUSH_HOSTS.some((rx) => rx.test(ep.hostname))) return json({ error: "Servicio de notificaciones no permitido" }, 400);
      this.sql().exec("UPDATE members SET push=NULL WHERE push=? AND id<>?", ep.toString(), r.id);
      this.sql().exec("UPDATE members SET push=? WHERE id=?", ep.toString(), r.id);
      r.push = ep.toString();
      this.broadcast();
      return json({ ok: true, member: this.memberView(r) });
    }
    if (p === "/club/recover" && method === "POST") {
      const phone = digits(body.phone), code = String(body.code || "").replace(/\D/g, "");
      const r = this.sql().exec("SELECT * FROM members WHERE phone=?", phone).toArray()[0];
      if (!r || !r.rcode || r.rexp < Date.now() || r.rcode !== code) {
        // tras 5 intentos fallidos el código se invalida y hay que pedir otro
        if (r && r.rcode) { this.recFails = this.recFails || {}; this.recFails[r.id] = (this.recFails[r.id] || 0) + 1; if (this.recFails[r.id] >= 5) { this.sql().exec("UPDATE members SET rcode=NULL, rexp=NULL WHERE id=?", r.id); this.recFails[r.id] = 0; } }
        return json({ error: "El código no es correcto o ya venció. Pide uno nuevo en barra." }, 400);
      }
      const tok = rid() + rid();
      this.sql().exec("UPDATE members SET tok=?, rcode=NULL, rexp=NULL WHERE id=?", tok, r.id);
      r.tok = tok;
      return json({ ok: true, id: r.id, tok, member: this.memberView(r) });
    }
    if (p === "/club/leave" && method === "POST") {
      const r = this.memberRow(body.id, body.tok);
      if (!r) return json({ error: "No encontramos tu tarjeta." }, 404);
      this.sql().exec("DELETE FROM members WHERE id=?", r.id);
      this.broadcast();
      return json({ ok: true });
    }

    // ---- push ----
    if (p === "/push/key" && method === "GET") return json({ key: (await this.vapid()).pub });
    if (p === "/push/sub" && method === "POST") {
      const e = this.s.entries.find((x) => x.id === body.id && ACTIVE.includes(x.status));
      if (!e) return json({ error: "No encontramos tu turno" }, 404);
      let ep;
      try { ep = new URL(body.sub?.endpoint); } catch (x) { return json({ error: "Suscripción inválida" }, 400); }
      if (ep.protocol !== "https:" || !PUSH_HOSTS.some((r) => r.test(ep.hostname))) return json({ error: "Servicio de notificaciones no permitido" }, 400);
      // un celular solo puede estar ligado a un turno a la vez
      this.s.entries.forEach((x) => { if (x !== e && x.push && x.push.endpoint === ep.toString()) delete x.push; });
      e.push = { endpoint: ep.toString() };
      delete e.pushFail;
      await this.save();
      return json({ ok: true });
    }
    if (p === "/push/msg" && method === "POST") {
      const sx = body.endpoint && (this.s.staff || []).find((x) => x.ep === body.endpoint && x.msg);
      if (sx) return json({ title: sx.msg.title, body: sx.msg.body, url: sx.msg.url, tag: "hg-staff-" + sx.msg.t });
      const e = body.endpoint && this.s.entries.filter((x) => x.push && x.push.endpoint === body.endpoint && x.pushMsg).sort((a, b) => b.pushMsg.t - a.pushMsg.t)[0];
      if (!e || !e.pushMsg) {
        const r = body.endpoint ? this.sql().exec("SELECT pmsg FROM members WHERE push=? AND pmsg IS NOT NULL", String(body.endpoint)).toArray()[0] : null;
        if (r) { const pm = JSON.parse(r.pmsg); return json({ title: pm.title, body: pm.body, url: pm.url, tag: "hg-club-" + pm.t }); }
        return json({ title: this.s.name + " · Lista de espera", body: "Revisa tu turno en la lista.", url: this.cfg.site });
      }
      const { title, body: b, url: u, kind } = e.pushMsg;
      return json({ title, body: b, url: u, tag: "hg-" + e.code + "-" + kind });
    }

    // ---- host ----
    if (p.startsWith("/host")) {
      const pin = request.headers.get("x-pin") || body.pin;
      if (p === "/host/claim" && method === "POST") {
        if (this.s.pinHash) {
          const c = await this.checkPin(pin);
          return c.ok ? json({ ok: true, state: this.hostState() }) : json({ error: c.locked ? "Demasiados intentos. Espera un minuto." : "PIN incorrecto" }, 401);
        }
        const np = String(body.pin || "");
        if (!/^\d{4,6}$/.test(np)) return json({ error: "El PIN debe ser de 4 a 6 números" }, 400);
        this.s.pinHash = await sha(this.s.salt + ":" + np);
        await this.save();
        return json({ ok: true, created: true, state: this.hostState() });
      }
      if (p === "/host/info" && method === "GET") return json({ hasPin: !!this.s.pinHash, name: this.s.name });
      const c = await this.checkPin(pin);
      if (!c.ok) return json({ error: c.locked ? "Demasiados intentos. Espera un minuto." : "PIN incorrecto" }, 401);

      if (p === "/host/state") return json(this.hostState());
      if (p === "/host/action" && method === "POST") {
        const e = this.s.entries.find((x) => x.id === body.id);
        if (!e) return json({ error: "No existe" }, 404);
        const now = Date.now();
        let pushed = null;
        if (body.action === "call" || body.action === "renotify") {
          if (body.action === "call") {
            e.status = "called"; e.tCalled = now; e.calls = 1;
            const mm = parseInt(body.mesa, 10);
            if (mm >= 1 && mm <= this.s.mesas.count) { e.mesa = mm; this.s.freed = (this.s.freed || []).filter((f) => f.m !== mm); }
          }
          else e.calls = (e.calls || 1) + 1;
          pushed = await this.sendPush(e, { kind: "call" + (e.calls || 1), title: "Tu mesa está lista, " + e.name, body: `${e.mesa ? "Pasa a la mesa " + e.mesa + ". " : ""}Te esperamos en la entrada de ${this.s.name} en los próximos ${this.s.tolerance} minutos. Tu turno: ${e.code}.`, url: this.cfg.site + "?t=" + e.id });
          if (body.action === "call") await this.notifyNext();
        }
        else if (body.action === "seat") {
          e.status = "seated"; e.tDone = now; await this.notifyNext();
          if (e.phone) { const r = this.sql().exec("SELECT * FROM members WHERE phone=?", e.phone).toArray()[0]; if (r && this.visitFor(r)) e.clubVisit = true; }
        }
        else if (body.action === "noshow") { e.status = "noshow"; e.tDone = now; await this.notifyNext(); }
        else if (body.action === "back") { e.status = "waiting"; delete e.tCalled; delete e.tDone; delete e.otw; delete e.here; }
        else if (body.action === "remove") { this.s.entries = this.s.entries.filter((x) => x.id !== e.id); await this.notifyNext(); }
        await this.save();
        return json({ ...this.hostState(), pushed });
      }
      if (p === "/host/add" && method === "POST") {
        const r = this.newEntry(body, "host");
        if (r.error) return json({ error: r.error }, 400);
        await this.save();
        return json(this.hostState());
      }
      if (p === "/host/settings" && method === "POST") {
        const s = this.s;
        if (typeof body.open === "boolean") s.open = body.open;
        if (typeof body.autoHours === "boolean") s.autoHours = body.autoHours;
        if (body.minsPerGroup != null) s.minsPerGroup = Math.max(2, Math.min(30, parseInt(body.minsPerGroup, 10) || 6));
        if (body.lastCall != null) s.lastCall = Math.max(0, Math.min(120, parseInt(body.lastCall, 10) || 0));
        if (body.tolerance != null) s.tolerance = Math.max(3, Math.min(30, parseInt(body.tolerance, 10) || 10));
        if (body.maxSize != null) s.maxSize = Math.max(2, Math.min(30, parseInt(body.maxSize, 10) || 10));
        await this.save();
        return json(this.hostState());
      }
      if (p === "/host/site" && method === "POST") {
        const st = this.s.site || (this.s.site = {});
        if (typeof body.notice === "string") st.notice = clean(body.notice, 140);
        if (body.season && typeof body.season === "object") {
          const imgs = ["waffle", "chilaquiles-xl", "sopa-xl", "latte", "enfrijoladas", "postre", "shakshouka", "sandwich", "barra-xl", "interior-xl"];
          st.season = { on: !!body.season.on, title: clean(body.season.title, 60), text: clean(body.season.text, 160), img: imgs.includes(body.season.img) ? body.season.img : "waffle" };
        }
        if (Array.isArray(body.soldout)) { st.soldout = body.soldout.map((x) => clean(x, 60)).filter(Boolean).slice(0, 60); st.soldDay = this.s.day; }
        await this.save();
        return json(this.hostState());
      }
      if (p === "/host/requests" && method === "GET") {
        const rows = this.sql().exec("SELECT id,kind,created,status,data FROM requests ORDER BY created DESC LIMIT 200").toArray().map((r) => ({ ...r, data: JSON.parse(r.data) }));
        return json({ rows });
      }
      if (p === "/host/request" && method === "POST") {
        if (body.action === "delete") this.sql().exec("DELETE FROM requests WHERE id=?", String(body.id));
        else if (["visto", "nuevo", "archivado"].includes(body.action)) this.sql().exec("UPDATE requests SET status=? WHERE id=?", body.action, String(body.id));
        this.broadcast();
        return json({ ok: true, newRequests: this.newRequests() });
      }
      if (p === "/host/contacts" && method === "GET") {
        const rows = this.sql().exec("SELECT phone,name,first,last,visits FROM contacts ORDER BY last DESC").toArray();
        return json({ rows });
      }
      if (p === "/host/demo" && method === "POST") {
        const names = [["Mariana", 2, "terraza", ["bebe"]], ["Diego", 4, "interior", []], ["Sofía", 3, "any", ["mascota"]], ["Rodrigo", 2, "barra", []], ["Valeria", 5, "interior", ["accesible"]], ["Andrés", 2, "any", []]];
        const now = Date.now();
        names.forEach(([n, sz, z, nd], i) => {
          const r = this.newEntry({ name: n, size: sz, zone: z, needs: nd, demo: true }, "demo");
          r.e.t0 = now - (names.length - i) * 4 * 60000;
        });
        [["Paola", 2, 21], ["Luis", 4, 33], ["Fer", 3, 26]].forEach(([n, sz, w], i) => {
          const r = this.newEntry({ name: n, size: sz, demo: true }, "demo");
          r.e.t0 = now - (90 - i * 15) * 60000; r.e.status = "seated"; r.e.tDone = r.e.t0 + w * 60000;
        });
        const ex = this.sql().exec("SELECT COUNT(*) AS n FROM requests WHERE ipH='demo'").one().n;
        if (!ex) {
          this.sql().exec("INSERT INTO requests (id,kind,created,status,data,ipH) VALUES (?,?,?,?,?,?)", rid(), "evento", now - 50 * 60000, "nuevo", JSON.stringify({ name: "Ana Treviño", phone: "8110000000", company: "Despacho Treviño", type: "Desayuno en oficina", date: "", time: "9:00", people: 18, notes: "Ejemplo: junta mensual, chilaquiles y café para todos." }), "demo");
          this.sql().exec("INSERT INTO requests (id,kind,created,status,data,ipH) VALUES (?,?,?,?,?,?)", rid(), "empleo", now - 3 * 3600000, "nuevo", JSON.stringify({ name: "Luis Garza", phone: "8120000000", role: "Barra", availability: "Fines de semana", experience: "Ejemplo: un año como barista." }), "demo");
        }
        await this.save();
        return json(this.hostState());
      }
      // ---- avisos en el celular del equipo ----
      if (p === "/host/push/sub" && method === "POST") {
        const role = ["cocina", "meseros", "gerente"].includes(body.role) ? body.role : "meseros";
        let ep;
        try { ep = new URL(body.sub?.endpoint); } catch (x) { return json({ error: "Suscripción inválida" }, 400); }
        if (ep.protocol !== "https:" || !PUSH_HOSTS.some((rx) => rx.test(ep.hostname))) return json({ error: "Servicio de notificaciones no permitido" }, 400);
        this.s.staff = (this.s.staff || []).filter((x) => x.ep !== ep.toString());
        this.s.staff.push({ ep: ep.toString(), role, t: Date.now() });
        this.s.staff = this.s.staff.slice(-40);
        await this.save();
        return json({ ok: true, count: this.s.staff.filter((x) => x.role === role).length });
      }
      if (p === "/host/push/off" && method === "POST") {
        this.s.staff = (this.s.staff || []).filter((x) => x.ep !== String(body.endpoint || ""));
        await this.save();
        return json({ ok: true });
      }
      if (p === "/host/push/test" && method === "POST") {
        const role = ["cocina", "meseros", "gerente"].includes(body.role) ? body.role : "meseros";
        this.notifyStaff([role], { title: "Prueba de aviso · " + role, body: "Si ves esto con el celular bloqueado, los avisos funcionan.", url: "/higuera/" + (role === "gerente" ? "club" : role) + "/" });
        return json({ ok: true });
      }
      if (p === "/host/freed" && method === "POST") {
        this.s.freed = (this.s.freed || []).filter((f) => f.m !== parseInt(body.m, 10));
        await this.save();
        return json(this.hostState());
      }
      // ---- mesas ----
      if (p === "/host/mesas" && method === "POST") {
        const M = this.s.mesas;
        if (typeof body.on === "boolean") M.on = body.on;
        if (["pedir", "llamar"].includes(body.mode)) M.mode = body.mode;
        if (body.count != null) M.count = Math.max(1, Math.min(60, parseInt(body.count, 10) || 12));
        if (body.rewardVisits != null) M.rewardVisits = Math.max(2, Math.min(20, parseInt(body.rewardVisits, 10) || 5));
        if (typeof body.rewardText === "string" && clean(body.rewardText, 60)) M.rewardText = clean(body.rewardText, 60);
        if (typeof body.onlyHours === "boolean") M.onlyHours = body.onlyHours;
        if (typeof body.reviewUrl === "string") { const u = body.reviewUrl.trim(); if (/^https:\/\/[^\s<>"]{6,400}$/.test(u)) M.reviewUrl = u; else return json({ error: "La liga de reseñas debe empezar con https://" }, 400); }
        if (body.rekey) { const n = parseInt(body.rekey, 10); if (n >= 1 && n <= M.count) M.keys[n] = rid().slice(0, 6); }
        this.ensureKeys();
        await this.save();
        return json(this.hostState());
      }
      if (p === "/host/order" && method === "POST") {
        const o = this.s.orders.find((x) => x.id === body.id);
        if (!o) return json({ error: "No existe" }, 404);
        const now = Date.now(), a = body.action;
        if (a === "start") o.status = "prep";
        else if (a === "ready") { o.status = "listo"; o.tReady = o.tReady || now; this.notifyStaff(["meseros"], { title: "Listo para llevar · Mesa " + o.m, body: this.itemsTxt(o.items), url: "/higuera/meseros/" }); }
        else if (a === "deliver") { o.status = "entregado"; o.tReady = o.tReady || now; }
        else if (a === "cancel") o.status = "cancelado";
        else if (a === "back") o.status = o.status === "entregado" ? "listo" : o.status === "listo" ? "prep" : "nuevo";
        o.tUpd = now;
        await this.save();
        return json(this.hostState());
      }
      if (p === "/host/call" && method === "POST") {
        const c = this.s.calls.find((x) => x.id === body.id);
        if (c && c.status === "open") { c.status = "done"; c.tDone = Date.now(); }
        await this.save();
        return json(this.hostState());
      }
      if (p === "/host/table" && method === "POST") {
        const m = parseInt(body.m, 10), now = Date.now();
        if (body.action === "close") {
          this.s.orders.forEach((o) => { if (o.m === m && !o.closed) { o.closed = true; o.tUpd = now; if (["nuevo", "prep", "listo"].includes(o.status)) o.status = "entregado"; } });
          this.s.calls.forEach((c) => { if (c.m === m && c.status === "open") { c.status = "done"; c.tDone = now; } });
          (this.s.reviews || []).forEach((r) => { if (r.m === m) r.closed = true; });
          this.s.freed = [...(this.s.freed || []).filter((f) => f.m !== m && now - f.t < 30 * 60000), { m, t: now }];
        }
        await this.save();
        return json(this.hostState());
      }
      // ---- club ----
      if (p === "/host/club" && method === "GET") {
        const rows = this.sql().exec("SELECT id,name,phone,created,visits,total,lastDay,optin,push,rewards,demo FROM members ORDER BY lastDay DESC, created DESC LIMIT 500").toArray().map((r) => ({ ...r, push: !!r.push }));
        return json({ rows, summary: this.clubSummary(), promos: (this.s.promos || []).slice(-8).reverse() });
      }
      if (p === "/host/club/member" && method === "POST") {
        const r = this.sql().exec("SELECT * FROM members WHERE id=?", String(body.id)).toArray()[0];
        if (!r) return json({ error: "No existe" }, 404);
        const need = this.s.mesas.rewardVisits;
        let extra = {};
        if (body.action === "visit") { if (!this.visitFor(r)) return json({ error: "Ya se le contó la visita de hoy." }, 409); }
        else if (body.action === "unvisit") this.sql().exec("UPDATE members SET visits=MAX(0,visits-1), total=MAX(0,total-1), lastDay=CASE WHEN lastDay=? THEN '' ELSE lastDay END WHERE id=?", this.s.day, r.id);
        else if (body.action === "redeem") {
          if (r.visits < need) return json({ error: "Todavía no junta las visitas." }, 409);
          this.sql().exec("UPDATE members SET visits=visits-?, rewards=rewards+1 WHERE id=?", need, r.id);
          r.visits -= need; r.rewards++;
          if (r.push) await this.pushMember(r, { title: "¡Disfrútalo, " + (r.name || "").split(" ")[0] + "!", body: "Canjeaste tu recompensa del Club " + this.s.name + ". Ya empezaste a juntar visitas para la siguiente.", url: "/higuera/mesa/?tab=club" });
        }
        else if (body.action === "code") {
          const code = String(Math.floor(100000 + Math.random() * 900000));
          this.sql().exec("UPDATE members SET rcode=?, rexp=? WHERE id=?", code, Date.now() + 15 * 60000, r.id);
          extra = { code };
        }
        else if (body.action === "delete") this.sql().exec("DELETE FROM members WHERE id=?", r.id);
        this.broadcast();
        return json({ ok: true, ...extra });
      }
      if (p === "/host/club/promo" && method === "POST") {
        const title = clean(body.title, 60), text = clean(body.body, 160);
        if (!title || !text) return json({ error: "Escribe el título y el mensaje." }, 400);
        const last = (this.s.promos || []).slice(-1)[0];
        if (last && Date.now() - last.t < 60000) return json({ error: "Espera un minuto antes de mandar otra promoción." }, 429);
        const rows = this.sql().exec("SELECT * FROM members WHERE optin=1 AND push IS NOT NULL").toArray();
        let ok = 0;
        for (let i = 0; i < rows.length; i += 10) {
          const res = await Promise.all(rows.slice(i, i + 10).map((r) => this.pushMember(r, { title, body: text, url: "/higuera/mesa/?tab=club" })));
          ok += res.filter(Boolean).length;
        }
        const pr = { t: Date.now(), title, body: text, sent: rows.length, ok, optin: this.clubSummary().optin };
        this.s.promos = [...(this.s.promos || []), pr].slice(-30);
        await this.save();
        return json({ ok: true, promo: pr, state: this.hostState() });
      }
      if (p === "/host/mesas/demo" && method === "POST") {
        const now = Date.now(), M = this.s.mesas;
        const mk = (m, items, status, ago, who) => { this.s.orderSeq++; this.s.orders.push({ id: rid(), n: this.s.orderSeq, m, items, note: "", status, t0: now - ago * 60000, tUpd: now - Math.max(0, ago - 3) * 60000, demo: true, who: who || "", tReady: status === "listo" || status === "entregado" ? now - Math.max(0, ago - 9) * 60000 : undefined }); };
        mk(2, [{ n: "Chilaquiles verdes", q: 2, note: "Uno sin cebolla" }, { n: "Latte", q: 2, note: "" }], "nuevo", 1, "Ana");
        mk(5, [{ n: "Buttermilk waffles", q: 1, note: "" }, { n: "Cold brew", q: 1, note: "" }, { n: "Sopa de tomate", q: 1, note: "" }], "prep", 7);
        mk(7, [{ n: "Enfrijoladas", q: 1, note: "" }, { n: "Honey lavender latte", q: 1, note: "Con leche de avena" }], "listo", 13, "Diego");
        mk(Math.min(9, M.count), [{ n: "French toast", q: 2, note: "" }, { n: "Americano", q: 2, note: "" }], "entregado", 26);
        this.s.calls.push({ id: rid(), m: Math.min(4, M.count), kind: "mesero", t0: now - 60000, status: "open", demo: true });
        this.s.calls.push({ id: rid(), m: Math.min(9, M.count), kind: "cuenta", t0: now - 30000, status: "open", demo: true });
        const rv = (m, stars, text, ago, who) => { const r = { id: rid(), m, t: now - ago * 60000, day: this.s.day, stars, text, who: who || "", demo: true, closed: m !== Math.min(11, M.count) }; this.s.reviews.push(r); return r; };
        rv(3, 5, "Los chilaquiles increíbles y nos atendieron rapidísimo.", 95, "Sofía"); rv(6, 4, "", 70); rv(8, 5, "", 40, "Rodrigo");
        const low = rv(Math.min(11, M.count), 2, "Tardaron mucho con los cafés.", 2);
        this.s.calls.push({ id: rid(), m: low.m, kind: "alerta", t0: now - 2 * 60000, status: "open", demo: true, rid: low.id, stars: 2, text: low.text });
        const ex = this.sql().exec("SELECT COUNT(*) AS n FROM members WHERE demo=1").one().n;
        if (!ex) {
          [["Ana Treviño", "8110000001", 4, 9], ["Diego Garza", "8110000002", 2, 2], ["Sofía Cantú", "8110000003", 5, 11], ["Rodrigo Leal", "8110000004", 1, 1]].forEach(([n, ph, v, t], i) => {
            this.sql().exec("INSERT OR IGNORE INTO members (id,tok,phone,name,created,visits,total,lastDay,optin,demo) VALUES (?,?,?,?,?,?,?,?,?,1)", rid(), rid(), ph, n, now - (40 - i * 8) * 86400000, v, t, i < 2 ? this.s.day : "", i === 3 ? 0 : 1);
          });
        }
        await this.save();
        return json(this.hostState());
      }
      if (p === "/host/reset" && method === "POST" && body.only === "mesas") {
        // solo borra lo de ejemplo de mesas y club; no toca la lista de espera ni datos reales
        this.s.orders = this.s.orders.filter((o) => !o.demo);
        this.s.calls = this.s.calls.filter((c) => !c.demo);
        this.s.reviews = (this.s.reviews || []).filter((r) => !r.demo);
        try { this.sql().exec("DELETE FROM members WHERE demo=1"); } catch (e) {}
        await this.save();
        return json(this.hostState());
      }
      if (p === "/host/reset" && method === "POST") {
        this.s.entries = []; this.s.counter = 0; this.s.open = true;
        this.s.orders = []; this.s.calls = []; this.s.orderSeq = 0; this.s.reviews = []; this.s.freed = [];
        try { this.sql().exec("DELETE FROM requests WHERE ipH='demo'"); this.sql().exec("DELETE FROM members WHERE demo=1"); } catch (e) {}
        if (body.history) this.s.history = [];
        await this.save();
        return json(this.hostState());
      }
      return json({ error: "Ruta no encontrada" }, 404);
    }
    return json({ error: "Ruta no encontrada" }, 404);
  }

  async webSocketMessage(ws, msg) {
    let m = {};
    try { m = JSON.parse(msg); } catch (e) { return; }
    const a = ws.deserializeAttachment() || {};
    await this.load(a.room || "higuera");
    this.rollDay();
    if (m.t === "auth" && a.role === "host") {
      const c = await this.checkPin(m.pin);
      a.ok = c.ok; ws.serializeAttachment(a);
      ws.send(JSON.stringify(c.ok ? { t: "host", d: this.hostState() } : { t: "err", d: "PIN incorrecto" }));
    } else if (m.t === "mine") {
      a.mine = m.id || null; ws.serializeAttachment(a);
      ws.send(JSON.stringify({ t: "pub", d: this.publicState(a.mine) }));
    } else if (m.t === "ping") ws.send('{"t":"pong"}');
  }

  async webSocketClose(ws) { try { ws.close(); } catch (e) {} }
}
