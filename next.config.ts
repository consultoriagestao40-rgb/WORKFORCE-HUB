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

  // playwright só existe localmente — excluir do bundle serverless da Vercel
  serverExternalPackages: ["playwright", "playwright-core", "playwright-chromium"],

  // Webpack: marcar playwright como externo em produção (não disponível na Vercel)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "playwright", "playwright-core"];
    }
    return config;
  },
};

export default withSerwist(nextConfig);
