// Shared helpers: dates, time zones, geo, formatting, icons, categories.

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- categories (fixed across trips) ---------- */
export const CATS = [
  { k: 'food', label: 'Food', color: '#FF7A59', tint: 'rgba(255,122,89,0.16)', icon: 'M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 2-3 5s1 4 3 4v9' },
  { k: 'sights', label: 'Sights', color: '#8B97FF', tint: 'rgba(139,151,255,0.16)', icon: 'M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM8 7l2-3h4l2 3M15.5 13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z' },
  { k: 'activity', label: 'Activities', color: '#F2C14E', tint: 'rgba(242,193,78,0.16)', icon: 'M3 6h18v3a3 3 0 0 0 0 6v3H3v-3a3 3 0 0 0 0-6zM14 6v12' },
  { k: 'transport', label: 'Transport', color: '#2BB8A3', tint: 'rgba(43,184,163,0.16)', icon: 'M8 3h8a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM5 10h14M8 20l2-4M16 20l-2-4' },
  { k: 'stay', label: 'Stay', color: '#C58BFF', tint: 'rgba(197,139,255,0.16)', icon: 'M3 19V7M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6M9 11a2 2 0 1 1-4 0 2 2 0 0 1 4 0z' },
  { k: 'shopping', label: 'Shopping', color: '#FF8FB1', tint: 'rgba(255,143,177,0.16)', icon: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2' }
];
export const CAT = Object.fromEntries(CATS.map((c) => [c.k, c]));

export const ACCENTS = [
  { name: 'Indigo', solid: '#4B5BE0', light: '#8B97FF' },
  { name: 'Teal', solid: '#0E7C6E', light: '#4FD1BC' },
  { name: 'Plum', solid: '#7B3FC4', light: '#C29BFF' },
  { name: 'Rose', solid: '#C23B66', light: '#FF8FB1' },
  { name: 'Ocean', solid: '#1F6FB8', light: '#7DB8F0' }
];

/* ---------- icons ---------- */
export const ICONS = {
  plane: 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z',
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  cal: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
  wallet: 'M5 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM3 10h18M16 15h2',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM14.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  back: 'M15 6l-6 6 6 6',
  chev: 'M9 6l6 6-6 6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  train: 'M8 3h8a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM5 10h14M8 20l2-4M16 20l-2-4',
  walk: 'M15 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM10 21l2-6 3 3v3M8 12l3-4 4 2 2 3M12 15l-4 6',
  expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  shrink: 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7',
  share: 'M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5',
  warn: 'M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
  sound: 'M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  archive: 'M3 4h18v5H3zM5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4',
  bag: 'M6 7h12l1 13H5zM9 7V5a3 3 0 0 1 6 0v2',
  doc: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  play: 'M8 5v14l11-7z',
  download: 'M12 3v12M7 10l5 5 5-5M5 19h14',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2'
};
export const svg = (d, size = 20, extra = '') =>
  `<svg ${extra} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"></path></svg>`;
export const fillSvg = (d, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${d}"></path></svg>`;

/* ---------- dates (YYYY-MM-DD strings, treated as calendar days) ---------- */
export const pad2 = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
export const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const addDays = (s, n) => { const d = parseDay(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
export const diffDays = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);
export const tripDays = (t) => { const out = []; const n = diffDays(t.start, t.end); for (let i = 0; i <= n; i++) out.push(addDays(t.start, i)); return out; };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WDS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const wd = (s) => WDS[parseDay(s).getUTCDay()];
export const dayNum = (s) => parseDay(s).getUTCDate();
export const monShort = (s) => MON[parseDay(s).getUTCMonth()];
export const fmtDay = (s) => `${wd(s)} ${dayNum(s)} ${monShort(s)}`;
export const fmtRange = (a, b) => {
  const A = parseDay(a), B = parseDay(b);
  if (A.getUTCFullYear() === B.getUTCFullYear() && A.getUTCMonth() === B.getUTCMonth()) return `${A.getUTCDate()} – ${B.getUTCDate()} ${MON[B.getUTCMonth()]} ${B.getUTCFullYear()}`;
  if (A.getUTCFullYear() === B.getUTCFullYear()) return `${A.getUTCDate()} ${MON[A.getUTCMonth()]} – ${B.getUTCDate()} ${MON[B.getUTCMonth()]} ${B.getUTCFullYear()}`;
  return `${A.getUTCDate()} ${MON[A.getUTCMonth()]} ${A.getUTCFullYear()} – ${B.getUTCDate()} ${MON[B.getUTCMonth()]} ${B.getUTCFullYear()}`;
};
export const stampDate = (s) => `${pad2(dayNum(s))} ${MON[parseDay(s).getUTCMonth()].toUpperCase()} ${String(parseDay(s).getUTCFullYear()).slice(2)}`;
export const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
export const toMin = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
export const fmtDur = (min) => { min = Math.max(0, Math.round(min)); const h = Math.floor(min / 60), m = min % 60; return h ? `${h}h ${pad2(m)}m` : `${m} min`; };
export const fmtIn = (min) => { min = Math.round(min); if (min < 1) return 'now'; if (min < 60) return `in ${min} min`; const h = Math.floor(min / 60), m = min % 60; if (h < 24) return `in ${h}h${m ? ' ' + m + 'm' : ''}`; const d = Math.round(h / 24); return `in ${d} day${d === 1 ? '' : 's'}`; };

/* ---------- time zones ---------- */
export const DEVICE_TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } })();
const dtfCache = {};
function partsIn(tz, ms) {
  let f = dtfCache[tz];
  if (!f) {
    try { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
    catch (e) { f = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
    dtfCache[tz] = f;
  }
  const p = {}; f.formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
  return p;
}
export function tzOffsetMin(tz, ms) {
  const p = partsIn(tz, ms);
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUTC - Math.floor(ms / 1000) * 1000) / 60000);
}
// local "YYYY-MM-DDTHH:mm" in tz -> UTC ms
export function zonedToUtc(local, tz) {
  if (!local) return NaN;
  const [d, t = '00:00'] = local.split('T');
  const [y, m, dd] = d.split('-').map(Number), [h, mi] = t.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, dd, h, mi || 0);
  tz = tz || DEVICE_TZ;
  const o1 = tzOffsetMin(tz, guess);
  let utc = guess - o1 * 60000;
  const o2 = tzOffsetMin(tz, utc);
  if (o2 !== o1) utc = guess - o2 * 60000;
  return utc;
}
export function nowIn(tz) {
  const p = partsIn(tz || DEVICE_TZ, Date.now());
  return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute };
}
export function tzDiffLabel(tz) {
  if (!tz || tz === DEVICE_TZ) return '';
  const now = Date.now(), d = (tzOffsetMin(tz, now) - tzOffsetMin(DEVICE_TZ, now)) / 60;
  if (!d) return 'Same time as home';
  const h = Math.abs(d), hs = Number.isInteger(h) ? h : h.toFixed(1);
  return `${hs}h ${d < 0 ? 'behind' : 'ahead of'} home`;
}
export const fmtTimeIn = (ms, tz) => { const p = partsIn(tz || DEVICE_TZ, ms); return `${pad2(+p.hour % 24)}:${p.minute}`; };

