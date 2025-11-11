/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // DO NOT MODIFY - TypeScript errors must be fixed, not ignored
    ignoreBuildErrors: false,
  },
  eslint: {
    // DO NOT MODIFY - ESLint errors must be fixed, not ignored
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig
