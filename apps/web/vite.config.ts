import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// PWA instalável (mobile-first). Ícones gerados de public/icon.svg no build.
export default defineConfig({
  // As VITE_* moram no .env.local da RAIZ do monorepo (cofre único). Sem isto o
  // Vite só olharia apps/web e o app subiria sem Supabase → tela branca.
  envDir: '../../',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      pwaAssets: { image: 'public/icon.svg', overrideManifestIcons: true },
      manifest: {
        name: 'Dispara',
        short_name: 'Dispara',
        description: 'Bota pra rodar, o faturamento dispara.',
        lang: 'pt-BR',
        theme_color: '#FF6A2C',
        background_color: '#FFF4EC',
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
