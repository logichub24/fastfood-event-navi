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

// 행동 기반 전면광고 트리거 엔진.
// "사용자의 탐색을 방해하지 않고, 목적 행동 직전에 광고를 배치한다"는 원칙에 따라
// 트리거마다 노출 빈도를 다르게 둔다 (구매의사가 높을수록 자주, 탐색 중일수록 드물게).
// every=1이면 매번, every=3이면 1·4·7번째... 식으로 노출.
const AD_TRIGGER_CONFIG = {
  map: { every: 2 },        // 매장찾기 탭 진입("지도 보기") - 자연스러운 전환 지점
  navigation: { every: 2 }, // 길찾기 클릭 - 구매의사가 가장 높지만, 매장 비교 중 연타가 잦아 2회당 1회
  detail: { every: 4 },     // 행사 상세보기 - 탐색 중이라 빈도를 낮게 제한
};

// 트리거별 빈도만으로는 상한이 없다. 길찾기·지도를 오가며 여러 트리거를 번갈아 밟으면
// 짧은 시간에 전면광고가 연달아 뜰 수 있어, 트리거와 무관한 전역 가드를 둔다.
const AD_START_GRACE_MS = 45000;  // 첫 진입 직후엔 띄우지 않는다 (앱 가치를 먼저 보여줘야 재방문이 생김)
const AD_COOLDOWN_MS = 90000;     // 직전 노출 이후 최소 간격
const AD_SESSION_LIMIT = 5;       // 세션당 총 노출 상한

const appStartedAt = Date.now();
let lastAdShownAt = 0;
let adShownCount = 0;
const adTriggerCounts = {};

window.onAdTrigger = function onAdTrigger(trigger) {
  const config = AD_TRIGGER_CONFIG[trigger];
  if (!config) return;

  adTriggerCounts[trigger] = (adTriggerCounts[trigger] || 0) + 1;
  if ((adTriggerCounts[trigger] - 1) % config.every !== 0) return;

  const now = Date.now();
  if (now - appStartedAt < AD_START_GRACE_MS) return;
  if (now - lastAdShownAt < AD_COOLDOWN_MS) return;
  if (adShownCount >= AD_SESSION_LIMIT) return;
  if (!interstitialReady) return; // 미준비 상태를 소진으로 세지 않도록 카운터 증가 전에 확인

  lastAdShownAt = now;
  adShownCount++;
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
    requestNotificationAgreement({
      options: { templateCode: NOTIFICATION_TEMPLATE_CODE },
      onEvent: (event) => resolve(event),
      onError: (error) => reject(error),
    });
  });
};

// 계측: 토스가 제공하는 1st-party 애널리틱스(콘솔 지표로 바로 집계됨).
// 광고·공유·위치와 달리 계측은 실패해도 앱 기능에 영향이 없어야 하므로,
// 정적 import로 묶지 않고 동적 import로 격리한다. 로드 실패 시 tossLog는 조용히 무시된다.
let analyticsApi = null;
import('https://esm.sh/@apps-in-toss/web-analytics@2.10.4')
  .then((m) => { analyticsApi = m.Analytics; })
  .catch(() => {}); // 토스 앱 밖이거나 네트워크 실패 - 계측만 비활성

// type: 'screen' | 'impression' | 'click'
window.tossLog = function tossLog(type, params) {
  try {
    const result = analyticsApi?.[type]?.(params);
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch (e) {
    // 계측 실패가 사용자 동작을 막지 않도록 삼킨다.
  }
};

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

document.addEventListener('DOMContentLoaded', init);
