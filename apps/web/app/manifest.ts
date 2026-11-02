import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kazi Merge",
    short_name: "Kazi",
    description: "A simple work operating system for growing businesses.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#2f5bea",
    lang: "en",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
