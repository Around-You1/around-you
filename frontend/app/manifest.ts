import type { MetadataRoute } from "next";

// Next.js serves this at /manifest.webmanifest automatically.
// display: "browser" makes a home-screen shortcut open the site in the normal
// browser tab (sharing its cookies/localStorage) instead of a separate
// standalone web app. On iPhone a standalone web app has its OWN storage jar,
// so a sign-in done in Safari would NOT carry over to the home-screen icon;
// opening in the browser keeps the user signed in across both.
// background_color/theme_color are kept for the brief launch background.
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
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}