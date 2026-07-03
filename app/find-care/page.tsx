"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  MapPin, Navigation, Search, Loader2, AlertTriangle, WifiOff, Phone, MapPinned,
} from "lucide-react";
import TopBar from "@/components/TopBar";
import {
  FACILITY_TYPES,
  type Facility,
  type FacilityType,
  type GeocodeResult,
} from "@/lib/find-care";

// The map requires `window` (Leaflet), so it is code-split and never rendered on
// the server. This keeps Leaflet out of the SSR/build path and off other routes.
const FindCareMap = dynamic(() => import("@/components/FindCareMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
      <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
    </div>
  ),
});

const CHIP_LABELS: Record<FacilityType, string> = {
  dialysis: "Dialysis",
  hospital: "Hospital",
  pharmacy: "Pharmacy",
  clinic: "Clinic",
  doctors: "Doctors",
  cardiology: "Cardiology",
  pulmonology: "Pulmonology",
};

const TYPE_DOT: Record<FacilityType, string> = {
  dialysis: "#dc2626",
  hospital: "#ea580c",
  pharmacy: "#16a34a",
  clinic: "#0d9488",
  doctors: "#7c3aed",
  cardiology: "#db2777",
  pulmonology: "#2563eb",
};

const RADIUS_OPTIONS = [
  { value: 2000, label: "2 km" },
  { value: 5000, label: "5 km" },
  { value: 10000, label: "10 km" },
  { value: 25000, label: "25 km" },
];

const DEFAULT_TYPES: FacilityType[] = ["dialysis", "hospital", "pharmacy"];

interface ActiveLocation {
  lat: number;
  lon: number;
  label: string;
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

async function postJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  return { ok: res.ok, status: res.status, data };
}

function mapGeocodeError(status: number): string {
  if (status === 429) return "Too many requests — please wait a moment.";
  if (status === 504) return "Location lookup timed out. Please try again.";
  return "Couldn't look up that location. Please try again.";
}

function mapFacilitiesError(status: number): string {
  if (status === 429) return "Too many requests — please wait a moment.";
  if (status === 504) return "Search timed out. Please try again.";
  return "Search is temporarily unavailable. Showing your last results.";
}

