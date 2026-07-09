/** @type {import('next').NextConfig} */
const nextConfig = {
  // In a pnpm workspace, Next.js needs explicit permission to transpile
  // the in-repo `@heynxt/*` packages (they ship TypeScript that the
  // bundler needs to process, not pre-compiled JS). List every workspace
  // package the app actually imports.
  transpilePackages: [
    '@heynxt/core-types',
    '@heynxt/persistence',
  ],

  // Turn on React Server Components by default (Next 14 default).
  experimental: {
    // Use server actions when we need mutations from Server Components.
    // Default is on in Next 14. Left explicit as a breadcrumb.
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
