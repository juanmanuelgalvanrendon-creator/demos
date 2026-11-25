/* Higuera · fila virtual — cliente de la API (compartido por las páginas) */
(function () {
  const ROOM = "higuera";
  const BASE = "/api/fila/" + ROOM;

  async function api(path, opt = {}) {
    const h = { "content-type": "application/json" };
    if (opt.pin) h["x-pin"] = opt.pin;
    const r = await fetch(BASE + path, { method: opt.body ? "POST" : opt.method || "GET", headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined, cache: "no-store" });
    let d = {};
    try { d = await r.json(); } catch (e) {}
    if (!r.ok) { const err = new Error(d.error || "No se pudo conectar"); err.status = r.status; throw err; }
    return d;
  }

  // Conexión en vivo: WebSocket con reconexión y, si falla, consulta cada pocos segundos.
  function live({ role = "guest", mine = null, pin = null, onData, onStatus }) {
    let ws = null, alive = false, stopped = false, retry = 0, pollT = null, pingT = null;
    const status = (s) => onStatus && onStatus(s);
    const poll = async () => {
      if (stopped || alive) return;
      try {
        const d = role === "host" ? await api("/host/state", { pin }) : await api("/state" + (mine ? "?mine=" + mine : ""));
        onData(d); status("poll");
      } catch (e) { status("off"); if (e.status === 401) onData({ authError: true }); }
      pollT = setTimeout(poll, document.hidden ? 15000 : 4000);
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
    get(k) { try { return localStorage.getItem("hg_" + k); } catch (e) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem("hg_" + k) : localStorage.setItem("hg_" + k, v); } catch (e) {} },
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ago = (t, now = Date.now()) => { const m = Math.max(0, Math.floor((now - t) / 60000)); return m < 1 ? "ahora" : m < 60 ? m + " min" : Math.floor(m / 60) + " h " + (m % 60) + " min"; };
  const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const ZONES = { any: "Lo primero que se libere", interior: "Interior", terraza: "Terraza", barra: "Barra" };

  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.append(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600);
  }

  let actx = null;
  function beep(n = 3) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const now = actx.currentTime;
      for (let i = 0; i < n; i++) {
        [660, 880].forEach((f, j) => {
          const o = actx.createOscillator(), g = actx.createGain();
          o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(actx.destination);
          const st = now + i * 0.55 + j * 0.16;
          g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.25, st + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.28);
          o.start(st); o.stop(st + 0.3);
        });
      }
    } catch (e) {}
  }
  function unlockAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch (e) {} }

  function qrSvg(text, opts = {}) {
    if (!window.qrcode) return "";
    const q = window.qrcode(0, "M"); q.addData(text); q.make();
    const n = q.getModuleCount(), m = opts.margin ?? 2, size = n + m * 2;
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="Código QR"><rect width="${size}" height="${size}" fill="${opts.bg || "#fff"}"/><path d="${d}" fill="${opts.fg || "#1c1b17"}"/></svg>`;
  }

  window.HG = { api, live, store, esc, ago, mmss, ZONES, toast, beep, unlockAudio, qrSvg, ROOM };
})();
