import { parseCategory } from './categories.js';

/** Anorix Eye shell: the exact Anorix Cosmos / Globe UI system, driving Eye's own controls. */
const GROUPS = [
  ['air', 'Air', ['flights', 'military', 'local-adsb']],
  ['sea', 'Sea', ['ais-live-vessels']],
  ['space', 'Space', ['satellites', 'rocket-launches']],
  ['earth', 'Earth', ['earthquakes', 'local-firms', 'weather-radar', 'weather-cyclones', 'fire-perimeters', 'wind', 'weather-satellite', 'weather-lightning']],
  ['more', 'More', ['traffic', 'transit', 'bikeshare', 'cctv', 'recent-imagery', 'street-level', 'alpr-cameras', 'military-installations', 'local-datacenters', 'local-dams', 'directions', 'radio']],
];
const SOURCES = [
  ['OpenSky Network', 'Live flights'], ['adsb.lol', 'Military flights (ODbL)'], ['AISStream', 'Vessels (own key)'],
  ['CelesTrak', 'Satellites'], ['Launch Library 2', 'Space missions'], ['USGS', 'Earthquakes'],
  ['NASA FIRMS', 'Fires (own key)'], ['NOAA nowCOAST', 'Weather radar'], ['Esri World Imagery', 'Base imagery'],
  ['NASA Black Marble', 'Night lights'], ['OpenStreetMap', 'Infrastructure (ODbL)'], ['Natural Earth', 'Boundaries'],
];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
const PLAY = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.5v9l8-4.5-8-4.5z" fill="currentColor"/></svg>';
const PAUSE = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 1.5h3v9H2zM7 1.5h3v9H7z" fill="currentColor"/></svg>';

