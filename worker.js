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
      site: { notice: "", season: { on: true, title: "Buttermilk waffle con moras", text: "El destacado de la semana. El equipo lo cambia cuando quiera desde su panel.", img: "waffle" }, soldout: [], soldDay: "" },
    };
    this.s = { ...base, ...((await this.ctx.storage.get("s")) || {}) };
    this.cfg = cfg;
    this.rollDay();
    return this.s;
  }

  sql() {
    if (!this.sqlReady) {
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS contacts (phone TEXT PRIMARY KEY, name TEXT, first TEXT, last TEXT, visits INTEGER DEFAULT 1)");
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, kind TEXT, created INTEGER, status TEXT, data TEXT, ipH TEXT)");
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
    const st = this.statsFor(s.entries, s.day);
    if (st.joined) s.history = [...s.history.filter((h) => h.day !== s.day), st].slice(-60);
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
          id: me.id, code: me.code, name: me.name, size: me.size, zone: me.zone, status: me.status, otw: !!me.otw, here: !!me.here,
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
    };
  }

  broadcast() {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const a = ws.deserializeAttachment() || {};
        if (a.role === "host") { if (a.ok) ws.send(JSON.stringify({ t: "host", d: this.hostState() })); }
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
      const role = url.searchParams.get("role") === "host" ? "host" : "guest";
      server.serializeAttachment({ role, room, mine: url.searchParams.get("mine") || null, ok: false });
      if (role === "guest") server.send(JSON.stringify({ t: "pub", d: this.publicState(url.searchParams.get("mine")) }));
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
      const e = body.endpoint && this.s.entries.filter((x) => x.push && x.push.endpoint === body.endpoint && x.pushMsg).sort((a, b) => b.pushMsg.t - a.pushMsg.t)[0];
      if (!e || !e.pushMsg) return json({ title: this.s.name + " · Lista de espera", body: "Revisa tu turno en la lista.", url: this.cfg.site });
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
          if (body.action === "call") { e.status = "called"; e.tCalled = now; e.calls = 1; }
          else e.calls = (e.calls || 1) + 1;
          pushed = await this.sendPush(e, { kind: "call" + (e.calls || 1), title: "Tu mesa está lista, " + e.name, body: `Te esperamos en la entrada de ${this.s.name} en los próximos ${this.s.tolerance} minutos. Tu turno: ${e.code}.`, url: this.cfg.site + "?t=" + e.id });
          if (body.action === "call") await this.notifyNext();
        }
        else if (body.action === "seat") { e.status = "seated"; e.tDone = now; await this.notifyNext(); }
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
      if (p === "/host/reset" && method === "POST") {
        this.s.entries = []; this.s.counter = 0; this.s.open = true;
        try { this.sql().exec("DELETE FROM requests WHERE ipH='demo'"); } catch (e) {}
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
