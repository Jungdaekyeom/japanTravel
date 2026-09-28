import type { NextConfig } from "next";

const googleMapsScriptSources = [
  "https://*.googleapis.com",
  "https://*.gstatic.com",
  "*.google.com",
  "https://*.ggpht.com",
  "*.googleusercontent.com",
];
const googleMapsDataSources = ["https://*.googleapis.com", "*.google.com", "https://*.gstatic.com"];
const googleMapsImageSources = [...googleMapsDataSources, "*.googleusercontent.com"];

export function buildContentSecurityPolicy({
  development,
  googleMaps,
}: {
  development: boolean;
  googleMaps: boolean;
}) {
  const scriptSources = ["'self'", "'unsafe-inline'"];
  const connectSources = ["'self'"];
  const imageSources = ["'self'", "data:", "blob:"];

  if (googleMaps) {
    scriptSources.push("'unsafe-eval'", ...googleMapsScriptSources, "blob:");
    connectSources.push(...googleMapsDataSources, "data:", "blob:");
    imageSources.push(...googleMapsImageSources);
  }
  if (development) connectSources.push("ws:", "wss:");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    `connect-src ${connectSources.join(" ")}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    "form-action 'self'",
    googleMaps ? "frame-src *.google.com" : "frame-src 'none'",
    "frame-ancestors 'none'",
    `img-src ${imageSources.join(" ")}`,
    "object-src 'none'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "worker-src 'self' blob:",
  ].join("; ");
}

const development = process.env.NODE_ENV !== "production";
const sharedHeaders = [
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()" },
  { key: "Referrer-Policy", value: "strict-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const nextConfig: NextConfig = {
  agentRules: false,
  experimental: { useTypeScriptCli: false },
  // Route modules expose tested handler factories; standalone typecheck remains the release gate.
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: buildContentSecurityPolicy({ development, googleMaps: false }),
          },
          ...sharedHeaders,
        ],
      },
      {
        source: "/",
        headers: [
          {
            key: "Content-Security-Policy",
            value: buildContentSecurityPolicy({ development, googleMaps: true }),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
