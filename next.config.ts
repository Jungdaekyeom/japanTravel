import type { NextConfig } from "next";

const googleMapsSources = [
  "https://maps.googleapis.com",
  "https://maps.gstatic.com",
  "https://*.googleapis.com",
  "https://*.gstatic.com",
  "https://*.google.com",
];
const scriptSources = ["'self'", "'unsafe-inline'", ...googleMapsSources];
const connectSources = ["'self'", ...googleMapsSources];

if (process.env.NODE_ENV !== "production") {
  scriptSources.push("'unsafe-eval'");
  connectSources.push("ws:", "wss:");
}

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  `connect-src ${connectSources.join(" ")}`,
  "font-src 'self' data: https://fonts.gstatic.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  `img-src 'self' data: blob: ${googleMapsSources.join(" ")}`,
  "object-src 'none'",
  `script-src ${scriptSources.join(" ")}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "worker-src 'self' blob:",
].join("; ");

const nextConfig: NextConfig = {
  agentRules: false,
  experimental: { useTypeScriptCli: false },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()" },
        { key: "Referrer-Policy", value: "strict-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      ],
    }];
  },
};

export default nextConfig;
