import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // 콘솔에 등록한 앱 ID와 반드시 일치해야 함
  appName: 'fastfood-event-navi',

  brand: {
    primaryColor: '#EA580C'
  },

  // 앱 내부 화면 전환은 시스템 뒤로가기 이벤트로 처리한다.
  // 토스 기본 내비게이션 바를 함께 노출하면 앱 헤더와 뒤로가기 UI가 겹칠 수 있다.
  navigationBar: {
    withBackButton: false,
    withTitle: false,
  },

  permissions: [
    { name: 'geolocation', access: 'access' },
  ],

  webBundleDir: 'dist'
});
