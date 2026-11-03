import type { MetadataRoute } from "next";

// Next.js serves this at /manifest.webmanifest automatically.
// display: "standalone" makes the site installable from the browser menu
// ("Install app" on Android Chrome) and launch full-screen like a real app.
// Android shares storage with Chrome, so installed users stay signed in; on
// iPhone a standalone web app has its OWN storage, so an iOS user may need to
// sign in once after installing from the home-screen icon.
// background_color/theme_color set the brief launch background.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Around You",
    short_name: "Around You",
    description: "Around You — guest, partner and admin portal",
    start_url: "/",
    display: "standalone",
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