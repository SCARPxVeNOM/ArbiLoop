import type { NextConfig } from "next";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const reduxPkgPath = require.resolve("redux/package.json");
const reduxMjsPath = path.join(path.dirname(reduxPkgPath), "dist", "redux.mjs");

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {},
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      redux: reduxMjsPath,
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};

export default nextConfig;
