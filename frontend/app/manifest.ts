import type { MetadataRoute } from "next";

// Next.js serves this at /manifest.webmanifest automatically.
// display: "browser" keeps "Add to Home Screen" a plain shortcut: Android does
// NOT mint a WebAPK, so Google Play Protect never shows the "Unsafe app blocked /
// built for an older version of Android" warning that standalone triggered. The
// icon just opens the site in the browser (sharing its cookies/localStorage, so
// users stay signed in across Safari/Chrome and the icon on both iOS and Android).
// background_color/theme_color set the brief launch background.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Around You",
    short_name: "Around You",
    description: "Around You — guest, partner and admin portal",
    start_url: "/",
    display: "browser",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/app-icon-512.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}