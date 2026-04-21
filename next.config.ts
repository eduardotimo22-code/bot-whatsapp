import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  watchOptions: {
    ignored: [path.join(process.cwd(), "data")],
  },
};

export default nextConfig;
