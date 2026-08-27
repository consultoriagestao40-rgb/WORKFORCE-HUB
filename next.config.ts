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
  // turbopack:{} vazio silencia o warning de compatibilidade do @serwist/next no Next.js 16
  turbopack: {},

  // puppeteer-core e @sparticuz/chromium para automacao em nuvem na Vercel
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
};

export default withSerwist(nextConfig);
