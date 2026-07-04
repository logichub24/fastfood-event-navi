import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'fastfood-event-navi', // 콘솔에 등록한 앱 ID와 반드시 일치해야 함
  brand: {
    displayName: '패스트푸드 행사',
    primaryColor: '#EA580C',
    // Toss 콘솔에 등록한 로고 이미지 (콘솔 등록 이미지와 반드시 일치해야 함)
    icon: 'https://static.toss.im/appsintoss/32449/da4c30df-6fd4-4b08-8c99-72030d0aeec6.png',
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
