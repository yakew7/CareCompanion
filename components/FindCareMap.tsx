"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FACILITY_TYPE_LABELS, type Facility, type FacilityType } from "@/lib/find-care";

// Distinct colour per facility type so markers are distinguishable on the map.
const TYPE_COLORS: Record<FacilityType, string> = {
  dialysis: "#dc2626",
  hospital: "#ea580c",
  pharmacy: "#16a34a",
  clinic: "#0d9488",
  doctors: "#7c3aed",
  cardiology: "#db2777",
  pulmonology: "#2563eb",
};

// Marker icons are built as Leaflet divIcons (inline HTML) so we never load
// Leaflet's default CDN-hosted marker images — required by the app's CSP.
function facilityIcon(color: string, highlighted: boolean): L.DivIcon {
  const size = highlighted ? 30 : 22;
  const ring = highlighted ? "box-shadow:0 0 0 4px rgba(13,148,136,0.35);" : "";
  return L.divIcon({
    className: "cc-facility-marker",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #fff;${ring}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) - 2],
  });
}

function locationIcon(): L.DivIcon {
  return L.divIcon({
    className: "cc-location-marker",
    html: `<span style="display:block;width:18px;height:18px;border-radius:50%;background:#1d4ed8;border:3px solid #fff;box-shadow:0 0 0 4px rgba(29,78,216,0.3);"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Recenters the map when the search origin changes (motion-preference aware). */
function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (prefersReducedMotion()) map.setView(center, map.getZoom());
    else map.flyTo(center, map.getZoom(), { duration: 0.6 });
  }, [center, map]);
  return null;
}

/** Pans to the selected facility when the selection changes. */
function PanToSelected({ facilities, selectedId }: { facilities: Facility[]; selectedId: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const f = facilities.find((x) => x.id === selectedId);
    if (!f) return;
    if (prefersReducedMotion()) map.setView([f.lat, f.lon], map.getZoom());
    else map.panTo([f.lat, f.lon], { duration: 0.4 });
  }, [selectedId, facilities, map]);
  return null;
}

export interface FindCareMapProps {
  center: [number, number];
  locationLabel?: string;
  facilities: Facility[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function FindCareMap({
  center,
  locationLabel,
  facilities,
  selectedId,
  onSelect,
}: FindCareMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom
      className="h-full w-full"
      aria-label="Map of nearby care facilities"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Recenter center={center} />
      <PanToSelected facilities={facilities} selectedId={selectedId} />

      {/* Active search location */}
      <Marker position={center} icon={locationIcon()} zIndexOffset={1000} keyboard={false}>
        <Popup>{locationLabel || "Search location"}</Popup>
      </Marker>

      {facilities.map((f) => (
        <Marker
          key={f.id}
          position={[f.lat, f.lon]}
          icon={facilityIcon(TYPE_COLORS[f.type], f.id === selectedId)}
          title={f.name}
          alt={`${FACILITY_TYPE_LABELS[f.type]}: ${f.name}`}
          eventHandlers={{ click: () => onSelect(f.id) }}
        >
          <Popup>
            <div style={{ minWidth: 160 }}>
              <strong>{f.name}</strong>
              <div style={{ fontSize: 12, color: "#64748b" }}>{FACILITY_TYPE_LABELS[f.type]}</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {(f.distanceMeters / 1000).toFixed(1)} km away
              </div>
              {f.address && <div style={{ fontSize: 12, marginTop: 4 }}>{f.address}</div>}
              {f.phone && (
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  <a href={`tel:${f.phone}`}>{f.phone}</a>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
