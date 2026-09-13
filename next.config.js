/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Monaco + Yjs work best without double mount in dev
};

module.exports = nextConfig;
