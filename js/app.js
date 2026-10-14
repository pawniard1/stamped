import { db, subscribe, commit, save, trip, ofTrip, tripStatus, baseFor, plansOn, add, update, remove, removeTrip, idbPut, idbGet, idbDel, exportBackup, importBackup, loadSample, newTrip, tripLength } from './store.js';
import { esc, svg, fillSvg, ICONS, CATS, CAT, ACCENTS, tripDays, fmtDay, fmtRange, wd, dayNum, monShort, addDays, diffDays, toMin, fmtDur, fmtIn, nowIn, zonedToUtc, fmtTimeIn, tzDiffLabel, DEVICE_TZ, haversineKm, estimateLeg, appleMapsDir, appleMapsAt, money, countryName, CURRENCY_BY_COUNTRY, wxIcon, wxWord, guessCat, stampDate, clamp, pad2, localToday } from './util.js';
import { play, unlockAudio, refreshWeather, weatherFor, refreshRate, searchCities, searchPlaces, searchAirports, buildICS, saveMapsOffline } from './services.js';
import { Globe } from './globe.js';
import { mapper } from './map.js';

const STAMP_ICON = (n) => `<svg viewBox="0 0 100 100" width="${n}" height="${n}" aria-hidden="true"><rect width="100" height="100" fill="#10142B"></rect><g transform="rotate(-10 50 50)"><rect x="20" y="22" width="60" height="56" rx="10" fill="none" stroke="#FF8FB1" stroke-width="3.5" stroke-dasharray="6 4"></rect><g transform="translate(36 30) scale(1.15)"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" fill="#FF8FB1"></path></g><path d="M30 66h40" stroke="#FF8FB1" stroke-width="3" stroke-linecap="round"></path></g></svg>`;

/* ================= UI state ================= */
const UIKEY = 'stamped.ui';
const ui = Object.assign({ screen: 'trips', tripId: null, day: null, cat: 'all', placeCat: 'all', mapMode: 'day', bigMap: false, sel: null, selPlace: null, selFlight: null, packTab: 'packing', budgetCur: 'home' }, (() => { try { return JSON.parse(localStorage.getItem(UIKEY)) || {}; } catch (e) { return {}; } })());
ui.sel = null; ui.selPlace = null;
let sheet = null;          // { type, data }
let scrollMemo = {};
const persistUI = () => { try { localStorage.setItem(UIKEY, JSON.stringify({ screen: ui.screen, tripId: ui.tripId, budgetCur: ui.budgetCur })); } catch (e) {} };

const app = document.getElementById('app');
const sheetRoot = document.createElement('div'); document.body.appendChild(sheetRoot);
const T = () => (ui.tripId ? trip(ui.tripId) : null);
const acc = (t) => ACCENTS[(t && t.accent) || 0] || ACCENTS[0];
function applyAccent(t) { const a = acc(t); document.documentElement.style.setProperty('--acc', a.solid); document.documentElement.style.setProperty('--acc-light', a.light); }
const tzOf = (t, day) => baseFor(t, day)?.tz || (t.bases?.[0]?.tz) || DEVICE_TZ;
const todayOf = (t) => nowIn(tzOf(t, t.start)).date;
const statusOf = (t) => tripStatus(t, todayOf(t));

/* ================= small render helpers ================= */
const ic = (d, s = 20, x = '') => svg(d, s, x);
const back = (label, act, arg = '') => `<button class="back" data-act="${act}" data-arg="${esc(arg)}">${ic(ICONS.back, 18)}${esc(label)}</button>`;
const catBox = (k, size = 34) => { const c = CAT[k] || CAT.sights; return `<div class="iconbox" style="width:${size}px;height:${size}px;background:${c.tint};color:${c.color}">${ic(c.icon, size > 30 ? 18 : 15)}</div>`; };
const tag = (booked) => `<span class="tag ${booked ? 'booked' : ''}">${booked ? 'Booked' : 'Idea'}</span>`;
const sw = (on, act, arg = '', label = '') => `<button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${esc(label)}" data-act="${act}" data-arg="${esc(arg)}"><i></i></button>`;
function nav() {
  const items = [['home', 'Trip', ICONS.home], ['flights', 'Flights', ICONS.plane], ['plan', 'Plan', ICONS.cal], ['budget', 'Budget', ICONS.wallet], ['places', 'Places', ICONS.pin]];
  return `<nav class="nav" aria-label="Main">${items.map(([k, l, d]) => `<button class="${ui.screen === k ? 'on' : ''}" data-act="go" data-arg="${k}">${ic(d, 24)}${l}</button>`).join('')}</nav>`;
}
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2300); }

/* ================= derived data ================= */
function dayStops(t, day) {
  const list = plansOn(t.id, day); let n = 0;
  return list.map((p) => ({ p, n: p.place && p.place.lat != null ? ++n : null }));
}
function legsFor(stops) {
  // leg between consecutive plans that both have a place
  const legs = {}; let prev = null;
  stops.forEach(({ p }) => { if (p.place?.lat != null) { if (prev) legs[prev.id] = Object.assign(estimateLeg([prev.place.lon, prev.place.lat], [p.place.lon, p.place.lat]), { to: p, from: prev }); prev = p; } });
  return legs;
}
function spentByCat(t) {
  const out = {}; CATS.forEach((c) => (out[c.k] = 0));
  ofTrip('expenses', t.id).forEach((e) => { out[e.cat] = (out[e.cat] || 0) + (e.home || 0); });
  return out;
}
function flightUTC(f) { return { dep: zonedToUtc(f.dep, f.from?.tz), arr: zonedToUtc(f.arr, f.to?.tz) }; }
function nextFlight(t) {
  const now = Date.now();
  return ofTrip('flights', t.id).map((f) => Object.assign({ f }, flightUTC(f))).filter((x) => x.arr > now).sort((a, b) => a.dep - b.dep)[0] || null;
}
function reminders(t) {
  const now = Date.now(), out = [];
  ofTrip('flights', t.id).forEach((f) => {
    const { dep } = flightUTC(f); if (isNaN(dep)) return;
    const h = (dep - now) / 3600000;
    if (h > 0 && h <= 3) out.push({ icon: ICONS.plane, text: `Leave for ${f.from.iata} airport now · ${f.number || 'flight'} departs ${fmtIn((dep - now) / 60000)}`, warn: true });
    else if (h > 3 && h <= 24) out.push({ icon: ICONS.bell, text: `Check-in is open for ${f.number || 'your flight'} · departs ${fmtIn((dep - now) / 60000)}` });
    else if (h > 24 && h <= 26) out.push({ icon: ICONS.bell, text: `Check-in for ${f.number || 'your flight'} opens ${fmtIn((dep - 86400000 - now) / 60000)}` });
  });
  ofTrip('plans', t.id).filter((p) => p.booked && p.time).forEach((p) => {
    const s = zonedToUtc(`${p.date}T${p.time}`, tzOf(t, p.date)), m = (s - now) / 60000;
    if (m > 0 && m <= 60) out.push({ icon: ICONS.clock, text: `${p.title} ${fmtIn(m)}`, warn: true });
  });
  return out;
}
const kmFlown = (t) => ofTrip('flights', t.id).reduce((a, f) => a + (f.from && f.to ? haversineKm([f.from.lon, f.from.lat], [f.to.lon, f.to.lat]) : 0), 0);
function tripCountries(t) {
  const cc = new Map();
  ofTrip('flights', t.id).forEach((f) => { if (f.to?.cc && f.to.cc !== (t.homeCC || 'AU')) cc.set(f.to.cc, f.to.iata); });
  (t.bases || []).forEach((b) => { if (b.cc && b.cc !== (t.homeCC || 'AU') && !cc.has(b.cc)) cc.set(b.cc, b.name.slice(0, 3).toUpperCase()); });
  return [...cc.entries()];
}

/* ================= screens ================= */
function screenTrips() {
  const trips = db.trips.slice().sort((a, b) => (a.start < b.start ? -1 : 1));
  const upcoming = trips.filter((t) => statusOf(t) !== 'past');
  const past = trips.filter((t) => statusOf(t) === 'past').reverse();
  if (!trips.length) {
    return `<div class="screen"><div class="scroll">
      <div style="display:flex;flex-direction:column;align-items:center;gap:18px;margin-top:40px;text-align:center">
        <div style="width:96px;height:96px;border-radius:22px;overflow:hidden">${STAMP_ICON(96)}</div>
        <h1 class="title">Welcome to Stamped</h1>
        <p class="muted" style="margin:0;line-height:1.5">Plan flights, days, budgets and places for every trip. Everything stays on this phone and works offline.</p>
      </div>
      <button class="btn block round" data-act="sheet" data-arg="newTrip" style="margin-top:12px">${ic(ICONS.plus, 18)}Plan a new trip</button>
      <button class="btn ghost block round" data-act="sample">Explore with a sample trip</button>
      <button class="btn ghost block round" data-act="restore">${ic(ICONS.download, 18)}Restore from a backup</button>
      <div class="banner info" style="margin-top:6px">${ic(ICONS.info, 18)}<span>Tip: in Safari tap Share → Add to Home Screen to use Stamped like an app.</span></div>
    </div></div>`;
  }
  const stamps = [];
  past.slice().reverse().forEach((t) => tripCountries(t).forEach(([cc, code]) => stamps.push({ cc, code, date: t.start, color: acc(t).light, id: t.id, faded: false })));
  upcoming.forEach((t) => tripCountries(t).forEach(([cc, code]) => stamps.push({ cc, code, date: t.start, color: '#98A2C3', id: t.id, faded: true })));
  const seen = db.settings.seenStamps || [];
  const shapes = ['14px', '40px', '8px', '22px'], rots = [-8, 6, -3, 9, -6];
  const card = (t, big) => {
    const st = statusOf(t), days = diffDays(todayOf(t), t.start);
    const badge = st === 'now' ? `Day ${diffDays(t.start, todayOf(t)) + 1} of ${tripLength(t)}` : days === 0 ? 'Today' : `In ${days} day${days === 1 ? '' : 's'}`;
    const a = acc(t), sp = Object.values(spentByCat(t)).reduce((x, y) => x + y, 0);
    return big ? `<button class="hero" style="background:${a.solid};border:none;text-align:left" data-act="open" data-arg="${t.id}">
        <div class="between small"><span style="opacity:.9">${fmtRange(t.start, t.end)}</span><span class="pill" style="background:#FF7A59;color:#0A0D18;font-weight:600;padding:3px 10px">${badge}</span></div>
        <span class="display" style="font-size:28px;line-height:1.1">${esc(t.name)}</span>
        <div class="row small" style="gap:16px;opacity:.92"><span>${ofTrip('flights', t.id).length} flights</span><span>${ofTrip('plans', t.id).length} plans</span><span>${money(sp, t.home)}${t.budget ? ' / ' + money(t.budget, t.home) : ''}</span></div>
      </button>` : `<button class="between" style="background:${a.solid};border:none;border-radius:18px;padding:14px 16px;color:#fff;text-align:left" data-act="open" data-arg="${t.id}">
        <div class="col"><span class="strong" style="font-size:16px">${esc(t.name)}</span><span class="small" style="opacity:.9">${fmtRange(t.start, t.end)} · ${badge}</span></div>${ic(ICONS.chev, 18)}</button>`;
  };
  const html = `<div class="screen"><div class="scroll" data-scroll="trips">
    <div class="between"><h1 class="title">Your trips</h1><button class="btn round" style="height:44px" data-act="sheet" data-arg="newTrip">${ic(ICONS.plus, 18)}New trip</button></div>
    ${upcoming.length ? `<div class="eyebrow">Upcoming</div>${upcoming.map((t, i) => card(t, i === 0)).join('')}` : `<div class="empty"><span class="strong">No upcoming trips</span><span class="small muted">Where to next?</span><button class="btn round" data-act="sheet" data-arg="newTrip">Plan a trip</button></div>`}
    ${stamps.length ? `<div class="between" style="margin-top:4px"><div class="eyebrow">Passport</div><span class="small muted">${((n) => `${n} countr${n === 1 ? 'y' : 'ies'}`)(new Set(stamps.filter((s) => !s.faded).map((s) => s.cc)).size)} · ${new Set(stamps.filter((s) => s.faded).map((s) => s.cc)).size} coming up</span></div>
      <div class="chips" style="gap:14px;padding:6px 4px 4px">${stamps.map((s, i) => `<div class="stamp ${!s.faded && !seen.includes(s.id + s.cc) ? 'stamp-pop' : ''}" style="color:${s.color};border-radius:${shapes[i % 4]};transform:rotate(${rots[i % 5]}deg);opacity:${s.faded ? 0.45 : 1}"><span class="c">${esc(countryName(s.cc).toUpperCase())}</span><span class="code">${esc(s.code)}</span><span class="d">${stampDate(s.date)}</span></div>`).join('')}</div>` : ''}
    ${past.length ? `<div class="between" style="margin-top:4px"><div class="eyebrow">Archive</div><span class="small muted">Tap a trip for its recap</span></div>
      <div class="card list">${past.map((t) => `<button class="listrow" style="width:100%;background:none;border-left:none;border-right:none;border-top:none;color:var(--text);text-align:left" data-act="recap" data-arg="${t.id}">
        <div class="iconbox lg" style="background:${acc(t).solid};color:#fff;flex-direction:column;gap:0"><span style="font:600 10px var(--body);text-transform:uppercase">${monShort(t.start)}</span><span class="display" style="font-size:14px">${String(t.start).slice(2, 4)}</span></div>
        <div class="grow col" style="gap:2px"><span class="strong">${esc(t.name)}</span><span class="small muted">${tripLength(t)} days · ${money(Object.values(spentByCat(t)).reduce((x, y) => x + y, 0), t.home)} spent</span></div>${ic(ICONS.chev, 18, 'style="color:var(--muted)"')}</button>`).join('')}</div>` : ''}
    <div class="row small muted" style="align-items:flex-start;padding:0 4px">${ic(ICONS.archive, 18, 'style="flex-shrink:0"')}<span>Trips move to the archive automatically after you get home.</span></div>
  </div></div>`;
  const fresh = stamps.filter((s) => !s.faded && !seen.includes(s.id + s.cc));
  if (fresh.length) { setTimeout(() => play('stamp'), 150); db.settings.seenStamps = seen.concat(fresh.map((s) => s.id + s.cc)); save(); }
  return html;
}

