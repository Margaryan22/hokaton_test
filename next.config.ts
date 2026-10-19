import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // End-to-end tests run their own `next dev` on port 3100 with NEXT_DIST_DIR=.next-e2e,
  // so they do not collide with a developer's `next dev` on port 3000 (Next.js locks the dist dir).
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
