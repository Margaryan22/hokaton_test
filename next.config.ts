import type { NextConfig } from "next";

// Security headers for every response (security review M2). No CSP: Next.js inline scripts would need nonces,
// and the app shows no third-party content; framing is blocked by X-Frame-Options instead.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Voice input needs the microphone on our own origin only; nothing else is used.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // End-to-end tests build and serve their own production server (`next build && next start` on port 3100)
  // with NEXT_DIST_DIR=.next-e2e, so they do not collide with a developer's `.next` (playwright.config.ts).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