export function installAnorixShell(viewer, Cesium) {
  const $ = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstChild; };
  document.documentElement.classList.add('anorix-shell');
  const header = $(`<header class="ax-header">
    <a class="ax-brand" href="https://anorix.dev" target="_blank" rel="noreferrer"><span class="eyebrow">Anorix</span><span class="wordmark">Eye</span></a>
    <form class="ax-search" role="search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" placeholder="Search a place, or “schools in Lahore”" aria-label="Search any place"/></form>
    <div class="ax-nav"><button class="ax-theme" aria-label="Toggle theme"></button>
      <button class="g-btn g-btn-solid" data-view="layers">Layers</button>
      <button class="g-btn g-btn-soft" data-view="sources">Sources</button>
      <button class="g-btn g-btn-soft ax-hide-sm" data-view="about">About</button></div></header>`);
  const panel = $(`<aside class="ax-panel" aria-label="Eye panel"><div class="ax-head"><div><p class="eyebrow ax-eyebrow">Live data</p><h2 class="ax-title">Air</h2></div><p class="ax-count"></p></div><div class="tabs" role="tablist"></div><div class="ax-body pin-scroll"></div><footer class="ax-foot">anorix.dev · open live data</footer></aside>`);
  const hud = $(`<div class="hud"><div class="hud-row"><button class="icon-btn ax-play" aria-label="Pause motion"></button><div class="hud-date ax-clock">--:--</div><p class="hud-meta ax-status">Live</p></div>
    <div class="hud-actions"><button class="hud-btn" data-go="earth">Whole Earth</button><button class="hud-btn" data-go="pk">Pakistan</button><button class="hud-btn" data-go="tilt">Tilt</button><button class="hud-btn" data-go="north">North up</button></div></div>`);
  document.body.append(header, panel, hud);
  let view = 'layers', tab = 'air', detail = null;
  const tabsEl = panel.querySelector('.tabs'), body = panel.querySelector('.ax-body');
  const rowOf = (id) => document.querySelector(`.data-toggle-row[data-layer-id="${id}"]`) || document.querySelector(`[data-layer-id="${id}"]`);
  const info = (id) => {
    const r = rowOf(id); if (!r) return null;
    const btn = r.querySelector('.data-toggle-btn');
    return { id, name: r.querySelector('.data-name')?.textContent.trim() || id, count: r.querySelector('.data-count')?.textContent.trim() || '', meta: r.querySelector('.data-toggle-meta')?.textContent.trim() || '', on: btn?.classList.contains('active') || btn?.getAttribute('aria-pressed') === 'true', busy: btn?.getAttribute('aria-busy') === 'true', btn };
  };
  function render() {
    panel.dataset.view = detail ? 'detail' : view;
    const title = panel.querySelector('.ax-title'), eb = panel.querySelector('.ax-eyebrow'), count = panel.querySelector('.ax-count');
    if (detail) {
      eb.textContent = detail.kicker; title.textContent = detail.title; count.textContent = '';
      tabsEl.innerHTML = '<button class="tab" data-back aria-selected="false">← Back to layers</button>';
      body.innerHTML = `${detail.note ? `<p class="ax-note">${esc(detail.note)}</p>` : ''}<dl class="fact-grid">${detail.rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
      return;
    }
    if (view === 'sources' || view === 'about') {
      eb.textContent = view === 'sources' ? 'Attribution' : 'Anorix Eye';
      title.textContent = view === 'sources' ? 'Sources' : 'About';
      count.textContent = view === 'sources' ? `${SOURCES.length} feeds` : '';
      tabsEl.innerHTML = '';
      body.innerHTML = view === 'sources'
        ? `<ul class="ax-list">${SOURCES.map(([a, b]) => `<li class="ax-row"><span>${a}</span><span class="ax-sub">${b}</span></li>`).join('')}</ul><p class="ax-credit">Interface and data layers adapted from God's Eye View (MIT).</p>`
        : `<p class="ax-note">The planet, live. Aircraft, ships, satellites and Earth events from open public feeds on a 3D globe.</p>`;
      return;
    }
    const g = GROUPS.find((x) => x[0] === tab);
    eb.textContent = 'Live data'; title.textContent = g[1];
    const all = GROUPS.flatMap((x) => x[2]).map(info).filter(Boolean);
    count.textContent = `${all.filter((x) => x.on).length} on`;
    tabsEl.innerHTML = GROUPS.map(([id, label]) => `<button class="tab" role="tab" data-tab="${id}" aria-selected="${id === tab}">${label}</button>`).join('');
    const rows = g[2].map(info).filter(Boolean);
    body.innerHTML = `<ul class="ax-list">${rows.map((r) => `<li><button class="ax-row row-hover" data-toggle="${r.id}" aria-pressed="${r.on}"${/unavailable/i.test(r.meta) ? ' data-unavailable' : ''}>
      <span class="ax-row-main"><span class="ax-name">${esc(r.name)}</span><span class="ax-sub">${esc(r.meta)}</span></span>
      <span class="ax-row-side"><span class="ax-num">${esc(r.on ? r.count : '')}</span><span class="ax-switch" data-on="${r.on}" data-busy="${r.busy}"></span></span></button></li>`).join('') || '<li class="ax-note">Loading layers…</li>'}</ul>`;
  }
  // Update toggle rows in place (used while the pointer is over the panel).
  function refreshRows() {
    body.querySelectorAll('[data-toggle]').forEach((row) => {
      const r = info(row.dataset.toggle); if (!r) return;
      row.setAttribute('aria-pressed', String(r.on));
      row.toggleAttribute('data-unavailable', /unavailable/i.test(r.meta));
      const num = row.querySelector('.ax-num'); if (num) num.textContent = r.on ? r.count : '';
      const sub = row.querySelector('.ax-sub'); if (sub) sub.textContent = r.meta;
      const sw = row.querySelector('.ax-switch'); if (sw) { sw.dataset.on = String(r.on); sw.dataset.busy = String(r.busy); }
    });
    const all = GROUPS.flatMap((x) => x[2]).map(info).filter(Boolean);
    panel.querySelector('.ax-count').textContent = `${all.filter((x) => x.on).length} on`;
  }
  panel.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; render(); return; }
    if (e.target.closest('[data-back]')) { detail = null; render(); return; }
    const tg = e.target.closest('[data-toggle]'); if (tg) { const r = info(tg.dataset.toggle); if (r && /unavailable/i.test(r.meta) && !r.on) { tg.classList.add('ax-shake'); setTimeout(() => tg.classList.remove('ax-shake'), 400); return; } r?.btn?.click(); setTimeout(render, 150); setTimeout(refreshRows, 1500); }
  });
  header.addEventListener('click', (e) => {
    const v = e.target.closest('[data-view]'); if (!v) return;
    view = v.dataset.view; detail = null;
    header.querySelectorAll('[data-view]').forEach((b) => { b.classList.toggle('g-btn-solid', b === v); b.classList.toggle('g-btn-soft', b !== v); });
    panel.classList.remove('ax-collapsed'); render();
  });
  // Theme (shared key with Cosmos / Globe semantics).
  const themeBtn = header.querySelector('.ax-theme');
  const applyTheme = (t) => { document.documentElement.dataset.theme = t; themeBtn.innerHTML = t === 'light' ? MOON : SUN; try { localStorage.setItem('anorix-eye-theme', t); } catch {} };
  let theme = 'dark'; try { theme = localStorage.getItem('anorix-eye-theme') || 'dark'; } catch {}
  applyTheme(theme);
  themeBtn.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
  // Search: server-side multi-provider (Nominatim + Photon + Open-Meteo), deduped and ranked.
  const form = header.querySelector('.ax-search'), input = form.querySelector('input');
  const list = document.createElement('ul'); list.className = 'ax-suggest'; list.hidden = true; form.appendChild(list);
  let results = [], active = -1, timer = 0, seq = 0;
  const fly = (r) => {
    if (!r) return;
    const bb = r.bbox;
    const small = bb && Math.abs(bb[1] - bb[0]) < 0.002;
    const dest = bb && !small ? Cesium.Rectangle.fromDegrees(bb[2], bb[0], bb[3], bb[1]) : Cesium.Cartesian3.fromDegrees(r.lon, r.lat, small ? 1500 : 30000);
    viewer.camera.flyTo({ destination: dest, duration: 2.2 });
    input.value = r.name; list.hidden = true; input.blur();
  };
  const paint = () => {
    const catRows = cat ? [`<li class="ax-cat" aria-live="polite"><span class="ax-s-name">${cat.loading ? `Finding ${esc(cat.label.toLowerCase())}…` : cat.places.length ? `${cat.places.length}${cat.total > cat.places.length ? '+' : ''} ${esc(cat.label.toLowerCase())} near ${esc(cat.where)} on the map` : esc(cat.message || `No ${cat.label.toLowerCase()} found here. Zoom to a city or try “schools in Lahore”.`)}</span>${cat.places.length ? '<button type="button" class="ax-cat-clear" data-clear aria-label="Clear results from map">Clear</button>' : ''}</li>`,
      ...cat.places.slice(0, 6).map((p, i) => `<li role="option" data-p="${i}"><span class="ax-s-name">${esc(p.name)}</span><span class="ax-s-sub">${esc(p.detail || p.kind)}</span></li>`)] : [];
    const placeRows = cat && cat.places.length ? [] : results.map((r, i) => `<li role="option" data-i="${i}" aria-selected="${i === active}"><span class="ax-s-name">${esc(r.name)}</span><span class="ax-s-sub">${esc(r.label.replace(r.name + ', ', ''))}</span></li>`);
    list.innerHTML = [...catRows, ...placeRows].join('');
    list.hidden = !list.innerHTML;
  };
  // Category search ("schools", "colleges in Lahore", "hospitals near me"): every match as a marker.
  const places = new Cesium.CustomDataSource('anorix-places');
  viewer.dataSources.add(places);
  let cat = null, catSeq = 0;
  const viewBox = () => {
    const rect = viewer.camera.computeViewRectangle();
    if (!rect) return null;
    const d = Cesium.Math.toDegrees;
    return [d(rect.west), d(rect.south), d(rect.east), d(rect.north)];
  };
  const showPlaces = (list, fit) => {
    places.entities.removeAll();
    window.__anorixPlacesCount = list.length;
    for (const p of list) {
      places.entities.add({
        id: `place-${p.id}`,
        name: p.name,
        position: Cesium.Cartesian3.fromDegrees(p.lng, p.lat),
        point: { pixelSize: 9, color: Cesium.Color.fromCssColorString('#3b82f6'), outlineColor: Cesium.Color.WHITE, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        label: { text: p.name, font: '500 12px Inter, system-ui, sans-serif', fillColor: Cesium.Color.WHITE, showBackground: true, backgroundColor: Cesium.Color.fromCssColorString('rgba(10,10,10,0.82)'), pixelOffset: new Cesium.Cartesian2(0, -16), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 9000), disableDepthTestDistance: Number.POSITIVE_INFINITY },
        description: `${esc(p.name)}<br>${esc(p.detail || p.kind)}`,
      });
    }
    if (fit && list.length) {
      let w = 180, so = 90, e = -180, n = -90;
      for (const p of list) { w = Math.min(w, p.lng); e = Math.max(e, p.lng); so = Math.min(so, p.lat); n = Math.max(n, p.lat); }
      const pad = Math.max(0.01, (e - w) * 0.12, (n - so) * 0.12);
      viewer.camera.flyTo({ destination: Cesium.Rectangle.fromDegrees(w - pad, so - pad, e + pad, n + pad), duration: 2 });
    }
  };
  const queryCategory = async (q, parsed) => {
    const my = ++catSeq;
    cat = { loading: true, label: parsed.category.label, places: [] }; paint();
    const params = new URLSearchParams({ q });
    if (parsed.nearMe && 'geolocation' in navigator) {
      const pos = await new Promise((res) => navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 6000, maximumAge: 300000 }));
      if (pos) { params.set('lat', pos.coords.latitude); params.set('lng', pos.coords.longitude); }
    }
    if (!params.has('lat')) { const b = viewBox(); if (b) params.set('bbox', b.join(',')); }
    try {
      const d = await (await fetch(`/api/anorix/places?${params}`)).json();
      if (my !== catSeq) return;
      cat = { loading: false, label: d.category || parsed.category.label, where: d.where, places: d.places || [], total: d.total, message: d.message };
      showPlaces(cat.places, true);
    } catch { if (my === catSeq) cat = { loading: false, label: parsed.category.label, places: [], message: 'Place search is unavailable right now.' }; }
    if (my === catSeq) paint();
  };
  const query = async (q) => {
    const my = ++seq;
    try {
      const r = await fetch(`/api/anorix/search?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      if (my !== seq) return;
      results = d.results || []; active = results.length ? 0 : -1; paint();
    } catch { /* offline: keep previous */ }
  };
  input.addEventListener('input', () => { clearTimeout(timer); const q = input.value.trim(); if (q.length < 2) { results = []; cat = null; paint(); return; } timer = setTimeout(() => { const parsed = q.length >= 3 ? parseCategory(q) : null; if (parsed) queryCategory(q, parsed); else { cat = null; catSeq++; } query(q); }, 380); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { active = Math.min(results.length - 1, active + 1); paint(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); paint(); e.preventDefault(); }
    if (e.key === 'Escape') { list.hidden = true; }
  });
  list.addEventListener('mousedown', (e) => {
    if (e.target.closest('[data-clear]')) { e.preventDefault(); cat = null; catSeq++; places.entities.removeAll(); window.__anorixPlacesCount = 0; paint(); return; }
    const pi = e.target.closest('[data-p]');
    if (pi && cat) { e.preventDefault(); const p = cat.places[+pi.dataset.p]; viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(p.lng, p.lat, 1200), duration: 2 }); list.hidden = true; input.blur(); return; }
    const li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); fly(results[+li.dataset.i]); }
  });
  input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 120));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = input.value.trim(); if (!q) return;
    if (cat && cat.places.length) { showPlaces(cat.places, true); list.hidden = true; input.blur(); return; }
    if (!results.length) await query(q);
    fly(results[Math.max(0, active)]);
  });
  // HUD.
  const play = hud.querySelector('.ax-play');
  const syncPlay = () => { play.innerHTML = viewer.clock.shouldAnimate ? PAUSE : PLAY; play.setAttribute('aria-label', viewer.clock.shouldAnimate ? 'Pause motion' : 'Play motion'); };
  play.addEventListener('click', () => { viewer.clock.shouldAnimate = !viewer.clock.shouldAnimate; syncPlay(); });
  window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) { e.preventDefault(); play.click(); } });
  syncPlay();
  hud.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]')?.dataset.go; if (!g) return;
    const cam = viewer.camera;
    if (g === 'earth') cam.flyTo({ destination: Cesium.Cartesian3.fromDegrees(52, 24, 25000000), duration: 2 });
    if (g === 'pk') cam.flyTo({ destination: Cesium.Cartesian3.fromDegrees(70, 30, 2600000), duration: 2 });
    if (g === 'north') cam.flyTo({ destination: cam.positionWC.clone(), orientation: { heading: 0, pitch: cam.pitch, roll: 0 }, duration: 0.8 });
    if (g === 'tilt') { const h = cam.positionCartographic.height; cam.flyTo({ destination: cam.positionWC.clone(), orientation: { heading: cam.heading, pitch: Cesium.Math.toRadians(cam.pitch < -1.2 ? -40 : -90), roll: 0 }, duration: 1 }); void h; }
  });
  const clock = hud.querySelector('.ax-clock'), status = hud.querySelector('.ax-status');
  setInterval(() => {
    const d = Cesium.JulianDate.toDate(viewer.clock.currentTime);
    clock.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const on = GROUPS.flatMap((x) => x[2]).map(info).filter((x) => x?.on).length;
    status.textContent = `${viewer.clock.shouldAnimate ? 'Live' : 'Paused'} · ${on} feed${on === 1 ? '' : 's'} on`;
    if (!detail && view === 'layers') {
      if (!panel.matches(':hover')) render();
      else refreshRows(); // keep rows live under the cursor without rebuilding them
    }
  }, 1000);
  render();
  return {
    showDetail(d) { detail = d; render(); },
    hideDetail() { if (detail) { detail = null; render(); } },
  };
}
