// Data store: everything lives on this phone (localStorage + IndexedDB for documents).
import { uid, addDays, localToday, diffDays } from './util.js';

const KEY = 'stamped.v1';
const empty = () => ({
  version: 1,
  trips: [], flights: [], plans: [], places: [], expenses: [], packing: [], docs: [],
  settings: { sounds: true, clicks: false, reminders: { checkin: true, leave: true, bookings: true, morning: false }, lastBackup: null, seenStamps: [] },
  weather: {}, fx: {}
});

export let db = load();
const listeners = new Set();
export const subscribe = (fn) => listeners.add(fn);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const d = JSON.parse(raw), e = empty();
    return Object.assign(e, d, { settings: Object.assign(e.settings, d.settings || {}, { reminders: Object.assign(e.settings.reminders, (d.settings || {}).reminders || {}) }) });
  } catch (err) { return empty(); }
}
let saveTimer = null;
export function save(immediate) {
  clearTimeout(saveTimer);
  const run = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (err) { console.warn('save failed', err); } };
  if (immediate) run(); else saveTimer = setTimeout(run, 120);
}
export function commit() { save(); listeners.forEach((fn) => fn()); }
export function replaceAll(data) { db = Object.assign(empty(), data); save(true); listeners.forEach((fn) => fn()); }

/* ---------- queries ---------- */
export const trip = (id) => db.trips.find((t) => t.id === id);
export const ofTrip = (coll, id) => db[coll].filter((x) => x.tripId === id);
export const tripStatus = (t, today = localToday()) => (today < t.start ? 'upcoming' : today > t.end ? 'past' : 'now');
export function baseFor(t, day) {
  const bs = (t.bases || []).slice().sort((a, b) => (a.from < b.from ? -1 : 1));
  let pick = bs[0] || null;
  bs.forEach((b) => { if (b.from <= day) pick = b; });
  return pick;
}
export function plansOn(tripId, day) {
  return db.plans.filter((p) => p.tripId === tripId && p.date === day).sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1);
}

/* ---------- mutations ---------- */
export function add(coll, obj) { const o = Object.assign({ id: uid() }, obj); db[coll].push(o); commit(); return o; }
export function update(coll, id, patch) { const o = db[coll].find((x) => x.id === id); if (o) Object.assign(o, patch); commit(); return o; }
export function remove(coll, id) { db[coll] = db[coll].filter((x) => x.id !== id); commit(); }
export function removeTrip(id) {
  ['flights', 'plans', 'places', 'expenses', 'packing'].forEach((c) => { db[c] = db[c].filter((x) => x.tripId !== id); });
  db.docs.filter((d) => d.tripId === id).forEach((d) => idbDel(d.id));
  db.docs = db.docs.filter((d) => d.tripId !== id);
  db.trips = db.trips.filter((t) => t.id !== id);
  commit();
}

