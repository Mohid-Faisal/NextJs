import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["react-map-gl", "maplibre-gl"],
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],

  // Security headers applied to every response.
  async headers() {
    // Pragmatic CSP: locks down object/frame/base injection vectors while
    // allowing the third parties the app actually uses (Crisp chat,
    // flagcdn images, jsdelivr TopoJSON, MapLibre demo tiles).
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://client.crisp.chat",
      "style-src 'self' 'unsafe-inline' https://client.crisp.chat",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://client.crisp.chat wss://client.crisp.chat https://cdn.jsdelivr.net https://api.stripe.com",
      "frame-src 'self' https://js.stripe.com",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },

  eslint: {
    // SECURITY/quality: build now fails on ESLint errors (warnings allowed).
    ignoreDuringBuilds: false,
  },
  typescript: {
    // SECURITY/quality: build now fails on TypeScript errors.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
