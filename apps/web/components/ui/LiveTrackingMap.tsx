"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  lat: number;
  lng: number;
  destinationAddress: string;
};

declare global {
  interface Window { google: typeof google; initTrackingMap?: () => void; }
}

export default function LiveTrackingMap({ lat, lng, destinationAddress }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;
    if (window.google?.maps) { setLoaded(true); return; }
    const scriptId = "google-maps-script";
    if (document.getElementById(scriptId)) { window.initTrackingMap = () => setLoaded(true); return; }
    window.initTrackingMap = () => setLoaded(true);
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initTrackingMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        zoom: 14,
        center: { lat, lng },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
          { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0ea5e9" }, { weight: 0.5 }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0c4a6e" }] },
        ],
      });
      markerRef.current = new window.google.maps.Marker({
        position: { lat, lng },
        map: mapInstanceRef.current,
        title: "Handyman location",
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#0ea5e9",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
    } else {
      const pos = { lat, lng };
      markerRef.current?.setPosition(pos);
      mapInstanceRef.current.panTo(pos);
    }
  }, [loaded, lat, lng]);

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-tarea-sky/10 border-b border-white/10">
        <span className="w-2 h-2 rounded-full bg-tarea-sky animate-pulse" />
        <p className="text-tarea-sky text-xs font-semibold">Live — Handyman is on the way</p>
      </div>
      <div ref={mapRef} className="w-full h-52" />
    </div>
  );
}
