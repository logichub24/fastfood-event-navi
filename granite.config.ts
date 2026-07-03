import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'fastfood-event-navi', // 콘솔에 등록한 앱 ID와 반드시 일치해야 함
  brand: {
    displayName: '패스트푸드 행사',
    primaryColor: '#EA580C',
    icon: 'https://placehold.co/512x512/EA580C/FFFFFF.png?text=%F0%9F%8D%94', // TODO: 콘솔 등록용 실제 아이콘 이미지 주소로 교체 필요
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
