import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [
      { source: "/facilities", destination: "/districts", permanent: false },
      { source: "/map", destination: "/command", permanent: false },
      { source: "/supply/warehouses", destination: "/inventory", permanent: false },
      { source: "/beds", destination: "/districts", permanent: false },
      { source: "/doctors", destination: "/districts", permanent: false },
      { source: "/diagnostics", destination: "/districts", permanent: false },
    ];
  },
};

export default nextConfig;
