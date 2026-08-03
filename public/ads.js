// 토스인앱(Apps in Toss) 광고 SDK 연동.
// 일반 브라우저에서는 isSupported()가 false라 전부 조용히 no-op되고,
// 토스 앱 WebView 안에서 열렸을 때만 실제 광고가 붙는다.
import { TossAds, loadFullScreenAd, showFullScreenAd, share, getCurrentLocation, Accuracy, requestNotificationAgreement } from 'https://esm.sh/@apps-in-toss/web-bridge@2.9.2';

const AD_CONFIG = {
  banner: 'ait.v2.live.2d12e1c821d44d97',
  interstitial: 'ait.v2.live.ac39f712a06f42c5',
};

let interstitialReady = false;

// 전면광고가 안 뜰 때 원인이 넷(미지원/로드실패/가드차단/재고없음)인데 원격에서는 구분이 안 된다.
// 실기기에서 설정 화면으로 바로 확인할 수 있도록 상태를 남긴다.
window.__adState = {
  supported: null,   // loadFullScreenAd 지원 여부
  loaded: false,     // 광고 준비 완료
  loadError: '',     // 로드 실패 사유
  lastBlock: '',     // 마지막으로 노출이 막힌 이유
  shown: 0,          // 이번 세션 노출 횟수
  banner: false,     // 배너 부착 여부
};

function loadInterstitial() {
  const supported = !!(loadFullScreenAd.isSupported && loadFullScreenAd.isSupported());
  window.__adState.supported = supported;
  if (!supported) {
    window.tossLog?.('screen', { log_name: 'interstitial_unsupported' });
    return;
  }
  loadFullScreenAd({
    options: { adGroupId: AD_CONFIG.interstitial },
    onEvent: (event) => {
      if (event.type === 'loaded') {
        interstitialReady = true;
        window.__adState.loaded = true;
        window.__adState.loadError = '';
        window.tossLog?.('screen', { log_name: 'interstitial_loaded' });
      }
    },
    onError: (err) => {
      interstitialReady = false;
      window.__adState.loaded = false;
      window.__adState.loadError = String(err && err.message ? err.message : err).slice(0, 120);
      window.tossLog?.('screen', { log_name: 'interstitial_load_error' });
    },
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
// 유예는 처음에 45초로 뒀는데, 실측 평균 체류가 34초(28일 중 최장 일평균도 48.5초)라
// 대부분의 세션이 유예 안에 끝나 전면광고가 아예 뜨지 않았다. 20초로 낮춘다.
// 20초면 첫 화면을 보고 카드를 한 번 눌러본 뒤라 "가치를 먼저 보여준다"는 취지는 유지된다.
// 트리거(지도 진입·길찾기·상세)가 이미 사용자의 목적 행동이라 불쑥 튀어나오는 구조도 아니다.
const AD_START_GRACE_MS = 20000;
// 아래 둘은 34초 세션에서는 거의 걸리지 않지만, 오래 머무는 소수에게 광고가 연달아 뜨는
// 최악의 경우만 막아주는 안전장치라 그대로 둔다.
const AD_COOLDOWN_MS = 90000;     // 직전 노출 이후 최소 간격
const AD_SESSION_LIMIT = 5;       // 세션당 총 노출 상한

const appStartedAt = Date.now();
let lastAdShownAt = 0;
let adShownCount = 0;
const adTriggerCounts = {};

window.onAdTrigger = function onAdTrigger(trigger) {
  const config = AD_TRIGGER_CONFIG[trigger];
  if (!config) return;

  // 막힌 이유를 남겨야 "왜 안 뜨는지"를 실기기에서 알 수 있다.
  const block = (reason) => { window.__adState.lastBlock = reason; };

  adTriggerCounts[trigger] = (adTriggerCounts[trigger] || 0) + 1;
  if ((adTriggerCounts[trigger] - 1) % config.every !== 0) { block(`빈도(${trigger} ${config.every}회당 1회)`); return; }

  const now = Date.now();
  const elapsed = Math.round((now - appStartedAt) / 1000);
  if (now - appStartedAt < AD_START_GRACE_MS) { block(`시작 유예(${elapsed}s / ${AD_START_GRACE_MS / 1000}s)`); return; }
  if (now - lastAdShownAt < AD_COOLDOWN_MS) { block('쿨다운'); return; }
  if (adShownCount >= AD_SESSION_LIMIT) { block('세션 상한'); return; }
  if (!interstitialReady) { block('광고 미준비'); return; } // 미준비를 소진으로 세지 않도록 마지막에 확인

  block('');
  lastAdShownAt = now;
  adShownCount++;
  window.__adState.shown = adShownCount;
  // 유예를 낮춘 효과를 확인하려면 "실제로 떴는가"가 남아야 한다.
  // 트리거를 이름에 넣어, 콘솔이 파라미터 분포를 못 보여줘도 어느 시점에서 떴는지 읽히게 한다.
  window.tossLog?.('impression', {
    log_name: `interstitial_${trigger}`,
    seconds_since_start: Math.round((now - appStartedAt) / 1000),
    nth_in_session: adShownCount,
  });
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
        if (slot) { TossAds.attachBanner(AD_CONFIG.banner, slot); window.__adState.banner = true; }
        loadInterstitial();
      },
      onInitializationFailed: (error) => {
        window.__adState.loadError = 'SDK 초기화 실패: ' + String(error && error.message ? error.message : error).slice(0, 100);
        window.tossLog?.('screen', { log_name: 'ads_init_failed' });
      },
    },
  });
}

document.addEventListener('DOMContentLoaded', init);
