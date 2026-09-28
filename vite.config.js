import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.png', 'favicon.svg'],
      manifest: {
        name: 'Bible Search',
        short_name: 'BibleSearch',
        description: '성경 검색 앱',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // 성경 데이터(json)도 프리캐시해야 오프라인에서 열린다 (기본 2MB 제한을 넘으므로 상향)
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,json}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
})
