import type { MetadataRoute } from "next";

/** Lets golfers add the app to their phone's home screen with the flag icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Woodside Wednesday",
    short_name: "Woodside",
    description: "Woodside Wednesday golf league: scores, standings and stats.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7faf8",
    theme_color: "#2f6b45",
    // Long-press shortcut on the home-screen icon (where supported).
    shortcuts: [{ name: "Enter scores", short_name: "Scores", url: "/play", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
