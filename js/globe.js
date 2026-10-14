// Interactive globe (SVG + d3-geo orthographic) with flight arcs and a moving plane.
import { ICONS } from './util.js';

let landP = null;
export function landGeo() {
  if (!landP) landP = fetch('data/land110.json').then((r) => r.json()).then((polys) => {
    const d3 = window.d3;
    const coords = polys.map((ring) => {
      let r = ring;
      if (d3 && d3.geoArea({ type: 'Polygon', coordinates: [r] }) > 2 * Math.PI) r = r.slice().reverse();
      return [r];
    });
    return { type: 'MultiPolygon', coordinates: coords };
  });
  return landP;
}

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };

export class Globe {
  constructor(host, { width = 350, height = 256, interactive = true, landFill = '#3B4CCA', landStroke = '#7F8CF0', arcColor = '#FF7A59', accent = '#8B97FF', plane = true } = {}) {
    this.w = width; this.h = height; this.zoom = 1; this.rot = [-140, 0]; this.sel = null; this.arcs = []; this.ports = []; this.t = 0.35; this.live = null;
    this.colors = { landFill, landStroke, arcColor, accent };
    this.showPlane = plane;
    const s = this.svg = el('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Globe showing your flights' });
    host.appendChild(s);
    this.gSphere = el('circle', { fill: '#141B3A' }, s);
    this.gGrat = el('path', { fill: 'none', stroke: '#FFFFFF', 'stroke-opacity': '0.08', 'stroke-width': '1' }, s);
    this.gLand = el('path', { fill: landFill, 'fill-opacity': '0.7', stroke: landStroke, 'stroke-width': '0.8', 'stroke-opacity': '0.9' }, s);
    this.gRim = el('circle', { fill: 'none', stroke: '#7F8CF0', 'stroke-opacity': '0.45', 'stroke-width': '1.5' }, s);
    this.gOther = el('g', {}, s);
    this.gAhead = el('path', { fill: 'none', stroke: arcColor, 'stroke-opacity': '0.45', 'stroke-width': '2.4', 'stroke-dasharray': '2 6', 'stroke-linecap': 'round' }, s);
    this.gTrail = el('path', { fill: 'none', stroke: arcColor, 'stroke-width': '3.2', 'stroke-linecap': 'round' }, s);
    this.gPorts = el('g', {}, s);
    this.gPlane = el('g', {}, s);
    const pp = el('path', { d: ICONS.plane, fill: arcColor, stroke: '#070912', 'stroke-width': '1.4', 'stroke-linejoin': 'round' }, this.gPlane);
    pp.setAttribute('transform', 'scale(0.85) translate(-12 -12)');
    this.proj = window.d3 ? window.d3.geoOrthographic().clipAngle(90).precision(0.5) : null;
    if (interactive) this.bind();
    landGeo().then((g) => { this.land = g; this.draw(true); }).catch(() => {});
  }
  setData({ arcs = [], ports = [], selected = null, live = null }) {
    this.arcs = arcs; this.ports = ports; this.live = live;
    if (selected !== this.sel) { this.sel = selected; this.t = 0.02; this.focus(); }
    this.draw(true);
  }
  focus() {
    const a = this.arcs.find((x) => x.id === this.sel) || this.arcs[0];
    if (!a || !window.d3) return;
    const mid = window.d3.geoInterpolate(a.from, a.to)(0.5);
    this.rot = [-mid[0], -mid[1] * 0.7];
    const dist = window.d3.geoDistance(a.from, a.to);
    this.zoom = Math.max(0.75, Math.min(2.2, 1.6 / Math.max(dist, 0.4)));
  }
  bind() {
    const s = this.svg; this.ptrs = {};
    s.addEventListener('pointerdown', (e) => {
      this.ptrs[e.pointerId] = [e.clientX, e.clientY]; s.setPointerCapture(e.pointerId);
      const ids = Object.keys(this.ptrs);
      if (ids.length === 1) this.drag = { x: e.clientX, y: e.clientY, rot: this.rot.slice() };
      if (ids.length === 2) { const [a, b] = ids.map((i) => this.ptrs[i]); this.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: this.zoom }; this.drag = null; }
    });
    s.addEventListener('pointermove', (e) => {
      if (!this.ptrs[e.pointerId]) return;
      this.ptrs[e.pointerId] = [e.clientX, e.clientY];
      const ids = Object.keys(this.ptrs);
      if (ids.length >= 2 && this.pinch) { const [a, b] = ids.map((i) => this.ptrs[i]); this.zoom = Math.max(0.6, Math.min(4, this.pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / this.pinch.d)); this.draw(true); }
      else if (this.drag) { const k = 0.4 / this.zoom; this.rot = [this.drag.rot[0] + (e.clientX - this.drag.x) * k, Math.max(-70, Math.min(70, this.drag.rot[1] - (e.clientY - this.drag.y) * k))]; this.draw(true); }
    });
    const up = (e) => { delete this.ptrs[e.pointerId]; if (!Object.keys(this.ptrs).length) { this.drag = null; this.pinch = null; } };
    s.addEventListener('pointerup', up); s.addEventListener('pointercancel', up);
  }
  zoomBy(f) { this.zoom = Math.max(0.6, Math.min(4, this.zoom * f)); this.draw(true); }
  draw(full) {
    const d3 = window.d3, p = this.proj; if (!d3 || !p) return;
    const R = 110 * this.zoom * (this.h / 256), cx = this.w / 2, cy = this.h / 2;
    p.scale(R).translate([cx, cy]).rotate([this.rot[0], this.rot[1]]);
    const path = d3.geoPath(p);
    if (full) {
      this.gSphere.setAttribute('cx', cx); this.gSphere.setAttribute('cy', cy); this.gSphere.setAttribute('r', R);
      this.gRim.setAttribute('cx', cx); this.gRim.setAttribute('cy', cy); this.gRim.setAttribute('r', R);
      this.gGrat.setAttribute('d', path(d3.geoGraticule().step([20, 20])()) || '');
      if (this.land) this.gLand.setAttribute('d', path(this.land) || '');
      this.gOther.innerHTML = '';
      this.arcs.forEach((a) => {
        if (a.id === this.sel && this.showPlane) return;
        el('path', { d: path({ type: 'LineString', coordinates: [a.from, a.to] }) || '', fill: 'none', stroke: a.id === this.sel ? this.colors.arcColor : this.colors.accent, 'stroke-width': a.id === this.sel ? '3' : '2', 'stroke-dasharray': a.id === this.sel ? 'none' : '4 5', 'stroke-linecap': 'round' }, this.gOther);
      });
      this.gPorts.innerHTML = '';
      const center = [-this.rot[0], -this.rot[1]];
      this.ports.forEach((pt) => {
        if (d3.geoDistance(pt.ll, center) > Math.PI / 2 - 0.02) return;
        const [x, y] = p(pt.ll);
        el('circle', { cx: x, cy: y, r: 4.5, fill: '#FFFFFF' }, this.gPorts);
        const t = el('text', { x: x + (pt.side < 0 ? -9 : 9), y: y + 4, 'text-anchor': pt.side < 0 ? 'end' : 'start', fill: '#FFFFFF', 'font-family': 'DM Sans, sans-serif', 'font-size': '12', 'font-weight': '600' }, this.gPorts);
        t.textContent = pt.code;
      });
    }
    // selected arc progress + plane
    const a = this.arcs.find((x) => x.id === this.sel);
    if (!a || !this.showPlane) { this.gTrail.setAttribute('d', ''); this.gAhead.setAttribute('d', ''); this.gPlane.style.display = 'none'; return; }
    const t = this.live != null ? this.live : this.t;
    const ip = d3.geoInterpolate(a.from, a.to), cur = ip(t);
    const pts = (from, to) => { const out = []; for (let i = 0; i <= 40; i++) out.push(ip(from + (to - from) * i / 40)); return out; };
    this.gTrail.setAttribute('d', path({ type: 'LineString', coordinates: pts(0, t) }) || '');
    this.gAhead.setAttribute('d', path({ type: 'LineString', coordinates: pts(t, 1) }) || '');
    const center = [-this.rot[0], -this.rot[1]];
    if (d3.geoDistance(cur, center) < Math.PI / 2 - 0.02) {
      const [x, y] = p(cur), [x2, y2] = p(ip(Math.min(1, t + 0.01)));
      const ang = Math.atan2(y2 - y, x2 - x) * 180 / Math.PI + 90;
      this.gPlane.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(0)})`);
      this.gPlane.style.display = '';
    } else this.gPlane.style.display = 'none';
  }
  start() {
    if (this.raf) return;
    let last = 0;
    const step = (ts) => {
      this.raf = requestAnimationFrame(step);
      if (ts - last < 33) return; last = ts;
      if (this.live == null) { this.t += 0.0035; if (this.t > 1) this.t = 0; }
      this.draw(false);
    };
    this.raf = requestAnimationFrame(step);
  }
  stop() { cancelAnimationFrame(this.raf); this.raf = null; }
}
