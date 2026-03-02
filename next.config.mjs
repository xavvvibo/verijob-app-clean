/** @type {import('next').NextConfig} */
const nextConfig = {
  // iCloud/CloudDocs: evita watchers problemáticos
  webpack: (config) => {
    config.watchOptions = {
      ignored: ["**/node_modules", "**/.next", "**/.git"],
    };
    return config;
  },
};

export default nextConfig;
