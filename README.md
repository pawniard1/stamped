# Stamped

A trip planner for iPhone that runs from the Home Screen: flights on an interactive globe, a day-by-day itinerary on a street map, budgets, saved places, packing, documents, reminders and trip recaps.

**Open it:** https://pawniard1.github.io/stamped/ in Safari → Share → **Add to Home Screen**.

- All trip data stays on the phone (localStorage + IndexedDB). Use *Trip settings → Backup* to save a copy.
- Works offline after the first visit. *Trip settings → Offline maps* downloads street maps for your cities.
- Maps: [OpenFreeMap](https://openfreemap.org) vector tiles (© OpenMapTiles, data © OpenStreetMap contributors) rendered with MapLibre GL.
- Weather: [Open-Meteo](https://open-meteo.com). Exchange rates: [Frankfurter](https://frankfurter.app) (ECB). Place search: [Photon](https://photon.komoot.io).
- Airports: [mwgg/Airports](https://github.com/mwgg/Airports) (MIT). Coastlines: [Natural Earth](https://www.naturalearthdata.com) (public domain). Globe: d3-geo (ISC).

No build step: it's plain HTML, CSS and JavaScript modules.