/* ---------- geo ---------- */
const R_KM = 6371;
export function haversineKm(a, b) {
  const D = Math.PI / 180, dLat = (b[1] - a[1]) * D, dLon = (b[0] - a[0]) * D;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * D) * Math.cos(b[1] * D) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}
// great-circle interpolation; a,b = [lon,lat]
export function gcInterp(a, b) {
  const D = Math.PI / 180, R = 180 / Math.PI;
  const v = ([lo, la]) => [Math.cos(la * D) * Math.cos(lo * D), Math.cos(la * D) * Math.sin(lo * D), Math.sin(la * D)];
  const A = v(a), B = v(b);
  const w = Math.acos(clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1));
  return (t) => {
    if (w < 1e-9) return a;
    const s1 = Math.sin((1 - t) * w) / Math.sin(w), s2 = Math.sin(t * w) / Math.sin(w);
    const x = s1 * A[0] + s2 * B[0], y = s1 * A[1] + s2 * B[1], z = s1 * A[2] + s2 * B[2];
    return [Math.atan2(y, x) * R, Math.asin(clamp(z, -1, 1)) * R];
  };
}
// Rough door-to-door estimate between two stops (labelled "≈" in the UI).
export function estimateLeg(a, b) {
  const km = haversineKm(a, b);
  if (km < 1.3) return { mode: 'walk', min: Math.max(3, Math.round(km * 1.3 / 4.6 * 60)), km };
  if (km < 60) return { mode: 'train', min: Math.round(8 + km * 1.35 / 28 * 60), km };
  return { mode: 'train', min: Math.round(20 + km / 160 * 60), km };
}
export const appleMapsDir = (a, b, mode) => `https://maps.apple.com/?saddr=${a[1]},${a[0]}&daddr=${b[1]},${b[0]}&dirflg=${mode === 'walk' ? 'w' : 'r'}`;
export const appleMapsAt = (p) => `https://maps.apple.com/?ll=${p[1]},${p[0]}&q=${encodeURIComponent(p[2] || 'Pin')}`;

