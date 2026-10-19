import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 설정 화면에 보여 줄 앱 버전 (빌드한 시각, 한국 시간). VITE_BUILD_TIME 으로 지정할 수도 있다
const BUILD_TIME = process.env.VITE_BUILD_TIME ?? new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date());

// https://vite.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(BUILD_TIME),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 등록은 앱 코드(src/pwaUpdate.js)에서 직접 한다 — 새 버전이 적용됐을 때
      // 상황에 따라 새로고침하거나 안내를 띄우기 위해
      injectRegister: false,
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
        // 새 버전을 받으면 기다리지 않고 바로 적용 (그 뒤 새로고침 여부는 src/pwaUpdate.js 가 정한다).
        // injectRegister 를 끄면 플러그인이 이 둘을 꺼 버리므로 명시해야 한다
        skipWaiting: true,
        clientsClaim: true,
        // 성경 데이터(json)도 프리캐시해야 오프라인에서 열린다 (기본 2MB 제한을 넘으므로 상향)
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,json,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
})
