import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// PWA instalável (mobile-first). Ícones gerados de public/icon.svg no build.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      pwaAssets: { image: 'public/icon.svg', overrideManifestIcons: true },
      manifest: {
        name: 'AX Ads',
        short_name: 'AX Ads',
        description: 'Tráfego pago + automação + IA para e-commerce',
        lang: 'pt-BR',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
      },
      // SW desativado em dev para não interferir nos testes e2e.
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173 },
  preview: { port: 4173 },
});
