/* Higuera · "la mejor hora para venir": datos reales de la lista y un estimado mientras no haya historial */
window.HORAS = (() => {
  const OPEN = [[8, 16], [8, 16], [8, 16], [8, 16], [8, 16], [8, 17], [8, 17]];
  // estimado típico de un lugar de desayunos (grupos que llegan por hora); se reemplaza con datos reales
  const EST_WD = { 8: 1.2, 9: 2.2, 10: 3, 11: 2.6, 12: 2.1, 13: 2.6, 14: 2, 15: 1 };
  const EST_WE = { 8: 2, 9: 4.2, 10: 6.2, 11: 7, 12: 6.1, 13: 5, 14: 4, 15: 2.8, 16: 1.4 };
  const MIN_DAYS = 3;
  let data = null, waiters = [];
  async function load() {
    try { const r = await fetch("/api/fila/higuera/stats/hours", { cache: "no-store" }); if (r.ok) data = await r.json(); } catch (e) {}
    waiters.forEach((f) => f()); waiters = [];
  }
  function ready(f) { if (data !== null) f(); else waiters.push(f); }
  function curve(wd) {
    const [o, c] = OPEN[wd], real = data && data.days && data.days[wd] >= MIN_DAYS, src = real ? data.avg[wd] : wd >= 5 ? EST_WE : EST_WD;
    const hours = []; for (let h = o; h < c; h++) hours.push({ h, v: +(src[h] || 0) });
    return { hours, real, days: data && data.days ? data.days[wd] : 0 };
  }
  function summary(wd) {
    const { hours, real } = curve(wd);
    const usable = hours.slice(0, -1);
    const peak = hours.reduce((a, b) => (b.v > a.v ? b : a), hours[0]);
    const best = usable.reduce((a, b) => (b.v < a.v ? b : a), usable[0]);
    return { best: best.h, peak: peak.h, real };
  }
  const hr = (x) => (x > 12 ? x - 12 : x) + (x >= 12 ? " pm" : " am");
  load();
  return { OPEN, curve, summary, ready, hr };
})();
