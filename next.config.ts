import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@json-render/core", "@json-render/react-pdf", "@react-pdf/renderer"],
};

export default nextConfig;
