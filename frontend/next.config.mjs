import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // TypeScript checking is enforced on build. Type errors used to be silently
  // ignored here, which hid several real data bugs — keep this on. ESLint is
  // still skipped during builds; tighten that separately later.
  typescript: { ignoreBuildErrors: false },
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