function screenHome(t) {
  const st = statusOf(t), a = acc(t), today = todayOf(t);
  const bases = t.bases || [];
  const days = diffDays(today, t.start);
  let heroInner = '';
  if (st === 'upcoming') {
    const digits = String(Math.max(0, days)).padStart(2, '0').split('');
    heroInner = `<div class="eyebrow">${fmtRange(t.start, t.end)} · ${tripLength(t)} days</div>
      <h1 class="display" style="margin:0;font-size:36px;line-height:1.05">${esc(t.name)}</h1>
      <div class="row"><div class="flip">${digits.map((d) => `<span>${d}</span>`).join('')}</div><span style="font:500 16px var(--body)">day${days === 1 ? '' : 's'} to go</span></div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><span class="pill">${t.travellers || 1} traveller${(t.travellers || 1) > 1 ? 's' : ''}</span>${bases.length ? `<span class="pill">${bases.length} cit${bases.length > 1 ? 'ies' : 'y'}</span>` : ''}<span class="pill">Saved offline</span></div>`;
  } else if (st === 'now') {
    const base = baseFor(t, today), tz = tzOf(t, today), now = nowIn(tz);
    const stops = dayStops(t, today), legs = legsFor(stops);
    const upcomingP = stops.filter(({ p }) => p.time && toMin(p.time) >= now.min - 10);
    const next = upcomingP[0]?.p;
    let prevLeg = null; if (next) Object.values(legs).forEach((l) => { if (l.to.id === next.id) prevLeg = l; });
    const wx = weatherFor(t, base, today), cur = db.weather[base?.id]?.current;
    const leaveBy = next && prevLeg ? toMin(next.time) - prevLeg.min - 5 : null;
    heroInner = `<div class="between"><div class="eyebrow">Today · Day ${diffDays(t.start, today) + 1} of ${tripLength(t)}${base ? ' · ' + esc(base.name) : ''}</div>
        ${wx || cur ? `<span class="row small" style="gap:4px">${wxIcon((cur || wx).code) ? ic(wxIcon((cur || wx).code).d, 16) : ''}${Math.round(cur ? cur.temp : wx.max)}°</span>` : ''}</div>
      <h1 class="display" style="margin:0;font-size:30px;line-height:1.05">${esc(t.name)}</h1>
      ${next ? `<button class="today-next" style="border:none;color:#fff;text-align:left" data-act="goPlan" data-arg="${next.id}">
          ${catBox(next.cat, 40)}
          <div class="grow col" style="gap:2px"><span class="xs" style="opacity:.85;text-transform:uppercase;letter-spacing:.06em">Next up · ${fmtIn(toMin(next.time) - now.min)}</span>
          <span class="strong ellipsis" style="font-size:16px">${esc(next.title)}</span>
          <span class="small" style="opacity:.9">${next.time}${leaveBy != null ? ` · leave by ${pad2(Math.floor(((leaveBy % 1440) + 1440) % 1440 / 60))}:${pad2(((leaveBy % 60) + 60) % 60)}` : ''}${prevLeg ? ` · ≈ ${prevLeg.mode === 'walk' ? 'walk' : 'train'} ${fmtDur(prevLeg.min)}` : ''}</span></div></button>
        ${upcomingP.length > 1 ? `<div class="small" style="opacity:.9">Then ${upcomingP.slice(1, 3).map(({ p }) => `${p.time} ${esc(p.title)}`).join(' · ')}</div>` : ''}`
      : `<div class="today-next"><span class="small">${stops.length ? 'That’s everything planned for today. Enjoy the evening!' : 'Nothing planned today, a free day.'}</span></div>`}
      ${tzDiffLabel(tz) ? `<div class="row" style="gap:8px;flex-wrap:wrap"><span class="pill">${ic(ICONS.clock, 14)}${esc(base?.name || '')} ${fmtTimeIn(Date.now(), tz)} · ${tzDiffLabel(tz)}</span></div>` : ''}`;
  } else {
    heroInner = `<div class="eyebrow">${fmtRange(t.start, t.end)}</div><h1 class="display" style="margin:0;font-size:34px;line-height:1.05">${esc(t.name)}</h1>
      <span>Welcome home. This trip is in your archive.</span><button class="btn round" style="background:#fff;color:#0A0D18;align-self:flex-start" data-act="recap" data-arg="${t.id}">See your trip recap</button>`;
  }
  const rem = reminders(t), nf = nextFlight(t);
  const sp = spentByCat(t), spent = Object.values(sp).reduce((x, y) => x + y, 0);
  const left = (t.budget || 0) - spent, daysLeft = st === 'now' ? diffDays(today, t.end) + 1 : tripLength(t);
  const pk = ofTrip('packing', t.id);
  return `<div class="screen"><div class="scroll" data-scroll="home">
    <div class="between"><button class="back" style="margin:0" data-act="go" data-arg="trips">${ic(ICONS.back, 18)}All trips</button>
      <button class="ibtn" aria-label="Trip settings" data-act="go" data-arg="settings">${ic(ICONS.more, 20)}</button></div>
    <div class="hero" style="background:${a.solid}">${heroInner}</div>
    ${rem.map((r) => `<div class="banner ${r.warn ? '' : 'info'}">${ic(r.icon, 18, 'style="flex-shrink:0"')}<span>${esc(r.text)}</span></div>`).join('')}
    ${nf ? `<button class="card row" style="text-align:left;gap:14px;color:var(--text)" data-act="go" data-arg="flights">
      <div class="iconbox lg" style="background:#232B55;color:#B9C1FF">${ic(ICONS.plane, 22)}</div>
      <div class="grow col" style="gap:2px"><span class="eyebrow">${nf.dep <= Date.now() ? 'In the air' : 'Next flight'}</span>
        <span class="strong" style="font-size:16px">${esc(nf.f.from.iata)} → ${esc(nf.f.to.iata)} · ${fmtDay(nf.f.dep.slice(0, 10))}</span>
        <span class="small muted">Departs ${nf.f.dep.slice(11, 16)}${nf.f.seat ? ' · Seat ' + esc(nf.f.seat) : ''}</span>
        ${db.settings.reminders.checkin ? `<span class="row xs" style="gap:6px;color:#B9C1FF;margin-top:2px">${ic(ICONS.bell, 14)}Calendar reminder when check-in opens</span>` : ''}</div></button>` : ''}
    <button class="card col" style="gap:10px;text-align:left;color:var(--text)" data-act="go" data-arg="budget">
      <div class="between" style="width:100%"><span class="strong" style="font-size:16px">Budget</span><span class="small muted">${money(spent, t.home)}${t.budget ? ' of ' + money(t.budget, t.home) : ''}</span></div>
      <div class="bar" style="width:100%">${CATS.filter((c) => sp[c.k] > 0).map((c) => `<i style="width:${(sp[c.k] / Math.max(t.budget || spent, spent) * 100).toFixed(1)}%;background:${c.color}"></i>`).join('')}</div>
      <span class="small muted">${t.budget ? `${money(Math.abs(left), t.home)} ${left >= 0 ? 'left' : 'over'}${left > 0 ? ` · about ${money(left / Math.max(1, daysLeft), t.home)} a day` : ''}` : 'Set a budget in the Budget tab'}</span></button>
    <div class="grid2">
      <button class="tile" data-act="go" data-arg="plan"><b>${ofTrip('plans', t.id).length}</b><span>plans across ${tripLength(t)} days</span></button>
      <button class="tile" data-act="go" data-arg="places"><b>${ofTrip('places', t.id).length}</b><span>saved places</span></button>
      <button class="tile" data-act="pack" data-arg="packing"><b>${pk.filter((x) => x.done).length}/${pk.length}</b><span>packed</span></button>
      <button class="tile" data-act="pack" data-arg="docs"><b>${ofTrip('docs', t.id).length}</b><span>travel documents</span></button>
    </div>
  </div>${nav()}</div>`;
}

function screenFlights(t) {
  const fl = ofTrip('flights', t.id).map((f) => Object.assign({ f }, flightUTC(f))).sort((a, b) => a.dep - b.dep);
  if (fl.length && !fl.find((x) => x.f.id === ui.selFlight)) ui.selFlight = (fl.find((x) => x.arr > Date.now()) || fl[0]).f.id;
  const sel = fl.find((x) => x.f.id === ui.selFlight);
  let chip = '', line = '';
  if (sel) {
    const now = Date.now(), km = Math.round(haversineKm([sel.f.from.lon, sel.f.from.lat], [sel.f.to.lon, sel.f.to.lat]) / 10) * 10;
    line = `${esc(sel.f.from.city || sel.f.from.iata)} → ${esc(sel.f.to.city || sel.f.to.iata)} · ${km.toLocaleString('en-AU')} km`;
    if (now >= sel.dep && now <= sel.arr) chip = `In the air · ${fmtDur((sel.arr - now) / 60000)} to go`;
    else if (now < sel.dep) chip = `Departs ${fmtIn((sel.dep - now) / 60000)}`;
    else chip = 'Landed';
  }
  const pass = (x) => {
    const f = x.f, dur = (x.arr - x.dep) / 60000, outbound = x === fl[0];
    return `<button class="pass ${f.id === ui.selFlight ? 'sel' : ''}" data-act="selFlight" data-arg="${f.id}">
      <div class="top"><div class="between small muted"><span>${outbound ? 'Outbound' : x === fl[fl.length - 1] && fl.length > 1 ? 'Return' : 'Flight'} · ${fmtDay(f.dep.slice(0, 10))}</span>
        <span class="row" style="gap:10px">${f.airline || f.number ? `<span>${esc([f.airline, f.number].filter(Boolean).join(' '))}</span>` : ''}<span class="linkbtn" data-act="sheet" data-arg="flight:${f.id}" style="min-height:0;padding:0">Edit</span></span></div>
        <div class="row"><div class="col" style="gap:2px"><span class="code">${esc(f.from.iata)}</span><span class="small muted">${f.dep.slice(11, 16)}</span></div>
          <div class="grow col" style="align-items:center;gap:2px"><div style="width:100%;border-top:2px dashed var(--line2)"></div><span class="xs muted">${isNaN(dur) ? '' : fmtDur(dur)}</span></div>
          <div class="col" style="align-items:flex-end;gap:2px"><span class="code">${esc(f.to.iata)}</span><span class="small muted">${f.arr.slice(11, 16)}${f.arr.slice(0, 10) !== f.dep.slice(0, 10) ? ' +1' : ''}</span></div></div></div>
      <div class="tear"></div>
      <div class="bottom"><div class="col" style="gap:2px"><span class="k">Seat</span><span class="strong">${esc(f.seat || '—')}</span></div><div class="col" style="gap:2px"><span class="k">Terminal</span><span class="strong">${esc(f.terminal || '—')}</span></div><div class="col" style="gap:2px"><span class="k">Booking</span><span class="strong ellipsis">${esc(f.ref || '—')}</span></div></div></button>`;
  };
  return `<div class="screen"><div class="scroll" data-scroll="flights">
    <div class="between"><h1 class="title">Flights</h1><button class="ibtn solid" aria-label="Add flight" data-act="sheet" data-arg="flight:">${ic(ICONS.plus, 20)}</button></div>
    ${fl.length ? `<div class="globebox"><div data-slot="globe" style="width:350px;height:256px"></div>
      <div class="mapctl"><button aria-label="Zoom in" data-act="globeZoom" data-arg="1.3">${ic(ICONS.plus, 16)}</button><button aria-label="Zoom out" data-act="globeZoom" data-arg="0.77">${ic(ICONS.minus, 16)}</button></div>
      <div style="position:absolute;left:12px;top:12px" class="row xs"><span class="row" style="gap:6px;background:rgba(255,122,89,0.16);color:#FFB49F;border-radius:999px;padding:4px 10px;font-weight:600"><i style="width:6px;height:6px;border-radius:3px;background:#FF7A59;display:block"></i>${chip}</span></div>
      <div class="small strong">${line}</div><div class="xs muted" style="margin-top:2px">Drag to spin · tap a flight to follow it</div></div>
      ${fl.map(pass).join('')}`
    : `<div class="empty"><span class="strong">No flights yet</span><span class="small muted">Add your flights to see them on the globe and get calendar reminders for check-in.</span><button class="btn round" data-act="sheet" data-arg="flight:">${ic(ICONS.plus, 18)}Add a flight</button></div>`}
  </div>${nav()}</div>`;
}

