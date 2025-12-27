import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["react-map-gl", "maplibre-gl"],
};

export default nextConfig;
