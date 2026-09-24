import type { MetadataRoute } from "next";

// Next.js serves this at /manifest.webmanifest automatically. Its main job
// here is background_color/theme_color: when the site is launched from an
// Android home-screen shortcut, Chrome shows a brief native splash (icon on
// this background) before any page JS runs. Setting it to black means that
// flash blends straight into LoadingScreen instead of showing white.
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