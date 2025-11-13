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
  webpack: (config, { isServer }) => {
    // Suppress noisy Linear SDK warnings about missing 'encoding' module
    // The Linear SDK works fine without it - it's an optional dependency
    if (isServer) {
      config.ignoreWarnings = [{ module: /node_modules\/@linear\/sdk/ }]
    }
    return config
  },
}

export default nextConfig
