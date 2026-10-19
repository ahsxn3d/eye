import * as Cesium from 'cesium';
import { installAnorixShell } from './anorixShell.js';
/** Anorix Eye: details card, panel-aware centering, far-zoom label declutter. */
const FAR_M = 2_500_000;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function textOf(html) {
  const d = document.createElement('div');
  d.innerHTML = String(html || '');
  return d.textContent.replace(/\s+/g, ' ').trim();
}
function rowsFromEntity(entity, time) {
  const rows = [];
  const props = entity?.properties;
  if (props?.propertyNames) {
    for (const k of props.propertyNames) {
      if (rows.length >= 8) break;
      let v = props[k]?.getValue ? props[k].getValue(time) : props[k];
      if (v == null || v === '' || typeof v === 'object') continue;
      if (/id$/i.test(k) && k.length > 2) continue;
      if (k === 'time' && Number(v) > 1e11) v = new Date(Number(v)).toLocaleString();
      if (k === 'depth') v = `${v} km`;
      const label = { mag: 'Magnitude' }[k] || k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ');
      rows.push([label, String(v).slice(0, 60)]);
    }
  }
  return rows;
}
export function installAnorixEye(viewer) {
  const shell = installAnorixShell(viewer, Cesium);
  const card = document.createElement('aside');
  card.id = 'anorix-card';
  card.hidden = true;
  document.body.appendChild(card);
  const close = () => { card.hidden = true; shell.hideDetail(); };
  card.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  function show(title, kicker, rows, note) {
    card.innerHTML = `<button data-close aria-label="Close">×</button>
      <p class="ak">${esc(kicker)}</p><h2>${esc(title)}</h2>
      ${note ? `<p class="an">${esc(note)}</p>` : ''}
      <dl>${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
    card.hidden = true;
    shell.showDetail({ title, kicker, rows, note });
  }
  function describe(picked) {
    const time = viewer.clock.currentTime;
    const entity = picked?.id instanceof Cesium.Entity ? picked.id : null;
    const raw = typeof picked?.id === 'string' ? picked.id : picked?.primitive?.id;
    const ent = entity || (raw instanceof Cesium.Entity ? raw : null);
    const pv = (k) => { const p = ent?.properties?.[k]; return p?.getValue ? p.getValue(viewer.clock.currentTime) : p; };
    const title = ent?.name || pv('place') || pv('callsign') || pv('name') || pv('title') || (typeof raw === 'string' ? raw : '') || picked?.primitive?.text || (ent && typeof ent.id === 'string' ? ent.id : '');
    if (typeof raw === 'number' || (typeof raw === 'string' && /^\d{3,6}$/.test(raw))) {
      const sat = globalThis.__anorixSatNames?.get(raw) || globalThis.__anorixSatNames?.get(Number(raw));
      const rows = [['NORAD ID', String(raw)]];
      if (sat?.group) rows.push(['Group', String(sat.group)]);
      const pos = picked?.primitive?.position;
      if (pos) { const c = Cesium.Cartographic.fromCartesian(pos); if (c) { rows.push(['Position', `${Cesium.Math.toDegrees(c.latitude).toFixed(2)}°, ${Cesium.Math.toDegrees(c.longitude).toFixed(2)}°`]); rows.push(['Altitude', `${Math.round(c.height / 1000).toLocaleString()} km`]); } }
      return { title: sat?.name || `NORAD ${raw}`, kicker: 'Satellite', rows, note: '' };
    }
    if (!title && raw && typeof raw === 'object') {
      const t = raw.name || raw.OBJECT_NAME || raw.callsign || raw.title || raw.noradId || raw.id;
      if (t) {
        const rows = Object.entries(raw).filter(([, v]) => v != null && v !== '' && typeof v !== 'object' && typeof v !== 'function').slice(0, 8).map(([k, v]) => [k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' '), String(v).slice(0, 48)]);
        return { title: String(t), kicker: 'Selected', rows, note: '' };
      }
    }
    if (!title && !ent) return null;
    const rows = ent ? rowsFromEntity(ent, time) : [];
    const pos = ent?.position?.getValue?.(time) || picked?.primitive?.position;
    if (pos) {
      const c = Cesium.Cartographic.fromCartesian(pos);
      if (c) {
        rows.unshift(['Position', `${Cesium.Math.toDegrees(c.latitude).toFixed(3)}°, ${Cesium.Math.toDegrees(c.longitude).toFixed(3)}°`]);
        if (c.height > 50) rows.splice(1, 0, ['Altitude', `${Math.round(c.height).toLocaleString()} m`]);
      }
    }
    const note = ent?.description ? textOf(ent.description.getValue?.(time) ?? ent.description).slice(0, 220) : '';
    const kind = /^\d+$/.test(title) ? 'Satellite · NORAD' : /^[0-9a-f]{6}$/i.test(title) ? 'Aircraft · ICAO' : (ent?.entityCollection?.owner?.name || 'Selected');
    return { title, kicker: String(kind).replace(/[_-]/g, ' '), rows, note };
  }
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((click) => {
    const picked = viewer.scene.pick(click.position);
    const info = picked && describe(picked);
    if (info) show(info.title, info.kicker, info.rows, info.note);
    else close();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  viewer.trackedEntityChanged.addEventListener(() => {
    const e = viewer.trackedEntity;
    if (!e) return;
    const info = describe({ id: e });
    const label = e.label?.text?.getValue?.(viewer.clock.currentTime);
    if (label) info.title = String(label).split('\n')[0];
    if (info && /^[0-9a-f-]{30,}$/i.test(info.title)) return; // keep the click card's real name
    if (info) show(info.title, 'Tracking', info.rows, info.note);
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  // Quality: crisp pixels, AA, lighting with the real sun, night-side lights.
  const scene = viewer.scene;
  viewer.useBrowserRecommendedResolution = false;
  viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 2);
  if (scene.postProcessStages?.fxaa) scene.postProcessStages.fxaa.enabled = true;
  scene.globe.enableLighting = true;
  scene.globe.showGroundAtmosphere = true;
  scene.globe.maximumScreenSpaceError = 1.5;
  scene.globe.tileCacheSize = 400;
  scene.globe.dynamicAtmosphereLighting = true;
  scene.globe.dynamicAtmosphereLightingFromSun = true;
  scene.light = new Cesium.SunLight();
  viewer.clock.shouldAnimate = true;
  // Transparent space so the living CSS starfield shows through.
  if (scene.skyBox) scene.skyBox.show = false;
  scene.backgroundColor = new Cesium.Color(0, 0, 0, 0);
  let night = null;
  const nightProvider = new Cesium.UrlTemplateImageryProvider({
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
    maximumLevel: 8,
    credit: 'Night lights: NASA Earth Observatory / GIBS (public domain)',
  });
  const ensureNight = () => {
    const layers = scene.imageryLayers;
    if (night && layers.contains(night)) { layers.raiseToTop(night); return; }
    night = layers.addImageryProvider(nightProvider);
    night.dayAlpha = 0.0;
    night.nightAlpha = 0.9;
    night.brightness = 1.6;
  };
  ensureNight();
  setInterval(ensureNight, 4000);
  // Hover tooltip.
  const tip = document.createElement('div');
  tip.id = 'anorix-tip';
  tip.hidden = true;
  document.body.appendChild(tip);
  let last = 0;
  handler.setInputAction((m) => {
    const now = performance.now();
    if (now - last < 80) return;
    last = now;
    const picked = scene.pick(m.endPosition);
    const info = picked && describe(picked);
    if (!info?.title) { tip.hidden = true; return; }
    tip.textContent = info.title;
    const r = scene.canvas.getBoundingClientRect();
    tip.style.transform = `translate(${r.left + m.endPosition.x + 14}px, ${r.top + m.endPosition.y + 14}px)`;
    tip.hidden = false;
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  // Far zoom: hide crowded overlay labels.
  scene.preRender.addEventListener(() => {
    const h = viewer.camera.positionCartographic?.height ?? 0;
    document.body.classList.toggle('anorix-far', h > FAR_M);
  });
  window.__anorixViewer = viewer;
}
