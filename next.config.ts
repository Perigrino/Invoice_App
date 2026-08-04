import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.2"],
  output: "standalone",
  serverExternalPackages: ["@json-render/core", "@json-render/react-pdf", "@react-pdf/renderer"],
};

export default nextConfig;
