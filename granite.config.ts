import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'fastfood-event-navi', // 콘솔에 등록한 앱 ID와 반드시 일치해야 함
  brand: {
    displayName: '패스트푸드 행사',
    primaryColor: '#EA580C',
    // TODO: 지금은 임시 아이콘(주황 배경 + 버거 이모지)임. 실제 브랜드 로고로 교체 권장.
    // Toss 콘솔에 등록할 로고 이미지와 반드시 일치해야 하므로, 교체 시 이 URL과 콘솔 등록 이미지를 함께 바꿀 것.
    icon: 'https://logichub24.github.io/fastfood-event-navi/public/icon-512.png',
  },
  web: {
    host: 'localhost',
    port: 3000,
    commands: {
      dev: 'node scripts/build-toss.js',
      build: 'node scripts/build-toss.js',
    },
  },
  permissions: [
    { name: 'geolocation', access: 'access' },
  ],
  outdir: 'dist',
});
