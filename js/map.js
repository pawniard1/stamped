// Street map: MapLibre with OpenFreeMap vector tiles, styled to match the Stamped mockups.
// Falls back to a simple drawn map if the map library can't load (e.g. first launch offline).
import { landGeo } from './globe.js';
import { svg } from './util.js';

const ML_JS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
const ML_CSS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
const NAME = ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']];
const FONT = ['Noto Sans Regular'], FONT_B = ['Noto Sans Bold'];
const inClass = (list) => ['in', ['get', 'class'], ['literal', list]];
const zi = (...stops) => ['interpolate', ['linear'], ['zoom'], ...stops];

export const STYLE = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: { omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' } },
  layers: [
    { id: 'land', type: 'background', paint: { 'background-color': '#1A2246' } },
    { id: 'landcover', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: inClass(['wood', 'grass', 'forest', 'farmland']), paint: { 'fill-color': '#1B3A3F', 'fill-opacity': 0.4 } },
    { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': '#1B3A3F', 'fill-opacity': 0.95 } },
    { id: 'landuse-green', type: 'fill', source: 'omt', 'source-layer': 'landuse', filter: inClass(['park', 'cemetery', 'pitch', 'garden', 'grass', 'stadium']), paint: { 'fill-color': '#1B3A3F' } },
    { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': '#0B1026' } },
    { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', paint: { 'line-color': '#25346A', 'line-width': zi(8, 0.6, 13, 2, 17, 6) } },
    { id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 14.5, paint: { 'fill-color': '#202A55', 'fill-opacity': zi(14.5, 0, 16, 0.55) } },
    { id: 'road-minor', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 12.5, filter: inClass(['minor', 'service', 'tertiary']), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#222B55', 'line-width': zi(12.5, 0.3, 17, 4) } },
    { id: 'road-major', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 8, filter: inClass(['primary', 'secondary', 'trunk']), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#28326A', 'line-width': zi(8, 0.4, 12, 1, 17, 6) } },
    { id: 'road-motorway', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 6, filter: ['==', ['get', 'class'], 'motorway'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#2E3A78', 'line-width': zi(6, 0.5, 12, 1.4, 17, 7) } },
    { id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 7, filter: inClass(['rail', 'transit']), paint: { 'line-color': '#2BB8A3', 'line-opacity': 0.55, 'line-width': zi(7, 0.6, 12, 1.6, 15, 2.8, 18, 4) } },
    { id: 'boundary', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['all', ['<=', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]], paint: { 'line-color': '#34407A', 'line-width': 1, 'line-dasharray': [3, 2] } },
    { id: 'water-name', type: 'symbol', source: 'omt', 'source-layer': 'water_name', layout: { 'text-field': NAME, 'text-font': FONT, 'text-size': 11, 'text-letter-spacing': 0.1 }, paint: { 'text-color': '#3A4A85' } },
    { id: 'road-label', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 15, layout: { 'symbol-placement': 'line', 'text-field': NAME, 'text-font': FONT, 'text-size': 10 }, paint: { 'text-color': '#4A5690', 'text-halo-color': '#1A2246', 'text-halo-width': 1 } },
    { id: 'station-dot', type: 'circle', source: 'omt', 'source-layer': 'poi', minzoom: 12, filter: ['==', ['get', 'class'], 'railway'], paint: { 'circle-radius': 3.5, 'circle-color': '#0B1026', 'circle-stroke-color': '#6FE0C8', 'circle-stroke-width': 1.5 } },
    { id: 'station-label', type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom: 13, filter: ['==', ['get', 'class'], 'railway'], layout: { 'text-field': NAME, 'text-font': FONT_B, 'text-size': 10, 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-optional': true }, paint: { 'text-color': '#6FE0C8', 'text-halo-color': '#1A2246', 'text-halo-width': 1 } },
    { id: 'place-area', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 11.5, filter: inClass(['suburb', 'quarter', 'neighbourhood']), layout: { 'text-field': ['upcase', NAME], 'text-font': FONT_B, 'text-size': 9.5, 'text-letter-spacing': 0.12, 'text-max-width': 8 }, paint: { 'text-color': '#5D6790' } },
    { id: 'place-town', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 8, filter: inClass(['town', 'village']), layout: { 'text-field': NAME, 'text-font': FONT, 'text-size': 11 }, paint: { 'text-color': '#7F89B0', 'text-halo-color': '#1A2246', 'text-halo-width': 1 } },
    { id: 'place-city', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 3, filter: ['==', ['get', 'class'], 'city'], layout: { 'text-field': NAME, 'text-font': FONT_B, 'text-size': zi(4, 11, 10, 15) }, paint: { 'text-color': '#98A2C3', 'text-halo-color': '#1A2246', 'text-halo-width': 1.2 } },
    { id: 'place-country', type: 'symbol', source: 'omt', 'source-layer': 'place', maxzoom: 6, filter: ['==', ['get', 'class'], 'country'], layout: { 'text-field': ['upcase', NAME], 'text-font': FONT_B, 'text-size': 11, 'text-letter-spacing': 0.15 }, paint: { 'text-color': '#5D6790' } }
  ]
};

function loadLib() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  return new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = ML_CSS; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = ML_JS; s.onload = () => (window.maplibregl ? res(window.maplibregl) : rej(new Error('no maplibre')));
    s.onerror = () => rej(new Error('maplibre failed to load')); document.head.appendChild(s);
    setTimeout(() => rej(new Error('timeout')), 15000);
  });
}

const pinHTML = (s) => `<span style="background:${s.color}">${s.icon ? svg(s.icon, 15, 'stroke-width="2.4"') : s.n}</span>`;

class MapManager {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'maphost';
    this.markers = []; this.cfg = null; this.anim = null;
    this.ready = null;
  }
  init() {
    if (this.ready) return this.ready;
    this.ready = loadLib().then((ml) => {
      this.ml = ml;
      this.map = new ml.Map({ container: this.el, style: STYLE, center: [139.7, 35.68], zoom: 11, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false, maxPitch: 0, fadeDuration: 0 });
      this.map.touchZoomRotate.disableRotation();
      return new Promise((res) => this.map.on('load', () => {
        const m = this.map;
        m.addSource('trip', { type: 'geojson', data: empty() });
        m.addSource('route', { type: 'geojson', data: empty() });
        m.addLayer({ id: 'trip-line', type: 'line', source: 'trip', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FF7A59', 'line-width': 3, 'line-opacity': 0.85 } });
        m.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FF7A59', 'line-width': 3, 'line-dasharray': [0.01, 2.2] } });
        m.on('click', (e) => { if (!e.originalEvent.defaultPrevented) this.cfg?.onMap?.(); });
        res(this);
      }));
    }).catch((err) => { console.warn('Map library unavailable, using simple map', err); this.fallback = true; return this; });
    return this.ready;
  }
  attach(slot) {
    if (!slot) return;
    if (this.el.parentNode !== slot) slot.appendChild(this.el);
    if (this.map) requestAnimationFrame(() => this.map.resize());
  }
  resize() { if (this.map) this.map.resize(); else if (this.fallback && this.cfg) this.drawFallback(); }
  async show(cfg) {
    const prev = this.cfg; this.cfg = cfg;
    await this.init();
    if (this.fallback) return this.drawFallback();
    const m = this.map;
    this.markers.forEach((mk) => mk.remove()); this.markers = [];
    (cfg.cities || []).forEach((c) => {
      const b = document.createElement('button'); b.className = 'citypin' + (c.on ? ' on' : ''); b.setAttribute('aria-label', 'Zoom into ' + c.label);
      b.innerHTML = c.side < 0 ? `${c.label}<i></i>` : `<i></i>${c.label}`;
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); cfg.onCity?.(c.id); });
      this.markers.push(new this.ml.Marker({ element: b, anchor: c.side < 0 ? 'right' : 'left', offset: [c.side < 0 ? 7 : -7, 0] }).setLngLat([c.lon, c.lat]).addTo(m));
    });
    (cfg.stops || []).forEach((s) => {
      const b = document.createElement('button'); b.className = 'pin' + (s.sel ? ' sel' : '') + (s.dim ? ' dim' : '') + (s.icon ? ' icon' : '');
      b.setAttribute('aria-label', s.title); b.innerHTML = pinHTML(s);
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); cfg.onPick?.(s.id); });
      this.markers.push(new this.ml.Marker({ element: b }).setLngLat([s.lon, s.lat]).addTo(m));
    });
    m.getSource('trip').setData(cfg.tripLine ? line(curve(cfg.tripLine)) : empty());
    const routeKey = JSON.stringify(cfg.route || []);
    if (cfg.animate && routeKey !== this.routeKey) this.animateRoute(cfg.route || []);
    else if (routeKey !== this.routeKey) m.getSource('route').setData(cfg.route?.length > 1 ? line(cfg.route) : empty());
    this.routeKey = routeKey;
    if (cfg.focus) m.easeTo({ center: [cfg.focus.lon, cfg.focus.lat], zoom: Math.max(m.getZoom(), cfg.focus.zoom || 15), duration: 700, padding: { top: 40, bottom: 80, left: 20, right: 20 } });
    else if (cfg.fitKey && cfg.fitKey !== prev?.fitKey) this.fit(cfg.fit || []);
  }
  fit(pts) {
    const m = this.map; if (!m || !pts.length) return;
    if (pts.length === 1) { m.easeTo({ center: pts[0], zoom: 13, duration: 700 }); return; }
    const b = new this.ml.LngLatBounds(pts[0], pts[0]); pts.forEach((p) => b.extend(p));
    const h = this.el.clientHeight || 240;
    m.fitBounds(b, { padding: { top: 56, bottom: Math.min(70, h * 0.25), left: 36, right: 56 }, maxZoom: 15.5, duration: 800 });
  }
  zoomBy(d) { if (this.map) this.map.easeTo({ zoom: this.map.getZoom() + d, duration: 250 }); }
  animateRoute(coords) {
    const src = this.map.getSource('route'); cancelAnimationFrame(this.anim);
    if (coords.length < 2) { src.setData(empty()); return; }
    const seg = []; let total = 0;
    for (let i = 1; i < coords.length; i++) { const d = Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]); seg.push(d); total += d; }
    const t0 = performance.now(), dur = 1100;
    const frame = (now) => {
      const k = Math.min(1, (now - t0) / dur), ease = 1 - Math.pow(1 - k, 3), target = total * ease;
      const out = [coords[0]]; let acc = 0;
      for (let i = 0; i < seg.length; i++) {
        if (acc + seg[i] <= target) { out.push(coords[i + 1]); acc += seg[i]; continue; }
        const f = (target - acc) / (seg[i] || 1);
        out.push([coords[i][0] + (coords[i + 1][0] - coords[i][0]) * f, coords[i][1] + (coords[i + 1][1] - coords[i][1]) * f]);
        break;
      }
      src.setData(out.length > 1 ? line(out) : empty());
      if (k < 1) this.anim = requestAnimationFrame(frame);
    };
    this.anim = requestAnimationFrame(frame);
  }
  // Simple drawn map when MapLibre isn't available.
  async drawFallback() {
    const cfg = this.cfg; if (!cfg || !window.d3) return;
    const land = await landGeo().catch(() => null);
    const w = this.el.clientWidth || 350, h = this.el.clientHeight || 236, d3 = window.d3;
    const pts = (cfg.fit && cfg.fit.length ? cfg.fit : (cfg.stops || []).map((s) => [s.lon, s.lat]));
    const proj = d3.geoMercator();
    if (pts.length > 1) proj.fitExtent([[40, 56], [w - 56, h - 50]], { type: 'MultiPoint', coordinates: pts });
    else proj.center(pts[0] || [139.7, 35.68]).scale(20000).translate([w / 2, h / 2]);
    if (proj.scale() > 400000) {
      const c = proj.invert([w / 2, h / 2]); proj.scale(400000);
      const q = proj(c), tr = proj.translate(); proj.translate([tr[0] + w / 2 - q[0], tr[1] + h / 2 - q[1]]);
    }
    const path = d3.geoPath(proj);
    let html = `<svg width="${w}" height="${h}" style="position:absolute;inset:0"><rect width="${w}" height="${h}" fill="#0B1026"/>`;
    if (land) html += `<path d="${path(land)}" fill="#1A2246" stroke="#34407A"/>`;
    if (cfg.tripLine?.length > 1) html += `<path d="${path({ type: 'LineString', coordinates: curve(cfg.tripLine) })}" fill="none" stroke="#FF7A59" stroke-width="3" stroke-linecap="round"/>`;
    if (cfg.route?.length > 1) html += `<path d="${path({ type: 'LineString', coordinates: cfg.route })}" fill="none" stroke="#FF7A59" stroke-width="2.5" stroke-dasharray="1 6" stroke-linecap="round"/>`;
    html += '</svg>';
    this.el.innerHTML = html;
    const add = (node, ll, ax = 17, ay = 17) => { const [x, y] = proj(ll); node.style.position = 'absolute'; node.style.left = (x - ax) + 'px'; node.style.top = (y - ay) + 'px'; this.el.appendChild(node); };
    (cfg.cities || []).forEach((c) => { const b = document.createElement('button'); b.className = 'citypin' + (c.on ? ' on' : ''); b.innerHTML = `<i></i>${c.label}`; b.onclick = () => cfg.onCity?.(c.id); add(b, [c.lon, c.lat], 7, 8); });
    (cfg.stops || []).forEach((s) => { const b = document.createElement('button'); b.className = 'pin' + (s.sel ? ' sel' : '') + (s.dim ? ' dim' : '') + (s.icon ? ' icon' : ''); b.innerHTML = pinHTML(s); b.onclick = () => cfg.onPick?.(s.id); add(b, [s.lon, s.lat]); });
  }
}
const empty = () => ({ type: 'FeatureCollection', features: [] });
const line = (c) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c } });
function curve(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, bend = Math.min(0.6, len * 0.18);
    const cx = (a[0] + b[0]) / 2 - dy / len * bend, cy = (a[1] + b[1]) / 2 + dx / len * bend;
    for (let k = 1; k <= 16; k++) { const t = k / 16; out.push([(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cx + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cy + t * t * b[1]]); }
  }
  return out;
}

export const mapper = new MapManager();