function screenPlan(t) {
  const days = tripDays(t), today = todayOf(t);
  if (!ui.day || !days.includes(ui.day)) ui.day = days.includes(today) ? today : days[0];
  const day = ui.day, base = baseFor(t, day), stops = dayStops(t, day), legs = legsFor(stops);
  const shown = stops.filter(({ p }) => ui.cat === 'all' || p.cat === ui.cat);
  const counts = {}; stops.forEach(({ p }) => (counts[p.cat] = (counts[p.cat] || 0) + 1));
  const travel = Object.values(legs).reduce((a, l) => a + l.min, 0);
  const selStop = stops.find(({ p }) => p.id === ui.sel);
  const H = ui.bigMap ? 440 : 236;
  const dayBtn = (d, i) => {
    const b = baseFor(t, d), w = weatherFor(t, b, d), wi = w ? wxIcon(w.code) : null, has = plansOn(t.id, d).length;
    return `<button class="day ${d === day ? 'on' : ''} ${d === today ? 'today' : ''}" data-act="day" data-arg="${d}" aria-label="Day ${i + 1}, ${fmtDay(d)}${w ? ', ' + wxWord(w.code) + ' ' + Math.round(w.max) + ' degrees' : ''}">
      <span class="wd">${wd(d)}</span><span class="n">${dayNum(d)}</span>
      <span class="wx">${wi ? `${svg(wi.d, 12, `style="color:${d === day ? '#0A0D18' : wi.c}"`)}${Math.round(w.max)}°` : ''}</span>
      <span class="dot" style="background:${has ? (d === day ? '#FF7A59' : '#8B97FF') : 'transparent'}"></span></button>`;
  };
  const chip = (k, label, color, n) => `<button class="chip ${ui.cat === k ? 'on' : ''} ${!n && ui.cat !== k ? 'dim' : ''}" data-act="cat" data-arg="${k}"><span class="dot" style="background:${color}"></span>${label}<span class="n">${n}</span></button>`;
  const wxDay = weatherFor(t, base, day);
  const items = shown.map(({ p, n }, j) => {
    const c = CAT[p.cat] || CAT.sights, leg = ui.cat === 'all' ? legs[p.id] : null, last = j === shown.length - 1;
    return `<div class="tl"><div class="time">${esc(p.time || '')}</div>
      <div class="rail"><i class="top" style="background:${j ? 'var(--line2)' : 'transparent'}"></i>${catBox(p.cat, 32)}<i class="bot" style="background:${last ? 'transparent' : 'var(--line2)'}"></i></div>
      <div class="body"><button class="plan ${p.id === ui.sel ? 'sel' : ''}" data-act="focusPlan" data-arg="${p.id}">
        <span class="between" style="width:100%"><span class="t">${esc(p.title)}</span>${tag(p.booked)}</span>
        ${p.note ? `<span class="small muted">${esc(p.note)}</span>` : ''}
        <span class="between" style="width:100%"><span class="row xs strong" style="gap:6px;color:${c.color}">${n ? `<span class="numdot" style="background:${c.color}">${n}</span>` : ''}${c.label}${p.place && !n ? '' : ''}</span>
        <span class="linkbtn" data-act="sheet" data-arg="plan:${p.id}" style="min-height:0;padding:0 2px">Edit</span></span></button></div></div>
      ${leg && !last ? `<div class="leg"><div class="sp"></div><div class="dash"><i></i></div><div class="row grow" style="gap:8px"><span class="legpill">${ic(leg.mode === 'walk' ? ICONS.walk : ICONS.train, 16)}≈ ${leg.mode === 'walk' ? 'Walk' : 'Transit'} · ${fmtDur(leg.min)}</span><a class="linkbtn" href="${appleMapsDir([leg.from.place.lon, leg.from.place.lat], [leg.to.place.lon, leg.to.place.lat], leg.mode)}" target="_blank" rel="noopener">Directions</a></div></div>` : ''}`;
  }).join('');
  const sp = selStop?.p, sc = sp ? CAT[sp.cat] : null;
  return `<div class="screen"><div class="scroll tight" data-scroll="plan" style="gap:12px">
    <div class="between pad"><h1 class="title">Itinerary</h1><button class="ibtn solid" aria-label="Add plan" data-act="sheet" data-arg="plan:">${ic(ICONS.plus, 20)}</button></div>
    <div class="mapbox" style="height:${H}px"><div data-slot="map" style="position:absolute;inset:0"></div>
      <div class="mapseg"><button class="${ui.mapMode === 'day' ? 'on' : ''}" data-act="mapMode" data-arg="day">Day</button><button class="${ui.mapMode === 'trip' ? 'on' : ''}" data-act="mapMode" data-arg="trip">Whole trip</button></div>
      <div class="mapctl"><button aria-label="Zoom in" data-act="mapZoom" data-arg="1">${ic(ICONS.plus, 16)}</button><button aria-label="Zoom out" data-act="mapZoom" data-arg="-1">${ic(ICONS.minus, 16)}</button><button aria-label="${ui.bigMap ? 'Shrink map' : 'Expand map'}" data-act="bigMap">${ic(ui.bigMap ? ICONS.shrink : ICONS.expand, 16)}</button></div>
      ${sp ? `<div class="callout">${catBox(sp.cat, 36)}<div class="grow col" style="gap:1px;min-width:0"><span class="strong small ellipsis">${esc(sp.title)}</span><span class="xs muted">${esc(sp.time || '')} · <span style="color:${sc.color}">${sc.label}</span> · ${sp.booked ? 'Booked' : 'Idea'}</span></div>
        <a class="linkbtn" href="${appleMapsAt([sp.place.lon, sp.place.lat, sp.place.name])}" target="_blank" rel="noopener">Directions</a><button class="ibtn" style="width:32px;height:32px;background:#1B2240;border:none" aria-label="Close" data-act="clearSel">${ic(ICONS.close, 14)}</button></div>`
      : `<div class="maphint">${mapper.fallback ? 'Simple map · street detail loads online' : ui.mapMode === 'trip' ? 'Tap a city to jump to it' : 'Drag, pinch or tap a numbered stop'}</div>`}
    </div>
    <div class="days">${days.map(dayBtn).join('')}</div>
    ${ui.bigMap ? '' : `<div class="chips pad">${chip('all', 'All', '#EEF0F8', stops.length)}${CATS.map((c) => chip(c.k, c.label, c.color, counts[c.k] || 0)).join('')}</div>`}
    <div class="between pad"><div class="strong" style="font-size:17px">Day ${days.indexOf(day) + 1} · ${esc(base?.name || fmtDay(day))}</div>
      <div class="small muted">${travel ? '≈ ' + fmtDur(travel) + ' travelling' : wxDay ? `${wxWord(wxDay.code)} · ${Math.round(wxDay.min)}–${Math.round(wxDay.max)}°` : fmtDay(day)}</div></div>
    <div class="pad" style="padding-bottom:16px">
      ${items || `<div class="empty"><span class="strong">${stops.length ? `No ${CAT[ui.cat]?.label.toLowerCase()} plans this day` : 'Nothing planned yet'}</span><span class="small muted">${stops.length ? 'Try another category, or add one.' : ofTrip('places', t.id).length ? `Add a plan, or pick from your ${ofTrip('places', t.id).length} saved places.` : 'Add your first plan for this day.'}</span><button class="btn round" data-act="sheet" data-arg="plan:">Add a plan</button></div>`}
    </div>
  </div>${nav()}</div>`;
}
function planMapCfg(t) {
  const day = ui.day, bases = (t.bases || []).slice().sort((a, b) => (a.from < b.from ? -1 : 1));
  if (ui.mapMode === 'trip') {
    const cur = baseFor(t, day);
    const pts = bases.map((b) => [b.lon, b.lat]);
    return { cities: bases.map((b, i) => ({ id: b.id, lon: b.lon, lat: b.lat, label: `${b.name}`, on: cur && b.id === cur.id, side: i % 2 ? -1 : 1 })), tripLine: pts.length > 1 ? pts : null, stops: [], route: [], fit: pts, fitKey: 'trip:' + ui.bigMap,
      onCity: (id) => { const b = bases.find((x) => x.id === id); ui.mapMode = 'day'; ui.day = b.from < t.start ? t.start : b.from; ui.sel = null; play('click'); render(); } };
  }
  const stops = dayStops(t, day).filter((s) => s.n);
  const fit = stops.map(({ p }) => [p.place.lon, p.place.lat]);
  const base = baseFor(t, day);
  return {
    stops: stops.map(({ p, n }) => ({ id: p.id, lon: p.place.lon, lat: p.place.lat, n, color: (CAT[p.cat] || CAT.sights).color, title: `Stop ${n}: ${p.title}`, sel: p.id === ui.sel, dim: ui.cat !== 'all' && ui.cat !== p.cat })),
    route: fit, animate: true, fit: fit.length ? fit : base ? [[base.lon, base.lat]] : [], fitKey: `day:${day}:${ui.bigMap}:${fit.length}`,
    onPick: (id) => { ui.sel = id; play('click'); render(); }, onMap: () => { if (ui.sel) { ui.sel = null; render(); } }
  };
}

