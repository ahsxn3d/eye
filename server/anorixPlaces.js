/** Anorix Eye category search: "schools in Lahore" -> every matching place (Overpass, Photon, Nominatim; OSM data, ODbL). */
import { parseCategory } from "../src/categories.js";
const UA = "AnorixEye/1.0 (+https://anorix.dev; hello@anorix.dev)";
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const cache = /* @__PURE__ */ new Map();
let nominatimNext = 0;
async function getJson(url, ms, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store", headers: { "User-Agent": UA, Accept: "application/json", "Accept-Language": "en", ...init?.headers ?? {} } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
async function nominatim(params) {
  const wait = nominatimNext - Date.now();
  nominatimNext = Math.max(Date.now(), nominatimNext) + 1100;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 2500)));
  const search = new URLSearchParams({ format: "jsonv2", "accept-language": "en", ...params });
  return await getJson(`https://nominatim.openstreetmap.org/search?${search}`, 7e3) ?? [];
}
async function areaFor(place) {
  const hits = await nominatim({ q: place, limit: "1" });
  const hit = hits[0];
  if (!hit?.boundingbox) return null;
  const [s, n, w, e] = hit.boundingbox.map(Number);
  const lat = Number(hit.lat), lng = Number(hit.lon);
  const half = 0.35;
  return {
    bbox: [Math.max(w, lng - half), Math.max(s, lat - half), Math.min(e, lng + half), Math.min(n, lat + half)],
    label: hit.name || hit.display_name.split(", ")[0]
  };
}
async function overpass(tags, bbox, limit) {
  const [w, s, e, n] = bbox.map((v) => v.toFixed(4));
  const box = `(${s},${w},${n},${e})`;
  const body = `[out:json][timeout:8];(${tags.map((t) => `nwr${t}["name"]${box};`).join("")});out center ${limit};`;
  for (const endpoint of OVERPASS) {
    const data = await getJson(endpoint, 9e3, { method: "POST", body: new URLSearchParams({ data: body }), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    if (!data?.elements) continue;
    return data.elements.map((el) => {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      const t = el.tags ?? {};
      const kind = t.amenity ?? t.tourism ?? t.leisure ?? t.shop ?? t.railway ?? t.aeroway ?? "place";
      const detail = [t["addr:street"], t["addr:city"] ?? t["addr:district"]].filter(Boolean).join(", ");
      return { id: `${el.type}${el.id}`, name: t["name:en"] ?? t.name ?? "", detail, lat, lng, kind: kind.replace(/_/g, " ") };
    }).filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }
  return null;
}
function photonTags(tags) {
  const out = [];
  for (const tag of tags) {
    const m = tag.match(/^\["(\w+)"(=|~)"\^?\(?([^"$)]+)\)?\$?"\]/);
    if (!m) continue;
    for (const value of m[3].split("|")) out.push(`${m[1]}:${value}`);
  }
  return out;
}
async function photonCategory(words, tags, bbox, place) {
  const osmTags = photonTags(tags).slice(0, 5);
  const runs = (osmTags.length ? osmTags : [""]).map(async (osmTag) => {
    const term = osmTag ? osmTag.split(":")[1].replace(/_/g, " ") : words[0];
    const params = new URLSearchParams({ q: place ? `${term} ${place}` : term, limit: osmTags.length > 1 ? "30" : "50", lang: "en" });
    if (osmTag) params.set("osm_tag", osmTag);
    if (bbox) params.set("bbox", bbox.map((v) => v.toFixed(4)).join(","));
    const data = await getJson(`https://photon.komoot.io/api/?${params}`, 8e3);
    return (data?.features ?? []).map((f) => {
      const p = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      const detail = [p.street, p.district ?? p.city].filter(Boolean).map(String).join(", ");
      return { id: `p${p.osm_type}${p.osm_id}`, name: String(p.name ?? ""), detail, lat, lng, kind: String(p.osm_value ?? "place").replace(/_/g, " ") };
    });
  });
  const seen = /* @__PURE__ */ new Set();
  return (await Promise.all(runs)).flat().filter((h) => h.name && Number.isFinite(h.lat) && !seen.has(h.id) && seen.add(h.id) !== void 0);
}
async function findPlaces(url) {
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
  const parsed = parseCategory(q);
  if (!parsed) return { category: null, places: [] };
  const { category, place } = parsed;
  let bbox = null;
  let where = "this area";
  if (place) {
    const area = await areaFor(place);
    if (!area) return { category: category.label, where: place, places: [], message: `Couldn't find "${place}".` };
    bbox = area.bbox;
    where = area.label;
  } else {
    const raw = (url.searchParams.get("bbox") ?? "").split(",").map(Number);
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    if (raw.length === 4 && raw.every(Number.isFinite)) {
      const [w, s, e, n] = raw;
      const cx = (w + e) / 2, cy = (s + n) / 2;
      const half = Math.min(0.35, Math.max(e - w, n - s) / 2);
      bbox = e - w > 0.7 || n - s > 0.7 ? [cx - half, cy - half, cx + half, cy + half] : [w, s, e, n];
      where = e - w > 0.7 || n - s > 0.7 ? "the map centre" : "this view";
    } else if (Number.isFinite(lat) && Number.isFinite(lng) && url.searchParams.has("lat")) {
      bbox = [lng - 0.1, lat - 0.1, lng + 0.1, lat + 0.1];
      where = "you";
    }
  }
  const key = `${category.id}|${bbox?.map((v) => v.toFixed(2)).join(",") ?? "world"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 15 * 6e4) return hit.body;
  const [fromOverpass, fromPhoton] = await Promise.all([
    bbox ? overpass(category.tags, bbox, 200) : Promise.resolve(null),
    photonCategory(category.words, category.tags, bbox, null)
  ]);
  let places = fromOverpass?.length ? fromOverpass : fromPhoton;
  if (!places.length) {
    const term = category.words[0];
    const params = { q: place ? `${term} in ${place}` : term, limit: "40" };
    if (bbox && !place) {
      params.viewbox = bbox.join(",");
      params.bounded = "1";
    }
    places = (await nominatim(params)).map((h) => ({ id: `n${h.osm_type}${h.osm_id}`, name: h.name || h.display_name.split(", ")[0], detail: h.display_name.split(", ").slice(1, 3).join(", "), lat: Number(h.lat), lng: Number(h.lon), kind: h.type.replace(/_/g, " ") }));
  }
  const body = { category: category.label, where, places: places.slice(0, 200), total: places.length };
  if (places.length) {
    cache.set(key, { at: Date.now(), body });
    if (cache.size > 300) cache.delete(cache.keys().next().value);
  }
  return body;
}
function anorixPlacesPlugin() {
  const install = (mw) => mw.use("/api/anorix/places", async (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    try {
      res.end(JSON.stringify(await findPlaces(new URL(req.url || "", "http://x"))));
    } catch {
      res.end(JSON.stringify({ category: null, places: [], message: "Place search is unavailable right now." }));
    }
  });
  return { name: "anorix-places", configureServer(s) {
    install(s.middlewares);
  }, configurePreviewServer(s) {
    install(s.middlewares);
  } };
}
export {
  anorixPlacesPlugin,
  findPlaces
};
