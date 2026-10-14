// Sounds, weather, currency, search and calendar export.
import { db, save } from './store.js';
import { zonedToUtc, addDays, tripDays, pad2 } from './util.js';

/* ---------- sound effects (generated, no audio files) ---------- */
let ac = null;
function ctx() {
  const A = window.AudioContext || window.webkitAudioContext;
  if (!A) return null;
  if (!ac) ac = new A();
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
export function unlockAudio() { try { const c = ctx(); if (c) { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } } catch (e) {} }
export function play(name, force) {
  if (!force && !db.settings.sounds) return;
  if (!force && name === 'click' && !db.settings.clicks) return;
  const c = ctx(); if (!c) return;
  try {
    const t = c.currentTime + 0.01, out = c.createGain();
    out.gain.value = 0.6; out.connect(c.destination);
    const env = (g, at, peak, a, d) => { g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + a); g.gain.exponentialRampToValueAtTime(0.0001, at + a + d); };
    const tone = (type, f0, f1, at, a, d, peak) => {
      const o = c.createOscillator(), g = c.createGain(); o.type = type;
      o.frequency.setValueAtTime(f0, at); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + a + d);
      env(g, at, peak, a, d); o.connect(g); g.connect(out); o.start(at); o.stop(at + a + d + 0.02);
    };
    const noise = (dur, ftype, f0, f1, at, a, d, peak, q) => {
      const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = buf; f.type = ftype; f.Q.value = q || 0.8;
      f.frequency.setValueAtTime(f0, at); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, at + dur);
      env(g, at, peak, a, d); src.connect(f); f.connect(g); g.connect(out); src.start(at); src.stop(at + dur);
    };
    if (name === 'stamp') { tone('sine', 150, 45, t, 0.005, 0.22, 0.9); noise(0.1, 'lowpass', 900, 900, t, 0.003, 0.08, 0.5); }
    if (name === 'tick') { tone('triangle', 1500, 1500, t, 0.002, 0.06, 0.35); tone('sine', 2200, 2200, t + 0.045, 0.002, 0.05, 0.25); }
    if (name === 'whoosh') noise(0.7, 'bandpass', 300, 2800, t, 0.25, 0.42, 0.55, 0.9);
    if (name === 'coin') { tone('triangle', 1046.5, 1046.5, t, 0.003, 0.08, 0.3); tone('triangle', 1568, 1568, t + 0.08, 0.003, 0.25, 0.3); }
    if (name === 'swoosh') noise(0.35, 'bandpass', 2400, 350, t, 0.05, 0.28, 0.45, 1.2);
    if (name === 'chime') { tone('sine', 880, 880, t, 0.01, 0.9, 0.3); tone('sine', 1318.5, 1318.5, t + 0.13, 0.01, 1.1, 0.25); }
    if (name === 'click') noise(0.03, 'highpass', 3000, 3000, t, 0.001, 0.018, 0.35);
  } catch (e) {}
}

/* ---------- network helpers ---------- */
async function getJSON(url, ms = 9000) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); }
  finally { clearTimeout(tm); }
}

