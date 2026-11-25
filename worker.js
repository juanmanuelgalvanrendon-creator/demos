// Code Nova · servidor de las demos
// Sirve las páginas estáticas y la API de fila virtual (/api/fila/<negocio>/...).
// Cada negocio tiene su propia fila guardada en un Durable Object.

const ROOMS = {
  higuera: { name: "Higuera", tz: "America/Monterrey", minsPerGroup: 6 },
};

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
      return stub.fetch(new Request(fwd.toString(), request));
    }
    if (url.pathname === "/api/ping") return json({ ok: true, t: Date.now() });
    return env.ASSETS.fetch(request);
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
function dayKey(tz, t = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
}
function hourOf(tz, t) {
  return +new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date(t));
}
const ACTIVE = ["waiting", "called"];

/* ---------------- Durable Object ---------------- */
export class Fila {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.s = null;
    this.fails = 0;
    this.lockUntil = 0;
  }

  async load(room) {
    if (this.s) return this.s;
    const cfg = ROOMS[room] || { tz: "America/Monterrey", minsPerGroup: 6, name: room };
    this.s = (await this.ctx.storage.get("s")) || {
      room, name: cfg.name, tz: cfg.tz, open: true, minsPerGroup: cfg.minsPerGroup,
      pinHash: null, salt: rid(), counter: 0, day: dayKey(cfg.tz), entries: [], history: [], v: 1,
    };
    this.rollDay();
    return this.s;
  }

  rollDay() {
    const s = this.s;
    const today = dayKey(s.tz);
    if (s.day === today) return;
    const st = this.statsFor(s.entries, s.day);
    if (st.joined) s.history = [...s.history.filter((h) => h.day !== s.day), st].slice(-30);
    s.entries = [];
    s.counter = 0;
    s.day = today;
    s.v++;
  }

  async save() {
    this.s.v++;
    await this.ctx.storage.put("s", this.s);
    this.broadcast();
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
    return { day, joined: real.length, seated: seated.length, people, lost: lost.length, avgWait: avg, byHour, optin };
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

  publicState(mineId) {
    const s = this.s;
    const q = this.queue();
    const per = this.estimate();
    const waitingAhead = q.filter((e) => e.status === "waiting").length;
    const out = {
      v: s.v, name: s.name, open: s.open, now: Date.now(),
      waiting: waitingAhead, estWait: waitingAhead ? Math.max(5, Math.round((waitingAhead + 1) * per)) : 0,
      queue: q.map((e) => ({ code: e.code, size: e.size, status: e.status, initial: (e.name[0] || "").toUpperCase() })),
    };
    if (mineId) {
      const me = s.entries.find((e) => e.id === mineId);
      if (me) {
        const ahead = q.filter((e) => e.status === "waiting" && e.t0 < me.t0).length;
        out.mine = {
          id: me.id, code: me.code, name: me.name, size: me.size, zone: me.zone, status: me.status, otw: !!me.otw, hasPhone: !!me.phone,
          t0: me.t0, tCalled: me.tCalled || null, ahead, eta: me.status === "waiting" ? Math.max(3, Math.round((ahead + 1) * per)) : 0,
        };
      } else out.mine = { gone: true };
    }
    return out;
  }

  hostState() {
    const s = this.s;
    return {
      v: s.v, name: s.name, open: s.open, minsPerGroup: s.minsPerGroup, now: Date.now(), per: this.estimate(),
      queue: this.queue(),
      done: s.entries.filter((e) => !ACTIVE.includes(e.status)).sort((a, b) => b.tDone - a.tDone).slice(0, 30),
      today: this.statsFor(s.entries, s.day), history: s.history.slice(-14),
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
    const size = Math.max(1, Math.min(20, parseInt(b.size, 10) || 2));
    if (!name) return { error: "Escribe tu nombre" };
    const zones = ["any", "interior", "terraza", "barra"];
    s.counter++;
    const e = {
      id: rid(), code: "H-" + String(s.counter).padStart(3, "0"), name, size,
      phone: digits(b.phone), zone: zones.includes(b.zone) ? b.zone : "any", optin: !!b.optin,
      status: "waiting", t0: Date.now(), src, demo: !!b.demo,
      posAtJoin: this.queue().filter((x) => x.status === "waiting").length + 1,
    };
    s.entries.push(e);
    return { e };
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
      if (!this.s.open) return json({ error: "La fila está pausada por el momento." }, 409);
      if (this.queue().length >= 80) return json({ error: "La fila está llena, intenta en unos minutos." }, 409);
      const r = this.newEntry(body, "qr");
      if (r.error) return json({ error: r.error }, 400);
      await this.save();
      return json({ id: r.e.id, code: r.e.code });
    }

    const meM = p.match(/^\/me\/([a-z0-9]+)$/);
    if (meM && method === "POST") {
      const e = this.s.entries.find((x) => x.id === meM[1]);
      if (!e) return json({ error: "No encontramos tu turno" }, 404);
      if (body.action === "otw" && ACTIVE.includes(e.status)) e.otw = true;
      else if (body.action === "cancel" && ACTIVE.includes(e.status)) { e.status = "cancelled"; e.tDone = Date.now(); }
      else if (body.action === "here" && ACTIVE.includes(e.status)) e.here = true;
      await this.save();
      return json({ ok: true });
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
        if (body.action === "call") { e.status = "called"; e.tCalled = now; }
        else if (body.action === "seat") { e.status = "seated"; e.tDone = now; }
        else if (body.action === "noshow") { e.status = "noshow"; e.tDone = now; }
        else if (body.action === "back") { e.status = "waiting"; delete e.tCalled; delete e.tDone; }
        else if (body.action === "remove") { this.s.entries = this.s.entries.filter((x) => x.id !== e.id); }
        await this.save();
        return json(this.hostState());
      }
      if (p === "/host/add" && method === "POST") {
        const r = this.newEntry(body, "host");
        if (r.error) return json({ error: r.error }, 400);
        await this.save();
        return json(this.hostState());
      }
      if (p === "/host/settings" && method === "POST") {
        if (typeof body.open === "boolean") this.s.open = body.open;
        if (body.minsPerGroup) this.s.minsPerGroup = Math.max(2, Math.min(30, parseInt(body.minsPerGroup, 10) || 6));
        await this.save();
        return json(this.hostState());
      }
      if (p === "/host/demo" && method === "POST") {
        const names = [["Mariana", 2, "terraza"], ["Diego", 4, "interior"], ["Sofía", 3, "any"], ["Rodrigo", 2, "barra"], ["Valeria", 5, "interior"], ["Andrés", 2, "any"]];
        const now = Date.now();
        names.forEach(([n, sz, z], i) => {
          const r = this.newEntry({ name: n, size: sz, zone: z, demo: true }, "demo");
          r.e.t0 = now - (names.length - i) * 4 * 60000;
        });
        // unas mesas ya sentadas para que el resumen tenga números
        [["Paola", 2, 21], ["Luis", 4, 33], ["Fer", 3, 26]].forEach(([n, sz, w], i) => {
          const r = this.newEntry({ name: n, size: sz, demo: true }, "demo");
          r.e.t0 = now - (90 - i * 15) * 60000; r.e.status = "seated"; r.e.tDone = r.e.t0 + w * 60000;
        });
        await this.save();
        return json(this.hostState());
      }
      if (p === "/host/reset" && method === "POST") {
        this.s.entries = []; this.s.counter = 0; this.s.open = true;
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
