// Geolocation helpers reconstructed from component usage:
//   const pos = await getCurrentPosition();            // {latitude, longitude}
//   const url = buildDirectionsUrl(dest, origin?);     // Google Maps URL

export interface LatLng {
  latitude: number;
  longitude: number;
}

// Resolve the browser's current position. Rejects with a friendly message if
// permission is denied or geolocation is unavailable.
export function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      (error) => reject(new Error(error.message || "Unable to get your location.")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

// Build a Google Maps directions URL to `destination`. If `origin` is given the
// route starts there; otherwise Maps uses the user's own location.
export function buildDirectionsUrl(destination: LatLng, origin?: LatLng): string {
  const dest = `${destination.latitude},${destination.longitude}`;
  const base = "https://www.google.com/maps/dir/?api=1";
  if (origin) {
    const from = `${origin.latitude},${origin.longitude}`;
    return `${base}&origin=${from}&destination=${dest}`;
  }
  return `${base}&destination=${dest}`;
}
