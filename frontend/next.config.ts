import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [
      { source: "/facilities", destination: "/districts", permanent: false },
      { source: "/map", destination: "/command", permanent: false },
      { source: "/supply/warehouses", destination: "/inventory", permanent: false },
      { source: "/supply/planning", destination: "/supply", permanent: false },
    ];
  },
};

export default nextConfig;
