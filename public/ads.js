// 토스인앱(Apps in Toss) 광고 SDK 연동.
// 일반 브라우저에서는 isSupported()가 false라 전부 조용히 no-op되고,
// 토스 앱 WebView 안에서 열렸을 때만 실제 광고가 붙는다.
import { TossAds, loadFullScreenAd, showFullScreenAd, share, getCurrentLocation, Accuracy, requestNotificationAgreement } from 'https://esm.sh/@apps-in-toss/web-bridge@2.9.2';

const AD_CONFIG = {
  banner: 'ait.v2.live.2d12e1c821d44d97',
  interstitial: 'ait.v2.live.ac39f712a06f42c5',
};

let interstitialReady = false;

function loadInterstitial() {
  if (!loadFullScreenAd.isSupported || !loadFullScreenAd.isSupported()) return;
  loadFullScreenAd({
    options: { adGroupId: AD_CONFIG.interstitial },
    onEvent: (event) => { if (event.type === 'loaded') interstitialReady = true; },
    onError: () => { interstitialReady = false; },
  });
}

function showInterstitial() {
  if (!interstitialReady) return;
  showFullScreenAd({
    options: { adGroupId: AD_CONFIG.interstitial },
    onEvent: (event) => {
      if (event.type === 'dismissed' || event.type === 'failedToShow') {
        interstitialReady = false;
        loadInterstitial();
      }
    },
    onError: () => {},
  });
}

// 행동 기반 전면광고 트리거. 지도 진입 / 길찾기 클릭 / 행사 상세 열기 세 지점에서
// 제한 없이 매번 노출한다. (유예·쿨다운·세션 상한·빈도 제한은 모두 제거했다.)
const AD_TRIGGERS = ['map', 'navigation', 'detail'];

window.onAdTrigger = function onAdTrigger(trigger) {
  if (!AD_TRIGGERS.includes(trigger)) return;
  window.tossLog?.('impression', { log_name: `interstitial_${trigger}` });
  showInterstitial();
};

// TODO: 콘솔 > 스마트 발송 > 기능성 탭에서 알림 동의문(발송 코드)을 등록한 뒤 아래 코드로 교체할 것.
// 이 값이 없으면 실제 동의창이 뜨지 않거나 에러가 남 (등록 전까지는 호출부에서 안내만 노출).
const NOTIFICATION_TEMPLATE_CODE = 'PLACEHOLDER_TEMPLATE_CODE';

// 알림 수신 동의를 요청하는 클라이언트 측 훅. 동의를 받아도 실제 발송은 별도로
// (콘솔의 "토스에게 발송 요청" 또는 서버의 스마트 발송 API 호출) 이뤄져야 함 - 이 함수는 그 전 단계인
// "사용자 동의"만 담당한다.
window.tossRequestNotificationAgreement = function tossRequestNotificationAgreement() {
  return new Promise((resolve, reject) => {
    if (!requestNotificationAgreement) { reject(new Error('알림 동의 기능을 지원하지 않아요.')); return; }
    // 템플릿 코드 미등록 상태로 호출하면 동의창이 안 뜨거나 에러가 난다.
    // 등록 전까지는 SDK를 부르지 않고 안내만 하도록 여기서 끊는다.
    if (NOTIFICATION_TEMPLATE_CODE === 'PLACEHOLDER_TEMPLATE_CODE') {
      reject(new Error('알림 기능을 준비 중이에요.'));
      return;
    }
    requestNotificationAgreement({
      options: { templateCode: NOTIFICATION_TEMPLATE_CODE },
      onEvent: (event) => resolve(event),
      onError: (error) => reject(error),
    });
  });
};

// 계측(@apps-in-toss/web-analytics)은 제거했다.
// 이 패키지는 @apps-in-toss/web-bridge를 peerDependency로 갖는데, esm.sh에서 동적 import하면
// 브릿지 SDK가 두 번째 사본으로 또 로드된다. 네이티브 통신 채널이 충돌해 광고가 전부 죽었다.
// (출시본은 정상, 계측을 넣은 빌드만 광고 미노출 → 이 import가 원인)
// 다시 넣으려면 esm.sh 런타임 로드가 아니라 브릿지와 같은 인스턴스를 쓰는 방식이어야 한다.
// 호출부는 모두 window.tossLog?.(...) 형태라 이 함수가 없어도 조용히 넘어간다.

// 토스 앱 안에서는 navigator.share 대신 SDK 네이티브 공유 시트를 써야 함.
window.tossShare = function tossShare(message) {
  return share({ message });
};

// 토스 앱 안에서는 navigator.geolocation이 막혀있을 수 있어 SDK 전용 위치 정보 함수를 써야 함.
// 권한 거부/실패 시 reject되므로 호출 쪽에서 catch로 토스트 안내를 띄워야 함.
window.tossGetCurrentLocation = function tossGetCurrentLocation() {
  return getCurrentLocation({ accuracy: Accuracy.Balanced });
};

function init() {
  if (!TossAds.initialize.isSupported || !TossAds.initialize.isSupported()) return; // 토스 앱이 아니면 전부 스킵

  document.body.classList.add('in-toss-app');

  TossAds.initialize({
    callbacks: {
      onInitialized: () => {
        const slot = document.getElementById('adBannerSlot');
        if (slot) TossAds.attachBanner(AD_CONFIG.banner, slot);
        loadInterstitial();
      },
    },
  });
}

// 이 파일은 type="module"이고 esm.sh에서 SDK를 받아온다. 그 네트워크 요청이 늦어지면
// 모듈 본문이 DOMContentLoaded 이후에 실행될 수 있는데, 그때 리스너만 걸어두면 init이 영영 안 돈다.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
