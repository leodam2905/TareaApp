"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (address: string, city: string) => void;
  placeholder?: string;
  className?: string;
};

declare global {
  interface Window {
    google: typeof google;
    initGooglePlaces?: () => void;
  }
}

export default function AddressAutocomplete({ value, onChange, placeholder = "123 Main St", className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    if (window.google?.maps?.places) {
      setLoaded(true);
      return;
    }

    const scriptId = "google-places-script";
    if (document.getElementById(scriptId)) {
      window.initGooglePlaces = () => setLoaded(true);
      return;
    }

    window.initGooglePlaces = () => setLoaded(true);
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGooglePlaces`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!loaded || !inputRef.current) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["address_components", "formatted_address"],
    });

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current!.getPlace();
      if (!place.address_components) return;

      const components = place.address_components;
      const streetNumber = components.find(c => c.types.includes("street_number"))?.long_name ?? "";
      const route = components.find(c => c.types.includes("route"))?.long_name ?? "";
      const city =
        components.find(c => c.types.includes("locality"))?.long_name ??
        components.find(c => c.types.includes("sublocality"))?.long_name ?? "";

      const street = [streetNumber, route].filter(Boolean).join(" ");
      onChange(street || place.formatted_address || "", city);
    });
  }, [loaded, onChange]);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={e => onChange(e.target.value, "")}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
    />
  );
}
