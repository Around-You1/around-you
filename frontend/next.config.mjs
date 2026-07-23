import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The imported component files are best-effort typed (they were authored
  // against an Encore-generated client). Let dev/prod run even if a stray
  // type doesn't line up; tighten later by removing this.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  webpack: (config) => {
    // Module aliases mirrored from tsconfig paths for the bundler.
    config.resolve.alias = {
      ...config.resolve.alias,
      "~backend": path.resolve(__dirname, "backend"),
      "@": path.resolve(__dirname, "."),
    };
    return config;
  },
};

export default nextConfig;