/* ---------- money ---------- */
export function money(n, cur = 'AUD') {
  const zeroDp = ['JPY', 'KRW', 'IDR', 'VND', 'CLP', 'HUF', 'TWD', 'ISK'].includes(cur);
  try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: cur, maximumFractionDigits: zeroDp ? 0 : (Math.abs(n) >= 100 ? 0 : 2), minimumFractionDigits: 0 }).format(n); }
  catch (e) { return cur + ' ' + Math.round(n); }
}
export const countryName = (cc) => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(cc); } catch (e) { return cc; } };
export const CURRENCY_BY_COUNTRY = { AU: 'AUD', NZ: 'NZD', JP: 'JPY', US: 'USD', GB: 'GBP', ID: 'IDR', TH: 'THB', SG: 'SGD', MY: 'MYR', VN: 'VND', KR: 'KRW', CN: 'CNY', HK: 'HKD', TW: 'TWD', PH: 'PHP', IN: 'INR', FJ: 'FJD', CA: 'CAD', MX: 'MXN', AE: 'AED', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', IS: 'ISK', CZ: 'CZK', HU: 'HUF', PL: 'PLN', TR: 'TRY', ZA: 'ZAR', BR: 'BRL', CL: 'CLP', AR: 'ARS', FR: 'EUR', DE: 'EUR', IT: 'EUR', ES: 'EUR', PT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR', GR: 'EUR', FI: 'EUR', HR: 'EUR' };

/* ---------- weather codes (WMO) ---------- */
export function wxIcon(code) {
  if (code == null) return null;
  if (code === 0 || code === 1) return { k: 'sun', d: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', c: '#F2C14E' };
  if (code === 2) return { k: 'part', d: 'M8 4V3M3.5 8H2.5M4.8 4.8l-.7-.7M11.2 4.8l.7-.7M5 10.5A3.5 3.5 0 0 1 11.3 7M7 20h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 7 20z', c: '#F2C14E' };
  if (code === 3) return { k: 'cloud', d: 'M7 19h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 7 19z', c: '#B9C1FF' };
  if (code === 45 || code === 48) return { k: 'fog', d: 'M4 10h16M4 14h16M7 18h10M7 6h10', c: '#98A2C3' };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { k: 'rain', d: 'M7 15h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 7 15zM8 18l-1 3M12 18l-1 3M16 18l-1 3', c: '#7DB8F0' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { k: 'snow', d: 'M7 14h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 7 14zM8 18h.01M12 20h.01M16 18h.01M10 22h.01M14 22h.01', c: '#EEF0F8' };
  if (code >= 95) return { k: 'storm', d: 'M7 14h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 7 14zM13 14l-3 4h4l-3 4', c: '#C58BFF' };
  return { k: 'cloud', d: 'M7 19h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 7 19z', c: '#B9C1FF' };
}
export function wxWord(code) {
  const k = wxIcon(code)?.k;
  return { sun: 'Sunny', part: 'Partly cloudy', cloud: 'Cloudy', fog: 'Foggy', rain: 'Rain', snow: 'Snow', storm: 'Storms' }[k] || '';
}

/* ---------- guess category from a map search result ---------- */
export function guessCat(key, value) {
  key = key || ''; value = value || '';
  if (key === 'amenity' && /restaurant|cafe|bar|pub|fast_food|food_court|ice_cream|biergarten/.test(value)) return 'food';
  if (key === 'shop' || value === 'marketplace' || value === 'mall') return value === 'marketplace' ? 'food' : 'shopping';
  if (key === 'tourism' && /hotel|hostel|guest_house|motel|apartment|camp/.test(value)) return 'stay';
  if (key === 'railway' || key === 'aeroway' || key === 'public_transport' || value === 'bus_station' || value === 'ferry_terminal') return 'transport';
  if (key === 'leisure' || value === 'theme_park' || value === 'zoo' || value === 'aquarium') return 'activity';
  return 'sights';
}
