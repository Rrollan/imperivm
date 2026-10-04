/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Runtime discovery also needs supplied models in traced server deployments.
    outputFileTracingIncludes: { '/api/models': ['./public/models/**/*'] },
  },
};
export default nextConfig;
