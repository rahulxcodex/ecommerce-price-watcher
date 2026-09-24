/** @type {import('next').NextConfig} */

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,               // e.g. https://your-app.vercel.app
  'http://localhost:3000',                        // Local development
].filter(Boolean);

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['playwright', 'cheerio'],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: ALLOWED_ORIGINS.join(', ') || 'http://localhost:3000',
          },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With' },
          { key: 'Vary', value: 'Origin' },
        ],
      },
    ];
  },
};

export default nextConfig;