/* ---------- weather (Open-Meteo, free, no key) ---------- */
// Cached per base: db.weather[baseId] = { at, days: { 'YYYY-MM-DD': { code, max, min } } }
export async function refreshWeather(t) {
  if (!navigator.onLine) return false;
  const today = new Date().toISOString().slice(0, 10), limit = addDays(today, 15);
  let changed = false;
  for (const b of t.bases || []) {
    const cache = db.weather[b.id];
    if (cache && Date.now() - cache.at < 3 * 3600 * 1000) continue;
    const days = tripDays(t).filter((d) => d >= today && d <= limit);
    if (!days.length) continue;
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${b.lat}&longitude=${b.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&current=temperature_2m,weather_code&timezone=auto&start_date=${days[0]}&end_date=${days[days.length - 1]}`;
      const j = await getJSON(u);
      const out = { at: Date.now(), days: {}, current: j.current ? { temp: j.current.temperature_2m, code: j.current.weather_code } : null };
      (j.daily?.time || []).forEach((d, i) => { out.days[d] = { code: j.daily.weather_code[i], max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i], rain: j.daily.precipitation_probability_max?.[i] }; });
      db.weather[b.id] = out; changed = true;
    } catch (e) {}
  }
  if (changed) save();
  return changed;
}
export function weatherFor(t, base, day) { return base && db.weather[base.id]?.days?.[day] || null; }

/* ---------- exchange rate (Frankfurter / ECB) ---------- */
export async function refreshRate(t) {
  if (!navigator.onLine || !t.local || t.local === t.home) return null;
  const key = t.local + t.home, c = db.fx[key];
  if (c && Date.now() - c.at < 12 * 3600 * 1000) return c.rate;
  try {
    const j = await getJSON(`https://api.frankfurter.app/latest?from=${t.local}&to=${t.home}`);
    const rate = j.rates?.[t.home];
    if (rate) { db.fx[key] = { rate, at: Date.now() }; save(); return rate; }
  } catch (e) {}
  return null;
}

/* ---------- search ---------- */
// Cities (Open-Meteo geocoding: gives time zone + country)
export async function searchCities(q) {
  const j = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`);
  return (j.results || []).map((r) => ({ name: r.name, sub: [r.admin1, r.country].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude, tz: r.timezone, cc: r.country_code }));
}
// Places (Photon / OpenStreetMap), biased to a location
export async function searchPlaces(q, near) {
  const bias = near ? `&lat=${near.lat}&lon=${near.lon}` : '';
  const j = await getJSON(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en${bias}`);
  return (j.features || []).map((f) => {
    const p = f.properties || {};
    return { name: p.name || p.street || q, sub: [p.district || p.suburb, p.city || p.county, p.country].filter(Boolean).join(', '), area: p.district || p.suburb || p.city || '', lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], key: p.osm_key, value: p.osm_value };
  });
}

/* ---------- airports (bundled list) ---------- */
let airportsP = null;
export function airports() {
  if (!airportsP) airportsP = fetch('data/airports.json').then((r) => r.json()).then((rows) => rows.map(([iata, name, city, cc, lat, lon, tz]) => ({ iata, name, city, cc, lat, lon, tz })));
  return airportsP;
}
export async function searchAirports(q) {
  const list = await airports(); q = q.trim().toLowerCase();
  if (!q) return [];
  const exact = list.filter((a) => a.iata.toLowerCase() === q);
  const rest = list.filter((a) => a.iata.toLowerCase() !== q && (a.city.toLowerCase().startsWith(q) || a.name.toLowerCase().includes(q)));
  rest.sort((a, b) => (/international/i.test(b.name) ? 1 : 0) - (/international/i.test(a.name) ? 1 : 0));
  return exact.concat(rest).slice(0, 8);
}

