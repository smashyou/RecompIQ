import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@peptide/agent",
    "@peptide/nutrition",
    "@peptide/peptides",
    "@peptide/projections",
    "@peptide/shared",
    "@peptide/ui",
  ],
};

export default nextConfig;