/* ---------- IndexedDB for document files ---------- */
let idbP = null;
function idb() {
  if (!idbP) idbP = new Promise((res, rej) => {
    const r = indexedDB.open('stamped', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('docs');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return idbP;
}
export async function idbPut(key, blob) { const d = await idb(); return new Promise((res, rej) => { const tx = d.transaction('docs', 'readwrite'); tx.objectStore('docs').put(blob, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
export async function idbGet(key) { const d = await idb(); return new Promise((res, rej) => { const r = d.transaction('docs').objectStore('docs').get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
export async function idbDel(key) { try { const d = await idb(); d.transaction('docs', 'readwrite').objectStore('docs').delete(key); } catch (e) {} }

/* ---------- backup / restore ---------- */
const blobToB64 = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
export async function exportBackup() {
  const files = {};
  for (const d of db.docs) { try { const b = await idbGet(d.id); if (b) files[d.id] = await blobToB64(b); } catch (e) {} }
  const payload = { app: 'stamped', exportedAt: new Date().toISOString(), data: db, files };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}
export async function importBackup(text) {
  const p = JSON.parse(text);
  if (!p || p.app !== 'stamped' || !p.data) throw new Error('This file isn’t a Stamped backup.');
  for (const [id, dataUrl] of Object.entries(p.files || {})) {
    const blob = await (await fetch(dataUrl)).blob();
    await idbPut(id, blob);
  }
  replaceAll(p.data);
}

/* ---------- sample trip (for exploring) ---------- */
export function loadSample() {
  const today = localToday();
  const start = addDays(today, 20), d = (n) => addDays(start, n);
  const t = { id: uid(), name: 'Tokyo & Kyoto', start, end: d(11), accent: 0, home: 'AUD', local: 'JPY', rate: 0.0102, budget: 4500, partner: 'Alex', travellers: 2,
    caps: { transport: 1800, stay: 1500, food: 800, activity: 250, sights: 100, shopping: 50 },
    bases: [
      { id: uid(), name: 'Tokyo', lat: 35.6895, lon: 139.6917, tz: 'Asia/Tokyo', cc: 'JP', from: d(0) },
      { id: uid(), name: 'Hakone', lat: 35.2324, lon: 139.1069, tz: 'Asia/Tokyo', cc: 'JP', from: d(5) },
      { id: uid(), name: 'Kyoto', lat: 35.0116, lon: 135.7681, tz: 'Asia/Tokyo', cc: 'JP', from: d(6) },
      { id: uid(), name: 'Osaka', lat: 34.6937, lon: 135.5023, tz: 'Asia/Tokyo', cc: 'JP', from: d(10) }
    ], created: Date.now(), sample: true };
  db.trips.push(t);
  const ap = {
    MEL: { iata: 'MEL', name: 'Melbourne International Airport', city: 'Melbourne', cc: 'AU', lat: -37.673, lon: 144.843, tz: 'Australia/Melbourne' },
    HND: { iata: 'HND', name: 'Tokyo International Airport', city: 'Tokyo', cc: 'JP', lat: 35.552, lon: 139.78, tz: 'Asia/Tokyo' },
    KIX: { iata: 'KIX', name: 'Kansai International Airport', city: 'Osaka', cc: 'JP', lat: 34.427, lon: 135.244, tz: 'Asia/Tokyo' }
  };
  db.flights.push(
    { id: uid(), tripId: t.id, airline: 'Qantas', number: 'QF79', from: ap.MEL, to: ap.HND, dep: d(0) + 'T10:15', arr: d(0) + 'T18:40', seat: '42A', terminal: 'T2', ref: 'X7K2PQ', cost: 690 },
    { id: uid(), tripId: t.id, airline: 'Qantas', number: 'QF80', from: ap.KIX, to: ap.MEL, dep: d(11) + 'T21:30', arr: addDays(d(11), 1) + 'T08:50', seat: '38C', terminal: 'T1', ref: 'X7K2PQ', cost: 690 }
  );
  const P = (day, time, title, cat, note, booked, lon, lat, cost) => ({ id: uid(), tripId: t.id, date: d(day), time, title, cat, note, booked, place: { name: title, lon, lat } , cost: cost || 0 });
  db.plans.push(
    P(0, '20:30', 'Check in, Shinjuku hotel', 'stay', 'Near the south exit', true, 139.6993, 35.6880),
    P(1, '09:00', 'Senso-ji', 'sights', 'Go early before the crowds', false, 139.7967, 35.7148),
    P(1, '12:30', 'Nakamise street snacks', 'food', '', false, 139.7962, 35.7118),
    P(1, '16:00', 'Meiji Jingu', 'sights', 'Walk through to Harajuku', false, 139.6993, 35.6764),
    P(2, '08:30', 'Tsukiji Outer Market', 'food', 'Breakfast & street food', false, 139.7705, 35.6655),
    P(2, '11:00', 'teamLab Planets', 'activity', 'Tickets saved · 2 adults', true, 139.7895, 35.6490, 120),
    P(2, '14:00', 'Odaiba waterfront', 'sights', 'Free afternoon by the bay', false, 139.7760, 35.6280),
    P(2, '17:00', 'Shibuya shopping', 'shopping', 'Parco & side streets', false, 139.6985, 35.6620),
    P(2, '19:30', 'Dinner in Ebisu', 'food', 'Booked for 2', true, 139.7110, 35.6465),
    P(5, '08:00', 'Check out, Shinjuku hotel', 'stay', 'Luggage forwarded to Kyoto', true, 139.6993, 35.6880),
    P(5, '10:00', 'Arrive Hakone-Yumoto', 'transport', 'Romancecar · reserved seats', true, 139.1035, 35.2325),
    P(5, '11:30', 'Hakone Open-Air Museum', 'sights', 'Allow about 2 hours', false, 139.0505, 35.2450),
    P(5, '15:00', 'Lake Ashi cruise', 'activity', 'From Togendai pier', false, 139.0230, 35.2380),
    P(5, '18:00', 'Ryokan check-in', 'stay', 'Dinner included', true, 139.0270, 35.1950),
    P(6, '12:30', 'Hotel bag drop', 'stay', 'Near Karasuma Oike', true, 135.7595, 35.0105),
    P(6, '13:30', 'Fushimi Inari', 'sights', 'Climb to the halfway viewpoint', false, 135.7727, 34.9671),
    P(6, '17:30', 'Nishiki Market', 'food', 'Snacks before dinner', false, 135.7650, 35.0050),
    P(6, '19:30', 'Dinner in Gion', 'food', 'Booked for 2', true, 135.7755, 35.0037),
    P(10, '18:00', 'Dotonbori', 'food', 'Street food crawl', false, 135.5013, 34.6687)
  );
  const PL = (name, area, cat, lon, lat) => ({ id: uid(), tripId: t.id, name, area, cat, lon, lat });
  db.places.push(
    PL('Nakameguro canal cafés', 'Meguro', 'food', 139.6983, 35.6440), PL('Omoide Yokocho', 'Shinjuku', 'food', 139.6995, 35.6929),
    PL('Shimokitazawa vintage', 'Setagaya', 'shopping', 139.6680, 35.6618), PL('Arashiyama bamboo grove', 'Kyoto', 'sights', 135.6717, 35.0170),
    PL('Ichiran Shibuya', 'Shibuya', 'food', 139.7010, 35.6610), PL('Kiyomizu-dera', 'Kyoto', 'sights', 135.7850, 34.9949)
  );
  db.expenses.push(
    { id: uid(), tripId: t.id, date: today, amount: 1380, cur: 'AUD', home: 1380, cat: 'transport', note: 'Return flights', paidBy: 'me', split: true },
    { id: uid(), tripId: t.id, date: today, amount: 960, cur: 'AUD', home: 960, cat: 'stay', note: 'Hotels deposit', paidBy: 'me', split: true },
    { id: uid(), tripId: t.id, date: today, amount: 11800, cur: 'JPY', home: 120, cat: 'activity', note: 'teamLab tickets', paidBy: 'them', split: true }
  );
  ['Passport', 'Phone charger + adaptor (Type A)', 'IC card / transit pass', 'Cash (yen)', 'Comfortable walking shoes', 'Medications', 'Rain jacket', 'Power bank']
    .forEach((label, i) => db.packing.push({ id: uid(), tripId: t.id, label, done: i < 2 || i === 4, group: 'Essentials' }));
  commit();
  return t;
}

export function newTrip(f) {
  const t = Object.assign({ id: uid(), accent: db.trips.length % 5, home: 'AUD', local: 'AUD', rate: 1, budget: 0, partner: '', travellers: 1, caps: {}, bases: [], created: Date.now() }, f);
  db.trips.push(t);
  ['Passport', 'Phone charger', 'Travel adaptor', 'Medications', 'Comfortable shoes']
    .forEach((label) => db.packing.push({ id: uid(), tripId: t.id, label, done: false, group: 'Essentials' }));
  commit();
  return t;
}

export const tripLength = (t) => diffDays(t.start, t.end) + 1;
