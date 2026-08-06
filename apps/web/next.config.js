const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: true,
});

const securityHeaders = [
  { key: "X-Frame-Options",        value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection",       value: "1; mode=block" },
  { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",     value: "camera=(), microphone=(), geolocation=(self)" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://js.stripe.com/v3/",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://pub-adf5c223fa884cf6878a12b8f1ef7d2f.r2.dev https://res.cloudinary.com https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://images.pexels.com https://images.unsplash.com https://openmoji.org",
      "font-src 'self' data:",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "connect-src 'self' https://api.stripe.com https://api.telnyx.com https://nominatim.openstreetmap.org wss://*.pusher.com",
      "media-src 'self' https://pub-adf5c223fa884cf6878a12b8f1ef7d2f.r2.dev https://res.cloudinary.com blob:",
      "worker-src 'self' blob:",
    ].join("; "),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    domains: ["pub-adf5c223fa884cf6878a12b8f1ef7d2f.r2.dev", "res.cloudinary.com", "avatars.githubusercontent.com"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

module.exports = withPWA(nextConfig);
