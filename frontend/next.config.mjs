/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "https://localhost:8002"}/api/:path*/`,
      },
    ];
  },
};

export default nextConfig;
