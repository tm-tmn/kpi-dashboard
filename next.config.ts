import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Thai fonts are read from disk at request time by the PDF report route.
  outputFileTracingIncludes: { "/api/report": ["./assets/fonts/**"] },
  serverExternalPackages: ["@react-pdf/renderer"],
  partialPrefetching: true,
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