function screenBudget(t) {
  const sp = spentByCat(t), spent = Object.values(sp).reduce((a, b) => a + b, 0);
  const local = t.local && t.local !== t.home, showLocal = local && ui.budgetCur === 'local' && t.rate;
  const disp = (v) => (showLocal ? money(v / t.rate, t.local) : money(v, t.home));
  const today = todayOf(t), st = statusOf(t), daysLeft = st === 'now' ? diffDays(today, t.end) + 1 : tripLength(t);
  const left = (t.budget || 0) - spent;
  const exps = ofTrip('expenses', t.id).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  let owe = 0; exps.filter((e) => e.split).forEach((e) => { owe += e.paidBy === 'me' ? e.home / 2 : -e.home / 2; });
  const total = Math.max(t.budget || 0, spent) || 1;
  return `<div class="screen" style="position:relative"><div class="scroll" data-scroll="budget" style="padding-bottom:90px">
    <div class="between"><h1 class="title">Budget</h1>${local ? `<div class="seg pillseg"><button class="${!showLocal ? 'on' : ''}" data-act="budgetCur" data-arg="home">${t.home}</button><button class="${showLocal ? 'on' : ''}" data-act="budgetCur" data-arg="local">${t.local}</button></div>` : ''}</div>
    <button class="card col" style="gap:12px;text-align:left;color:var(--text)" data-act="sheet" data-arg="budgetSettings">
      <span class="small muted">Spent so far</span>
      <div class="row" style="align-items:baseline;gap:8px"><span class="display" style="font-size:40px;line-height:1">${disp(spent)}</span>${t.budget ? `<span class="muted">of ${disp(t.budget)}</span>` : `<span class="small" style="color:var(--acc-light)">Set a budget</span>`}</div>
      <div class="bar" style="width:100%;height:12px" role="img" aria-label="Spending split by category">${CATS.filter((c) => sp[c.k] > 0).map((c) => `<i style="width:${(sp[c.k] / total * 100).toFixed(1)}%;background:${c.color}"></i>`).join('')}</div>
      <div class="between small muted" style="width:100%"><span>${t.budget ? `${disp(Math.abs(left))} ${left >= 0 ? 'left' : 'over budget'}` : `${exps.length} expenses`}</span>${t.budget && left > 0 ? `<span>≈ ${disp(left / Math.max(1, daysLeft))} / day</span>` : ''}</div>
    </button>
    <div class="between"><h2 class="sub">By category</h2><span class="xs muted">Tap to set a limit</span></div>
    <div class="card list">${CATS.map((c) => { const cap = t.caps?.[c.k] || 0, v = sp[c.k] || 0; return `<button class="listrow" style="width:100%;background:none;border-left:none;border-right:none;border-top:none;color:var(--text);min-height:54px" data-act="sheet" data-arg="cap:${c.k}">${catBox(c.k, 32)}
      <div class="grow col" style="gap:6px"><div class="between small"><span style="font-weight:500">${c.label}</span><span style="color:${cap && v / cap > 0.75 ? '#FFB49F' : 'var(--muted)'}">${disp(v)}${cap ? ' / ' + disp(cap) : ''}</span></div>
      <div class="bar thin"><i style="width:${cap ? Math.min(100, v / cap * 100) : 0}%;background:${c.color}"></i></div></div></button>`; }).join('')}</div>
    ${t.partner || owe ? `<div class="card between" style="padding:12px 16px"><span>Split · ${owe >= 0 ? `${esc(t.partner || 'Your travel buddy')} owes you` : `You owe ${esc(t.partner || 'your travel buddy')}`}</span><span class="strong" style="color:var(--acc-light)">${disp(Math.abs(owe))}</span></div>` : ''}
    <h2 class="sub">Expenses</h2>
    ${exps.length ? `<div class="card list">${exps.map((e) => `<button class="listrow" style="width:100%;background:none;border-left:none;border-right:none;border-top:none;color:var(--text);min-height:56px" data-act="sheet" data-arg="expense:${e.id}">${catBox(e.cat, 32)}
      <div class="grow col" style="gap:2px;text-align:left"><span class="ellipsis" style="font-weight:500">${esc(e.note || CAT[e.cat]?.label)}</span><span class="xs muted">${fmtDay(e.date)}${e.split ? ' · split' : ''}${e.paidBy === 'them' ? ' · paid by ' + esc(t.partner || 'buddy') : ''}</span></div>
      <div class="col" style="align-items:flex-end;gap:2px"><span class="strong">${money(e.amount, e.cur)}</span>${e.cur !== t.home ? `<span class="xs muted">${money(e.home, t.home)}</span>` : ''}</div></button>`).join('')}</div>` : `<div class="empty"><span class="small muted">No expenses yet. Tap Expense to add one.</span></div>`}
  </div>
  <button class="fab" data-act="sheet" data-arg="expense:">${ic(ICONS.plus, 20, 'stroke-width="2.4"')}Expense</button>${nav()}</div>`;
}

function screenPlaces(t) {
  const all = ofTrip('places', t.id);
  const planned = new Set(ofTrip('plans', t.id).filter((p) => p.placeId).map((p) => p.placeId));
  const shown = all.filter((p) => ui.placeCat === 'all' || p.cat === ui.placeCat);
  const counts = {}; all.forEach((p) => (counts[p.cat] = (counts[p.cat] || 0) + 1));
  const sel = all.find((p) => p.id === ui.selPlace), sc = sel ? CAT[sel.cat] : null;
  const chip = (k, label, color, n) => `<button class="chip ${ui.placeCat === k ? 'on' : ''} ${!n && ui.placeCat !== k ? 'dim' : ''}" data-act="placeCat" data-arg="${k}"><span class="dot" style="background:${color}"></span>${label}<span class="n">${n}</span></button>`;
  const dayOf = (pl) => { const p = ofTrip('plans', t.id).find((x) => x.placeId === pl.id); return p ? `Day ${diffDays(t.start, p.date) + 1}` : null; };
  return `<div class="screen"><div class="scroll tight" data-scroll="places" style="gap:12px">
    <div class="between pad"><h1 class="title">Places</h1><button class="ibtn solid" aria-label="Save a place" data-act="sheet" data-arg="place:">${ic(ICONS.plus, 20)}</button></div>
    <div class="mapbox" style="height:${ui.bigMap ? 440 : 250}px"><div data-slot="map" style="position:absolute;inset:0"></div>
      <div class="mapctl"><button aria-label="Zoom in" data-act="mapZoom" data-arg="1">${ic(ICONS.plus, 16)}</button><button aria-label="Zoom out" data-act="mapZoom" data-arg="-1">${ic(ICONS.minus, 16)}</button><button aria-label="Expand map" data-act="bigMap">${ic(ui.bigMap ? ICONS.shrink : ICONS.expand, 16)}</button></div>
      ${sel ? `<div class="callout">${catBox(sel.cat, 36)}<div class="grow col" style="gap:1px;min-width:0"><span class="strong small ellipsis">${esc(sel.name)}</span><span class="xs muted">${esc(sel.area || '')} · <span style="color:${sc.color}">${sc.label}</span></span></div>
        <a class="linkbtn" href="${appleMapsAt([sel.lon, sel.lat, sel.name])}" target="_blank" rel="noopener">Directions</a><button class="ibtn" style="width:32px;height:32px;background:#1B2240;border:none" aria-label="Close" data-act="clearPlace">${ic(ICONS.close, 14)}</button></div>` : ''}
    </div>
    <div class="between pad"><h2 class="display" style="margin:0;font-size:24px">${shown.length} ${ui.placeCat === 'all' ? 'saved places' : CAT[ui.placeCat].label.toLowerCase()}</h2><span class="small muted">${shown.filter((p) => !planned.has(p.id)).length} not on a day yet</span></div>
    <div class="chips pad">${chip('all', 'All', '#EEF0F8', all.length)}${CATS.map((c) => chip(c.k, c.label, c.color, counts[c.k] || 0)).join('')}</div>
    <div class="pad col" style="gap:10px;padding-bottom:16px">
      ${shown.length ? shown.map((p) => { const c = CAT[p.cat], d = dayOf(p); return `<div class="card row" style="padding:10px 12px;gap:12px">
        <button style="display:contents" data-act="focusPlace" data-arg="${p.id}">${catBox(p.cat, 34)}<div class="grow col" style="gap:2px;text-align:left;background:none;border:none"><span class="strong ellipsis">${esc(p.name)}</span><span class="small muted ellipsis">${esc(p.area || '')}${p.area ? ' · ' : ''}<span style="color:${c.color}">${c.label}</span></span></div></button>
        ${d ? `<span class="tag booked">${d}</span>` : `<button class="tag" style="border:none;height:28px;color:var(--acc-light)" data-act="sheet" data-arg="toDay:${p.id}">Add to day</button>`}</div>`; }).join('')
      : `<div class="empty"><span class="strong">${all.length ? 'Nothing in this category' : 'No saved places yet'}</span><span class="small muted">Search for cafés, sights and shops you want to visit. They’ll show on the map, ready to add to a day.</span><button class="btn round" data-act="sheet" data-arg="place:">${ic(ICONS.search, 18)}Find a place</button></div>`}
    </div>
  </div>${nav()}</div>`;
}
function placesMapCfg(t) {
  const all = ofTrip('places', t.id).filter((p) => ui.placeCat === 'all' || p.cat === ui.placeCat);
  const fit = all.map((p) => [p.lon, p.lat]);
  const b = t.bases?.[0];
  return { stops: all.map((p) => ({ id: p.id, lon: p.lon, lat: p.lat, icon: (CAT[p.cat] || CAT.sights).icon, color: (CAT[p.cat] || CAT.sights).color, title: p.name, sel: p.id === ui.selPlace })),
    route: [], fit: fit.length ? fit : b ? [[b.lon, b.lat]] : [], fitKey: `places:${ui.placeCat}:${fit.length}:${ui.bigMap}`,
    onPick: (id) => { ui.selPlace = id; play('click'); render(); }, onMap: () => { if (ui.selPlace) { ui.selPlace = null; render(); } } };
}

function screenPacking(t) {
  const items = ofTrip('packing', t.id), docs = ofTrip('docs', t.id);
  const groups = [...new Set(items.map((i) => i.group || 'Essentials'))];
  return `<div class="screen"><div class="scroll" data-scroll="packing">
    ${back('Trip', 'go', 'home')}
    <h1 class="title">Packing &amp; docs</h1>
    <div class="seg"><button class="${ui.packTab === 'packing' ? 'on' : ''}" data-act="packTab" data-arg="packing">Packing ${items.filter((i) => i.done).length}/${items.length}</button><button class="${ui.packTab === 'docs' ? 'on' : ''}" data-act="packTab" data-arg="docs">Documents ${docs.length}</button></div>
    ${ui.packTab === 'packing' ? `
      ${groups.map((g) => `<div class="card flat" style="padding:4px 0"><div class="between xs muted" style="padding:12px 16px 4px;text-transform:uppercase;letter-spacing:.06em"><span>${esc(g)}</span><span style="text-transform:none;letter-spacing:0">Swipe left to delete</span></div>
        ${items.filter((i) => (i.group || 'Essentials') === g).map((i) => `<div class="swipe"><button class="del" data-act="delPack" data-arg="${i.id}">Delete</button>
          <button class="front ${i.done ? 'done' : ''}" data-swipe="${i.id}" data-act="togglePack" data-arg="${i.id}" role="checkbox" aria-checked="${i.done}"><span class="check ${i.done ? 'on' : ''}">${i.done ? ic(ICONS.check, 14, 'stroke="#0A0D18" stroke-width="3"') : ''}</span><span class="lbl">${esc(i.label)}</span></button></div>`).join('')}</div>`).join('')}
      <form class="row" data-form="addPack"><input class="input grow" name="label" placeholder="Add an item…" autocomplete="off" enterkeyhint="done"><button class="ibtn solid" aria-label="Add item">${ic(ICONS.plus, 20)}</button></form>`
    : `<div class="grid2">${docs.map((d) => `<button class="card col" style="gap:4px;text-align:left;color:var(--text);padding:12px 14px" data-act="openDoc" data-arg="${d.id}">${ic(d.type?.startsWith('image') ? ICONS.doc : ICONS.doc, 22, 'style="color:var(--acc-light)"')}<span class="strong ellipsis">${esc(d.name)}</span><span class="small muted">${d.type?.startsWith('image') ? 'Photo' : 'PDF'} · offline</span></button>`).join('')}
        <label class="card col" style="gap:6px;align-items:center;justify-content:center;border-style:dashed;min-height:96px;color:var(--muted)">${ic(ICONS.plus, 22)}<span class="small">Add photo or PDF</span><input type="file" accept="image/*,application/pdf" data-file="doc" class="hidden"></label></div>
      <div class="row small muted" style="align-items:flex-start">${ic(ICONS.info, 18, 'style="flex-shrink:0"')}<span>Passport photos, insurance and bookings are stored only on this phone and open without signal. They’re included in your backups.</span></div>`}
  </div></div>`;
}

