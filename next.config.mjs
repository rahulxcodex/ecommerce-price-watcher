/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['playwright', 'cheerio'],
  },
};

export default nextConfig;
