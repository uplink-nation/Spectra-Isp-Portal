import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.0.194",
    "192.168.0.194:3000",
    "192.168.*",
    "192.168.0.*",
    "192.168.1.*",
    "10.0.0.*",
    "10.0.1.*",
    "10.*",
    "172.16.*",
    "*.trycloudflare.com",
    "*.loca.lt",
    "*.ngrok-free.app",
    "*.ngrok.io",
    "localhost",
    "localhost:*",
    "127.0.0.1",
    "127.0.0.1:*",
  ],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
