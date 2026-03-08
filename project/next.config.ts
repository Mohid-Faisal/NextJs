import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["react-map-gl", "maplibre-gl"],
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
