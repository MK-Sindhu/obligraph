import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  // Everything behind sign-in is rendered in the browser from the bearer token in
  // localStorage, so Cache Components / Partial Prefetching (static shells, Activity-preserved
  // routes) buy nothing here and complicate dialogs; keep the classic App Router model.
  cacheComponents: false,
  poweredByHeader: false,
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
