import { MapPin } from "lucide-react";

interface AddressDirectionsButtonProps {
  address?: string;
  label?: string;
}

// Lightweight, address-based directions link for entries that only have a
// street address (no lat/lng) — e.g. emergency doctors, vets and hospitals.
// Opens Google Maps directions with the address as the destination; Maps
// resolves the user's current location as the origin.
export default function AddressDirectionsButton({ address, label = "Directions" }: AddressDirectionsButtonProps) {
  const trimmed = (address || "").trim();
  if (!trimmed) return null;

  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(trimmed)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:underline"
    >
      <MapPin className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}
