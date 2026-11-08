/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(process.env.BUILD_STANDALONE === 'true' ? { output: 'standalone' } : {}),
};

export default nextConfig;
