import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Hard ceiling on the body the proxy will buffer for a route. Individual
    // routes cap tighter in `src/lib/request-guard.ts`.
    proxyClientMaxBodySize: "4mb",
  },
  serverExternalPackages: ["@json-render/core", "@json-render/react-pdf", "@react-pdf/renderer"],
};

export default nextConfig;
