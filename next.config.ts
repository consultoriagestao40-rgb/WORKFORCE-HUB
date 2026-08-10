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

  // playwright e sparticuz/chromium tratados como externos no servidor Vercel
  serverExternalPackages: ["playwright", "playwright-core", "playwright-chromium", "@sparticuz/chromium"],

  // Webpack: marcar pacotes pesados como externos no servidor
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "playwright", "playwright-core", "@sparticuz/chromium"];
    }
    return config;
  },
};

export default withSerwist(nextConfig);
