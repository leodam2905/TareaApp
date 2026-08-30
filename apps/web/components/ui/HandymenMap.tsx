"use client";

import { useEffect } from "react";
import { cld } from "@/lib/cld";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Star, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// Fix default marker icon broken by webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function createHandymanIcon(rating: number) {
  const color = rating >= 4.5 ? "#38BDF8" : rating >= 4 ? "#34D399" : "#94A3B8";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="42" viewBox="0 0 36 42">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 24 18 24S36 31.5 36 18C36 8.06 27.94 0 18 0z" fill="${color}"/>
    <circle cx="18" cy="18" r="12" fill="white"/>
    <text x="18" y="22" text-anchor="middle" font-size="11" font-weight="700" fill="${color === "#38BDF8" ? "#0F172A" : "#1E293B"}">${rating.toFixed(1)}</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [36, 42],
    iconAnchor: [18, 42],
    popupAnchor: [0, -44],
  });
}

type Handyman = {
  id: string;
  name: string;
  avatarUrl: string | null;
  rating: number;
  hourlyRate: number;
  totalJobs: number;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  service: { title: string; hourlyRate: number | null } | null;
};

function FitBounds({ handymen }: { handymen: Handyman[] }) {
  const map = useMap();
  useEffect(() => {
    const pts = handymen.filter(h => h.latitude && h.longitude) as (Handyman & { latitude: number; longitude: number })[];
    if (pts.length === 0) return;
    const bounds = L.latLngBounds(pts.map(h => [h.latitude, h.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [handymen, map]);
  return null;
}

export default function HandymenMap({
  handymen,
  onSelect,
}: {
  handymen: Handyman[];
  onSelect: (id: string) => void;
}) {
  const withCoords = handymen.filter(h => h.latitude && h.longitude) as (Handyman & { latitude: number; longitude: number })[];
  const center: [number, number] = withCoords.length
    ? [withCoords[0].latitude, withCoords[0].longitude]
    : [39.5, -98.35]; // US center fallback

  return (
    <MapContainer center={center} zoom={10} style={{ height: "520px", width: "100%", borderRadius: "16px" }} className="z-0">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <FitBounds handymen={withCoords} />
      {withCoords.map(h => (
        <Marker key={h.id} position={[h.latitude, h.longitude]} icon={createHandymanIcon(h.rating)}>
          <Popup>
            <div style={{ minWidth: 180 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "#E0F2FE", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#0369A1", fontSize: 16 }}>
                  {h.avatarUrl ? <img src={cld(h.avatarUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : h.name[0]}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#0F172A" }}>{h.name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>{h.city}</p>
                </div>
              </div>
              {/* No rate in the pin. A map of prices turns browsing into
                  shopping the cheapest pin — same reasoning as the browse card.
                  The rate is on the pro's own page. */}
              <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#475569", marginBottom: 10 }}>
                <span>⭐ {h.rating.toFixed(1)} ({h.totalJobs} jobs)</span>
              </div>
              {h.service && (
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "#475569" }}>
                  {h.service.title}
                </p>
              )}
              <button
                onClick={() => onSelect(h.id)}
                style={{ width: "100%", background: "#38BDF8", color: "#0F172A", border: "none", borderRadius: 8, padding: "8px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                View Profile
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
