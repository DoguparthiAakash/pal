import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "mammoth", "onnxruntime-node", "@xenova/transformers"],
};

export default nextConfig;
