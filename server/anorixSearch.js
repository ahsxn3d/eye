/** Anorix Eye place search: Nominatim + Photon + Open-Meteo, deduped and ranked. */
const UA = 'AnorixEye/1.0 (https://anorix.dev)';
const cache = new Map();
async function getJson(url, ms = 6000) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
async function nominatim(q) {
  const d = await getJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&accept-language=en&q=${encodeURIComponent(q)}`);
  return d.map((h) => ({ name: h.name || h.display_name.split(',')[0], label: h.display_name, lat: +h.lat, lon: +h.lon, kind: h.addresstype || h.type, country: h.address?.country || '', bbox: h.boundingbox?.map(Number), score: (h.importance || 0.2) * 1.4, pop: 0, src: 'nominatim' }));
}
async function photon(q) {
  const d = await getJson(`https://photon.komoot.io/api/?limit=8&lang=en&q=${encodeURIComponent(q)}`);
  return (d.features || []).map((f, i) => {
    const p = f.properties; const [lon, lat] = f.geometry.coordinates;
    const label = [p.name, p.city !== p.name ? p.city : '', p.state, p.country].filter(Boolean).join(', ');
    const e = p.extent; // [minLon, maxLat, maxLon, minLat]
    return { name: p.name, label, lat, lon, kind: p.osm_value || p.type, country: p.country || '', bbox: e ? [e[3], e[1], e[0], e[2]] : null, score: 0.5 - i * 0.05, pop: 0, src: 'photon' };
  });
}
async function openMeteo(q) {
  const d = await getJson(`https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&name=${encodeURIComponent(q)}`);
  return (d.results || []).map((h) => ({ name: h.name, label: [h.name, h.admin2, h.admin1, h.country].filter(Boolean).join(', '), lat: h.latitude, lon: h.longitude, kind: h.feature_code || 'place', country: h.country || '', bbox: null, score: 0.2, pop: h.population || 0, src: 'open-meteo' }));
}
function dist(a, b) { const dx = (a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180); const dy = a.lat - b.lat; return Math.hypot(dx, dy); }
export async function searchPlaces(q) {
  const key = norm(q);
  if (cache.has(key)) return cache.get(key);
  const settled = await Promise.allSettled([nominatim(q), photon(q), openMeteo(q)]);
  const all = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : [])).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon) && r.name);
  const qn = key, first = qn.split(' ')[0];
  const groups = [];
  for (const r of all) {
    const nn = norm(r.name);
    let s = r.score;
    if (nn === qn) s += 0.6; else if (nn.startsWith(qn) || qn.startsWith(nn)) s += 0.35; else if (nn.includes(first)) s += 0.15; else s -= 0.2;
    if (norm(r.label).includes(qn)) s += 0.1;
    if (/^(city|town|ppla?\d?|pplc|administrative|state|country)$/i.test(r.kind)) s += 0.2;
    else if (/village|hamlet|suburb|neighbourhood|locality|ppl/i.test(r.kind)) s += 0.05;
    else if (/fort|attraction|building|monument|tower/i.test(r.kind) && nn !== qn) s -= 0.3;
    if (/pakistan|india|bangladesh/i.test(r.country)) s += 0.08;
    s += Math.min(0.9, Math.log10((r.pop || 0) + 1) / 7);
    const g = groups.find((x) => norm(x.name) === nn && dist(x, r) < 0.25) || groups.find((x) => dist(x, r) < 0.02);
    if (g) { g.pop = Math.max(g.pop || 0, r.pop || 0); g.score = Math.max(g.score, s) + 0.12 + Math.min(0.9, Math.log10((r.pop || 0) + 1) / 7) * (g.pop === r.pop && r.pop ? 1 : 0); g.srcs.add(r.src); if (!g.bbox && r.bbox) g.bbox = r.bbox; if (r.src === 'nominatim') { g.label = r.label; } }
    else groups.push({ ...r, score: s, srcs: new Set([r.src]) });
  }
  const out = groups.sort((a, b) => b.score - a.score).slice(0, 8).map(({ srcs, score, src, pop, ...r }) => ({ ...r, sources: [...srcs], score: +score.toFixed(3) }));
  cache.set(key, out);
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return out;
}
export function anorixSearchPlugin() {
  const install = (mw) => mw.use('/api/anorix/search', async (req, res) => {
    const q = new URL(req.url || '', 'http://x').searchParams.get('q')?.trim().slice(0, 120) || '';
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (q.length < 2) { res.end('{"results":[]}'); return; }
    try { res.end(JSON.stringify({ results: await searchPlaces(q) })); }
    catch (e) { res.statusCode = 200; res.end(JSON.stringify({ results: [], error: 'search unavailable' })); }
  });
  return { name: 'anorix-search', configureServer(s) { install(s.middlewares); }, configurePreviewServer(s) { install(s.middlewares); } };
}
