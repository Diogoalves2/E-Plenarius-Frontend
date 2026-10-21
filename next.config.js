/** @type {import('next').NextConfig} */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const API_ORIGIN = new URL(API_URL).origin;
const WS_ORIGIN = API_ORIGIN.replace(/^http/, 'ws');
const isDev = process.env.NODE_ENV !== 'production';

// Lista fechada de origens: um script injetado (XSS) não consegue mandar dados para
// servidor de terceiro nem carregar código de fora.
const csp = [
  "default-src 'self'",
  // Next injeta scripts inline de inicialização; 'unsafe-eval' só no modo dev (hot reload)
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${API_ORIGIN} https://img.youtube.com`,
  `media-src 'self' blob: ${API_ORIGIN}`,
  `connect-src 'self' ${API_ORIGIN} ${WS_ORIGIN}`,
  `frame-src 'self' blob: ${API_ORIGIN}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Content-Security-Policy', value: csp },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
