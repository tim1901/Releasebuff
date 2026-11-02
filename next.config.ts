import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keep Turbopack rooted in this project rather than inferring the user home directory.
  turbopack: { root: process.cwd() }
};

export default nextConfig;
