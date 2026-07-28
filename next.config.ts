import type { NextConfig } from "next";

const securityHeaders = [
  // Stop the browser from second-guessing declared content types.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Do not leak the class/stream path to third parties (embedded players).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app needs none of these.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Everything except the OBS overlay, which is loaded inside a browser
        // source and must stay framable.
        source: "/((?!embed).*)",
        headers: [...securityHeaders, { key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
      {
        source: "/embed/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