function screenSettings(t) {
  const a = acc(t), r = db.settings.reminders, bases = (t.bases || []).slice().sort((x, y) => (x.from < y.from ? -1 : 1));
  const lb = db.settings.lastBackup;
  return `<div class="screen"><div class="scroll" data-scroll="settings">
    ${back(t.name, 'go', 'home')}
    <h1 class="title">Trip settings</h1>
    <button class="card between" style="color:var(--text);text-align:left" data-act="sheet" data-arg="editTrip"><div class="col"><span class="strong">${esc(t.name)}</span><span class="small muted">${fmtRange(t.start, t.end)} · ${t.travellers || 1} traveller${(t.travellers || 1) > 1 ? 's' : ''}</span></div>${ic(ICONS.edit, 18, 'style="color:var(--muted)"')}</button>
    <h2 class="sub">Cities</h2>
    <div class="card list">${bases.map((b) => `<div class="listrow">${ic(ICONS.pin, 18, 'style="color:var(--acc-light)"')}<div class="grow col" style="gap:2px"><span class="strong">${esc(b.name)}</span><span class="small muted">From ${fmtDay(b.from)}</span></div><button class="linkbtn" data-act="delBase" data-arg="${b.id}" style="color:var(--muted)">Remove</button></div>`).join('')}
      <button class="listrow" style="width:100%;background:none;border:none;color:var(--acc-light);font-weight:600" data-act="sheet" data-arg="base">${ic(ICONS.plus, 18)}Add a city</button></div>
    <h2 class="sub">Trip colour</h2>
    <div class="card col" style="gap:14px">
      <div class="swatches" role="radiogroup" aria-label="Trip colour">${ACCENTS.map((x, i) => `<button role="radio" aria-checked="${i === (t.accent || 0)}" aria-label="${x.name}" data-act="accent" data-arg="${i}" style="border-color:${i === (t.accent || 0) ? x.light : 'transparent'}"><i style="background:${x.solid}"></i></button>`).join('')}</div>
      <span class="small muted" style="line-height:1.45">Changes the trip card, active tab, links and ticks for this trip only. The dark background and category colours stay the same.</span></div>
    <h2 class="sub">Reminders</h2>
    <div class="card list">
      ${[['checkin', 'Check-in opens', '24 hours before each flight'], ['leave', 'Leave for the airport', '3 hours before departure'], ['bookings', 'Bookings coming up', '1 hour before booked plans'], ['morning', 'Morning plan summary', '8:00 each day of the trip']].map(([k, l, s]) => `<div class="listrow"><div class="grow col" style="gap:2px"><span style="font-weight:500">${l}</span><span class="small muted">${s}</span></div>${sw(r[k], 'rem', k, l)}</div>`).join('')}
    </div>
    <button class="btn block" data-act="ics">${ic(ICONS.cal, 18)}Add reminders to Calendar</button>
    <span class="xs muted" style="margin-top:-6px;padding:0 4px;line-height:1.45">Adds your flights and bookings to your iPhone Calendar with these alerts, so they go off even when Stamped is closed or you’re offline. Run it again after you change plans.</span>
    <button class="card between" style="color:var(--text);min-height:60px;padding:0 16px" data-act="go" data-arg="sounds"><span class="row">${ic(ICONS.sound, 20, 'style="color:var(--muted)"')}<span style="font-weight:500">Sound effects</span></span><span class="row small muted">${db.settings.sounds ? 'On' : 'Off'}${ic(ICONS.chev, 18)}</span></button>
    <h2 class="sub">Maps & money</h2>
    <div class="card list">
      <div class="listrow"><div class="grow col" style="gap:2px"><span style="font-weight:500">Offline maps</span><span class="small muted" data-mapsave>${t.mapsSaved ? 'Saved ' + new Date(t.mapsSaved).toLocaleDateString('en-AU') : 'Download your cities before you fly'}</span></div><button class="linkbtn" data-act="saveMaps">${t.mapsSaved ? 'Update' : 'Save'}</button></div>
      <button class="listrow" style="width:100%;background:none;border-left:none;border-right:none;border-top:none;color:var(--text);text-align:left" data-act="sheet" data-arg="budgetSettings"><div class="grow col" style="gap:2px"><span style="font-weight:500">Currency</span><span class="small muted">${t.home}${t.local && t.local !== t.home ? ` · ${t.local} (1 ${t.local} = ${(t.rate || 0).toFixed(4)} ${t.home})` : ''}</span></div>${ic(ICONS.chev, 18, 'style="color:var(--muted)"')}</button>
    </div>
    <h2 class="sub">Backup</h2>
    <div class="card col" style="gap:12px">
      <div class="banner ${lb && Date.now() - lb < 14 * 86400000 ? 'info' : ''}">${ic(lb ? ICONS.check : ICONS.warn, 18, 'style="flex-shrink:0"')}<span>${lb ? `Last backup: ${new Date(lb).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : 'Last backup: never. Your trips only live on this phone.'}</span></div>
      <div class="row"><button class="btn grow" data-act="backup">Save backup file</button><button class="btn ghost grow" data-act="restore">Restore</button></div>
      <span class="xs muted">Save it to Files or iCloud Drive. Restore brings back every trip, plan and document.</span>
    </div>
    <button class="btn danger block" data-act="delTrip">${ic(ICONS.trash, 18)}Delete this trip</button>
  </div></div>`;
}

function screenSounds() {
  const L = [['stamp', 'Stamp', 'Trip archived, new passport stamp', '#FF8FB1', ICONS.archive], ['whoosh', 'Take-off', 'Choosing a flight on the globe', '#8B97FF', ICONS.plane], ['tick', 'Tick', 'Packing item done', '#4FD1BC', ICONS.check],
    ['coin', 'Coins', 'Adding an expense', '#F2C14E', ICONS.wallet], ['swoosh', 'Swipe away', 'Deleting a plan or item', '#FF7A59', ICONS.trash], ['chime', 'Chime', 'Countdown hits zero, trip starts', '#C58BFF', ICONS.bell], ['click', 'Soft click', 'Taps on tabs and pins', '#98A2C3', ICONS.clock]];
  const on = db.settings.sounds;
  return `<div class="screen"><div class="scroll" data-scroll="sounds">
    ${back('Trip settings', 'go', 'settings')}
    <h1 class="title">Sound effects</h1>
    <div class="card between" style="padding:0 16px;min-height:64px"><div class="col" style="gap:2px"><span class="strong">Play sounds</span><span class="small muted">Short and quiet, never while you type</span></div>${sw(on, 'sounds', '', 'Play sounds')}</div>
    <div class="card between" style="padding:0 16px;min-height:64px;opacity:${on ? 1 : 0.45}"><div class="col" style="gap:2px"><span class="strong">Soft clicks</span><span class="small muted">On tabs, days and map pins</span></div>${sw(db.settings.clicks, 'clicks', '', 'Soft clicks')}</div>
    <div class="between"><h2 class="sub">Tap to hear each one</h2><span class="xs muted">Turn your volume up</span></div>
    <div class="card list" style="opacity:${on ? 1 : 0.45}">${L.map(([k, n, w, c, d]) => `<div class="listrow" style="min-height:64px"><div class="iconbox" style="background:${c}29;color:${c}">${ic(d, 18)}</div><div class="grow col" style="gap:2px"><span class="strong">${n}</span><span class="small muted">${w}</span></div><button class="ibtn" style="background:transparent;border-color:var(--line2)" aria-label="Play ${n}" data-act="playSound" data-arg="${k}">${fillSvg(ICONS.play, 16)}</button></div>`).join('')}</div>
    <div class="row small muted" style="align-items:flex-start">${ic(ICONS.info, 18, 'style="flex-shrink:0"')}<span>Calendar reminders use your iPhone’s normal alert sound. These effects only play while Stamped is open.</span></div>
  </div></div>`;
}

function screenRecap(t) {
  const sp = spentByCat(t), spent = Object.values(sp).reduce((a, b) => a + b, 0);
  const visited = ofTrip('plans', t.id).filter((p) => p.place).length, cc = tripCountries(t)[0], a = acc(t);
  const km = Math.round(kmFlown(t) / 10) * 10;
  const segs = CATS.filter((c) => sp[c.k] > 0);
  return `<div class="screen"><div class="scroll" data-scroll="recap">
    ${back('All trips', 'go', 'trips')}
    <div class="col" style="gap:2px"><span class="xs strong" style="color:${a.light};text-transform:uppercase;letter-spacing:.1em">Trip recap</span><h1 class="title" style="font-size:36px">${esc(t.name)}</h1><span class="small muted">${fmtRange(t.start, t.end)} · ${tripLength(t)} days</span></div>
    <div class="globebox" style="padding:0;overflow:hidden;height:200px"><div data-slot="recapGlobe" style="width:350px;height:200px"></div>
      ${cc ? `<div class="stamp stamp-pop" style="position:absolute;right:14px;top:14px;color:${a.light};border-radius:14px;transform:rotate(-9deg);background:rgba(7,9,18,0.7);width:104px;height:82px"><span class="c">${esc(countryName(cc[0]).toUpperCase())}</span><span class="code" style="font-size:24px">${esc(cc[1])}</span><span class="d">${stampDate(t.start)}</span></div>` : ''}</div>
    <div class="grid2">
      <div class="card col" style="padding:12px 14px;gap:2px"><span class="display" style="font-size:24px">${km.toLocaleString('en-AU')} km</span><span class="small muted">flown, ${ofTrip('flights', t.id).length} flights</span></div>
      <div class="card col" style="padding:12px 14px;gap:2px"><span class="display" style="font-size:24px">${visited}</span><span class="small muted">places visited</span></div>
      <div class="card col" style="padding:12px 14px;gap:2px"><span class="display" style="font-size:24px">${money(spent, t.home)}</span><span class="small muted">spent${t.budget ? ' of ' + money(t.budget, t.home) : ''}</span></div>
      <div class="card col" style="padding:12px 14px;gap:2px"><span class="display" style="font-size:24px">${ofTrip('plans', t.id).length}</span><span class="small muted">plans ticked off</span></div>
    </div>
    ${segs.length ? `<div class="card col" style="gap:10px"><div class="between small"><span class="strong">Where the money went</span>${t.budget ? `<span class="muted">${money(Math.abs(t.budget - spent), t.home)} ${t.budget >= spent ? 'under' : 'over'} budget</span>` : ''}</div>
      <div class="bar">${segs.map((c) => `<i style="width:${(sp[c.k] / spent * 100).toFixed(1)}%;background:${c.color}"></i>`).join('')}</div>
      <div class="grid2" style="gap:6px 12px">${segs.map((c) => `<div class="row small" style="gap:6px"><i style="width:8px;height:8px;border-radius:4px;background:${c.color};display:block"></i><span class="grow">${c.label}</span><span class="muted">${money(sp[c.k], t.home)}</span></div>`).join('')}</div></div>` : ''}
    <div class="row"><button class="btn grow round" data-act="shareRecap" data-arg="${t.id}">${ic(ICONS.share, 18)}Share recap</button><button class="btn ghost round" data-act="open" data-arg="${t.id}">Open trip</button></div>
  </div></div>`;
}

const portSide = (p, all) => (all.some((q) => q !== p && Math.abs(q.lat - p.lat) < 4 && Math.abs(q.lon - p.lon) < 8 && q.lon > p.lon) ? -1 : 1);

/* ================= render ================= */
let globe = null, recapGlobe = null, lastScreen = null;
function render() {
  const t = T();
  if (!t && ui.screen !== 'trips') ui.screen = 'trips';
  applyAccent(ui.screen === 'trips' ? null : t);
  const prevScroll = app.querySelector('[data-scroll]');
  if (prevScroll) scrollMemo[prevScroll.dataset.scroll] = prevScroll.scrollTop;
  let html = '';
  switch (ui.screen) {
    case 'home': html = screenHome(t); break;
    case 'flights': html = screenFlights(t); break;
    case 'plan': html = screenPlan(t); break;
    case 'budget': html = screenBudget(t); break;
    case 'places': html = screenPlaces(t); break;
    case 'packing': html = screenPacking(t); break;
    case 'settings': html = screenSettings(t); break;
    case 'sounds': html = screenSounds(); break;
    case 'recap': html = screenRecap(trip(ui.recapId) || t); break;
    default: html = screenTrips();
  }
  app.innerHTML = html;
  const sc = app.querySelector('[data-scroll]');
  if (sc && lastScreen === ui.screen && scrollMemo[sc.dataset.scroll]) sc.scrollTop = scrollMemo[sc.dataset.scroll];
  lastScreen = ui.screen;
  // live components
  const mslot = app.querySelector('[data-slot="map"]');
  if (mslot) { mapper.attach(mslot); mapper.show(ui.screen === 'plan' ? planMapCfg(t) : placesMapCfg(t)); }
  const gslot = app.querySelector('[data-slot="globe"]');
  if (gslot) {
    if (!globe) { const host = document.createElement('div'); globe = new Globe(host); globe.host = host; }
    gslot.appendChild(globe.host);
    const fl = ofTrip('flights', t.id), sel = fl.find((f) => f.id === ui.selFlight);
    const ports = {}; fl.forEach((f) => { ports[f.from.iata] = f.from; ports[f.to.iata] = f.to; });
    let live = null; if (sel) { const u = flightUTC(sel), now = Date.now(); if (now >= u.dep && now <= u.arr) live = (now - u.dep) / (u.arr - u.dep); }
    const sorted = Object.values(ports);
    globe.setData({ arcs: fl.map((f) => ({ id: f.id, from: [f.from.lon, f.from.lat], to: [f.to.lon, f.to.lat] })), ports: sorted.map((p) => ({ ll: [p.lon, p.lat], code: p.iata, side: portSide(p, sorted) })), selected: ui.selFlight, live });
    globe.start();
  } else if (globe) globe.stop();
  const rslot = app.querySelector('[data-slot="recapGlobe"]');
  if (rslot) {
    const rt = trip(ui.recapId) || t, fl = ofTrip('flights', rt.id), a = acc(rt);
    const host = document.createElement('div'); rslot.appendChild(host);
    recapGlobe = new Globe(host, { width: 350, height: 200, interactive: false, landFill: a.solid, landStroke: a.light, arcColor: a.light, accent: '#FFFFFF', plane: false });
    const ports = {}; fl.forEach((f) => { ports[f.from.iata] = f.from; ports[f.to.iata] = f.to; });
    recapGlobe.zoom = 1.6;
    const rp = Object.values(ports);
    recapGlobe.setData({ arcs: fl.map((f) => ({ id: f.id, from: [f.from.lon, f.from.lat], to: [f.to.lon, f.to.lat] })), ports: rp.map((p) => ({ ll: [p.lon, p.lat], code: p.iata, side: portSide(p, rp) })), selected: fl[0]?.id || null });
  }
  bindSwipes();
  persistUI();
}
subscribe(() => { if (!sheet || sheet.liveBehind) render(); });

/* ================= sheets ================= */
function openSheet(type, data = {}) { sheet = { type, data }; renderSheet(); }
function closeSheet() { sheet = null; sheetRoot.innerHTML = ''; render(); }
const field = (label, inner) => `<label class="field"><span>${label}</span>${inner}</label>`;
const inp = (name, val = '', attrs = '') => `<input class="input" name="${name}" value="${esc(val)}" ${attrs}>`;
function catPicker(cur) { return `<div class="catpick" role="radiogroup" aria-label="Category">${CATS.map((c) => `<button type="button" role="radio" aria-checked="${c.k === cur}" class="${c.k === cur ? 'on' : ''}" style="color:${c.color}" data-act="pickCat" data-arg="${c.k}">${svg(c.icon, 16)}<span style="color:var(--text)">${c.label}</span></button>`).join('')}</div>`; }
function renderSheet() {
  if (!sheet) { sheetRoot.innerHTML = ''; return; }
  const t = T(), d = sheet.data; let body = '';
  const daysOpts = (cur) => t ? tripDays(t).map((x, i) => `<option value="${x}" ${x === cur ? 'selected' : ''}>Day ${i + 1} · ${fmtDay(x)}</option>`).join('') : '';
  switch (sheet.type) {
    case 'newTrip': case 'editTrip': {
      const e = sheet.type === 'editTrip' ? t : null;
      body = `<h3>${e ? 'Edit trip' : 'New trip'}</h3>
        ${field('Trip name', inp('name', e?.name || d.name || '', 'placeholder="e.g. Japan in spring" autocomplete="off"'))}
        <div class="row">${field('Start', inp('start', e?.start || d.start || addDays(localToday(), 30), 'type="date"'))}${field('End', inp('end', e?.end || d.end || addDays(localToday(), 37), 'type="date"'))}</div>
        ${field('Travellers', `<select class="input" name="travellers">${[1, 2, 3, 4, 5, 6].map((n) => `<option ${n === (e?.travellers || d.travellers || 1) ? 'selected' : ''}>${n}</option>`).join('')}</select>`)}
        ${e ? '' : field('First city', `${inp('q', d.city?.name || '', 'placeholder="Search a city" autocomplete="off" data-search="city"')}<div class="results ${d.results?.length ? '' : 'hidden'}" data-results>${resultsHTML(d.results, 'city')}</div>`)}
        ${e ? '' : `<div class="field"><span>Trip colour</span><div class="swatches">${ACCENTS.map((x, i) => `<button type="button" data-act="sheetAccent" data-arg="${i}" style="border-color:${i === (d.accent ?? db.trips.length % 5) ? x.light : 'transparent'}" aria-label="${x.name}"><i style="background:${x.solid}"></i></button>`).join('')}</div></div>`}
        <button class="btn block" data-act="saveTrip">${e ? 'Save changes' : 'Create trip'}</button>`;
      break;
    }
    case 'base':
      body = `<h3>Add a city</h3>${field('City', `${inp('q', d.city?.name || '', 'placeholder="Search a city" autocomplete="off" data-search="city"')}<div class="results ${d.results?.length ? '' : 'hidden'}" data-results>${resultsHTML(d.results, 'city')}</div>`)}
        ${field('Arriving', `<select class="input" name="from">${daysOpts(d.from || t.end)}</select>`)}
        <button class="btn block" data-act="saveBase" ${d.city ? '' : 'disabled'}>Add city</button>`;
      break;
    case 'plan': {
      const p = d.id ? db.plans.find((x) => x.id === d.id) : null;
      const f = sheet.form || (sheet.form = { title: p?.title || '', date: p?.date || ui.day || t.start, time: p?.time || '', cat: p?.cat || 'sights', booked: !!p?.booked, note: p?.note || '', place: p?.place || null, placeId: p?.placeId || null });
      body = `<h3>${p ? 'Edit plan' : 'New plan'}</h3>
        ${field('What', inp('title', f.title, 'placeholder="e.g. Fushimi Inari" autocomplete="off" data-bind="title"'))}
        ${field('Where', `${inp('q', f.place?.name || '', 'placeholder="Search for the place" autocomplete="off" data-search="place"')}<div class="results ${d.results?.length ? '' : 'hidden'}" data-results>${resultsHTML(d.results, 'place')}</div>${f.place ? `<span class="xs" style="color:var(--acc-light)">${ic(ICONS.pin, 12)} Pinned on the map</span>` : ''}`)}
        <div class="row">${field('Day', `<select class="input" name="date" data-bind="date">${daysOpts(f.date)}</select>`)}${field('Time', inp('time', f.time, 'type="time" data-bind="time"'))}</div>
        <div class="field"><span>Category</span>${catPicker(f.cat)}</div>
        <div class="between card" style="padding:10px 14px"><span>Booked</span>${sw(f.booked, 'toggleBooked', '', 'Booked')}</div>
        ${field('Notes', `<textarea class="input" name="note" data-bind="note" placeholder="Tickets, reservation, tips…">${esc(f.note)}</textarea>`)}
        <button class="btn block" data-act="savePlan">${p ? 'Save' : 'Add to day'}</button>
        ${p ? `<button class="btn danger block" data-act="delPlan" data-arg="${p.id}">Delete plan</button>` : ''}`;
      break;
    }
    case 'place': {
      const f = sheet.form || (sheet.form = { cat: 'food', picked: null });
      body = `<h3>Save a place</h3>
        ${field('Search', `${inp('q', f.picked?.name || '', 'placeholder="Cafés, sights, shops…" autocomplete="off" data-search="place"')}<div class="results ${d.results?.length ? '' : 'hidden'}" data-results>${resultsHTML(d.results, 'place')}</div>`)}
        ${f.picked ? `<div class="card row" style="padding:10px 12px">${ic(ICONS.pin, 18, 'style="color:var(--acc-light)"')}<div class="col grow"><span class="strong">${esc(f.picked.name)}</span><span class="xs muted">${esc(f.picked.sub || '')}</span></div></div>` : ''}
        <div class="field"><span>Category</span>${catPicker(f.cat)}</div>
        <button class="btn block" data-act="savePlace" ${f.picked ? '' : 'disabled'}>Save place</button>
        ${d.id ? `<button class="btn danger block" data-act="delPlace" data-arg="${d.id}">Delete place</button>` : ''}`;
      break;
    }
    case 'toDay': {
      const pl = db.places.find((x) => x.id === d.id);
      body = `<h3>Add to a day</h3><p class="muted" style="margin:0">${esc(pl?.name || '')}</p>
        <div class="row">${field('Day', `<select class="input" name="date">${daysOpts(ui.day || t.start)}</select>`)}${field('Time', inp('time', '', 'type="time"'))}</div>
        <button class="btn block" data-act="placeToDay" data-arg="${d.id}">Add to itinerary</button>
        <button class="btn danger block" data-act="delPlace" data-arg="${d.id}">Delete place</button>`;
      break;
    }
    case 'flight': {
      const fl = d.id ? db.flights.find((x) => x.id === d.id) : null;
      const f = sheet.form || (sheet.form = { from: fl?.from || null, to: fl?.to || null });
      const day0 = fl?.dep?.slice(0, 10) || t.start;
      const apField = (k, label) => field(label, `${inp('q_' + k, f[k] ? `${f[k].iata} · ${f[k].city || f[k].name}` : '', `placeholder="City or airport code" autocomplete="off" data-search="airport" data-key="${k}"`)}<div class="results ${d['results_' + k]?.length ? '' : 'hidden'}" data-results="${k}">${resultsHTML(d['results_' + k], 'airport', k)}</div>`);
      body = `<h3>${fl ? 'Edit flight' : 'Add a flight'}</h3>
        <div class="row">${field('Airline', inp('airline', fl?.airline || '', 'placeholder="Qantas" autocomplete="off"'))}${field('Flight no.', inp('number', fl?.number || '', 'placeholder="QF79" autocomplete="off" autocapitalize="characters"'))}</div>
        ${apField('from', 'From')}${apField('to', 'To')}
        <div class="row">${field('Departs (local)', inp('depD', day0, 'type="date"'))}${field('Time', inp('depT', fl?.dep?.slice(11, 16) || '', 'type="time"'))}</div>
        <div class="row">${field('Arrives (local)', inp('arrD', fl?.arr?.slice(0, 10) || day0, 'type="date"'))}${field('Time', inp('arrT', fl?.arr?.slice(11, 16) || '', 'type="time"'))}</div>
        <div class="row">${field('Seat', inp('seat', fl?.seat || '', 'autocomplete="off"'))}${field('Terminal', inp('terminal', fl?.terminal || '', 'autocomplete="off"'))}${field('Booking', inp('ref', fl?.ref || '', 'autocomplete="off" autocapitalize="characters"'))}</div>
        <button class="btn block" data-act="saveFlight">${fl ? 'Save' : 'Add flight'}</button>
        ${fl ? `<button class="btn danger block" data-act="delFlight" data-arg="${fl.id}">Delete flight</button>` : ''}`;
      break;
    }
    case 'expense': {
      const e = d.id ? db.expenses.find((x) => x.id === d.id) : null;
      const f = sheet.form || (sheet.form = { cat: e?.cat || 'food', cur: e?.cur || (t.local || t.home), split: e ? !!e.split : !!t.partner, paidBy: e?.paidBy || 'me' });
      const curs = [...new Set([t.home, t.local].filter(Boolean))];
      body = `<h3>${e ? 'Edit expense' : 'Add expense'}</h3>
        <div class="row">${field('Amount', inp('amount', e?.amount ?? '', 'type="number" inputmode="decimal" step="any" placeholder="0"'))}
          ${curs.length > 1 ? `<div class="field"><span>Currency</span><div class="seg" style="height:48px;align-items:center">${curs.map((c) => `<button type="button" class="${f.cur === c ? 'on' : ''}" data-act="expCur" data-arg="${c}">${c}</button>`).join('')}</div></div>` : ''}</div>
        ${field('What for', inp('note', e?.note || '', 'placeholder="e.g. Ramen lunch" autocomplete="off"'))}
        <div class="field"><span>Category</span>${catPicker(f.cat)}</div>
        ${field('Day', `<select class="input" name="date">${[localToday()].concat(tripDays(t)).filter((v, i, a) => a.indexOf(v) === i).map((x) => `<option value="${x}" ${x === (e?.date || localToday()) ? 'selected' : ''}>${x === localToday() ? 'Today · ' : ''}${fmtDay(x)}</option>`).join('')}</select>`)}
        <div class="between card" style="padding:10px 14px"><span>Split with ${esc(t.partner || 'travel buddy')}</span>${sw(f.split, 'expSplit', '', 'Split')}</div>
        ${f.split ? `<div class="seg"><button type="button" class="${f.paidBy === 'me' ? 'on' : ''}" data-act="expPaid" data-arg="me">I paid</button><button type="button" class="${f.paidBy === 'them' ? 'on' : ''}" data-act="expPaid" data-arg="them">${esc(t.partner || 'They')} paid</button></div>` : ''}
        <button class="btn block" data-act="saveExpense">${e ? 'Save' : 'Add expense'}</button>
        ${e ? `<button class="btn danger block" data-act="delExpense" data-arg="${e.id}">Delete expense</button>` : ''}`;
      break;
    }
    case 'cap':
      body = `<h3>${CAT[d.k].label} limit</h3>${field(`Limit in ${t.home}`, inp('cap', t.caps?.[d.k] || '', 'type="number" inputmode="decimal" placeholder="No limit"'))}<button class="btn block" data-act="saveCap" data-arg="${d.k}">Save</button>`;
      break;
    case 'budgetSettings':
      body = `<h3>Budget & currency</h3>
        ${field(`Total budget (${t.home})`, inp('budget', t.budget || '', 'type="number" inputmode="decimal" placeholder="e.g. 4500"'))}
        <div class="row">${field('Home currency', inp('home', t.home, 'maxlength="3" autocapitalize="characters" autocomplete="off"'))}${field('Local currency', inp('local', t.local || t.home, 'maxlength="3" autocapitalize="characters" autocomplete="off"'))}</div>
        ${field('Exchange rate (1 local = ? home)', inp('rate', t.rate || 1, 'type="number" step="any" inputmode="decimal"'))}
        <span class="xs muted" style="margin-top:-8px">Updated automatically when you’re online.</span>
        ${field('Travel buddy for splitting', inp('partner', t.partner || '', 'placeholder="Name (optional)" autocomplete="off"'))}
        <button class="btn block" data-act="saveBudget">Save</button>`;
      break;
    case 'doc':
      body = `<h3>${esc(d.name)}</h3><div data-docview style="min-height:200px;display:flex;align-items:center;justify-content:center" class="muted">Loading…</div>
        <button class="btn danger block" data-act="delDoc" data-arg="${d.id}">Delete document</button>`;
      break;
    case 'confirm':
      body = `<h3>${esc(d.title)}</h3><p class="muted" style="margin:0;line-height:1.5">${esc(d.text)}</p><button class="btn danger block" data-act="${d.act}" data-arg="${esc(d.arg || '')}">${esc(d.ok)}</button><button class="btn ghost block" data-act="closeSheet">Cancel</button>`;
      break;
  }
  sheetRoot.innerHTML = `<div class="sheet-bg" data-act="bgClose"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${body}</div></div>`;
  if (sheet.type === 'doc') showDoc(d.id);
}
function resultsHTML(list, kind, key = '') {
  return (list || []).map((r, i) => `<button type="button" data-act="pickResult" data-arg="${kind}:${key}:${i}"><span class="strong">${esc(kind === 'airport' ? `${r.iata} · ${r.city || r.name}` : r.name)}</span><span class="xs muted">${esc(kind === 'airport' ? `${r.name} · ${countryName(r.cc)}` : r.sub)}</span></button>`).join('');
}
const sheetVal = (name) => sheetRoot.querySelector(`[name="${name}"]`)?.value?.trim() ?? '';
function syncForm() { if (!sheet?.form) return; sheetRoot.querySelectorAll('[data-bind]').forEach((el) => { sheet.form[el.dataset.bind] = el.value; }); }

let searchTimer = null;
sheetRoot.addEventListener('input', (e) => {
  const el = e.target; if (!el.dataset.search || !sheet) return;
  clearTimeout(searchTimer);
  const q = el.value.trim(), kind = el.dataset.search, key = el.dataset.key || '';
  const box = sheetRoot.querySelector(key ? `[data-results="${key}"]` : '[data-results]');
  if (q.length < 2) { box.classList.add('hidden'); return; }
  searchTimer = setTimeout(async () => {
    try {
      const t = T();
      const near = t ? (baseFor(t, sheet.form?.date || ui.day || t.start) || t.bases?.[0]) : null;
      const res = kind === 'city' ? await searchCities(q) : kind === 'airport' ? await searchAirports(q) : await searchPlaces(q, near);
      if (!sheet) return;
      sheet.data[key ? 'results_' + key : 'results'] = res;
      box.innerHTML = res.length ? resultsHTML(res, kind, key) : `<button type="button" disabled><span class="small muted">No matches${kind !== 'airport' && !navigator.onLine ? ' (you’re offline)' : ''}</span></button>`;
      box.classList.remove('hidden');
    } catch (err) { box.innerHTML = `<button type="button" disabled><span class="small muted">${navigator.onLine ? 'Search isn’t responding, try again' : 'Search needs internet'}</span></button>`; box.classList.remove('hidden'); }
  }, 350);
});

async function showDoc(id) {
  const box = sheetRoot.querySelector('[data-docview]'); if (!box) return;
  const blob = await idbGet(id).catch(() => null);
  if (!blob) { box.textContent = 'File not found on this phone.'; return; }
  const url = URL.createObjectURL(blob);
  if (blob.type.startsWith('image')) box.innerHTML = `<img src="${url}" alt="" style="max-width:100%;max-height:60vh;border-radius:12px">`;
  else box.innerHTML = `<a class="btn" href="${url}" target="_blank" rel="noopener">${ic(ICONS.doc, 18)}Open PDF</a>`;
}

/* ================= actions ================= */
function go(screen) { ui.screen = screen; ui.sel = null; ui.selPlace = null; if (screen === 'plan' || screen === 'places') ui.bigMap = false; play('click'); render(); window.scrollTo(0, 0); afterOpen(); }
function afterOpen() {
  const t = T(); if (!t || ui.screen === 'trips') return;
  refreshWeather(t).then((ch) => { if (ch && !sheet) render(); });
  refreshRate(t).then((r) => { if (r && t.autoRate !== false && Math.abs((t.rate || 0) - r) > 1e-9) { t.rate = r; save(); } });
}
const A = {
  go: (a) => go(a),
  open: (id) => { ui.tripId = id; ui.day = null; ui.cat = 'all'; ui.mapMode = 'day'; ui.selFlight = null; go('home'); },
  recap: (id) => { ui.recapId = id; ui.tripId = id; go('recap'); play('stamp'); },
  sample: () => { const t = loadSample(); A.open(t.id); toast('Sample trip added. Delete it any time in Trip settings'); },
  pack: (tab) => { ui.packTab = tab; go('packing'); },
  packTab: (tab) => { ui.packTab = tab; render(); },
  day: (d) => { ui.day = d; ui.sel = null; ui.cat = 'all'; ui.mapMode = 'day'; play('click'); render(); },
  cat: (k) => { ui.cat = k; play('click'); render(); },
  placeCat: (k) => { ui.placeCat = k; ui.selPlace = null; play('click'); render(); },
  mapMode: (m) => { ui.mapMode = m; ui.sel = null; play('click'); render(); },
  mapZoom: (d) => mapper.zoomBy(Number(d)),
  bigMap: () => { ui.bigMap = !ui.bigMap; render(); setTimeout(() => { mapper.resize(); const t = T(); if (ui.screen === 'plan') mapper.fit(planMapCfg(t).fit); else mapper.fit(placesMapCfg(t).fit); }, 280); },
  clearSel: () => { ui.sel = null; render(); },
  clearPlace: () => { ui.selPlace = null; render(); },
  focusPlan: (id) => {
    const p = db.plans.find((x) => x.id === id); ui.sel = id; ui.mapMode = 'day'; render();
    if (p?.place?.lat != null) { mapper.show(Object.assign(planMapCfg(T()), { focus: { lon: p.place.lon, lat: p.place.lat, zoom: 15 } })); app.querySelector('[data-scroll]').scrollTo({ top: 0, behavior: 'smooth' }); }
  },
  focusPlace: (id) => { const p = db.places.find((x) => x.id === id); ui.selPlace = id; render(); if (p) { mapper.show(Object.assign(placesMapCfg(T()), { focus: { lon: p.lon, lat: p.lat, zoom: 15 } })); app.querySelector('[data-scroll]').scrollTo({ top: 0, behavior: 'smooth' }); } },
  goPlan: (id) => { const p = db.plans.find((x) => x.id === id); if (p) ui.day = p.date; ui.sel = id; go('plan'); },
  selFlight: (id, el, e) => { if (e.target.closest('[data-arg^="flight:"]')) return A.sheet('flight:' + id); ui.selFlight = id; play('whoosh'); render(); },
  globeZoom: (f) => globe?.zoomBy(Number(f)),
  togglePack: (id, el) => { if (el.dataset.open === '1') return; const i = db.packing.find((x) => x.id === id); if (!i) return; i.done = !i.done; if (i.done) play('tick'); commit(); },
  delPack: (id) => { play('swoosh'); remove('packing', id); },
  accent: (i) => { update('trips', ui.tripId, { accent: Number(i) }); play('click'); },
  rem: (k) => { db.settings.reminders[k] = !db.settings.reminders[k]; commit(); },
  sounds: () => { db.settings.sounds = !db.settings.sounds; commit(); if (db.settings.sounds) play('tick'); },
  clicks: () => { db.settings.clicks = !db.settings.clicks; commit(); play('click'); },
  playSound: (k) => play(k, !db.settings.sounds ? false : true),
  delBase: (id) => { const t = T(); t.bases = t.bases.filter((b) => b.id !== id); commit(); },
  budgetCur: (c) => { ui.budgetCur = c; render(); },
  sheet: (arg) => {
    const [type, id] = String(arg).split(':');
    if (type === 'plan') return openSheet('plan', { id });
    if (type === 'flight') return openSheet('flight', { id });
    if (type === 'expense') return openSheet('expense', { id });
    if (type === 'cap') return openSheet('cap', { k: id });
    if (type === 'toDay') return openSheet('toDay', { id });
    if (type === 'place') return openSheet('place', { id });
    openSheet(type);
  },
  closeSheet: () => closeSheet(),
  bgClose: (a, el, e) => { if (e.target === el) closeSheet(); },
  pickCat: (k) => { syncForm(); sheet.form.cat = k; rerenderSheetKeep(); },
  toggleBooked: () => { syncForm(); sheet.form.booked = !sheet.form.booked; rerenderSheetKeep(); },
  sheetAccent: (i) => { sheet.data.accent = Number(i); keepTripForm(); renderSheet(); },
  expCur: (c) => { keepInputs(); sheet.form.cur = c; rerenderSheetKeep(); },
  expSplit: () => { keepInputs(); sheet.form.split = !sheet.form.split; rerenderSheetKeep(); },
  expPaid: (w) => { keepInputs(); sheet.form.paidBy = w; rerenderSheetKeep(); },
  pickResult: (arg) => {
    const [kind, key, i] = arg.split(':'), list = sheet.data[key ? 'results_' + key : 'results'] || [], r = list[Number(i)]; if (!r) return;
    if (kind === 'city') { keepTripForm(); sheet.data.city = r; sheet.data.results = []; renderSheet(); return; }
    if (kind === 'airport') { keepInputs(); sheet.form[key] = r; sheet.data['results_' + key] = []; rerenderSheetKeep(); return; }
    if (sheet.type === 'plan') { syncForm(); sheet.form.place = { name: r.name, lat: r.lat, lon: r.lon, area: r.area }; if (!sheet.form.title) sheet.form.title = r.name; sheet.form.cat = guessCat(r.key, r.value); sheet.data.results = []; rerenderSheetKeep(); }
    else if (sheet.type === 'place') { sheet.form.picked = r; sheet.form.cat = guessCat(r.key, r.value); sheet.data.results = []; renderSheet(); }
  },
  saveTrip: () => {
    const name = sheetVal('name') || 'My trip', start = sheetVal('start'), end = sheetVal('end') < start ? start : sheetVal('end'), travellers = Number(sheetVal('travellers')) || 1;
    if (!start) return toast('Pick a start date');
    if (sheet.type === 'editTrip') { const t = T(); Object.assign(t, { name, start, end, travellers }); (t.bases || []).forEach((b) => { if (b.from < start) b.from = start; if (b.from > end) b.from = end; }); commit(); closeSheet(); return; }
    const c = sheet.data.city;
    const cur = c ? CURRENCY_BY_COUNTRY[c.cc] || 'AUD' : 'AUD';
    const t = newTrip({ name, start, end, travellers, accent: sheet.data.accent ?? db.trips.length % 5, local: cur, rate: cur === 'AUD' ? 1 : 0, bases: c ? [{ id: Math.random().toString(36).slice(2), name: c.name, lat: c.lat, lon: c.lon, tz: c.tz, cc: c.cc, from: start }] : [] });
    sheet = null; sheetRoot.innerHTML = ''; A.open(t.id); play('stamp');
  },
  saveBase: () => { const c = sheet.data.city; if (!c) return; const t = T(); t.bases = (t.bases || []).concat([{ id: Math.random().toString(36).slice(2), name: c.name, lat: c.lat, lon: c.lon, tz: c.tz, cc: c.cc, from: sheetVal('from') }]); commit(); closeSheet(); },
  savePlan: () => {
    syncForm(); const f = sheet.form, t = T();
    if (!f.title) return toast('Give the plan a name');
    const data = { tripId: t.id, title: f.title, date: f.date, time: f.time, cat: f.cat, booked: f.booked, note: f.note, place: f.place, placeId: f.placeId };
    if (sheet.data.id) update('plans', sheet.data.id, data); else add('plans', data);
    ui.day = f.date; closeSheet(); play('tick');
  },
  delPlan: (id) => { remove('plans', id); play('swoosh'); ui.sel = null; closeSheet(); },
  savePlace: () => { const f = sheet.form, t = T(); if (!f.picked) return; add('places', { tripId: t.id, name: f.picked.name, area: f.picked.area, cat: f.cat, lon: f.picked.lon, lat: f.picked.lat }); closeSheet(); play('tick'); },
  delPlace: (id) => { db.plans.forEach((p) => { if (p.placeId === id) p.placeId = null; }); remove('places', id); play('swoosh'); ui.selPlace = null; closeSheet(); },
  placeToDay: (id) => { const pl = db.places.find((x) => x.id === id), t = T(); add('plans', { tripId: t.id, title: pl.name, date: sheetVal('date'), time: sheetVal('time'), cat: pl.cat, booked: false, note: '', place: { name: pl.name, lat: pl.lat, lon: pl.lon }, placeId: pl.id }); closeSheet(); play('tick'); toast('Added to Day ' + (diffDays(t.start, sheetVal('date') || t.start) + 1)); },
  saveFlight: () => {
    keepInputs(); const f = sheet.form, t = T();
    if (!f.from || !f.to) return toast('Pick both airports');
    const depT = sheetVal('depT'), arrT = sheetVal('arrT');
    if (!depT || !arrT) return toast('Add departure and arrival times');
    const data = { tripId: t.id, airline: sheetVal('airline'), number: sheetVal('number').toUpperCase(), from: f.from, to: f.to, dep: `${sheetVal('depD')}T${depT}`, arr: `${sheetVal('arrD')}T${arrT}`, seat: sheetVal('seat').toUpperCase(), terminal: sheetVal('terminal'), ref: sheetVal('ref').toUpperCase() };
    if (sheet.data.id) update('flights', sheet.data.id, data); else { const fl = add('flights', data); ui.selFlight = fl.id; }
    closeSheet(); play('whoosh');
  },
  delFlight: (id) => { remove('flights', id); play('swoosh'); closeSheet(); },
  saveExpense: () => {
    keepInputs(); const f = sheet.form, t = T(), amount = parseFloat(sheetVal('amount'));
    if (!amount) return toast('Enter an amount');
    const home = f.cur === t.home ? amount : amount * (t.rate || 1);
    const data = { tripId: t.id, amount, cur: f.cur, home: Math.round(home * 100) / 100, cat: f.cat, note: sheetVal('note'), date: sheetVal('date'), split: f.split, paidBy: f.paidBy };
    if (sheet.data.id) update('expenses', sheet.data.id, data); else add('expenses', data);
    closeSheet(); play('coin');
  },
  delExpense: (id) => { remove('expenses', id); play('swoosh'); closeSheet(); },
  saveCap: (k) => { const t = T(); t.caps = Object.assign({}, t.caps, { [k]: parseFloat(sheetVal('cap')) || 0 }); commit(); closeSheet(); },
  saveBudget: () => {
    const t = T(), home = sheetVal('home').toUpperCase() || 'AUD', local = sheetVal('local').toUpperCase() || home, rate = parseFloat(sheetVal('rate')) || 1;
    const rateChanged = Math.abs(rate - (t.rate || 0)) > 1e-9;
    Object.assign(t, { budget: parseFloat(sheetVal('budget')) || 0, home, local, rate, partner: sheetVal('partner'), autoRate: rateChanged ? false : t.autoRate });
    if (local !== home && !rateChanged) refreshRate(t).then((r) => { if (r) { t.rate = r; commit(); } });
    commit(); closeSheet();
  },
  openDoc: (id) => { const d = db.docs.find((x) => x.id === id); openSheet('doc', { id, name: d?.name || 'Document' }); },
  delDoc: (id) => { idbDel(id); remove('docs', id); play('swoosh'); closeSheet(); },
  delTrip: () => openSheet('confirm', { title: 'Delete this trip?', text: 'This removes its flights, plans, places, expenses and documents from this phone. It can’t be undone unless you have a backup.', ok: 'Delete trip', act: 'reallyDelTrip' }),
  reallyDelTrip: () => { removeTrip(ui.tripId); ui.tripId = null; sheet = null; sheetRoot.innerHTML = ''; go('trips'); },
  ics: () => {
    const t = T(), ics = buildICS(t, ofTrip('flights', t.id), ofTrip('plans', t.id), (d) => baseFor(t, d));
        const a = document.createElement('a');
    a.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
    document.body.appendChild(a); a.click(); a.remove();
    toast('Tap “Add All” to put your reminders in Calendar');
  },
  backup: async () => {
    try {
      const blob = await exportBackup(), name = `stamped-backup-${localToday()}.json`, file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'Stamped backup' });
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
      db.settings.lastBackup = Date.now(); commit(); toast('Backup saved');
    } catch (e) { if (e.name !== 'AbortError') toast('Backup didn’t finish'); }
  },
  restore: () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = async () => { try { await importBackup(await i.files[0].text()); toast('Trips restored'); ui.screen = 'trips'; ui.tripId = null; render(); } catch (e) { toast(e.message || 'Couldn’t read that file'); } }; i.click(); },
  saveMaps: async (a, el) => {
    const t = T(), label = app.querySelector('[data-mapsave]');
    if (!navigator.onLine) return toast('Connect to the internet to save maps');
    const pts = (t.bases || []).map((b) => [b.lon, b.lat, 0.09]);
    ofTrip('plans', t.id).forEach((p) => { if (p.place?.lat != null) pts.push([p.place.lon, p.place.lat, 0.02]); });
    ofTrip('places', t.id).forEach((p) => pts.push([p.lon, p.lat, 0.02]));
    if (!pts.length) return toast('Add a city first');
    el.disabled = true;
    try { await saveMapsOffline(pts, (d, n) => { if (label) label.textContent = `Downloading… ${Math.round(d / n * 100)}%`; }); t.mapsSaved = Date.now(); commit(); toast('Maps saved for offline'); }
    catch (e) { toast('Couldn’t download maps right now'); el.disabled = false; }
  },
  shareRecap: (id) => {
    const t = trip(id), sp = Object.values(spentByCat(t)).reduce((a, b) => a + b, 0);
    const text = `${t.name} · ${fmtRange(t.start, t.end)}\n✈ ${Math.round(kmFlown(t)).toLocaleString('en-AU')} km flown · ${ofTrip('plans', t.id).length} plans · ${money(sp, t.home)} spent\nPlanned with Stamped`;
    if (navigator.share) navigator.share({ title: t.name, text }).catch(() => {}); else { navigator.clipboard?.writeText(text); toast('Copied to clipboard'); }
  }
};
function keepInputs() { if (!sheet) return; sheet.keep = {}; sheetRoot.querySelectorAll('input[name],select[name],textarea[name]').forEach((el) => { if (!el.dataset.search) sheet.keep[el.name] = el.value; }); syncForm(); }
function keepTripForm() { keepInputs(); }
function rerenderSheetKeep() { syncForm(); renderSheet(); }
const _render = renderSheet;
// keep typed values when re-rendering any sheet
renderSheet = function () { const keep = sheet ? (() => { const o = {}; sheetRoot.querySelectorAll('input[name],select[name],textarea[name]').forEach((el) => { if (!el.dataset.search && el.type !== 'file') o[el.name] = el.value; }); return o; })() : null; _render(); if (keep && sheet) Object.entries(keep).forEach(([k, v]) => { const el = sheetRoot.querySelector(`[name="${k}"]`); if (el && !el.dataset.search && !el.dataset.bind) el.value = v; }); };

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = A[el.dataset.act]; if (!fn) return;
  if (el.tagName === 'A' && el.getAttribute('href')) return;
  if (el.dataset.act === 'bgClose' && e.target !== el) return;
  e.preventDefault();
  fn(el.dataset.arg, el, e);
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault();
  if (f.dataset.form === 'addPack') { const v = f.label.value.trim(); if (v) { add('packing', { tripId: ui.tripId, label: v, done: false, group: 'Essentials' }); setTimeout(() => app.querySelector('[name="label"]')?.focus(), 30); } }
});
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.file === 'doc' && el.files[0]) {
    const file = el.files[0], t = T();
    const d = add('docs', { tripId: t.id, name: file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Document', type: file.type, size: file.size, added: Date.now() });
    try { await idbPut(d.id, file); toast('Saved to this phone'); } catch (err) { remove('docs', d.id); toast('Couldn’t save that file'); }
  }
});

/* swipe-to-delete on packing rows */
function bindSwipes() {
  app.querySelectorAll('[data-swipe]').forEach((row) => {
    let x0 = null, dx = 0, moved = false;
    row.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; dx = 0; moved = false; row.style.transition = 'none'; }, { passive: true });
    row.addEventListener('touchmove', (e) => { if (x0 == null) return; dx = e.touches[0].clientX - x0; if (Math.abs(dx) > 8) moved = true; const base = row.dataset.open === '1' ? -84 : 0; row.style.transform = `translateX(${clamp(base + dx, -100, 0)}px)`; }, { passive: true });
    row.addEventListener('touchend', () => {
      row.style.transition = ''; const base = row.dataset.open === '1' ? -84 : 0, end = base + dx;
      if (moved) { const open = end < -42; row.dataset.open = open ? '1' : '0'; row.style.transform = open ? 'translateX(-84px)' : ''; row.addEventListener('click', (ev) => ev.stopPropagation(), { once: true, capture: true }); }
      else if (row.dataset.open === '1') { row.dataset.open = '0'; row.style.transform = ''; }
      x0 = null;
    });
  });
}

/* ================= boot ================= */
document.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
document.addEventListener('click', unlockAudio, { once: true });
if (ui.tripId && !trip(ui.tripId)) { ui.tripId = null; ui.screen = 'trips'; }
if (ui.screen === 'recap' || ui.screen === 'sounds') ui.screen = ui.tripId ? 'home' : 'trips';
render(); afterOpen();
mapper.init();
setTimeout(() => document.getElementById('splash')?.classList.add('out'), 1500);
setTimeout(() => document.getElementById('splash')?.remove(), 2000);
// keep "today", countdowns and reminders fresh
setInterval(() => { if (!sheet && ['home', 'flights'].includes(ui.screen)) render(); }, 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !sheet) { render(); afterOpen(); } });
window.addEventListener('resize', () => mapper.resize());
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
