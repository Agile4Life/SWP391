import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'scms.bluesymphony.site',
  appName: 'SÖL',
  webDir: 'dist',
  appendUserAgent: 'SOLiOSApp',
  server: {
    // CAP_SERVER_URL=http://localhost:5173 để dev với Vite; mặc định VPS.
    url: process.env.CAP_SERVER_URL ?? 'https://scms.bluesymphony.site',
    allowNavigation: ['scms.bluesymphony.site', 'sandbox.vnpayment.vn'],
  },
  ios: { contentInset: 'never' },
};

export default config;