/* ---------- calendar reminders (.ics) ---------- */
const icsDate = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}00Z`; };
const icsText = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
export function buildICS(t, flights, plans, baseOf) {
  const r = db.settings.reminders, ev = [], stamp = icsDate(Date.now());
  const alarm = (mins, text) => `BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:${icsText(text)}\r\nTRIGGER:-PT${mins}M\r\nEND:VALARM`;
  flights.forEach((f) => {
    const s = zonedToUtc(f.dep, f.from.tz), e = zonedToUtc(f.arr, f.to.tz);
    if (isNaN(s)) return;
    const al = [];
    if (r.checkin) al.push(alarm(24 * 60, `Check-in opens for ${f.number || 'your flight'}`));
    if (r.leave) al.push(alarm(180, `Leave for ${f.from.iata} airport`));
    ev.push(`BEGIN:VEVENT\r\nUID:${f.id}@stamped\r\nDTSTAMP:${stamp}\r\nDTSTART:${icsDate(s)}\r\nDTEND:${icsDate(isNaN(e) ? s + 3600000 : e)}\r\nSUMMARY:${icsText(`✈ ${f.from.iata} → ${f.to.iata} ${f.number || ''}`)}\r\nLOCATION:${icsText(f.from.name)}\r\nDESCRIPTION:${icsText([f.airline, f.seat && 'Seat ' + f.seat, f.terminal && 'Terminal ' + f.terminal, f.ref && 'Booking ' + f.ref].filter(Boolean).join(' · '))}\r\n${al.join('\r\n')}${al.length ? '\r\n' : ''}END:VEVENT`);
  });
  if (r.bookings) plans.filter((p) => p.booked && p.time).forEach((p) => {
    const b = baseOf(p.date), s = zonedToUtc(`${p.date}T${p.time}`, b?.tz);
    if (isNaN(s)) return;
    ev.push(`BEGIN:VEVENT\r\nUID:${p.id}@stamped\r\nDTSTAMP:${stamp}\r\nDTSTART:${icsDate(s)}\r\nDTEND:${icsDate(s + 3600000)}\r\nSUMMARY:${icsText(p.title)}\r\nLOCATION:${icsText(p.place?.name || '')}\r\nDESCRIPTION:${icsText(p.note || '')}\r\n${alarm(60, `${p.title} in 1 hour`)}\r\nEND:VEVENT`);
  });
  if (r.morning) tripDays(t).forEach((d) => {
    const b = baseOf(d), s = zonedToUtc(`${d}T08:00`, b?.tz);
    const list = plans.filter((p) => p.date === d);
    if (!list.length || isNaN(s)) return;
    ev.push(`BEGIN:VEVENT\r\nUID:morning-${t.id}-${d}@stamped\r\nDTSTAMP:${stamp}\r\nDTSTART:${icsDate(s)}\r\nDTEND:${icsDate(s + 900000)}\r\nSUMMARY:${icsText(`Today: ${list.length} plan${list.length > 1 ? 's' : ''}`)}\r\nDESCRIPTION:${icsText(list.map((p) => `${p.time || ''} ${p.title}`.trim()).join('\n'))}\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Your plans for today\r\nTRIGGER:PT0M\r\nEND:VALARM\r\nEND:VEVENT`);
  });
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Stamped//Trip Planner//EN\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:${icsText(t.name)}\r\n${ev.join('\r\n')}${ev.length ? '\r\n' : ''}END:VCALENDAR\r\n`;
}

/* ---------- offline maps: pre-download vector tiles around the trip ---------- */
export async function saveMapsOffline(points, onProgress) {
  const tj = await getJSON('https://tiles.openfreemap.org/planet');
  const tpl = tj.tiles[0];
  const urls = new Set();
  const tile = (lon, lat, z) => { const n = 2 ** z, x = Math.floor((lon + 180) / 360 * n), r = lat * Math.PI / 180, y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n); return [x, y]; };
  points.forEach(([lon, lat, rad]) => {
    for (let z = 5; z <= 14; z++) {
      const span = z < 9 ? 1.2 : rad;
      const [x0, y0] = tile(lon - span, lat + span * 0.8, z), [x1, y1] = tile(lon + span, lat - span * 0.8, z);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) urls.add(tpl.replace('{z}', z).replace('{x}', x).replace('{y}', y));
    }
  });
  ['Noto Sans Regular', 'Noto Sans Bold'].forEach((f) => ['0-255', '256-511', '8192-8447'].forEach((r) => urls.add(`https://tiles.openfreemap.org/fonts/${encodeURIComponent(f)}/${r}.pbf`)));
  const list = [...urls].slice(0, 2500);
  let done = 0;
  const cache = await caches.open('stamped-tiles');
  const worker = async () => {
    while (list.length) {
      const u = list.pop();
      try { if (!(await cache.match(u))) { const r = await fetch(u); if (r.ok) await cache.put(u, r); } } catch (e) {}
      done++; if (done % 10 === 0) onProgress?.(done, urls.size);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
  onProgress?.(urls.size, urls.size);
  return urls.size;
}
