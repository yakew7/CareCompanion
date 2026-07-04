# Find Care — Map & Coverage Upgrade Plan

Status: **Proposed** · Owner: TBD · Last updated: 2026-07-04

Companion to [FIND_CARE_DEV.md](FIND_CARE_DEV.md). This plan upgrades the Find Care
map look and — more importantly — its **facility coverage**, without changing the
feature's public behaviour and without risking a regression on a live feature.

---

## 0. TL;DR

Two independent, env-gated changes shipped as two PRs. **Both are no-ops until a key
is present**, so merging them changes nothing in production until we deliberately
enable them, and disabling is instant.

| PR | Change | Enabled by | User-visible effect |
|----|--------|-----------|---------------------|
| **PR 1** | MapTiler tiles replace raw OSM raster | `NEXT_PUBLIC_MAPTILER_KEY` | Nicer basemap, global. **No new pins.** |
| **PR 2** | Ola Maps POI for India + OSM fallback everywhere | `OLA_MAPS_API_KEY` | More/deeper facility pins in India. |

Layer roles: **MapTiler = the picture + search box (global). OSM = pins everywhere
(global). Ola = better pins in India (our core market).**

---

## 1. Current stack (baseline to preserve)

- **Renderer:** Leaflet 1.9.4 + react-leaflet 4.2.1, client-only via `next/dynamic`.
- **Basemap:** OSM raster tiles, hardcoded at [components/FindCareMap.tsx:93](components/FindCareMap.tsx#L93).
- **POI data:** Overpass API (OSM), server-proxied at [app/api/find-care/facilities/route.ts](app/api/find-care/facilities/route.ts); query builder + normalization in [lib/find-care.ts](lib/find-care.ts).
- **Geocoding:** Nominatim (OSM), server-proxied at [app/api/find-care/geocode/route.ts](app/api/find-care/geocode/route.ts).
- **Security posture:** strict CSP ([next.config.js:13-25](next.config.js#L13-L25)) — `connect-src 'self' https://*.supabase.co`, `img-src` limited to OSM tile hosts; all map data server-proxied; no map API keys today.
- **Tests:** **none.** Repo has only `next lint` and `next build`. No jest/vitest, no test files. The safety net today is TypeScript + build + manual use.

---

## 2. Goals & non-goals

**Goals**
1. Materially more facility coverage in India (the "more crds" ask).
2. Keep global reach — every country must keep working.
3. Nicer-looking map.
4. **Zero regression risk** to the existing feature.

**Non-goals (explicitly out of scope for now)**
- Google Places integration (paid + caching-restrictive ToS; documented as a future premium path only).
- Leaflet → MapLibre vector migration (deferred; raster MapTiler is enough).
- The deferred OSRM driving-route + save-preferred-facility items from [FIND_CARE_DEV.md](FIND_CARE_DEV.md).

---

## 3. Architecture decision

The feature is two stacked layers, and coverage ("more crds") comes from the **data**
layer, not the basemap:

| Layer | Job | Today | After |
|-------|-----|-------|-------|
| Basemap tiles | the picture | OSM raster | MapTiler (global) |
| Search box | address → lat/lon | Nominatim | Nominatim (or MapTiler, optional) |
| Facility pins | the POIs | Overpass/OSM | OSM everywhere **+ Ola in India** |

Ola Maps is India-only, so it is a **depth booster for India**, not the global source.
OSM remains the global backbone and the universal fallback.

---

## 4. Environment variables (new)

```bash
# client-exposed tile key — MUST be domain-locked in the MapTiler dashboard
NEXT_PUBLIC_MAPTILER_KEY=xxxxx
# server-only; never prefix with NEXT_PUBLIC_
OLA_MAPS_API_KEY=xxxxx
# optional kill-switch to disable Ola without removing the key
FIND_CARE_DISABLE_OLA=          # set to "1" to force OSM everywhere
# optional (only if we consolidate geocoding onto MapTiler)
MAPTILER_KEY=xxxxx
```

Add to `.env.local`, the hosting provider's env, and `.env.example`/docs.

---

## 5. PR 1 — MapTiler basemap

**5.1** [components/FindCareMap.tsx:92-95](components/FindCareMap.tsx#L92-L95) — swap the tile
layer with a built-in OSM fallback so it behaves exactly like today when the key is absent:

```tsx
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const tile = MAPTILER_KEY
  ? {
      url: `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}@2x.png?key=${MAPTILER_KEY}`,
      attribution:
        '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }
  : {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    };
```

- Verified URL format: `https://api.maptiler.com/maps/{mapId}/256/{z}/{x}/{y}.png?key=…`.
- `streets-v2` = familiar look; `dataviz-light`/`dataviz-dark` = cleaner pin overlay (optionally follow app dark mode).

**5.2** [next.config.js:19](next.config.js#L19) — **add** (never remove) the MapTiler host to `img-src`:

```js
"img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.tile.openstreetmap.org https://api.maptiler.com",
```

**5.3** MapTiler dashboard — restrict the key to prod domain(s) + `localhost`. Makes the
`NEXT_PUBLIC_` exposure safe (leaked key is unusable off-domain).

**Cost:** raster ≈ 10–16 requests/view; free tier 100k req/mo (~6–10k views). Outgrow →
MapLibre vector later. No backend change in this PR.

---

## 6. PR 2 — Ola-for-India POI + OSM fallback

Verified Ola shape: `GET https://api.olamaps.io/places/v1/nearbysearch` with
`location=lat,lng`, `radius`, `types`, `layers=venue`, `limit`, `withCentroid`,
`api_key`. Response mirrors Google Places (`name`, `geometry.location.{lat,lng}`,
`formatted_address`, `types`).

### 6.1 [lib/find-care.ts](lib/find-care.ts) — pure, client-safe additions

**India gate** (bbox covers mainland + islands + Kashmir):
```ts
export const INDIA_BBOX = { south: 6.5, west: 68.0, north: 37.5, east: 97.5 } as const;
export function isInIndia(lat: number, lon: number): boolean {
  return lat >= INDIA_BBOX.south && lat <= INDIA_BBOX.north
      && lon >= INDIA_BBOX.west  && lon <= INDIA_BBOX.east;
}
```

**Config** in `FIND_CARE_CONFIG`: `olaEndpoint`, `olaTimeoutMs: 8_000`, `olaCacheTtlMs: 300_000`.
(The API key is read from `process.env` in the route — it is **not** placed in this
client-safe constant.)

**Type map + classifier**, reusing the existing `NAME_RE` so specialty detection is
consistent with OSM:
```ts
const OLA_TYPE_MAP: Record<string, FacilityType> = {
  hospital: "hospital", pharmacy: "pharmacy", drugstore: "pharmacy",
  doctor: "doctors", clinic: "clinic", health: "clinic",
};
// classifyOlaPlace(place, requested): OLA_TYPE_MAP on place.types (priority order),
// then NAME_RE.{dialysis,cardiology,pulmonology} on place.name — same precedence
// order as classifyElement().
```

**Normalizer** `normalizeOlaPlace(place, origin, requested): Facility | null` → emits the
**exact same `Facility` interface** (id `ola/<place_id>`, name, lat/lon, address, phone,
haversine distance); returns `null` when it matches none of the requested types.

**Shared tail** — extract dedupe→sort→cap from [lib/find-care.ts:388-395](lib/find-care.ts#L388-L395)
into `finalizeFacilities(facilities, radius)`, used by **both** OSM and Ola paths so
results are shaped identically. (See parity requirement in §8.4.)

### 6.2 [app/api/find-care/facilities/route.ts](app/api/find-care/facilities/route.ts) — provider selection + fallback

```ts
const olaEnabled = !!process.env.OLA_MAPS_API_KEY && process.env.FIND_CARE_DISABLE_OLA !== "1";
const useOla = olaEnabled && isInIndia(lat, lon);
if (useOla) {
  try {
    return await respondViaOla(lat, lon, radius, types);   // new
  } catch {
    // swallow → fall through to OSM. Ola outage must never take Find Care down.
  }
}
return await respondViaOverpass(lat, lon, radius, types);   // existing path, untouched
```

- Separate `TtlCache` instance for Ola, keyed like Overpass.
- Reuse `fetchUpstream` (abort/timeout/retry) with `olaTimeoutMs`.
- `api_key` appended **server-side** → **no CSP change** in this PR.

### 6.3 Copy updates (accuracy only)
- [app/find-care/page.tsx:256-257](app/find-care/page.tsx#L256-L257) and
  [page.tsx:521-525](app/find-care/page.tsx#L521-L525): "OpenStreetMap" → "OpenStreetMap and
  Ola Maps". Keep the "nothing is saved" line (still true — in-memory cache only).

---

## 7. (Optional) MapTiler geocoding — do last or skip

Replace Nominatim in [app/api/find-care/geocode/route.ts:22-28](app/api/find-care/geocode/route.ts#L22-L28):
`GET https://api.maptiler.com/geocoding/{query}.json?key=${MAPTILER_KEY}&limit=5` →
map `features[].place_name` + `features[].center=[lon,lat]` to `GeocodeResult`. Server-side
key, same cache/fetch helpers. Purely additive; ship after PR1/PR2 or skip if Nominatim is fine.

---

## 8. Regression safety — how Find Care will NOT break

This is the core of the plan. Five layers of protection, from design-time to runtime.

### 8.1 Default-off, byte-for-byte no-op (the #1 guarantee)
Every change is gated on an env var that is **absent by default**:
- No `NEXT_PUBLIC_MAPTILER_KEY` → tile layer uses the current OSM URL (same code path as today).
- No `OLA_MAPS_API_KEY` (or `FIND_CARE_DISABLE_OLA=1`) → `useOla` is `false` → the Overpass
  path runs **unchanged**.

⇒ Merging both PRs with no keys set produces **identical behaviour to today**. Prod is safe
on merge; enabling is a deliberate, separate, reversible step.

### 8.2 Contract invariants (nothing downstream changes)
These MUST NOT change — enforced by TypeScript and reviewed explicitly in the PR:
- `Facility`, `SearchRequest`, `SearchResponse`, `GeocodeResult`, `ErrorResponse` interfaces — **unchanged**.
- Ola results are normalized into the **same `Facility` shape** → [components/FindCareMap.tsx](components/FindCareMap.tsx)
  and [app/find-care/page.tsx](app/find-care/page.tsx) require **zero changes** (beyond copy) and
  cannot tell which provider served the data.
- HTTP status codes + `{error, message}` envelope — unchanged.
- `guardAiRoute()` rate-limit still runs first in both routes — unchanged.
- CSP: hosts are **only added, never removed**; `connect-src` untouched (Ola/Overpass are server-side).

### 8.3 Defense-in-depth fallback chains
- **Pins:** Ola (India only) → on any error/timeout → Overpass → on error → existing 502/504
  envelope. A user in India still gets OSM results if Ola is down. A user outside India is
  never routed to Ola at all.
- **Basemap:** MapTiler tiles → if key missing, OSM URL; if tiles fail at runtime (quota/network),
  Leaflet shows blank tiles but **markers, list, search, and all interactions keep working**
  (pins are `divIcon`s, not tile-dependent).
- **Kill switch:** `FIND_CARE_DISABLE_OLA=1` disables Ola instantly without touching the key.

### 8.4 Behaviour parity for the refactor
The one change that touches the *existing* OSM path is extracting `finalizeFacilities`
(§6.1). Risk: subtly altering current output. Mitigation:
- `respondViaOverpass` must call `processElements` → `finalizeFacilities` and produce
  **identical** output to today for the same input.
- **Parity check (required before merge):** capture a real Overpass JSON payload for 2–3
  cities into a fixture, run the old vs new pipeline, assert deep-equal `SearchResponse`.
  Run it either as a throwaway `node` script or as the first test if we adopt Vitest (§8.5).

### 8.5 Test & verification matrix (given: no test framework exists)
Two-track approach.

**Track A — add a minimal test runner (recommended, ~30 min).** Add Vitest + a `test`
script and cover the *pure* functions only (no React/Leaflet needed):
- `isInIndia` — Mumbai/Delhi/Bengaluru ✓; NYC/London ✗; border cases.
- `classifyOlaPlace` / `normalizeOlaPlace` — against a captured Ola JSON fixture, incl. the
  specialty name-match path (dialysis/cardiology/pulmonology) and the "matches nothing → null".
- `finalizeFacilities` — dedupe/sort/cap; **parity fixture** from §8.4.
This is the durable safety net the repo currently lacks and is worth it for a health feature.

**Track B — manual E2E via the `/verify` skill and build gates (minimum bar, always done).**

| # | Scenario | Expected |
|---|----------|----------|
| 1 | No keys set | Identical to today: OSM tiles, Overpass pins |
| 2 | MapTiler key only, any city | Nicer tiles; same pins; **no CSP console errors** |
| 3 | Ola key, India city (Mumbai/Bengaluru) | Ola pins; count ≥ OSM baseline |
| 4 | Ola key, small Indian town | Ola results, or clean OSM fallback if sparse |
| 5 | Ola key, **non-India** (London/NYC) | Overpass path used; unchanged |
| 6 | Force Ola 500/timeout (bad key/blocked host) | Silent fallback to Overpass; user sees results |
| 7 | `FIND_CARE_DISABLE_OLA=1` with key present | OSM everywhere |
| 8 | Offline / GPS-denied / 0 results / 429 | Existing banners & states unchanged |
| 9 | `next build` + `next lint` | Pass, no type errors |

Also: quantify the win — log OSM-only vs Ola pin counts for 3–4 Indian cities (that's the whole point of PR 2).

### 8.6 Instant rollback
- Remove the env var (or set `FIND_CARE_DISABLE_OLA=1`) → reverts to current behaviour.
  Note: on most hosts an env change needs a redeploy/restart to take effect — the
  `FIND_CARE_DISABLE_OLA` flag gives a config-only path; confirm your host applies env
  changes without a full code rollback.
- Code rollback: each PR is self-contained and revertible independently.

### 8.7 Monitoring / observability
- Server: log one structured line per facilities request — `provider` (ola|overpass),
  `olaFallback` (bool), `latencyMs`, `count`. Lets us spot silent Ola degradation (everyone
  falling back) instead of it going unnoticed.
- MapTiler dashboard: watch monthly request usage vs the 100k free cap.
- Client: periodic check for CSP violations in the console during QA.

---

## 9. Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Ola field/type names differ from assumption (docs return 403 to scrapers) | Med | Med | §12 confirm-by-curl step before wiring; normalizer isolates the mapping |
| `finalizeFacilities` refactor changes OSM output | Low | High | Parity fixture test (§8.4) blocks merge |
| MapTiler free quota exceeded | Low | Low | Usage monitor; blank tiles degrade gracefully; vector upgrade path |
| `NEXT_PUBLIC_MAPTILER_KEY` leaked | Med | Low | Domain-locked in dashboard → unusable off-domain |
| Ola outage/slowness | Med | Low | try/catch → Overpass fallback; 8s timeout |
| Ola ToS forbids caching | Low | Med | Confirm before enabling; can disable cache for Ola only |
| India bbox catches border slivers (NP/BD/LK) | Med | Low | Ola returns sparse/empty → OSM fallback covers it |
| CSP breakage | Low | High | Only add hosts; scenario 2 checks console; connect-src untouched |

---

## 10. Rollout stages

1. **Merge dark** — both PRs, no keys. Verify scenario 1 in prod (behaviour unchanged).
2. **Enable MapTiler** in prod (`NEXT_PUBLIC_MAPTILER_KEY`). Verify scenario 2.
3. **Enable Ola in staging** (`OLA_MAPS_API_KEY`). Run scenarios 3–7; quantify coverage gain.
4. **Enable Ola in prod.** Watch monitoring (§8.7) for fallback rate + latency.
5. (Optional) MapTiler geocoding — separate PR, same dark-merge → enable flow.

---

## 11. Pre-merge acceptance checklist

- [ ] `next build` and `next lint` pass; no TypeScript errors.
- [ ] With no env keys, behaviour is identical to `main` (scenario 1).
- [ ] Parity fixture (§8.4) confirms OSM output unchanged.
- [ ] Public interfaces (`Facility`, request/response) unchanged (diff review).
- [ ] CSP only adds hosts; `connect-src` unchanged; no console CSP errors (scenario 2).
- [ ] Ola failure falls back to Overpass (scenario 6).
- [ ] Kill switch works (scenario 7).
- [ ] Non-India routing unchanged (scenario 5).
- [ ] `.env.example`/docs and privacy copy updated.
- [ ] (If Track A) Vitest suite green.

---

## 12. Confirm at implementation time

- **Ola response fields** — the official docs (developer.olamaps.io) return 403 to automated
  fetches. Before wiring the normalizer, `curl` the Nearby Search endpoint with the real key
  and confirm exact field names (`geometry.location` vs `location`, healthcare `types` values,
  phone/contact field, `place_id`). The normalizer isolates this so it's a 1-file fix.
- **Ola ToS** — confirm in-memory caching of results is permitted.
- **`layers`/`types` values** — confirm the healthcare-relevant Nearby Search `types` keywords.
