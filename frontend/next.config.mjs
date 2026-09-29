/** @type {import('next').NextConfig} */

// When running the frontend on its own (`npm run dev:web`), proxy API calls to a
// separately running backend. With the unified root server this is not needed.
const apiProxy = process.env.API_PROXY_URL;

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  async rewrites() {
    if (!apiProxy) return [];
    return [
      { source: '/api/:path*', destination: `${apiProxy}/api/:path*` },
      { source: '/:slug/api/:path*', destination: `${apiProxy}/:slug/api/:path*` },
    ];
  },
};

export default nextConfig;