export default function FindCarePage() {
  const [queryInput, setQueryInput] = useState("");
  const [location, setLocation] = useState<ActiveLocation | null>(null);
  const [candidates, setCandidates] = useState<GeocodeResult[]>([]);
  const [types, setTypes] = useState<FacilityType[]>(DEFAULT_TYPES);
  const [radius, setRadius] = useState(5000);

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [loadingGeocode, setLoadingGeocode] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [offline, setOffline] = useState(false);

  const [hasSearched, setHasSearched] = useState(false);
  const resultRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Track online/offline status (client-gated: no request is issued offline).
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Run a facility search whenever the location, selected types, or radius change.
  useEffect(() => {
    if (!location) return;
    if (types.length === 0) {
      setFacilities([]);
      setTruncated(false);
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOffline(true);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingSearch(true);
      setSearchError(null);
      setHasSearched(true);
      const { ok, status, data } = await postJSON("/api/find-care/facilities", {
        lat: location.lat,
        lon: location.lon,
        radius,
        types,
      });
      if (cancelled) return;
      setLoadingSearch(false);
      if (ok) {
        setFacilities((data.facilities as Facility[]) || []);
        setTruncated(Boolean(data.truncated));
        setSelectedId(null);
      } else {
        setSearchError(mapFacilitiesError(status)); // keep prior results
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location, types, radius]);

  const handleGeocodeSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const q = queryInput.trim();
      setGpsError(null);
      if (q.length < 2) {
        setGeocodeError("Enter at least 2 characters (a city or postal code).");
        return;
      }
      if (!navigator.onLine) {
        setOffline(true);
        return;
      }
      setLoadingGeocode(true);
      setGeocodeError(null);
      const { ok, status, data } = await postJSON("/api/find-care/geocode", { query: q });
      setLoadingGeocode(false);
      if (!ok) {
        setGeocodeError(mapGeocodeError(status));
        return;
      }
      const results = (data.results as GeocodeResult[]) || [];
      if (results.length === 0) {
        setGeocodeError("We couldn't find that place. Try a city or postal code.");
        setCandidates([]);
        return;
      }
      setCandidates(results);
      const first = results[0];
      setLocation({ lat: first.lat, lon: first.lon, label: first.label });
    },
    [queryInput],
  );

  const handleUseMyLocation = useCallback(() => {
    setGpsError(null);
    setGeocodeError(null);
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGpsError("Location isn't available on this device. Enter a city or postal code instead.");
      return;
    }
    if (!navigator.onLine) {
      setOffline(true);
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        setCandidates([]);
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: "Your location",
        });
      },
      () => {
        setGpsLoading(false);
        setGpsError("Location access denied. Enter a city or postal code instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  function toggleType(t: FacilityType) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function selectCandidate(c: GeocodeResult) {
    setLocation({ lat: c.lat, lon: c.lon, label: c.label });
  }

  function handleSelectFacility(id: string) {
    setSelectedId(id);
    const el = resultRefs.current[id];
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  const center = useMemo<[number, number] | null>(
    () => (location ? [location.lat, location.lon] : null),
    [location],
  );

  return (
    <>
      <TopBar />
      <main className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Find Care</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Nearby care facilities from OpenStreetMap, sorted by distance.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="card space-y-4">
          <form onSubmit={handleGeocodeSubmit} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="input pl-9"
                placeholder="Enter a city or postal code…"
                value={queryInput}
                onChange={(e) => {
                  setQueryInput(e.target.value);
                  setGeocodeError(null);
                }}
                aria-label="Location (city or postal code)"
                enterKeyHint="search"
              />
            </div>
            <button
              type="submit"
              disabled={loadingGeocode}
              className="btn-primary flex items-center justify-center gap-2 px-5 disabled:opacity-60"
            >
              {loadingGeocode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={gpsLoading}
              className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-60"
              aria-label="Use my current location"
            >
              {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
              Use my location
            </button>
          </form>

          {geocodeError && <p className="text-sm text-red-500">{geocodeError}</p>}
          {gpsError && <p className="text-sm text-amber-600 dark:text-amber-400">{gpsError}</p>}

          {location && (
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
              <MapPinned className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-teal-600" />
              <span>
                Showing results near <span className="font-medium text-gray-700 dark:text-gray-300">{location.label}</span>
              </span>
            </p>
          )}

          {/* Alternative geocode matches */}
          {candidates.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-gray-400 dark:text-gray-500 self-center">Other matches:</span>
              {candidates.slice(0, 5).map((c) => {
                const active = location?.label === c.label;
                return (
                  <button
                    key={`${c.lat},${c.lon}`}
                    onClick={() => selectCandidate(c)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors max-w-[220px] truncate ${
                      active
                        ? "bg-teal-600 border-teal-600 text-white"
                        : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-teal-400"
                    }`}
                    title={c.label}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Filter chips */}
          <div className="flex flex-wrap gap-2">
            {FACILITY_TYPES.map((t) => {
              const on = types.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  aria-pressed={on}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${
                    on
                      ? "bg-teal-50 dark:bg-teal-900/30 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 font-medium"
                      : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_DOT[t] }} />
                  {CHIP_LABELS[t]}
                </button>
              );
            })}
          </div>

          {/* Radius */}
          <div className="flex items-center gap-2">
            <label htmlFor="fc-radius" className="text-xs text-gray-500 dark:text-gray-400">
              Within
            </label>
            <select
              id="fc-radius"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="input text-xs py-1 w-auto"
            >
              {RADIUS_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {types.length === 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-400">Select at least one facility type.</span>
            )}
          </div>
        </div>

        {/* Offline banner */}
        {offline && (
          <div className="card flex items-center gap-3 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
            <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              You&apos;re offline. Reconnect to search for facilities.
            </p>
          </div>
        )}

        {/* Search error (non-blocking) */}
        {searchError && (
          <div className="card flex items-center gap-3 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-300">{searchError}</p>
          </div>
        )}

        {/* Map + results */}
        {location ? (
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Map */}
            <div className="h-[360px] lg:h-[560px] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 order-2 lg:order-1">
              {center && (
                <FindCareMap
                  center={center}
                  locationLabel={location.label}
                  facilities={facilities}
                  selectedId={selectedId}
                  onSelect={handleSelectFacility}
                />
              )}
            </div>

            {/* Results list */}
            <section
              className="order-1 lg:order-2 lg:h-[560px] lg:overflow-y-auto"
              aria-label="Search results"
            >
              <div className="flex items-center justify-between mb-2 px-1" aria-live="polite">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {loadingSearch
                    ? "Searching…"
                    : `${facilities.length} ${facilities.length === 1 ? "facility" : "facilities"}`}
                </p>
                {truncated && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">Nearest 50 shown</span>
                )}
              </div>

              {loadingSearch ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="card animate-pulse h-16" />
                  ))}
                </div>
              ) : facilities.length === 0 && hasSearched ? (
                <div className="card text-center py-12 space-y-2">
                  <MapPin className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto" />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No facilities found</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Try a wider radius or a different facility type.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {facilities.map((f) => {
                    const active = f.id === selectedId;
                    return (
                      <li key={f.id}>
                        <button
                          ref={(el) => {
                            resultRefs.current[f.id] = el;
                          }}
                          onClick={() => setSelectedId(f.id)}
                          className={`w-full text-left card transition-colors ${
                            active
                              ? "ring-2 ring-teal-500 border-teal-300 dark:border-teal-700"
                              : "hover:border-teal-200 dark:hover:border-teal-800"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: TYPE_DOT[f.type] }}
                                />
                                <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{f.name}</p>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{CHIP_LABELS[f.type]}</p>
                              {f.address && (
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2">{f.address}</p>
                              )}
                            </div>
                            <span className="text-xs font-medium text-teal-600 dark:text-teal-400 flex-shrink-0 whitespace-nowrap">
                              {formatDistance(f.distanceMeters)}
                            </span>
                          </div>
                          {f.phone && (
                            <a
                              href={`tel:${f.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 mt-2 text-xs text-teal-600 dark:text-teal-400 hover:underline"
                            >
                              <Phone className="w-3 h-3" />
                              {f.phone}
                            </a>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        ) : (
          /* Pre-search prompt */
          <div className="card text-center py-16 space-y-3">
            <MapPin className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto" />
            <p className="text-base font-medium text-gray-500 dark:text-gray-400">
              Search for a location to begin
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 max-w-md mx-auto">
              Enter a city or postal code, or use your current location, to find nearby dialysis
              centers, hospitals, pharmacies, and clinics.
            </p>
          </div>
        )}

        {/* Privacy note */}
        <p className="text-xs text-center text-gray-400 dark:text-gray-500 pb-4">
          Find Care queries OpenStreetMap. Your search location and chosen filters are sent to our
          server to look up facilities. Nothing is saved. Location access is optional and used only
          when you tap “Use my location”.
        </p>
      </main>
    </>
  );
}
