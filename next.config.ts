import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
  // Silences Next's "custom webpack config with no turbopack config" check.
  // Serwist's webpack() hook is a no-op in dev (see `disable` above); the
  // actual service worker bundling still runs under `next build --webpack`.
  turbopack: {},
};

export default withSerwist(nextConfig);
