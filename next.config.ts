import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  turbopack: {},

  // Apenas sparticuz/chromium e playwright-core como serverExternalPackages para a Vercel
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
};

export default withSerwist(nextConfig);
