// 토스인앱(Apps in Toss) 광고 SDK 연동.
// SDK 3.x부터 web-bridge/web-analytics가 web-framework 하나로 합쳐졌다.
// 3.x의 isSupported()는 토스 밖에서 false를 주지 않고 TypeError를 던지므로
// 호출부를 반드시 try/catch로 감싼다(2.x는 조용히 false였다).
// 토스 앱 WebView 안에서 열렸을 때만 실제 광고가 붙는다.
import { TossAds, loadFullScreenAd, showFullScreenAd, share, getCurrentLocation, Accuracy, requestNotificationAgreement, Analytics } from 'https://esm.sh/@apps-in-toss/web-framework@3.1.1';

const AD_CONFIG = {
  banner: 'ait.v2.live.2d12e1c821d44d97',
  interstitial: 'ait.v2.live.ac39f712a06f42c5',
};

let interstitialReady = false;

function loadInterstitial() {
  // 3.x의 isSupported()는 토스 밖에서 window.__appsInTossConstants가 없어 TypeError를 던진다.
  try {
    if (!loadFullScreenAd.isSupported || !loadFullScreenAd.isSupported()) return;
  } catch (e) {
    return;
  }
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

// 행동 기반 전면광고 트리거.
// skipFirst: 처음 N번은 건너뛴다(그 기능을 처음 써보는 순간을 보호).
// every: 건너뛴 뒤로 몇 번당 한 번 띄울지.
//
// 시작 유예는 두지 않는다. 평균 체류가 34초라 유예를 걸면 광고가 사실상 꺼진다(45초로 뒀다가 겪음).
// 쿨다운·세션 상한도 두지 않는다. 광고를 띄우면 닫힌 뒤 다음 광고를 다시 받아야 하는데,
// 그 로딩 시간이 자연스러운 쿨다운 역할을 한다(준비 안 됐으면 그 회차는 건너뜀).
const AD_RULES = {
  // 길찾기 - 이미 카카오맵으로 나가는 시점이라 탐색을 끊지 않는다. 매번.
  navigation: { skipFirst: 0, every: 1 },
  // 지도 진입 - 처음 써보는 순간은 보호하고, 두 번째 진입부터 매번.
  map: { skipFirst: 1, every: 1 },
  // 행사 상세 - 카드를 열고 닫는 게 이 앱의 기본 탐색이라 가장 보수적으로. 2·4·6번째.
  detail: { skipFirst: 1, every: 2 },
};
const adTriggerCounts = {};

window.onAdTrigger = function onAdTrigger(trigger) {
  const rule = AD_RULES[trigger];
  if (!rule) return;

  const count = (adTriggerCounts[trigger] = (adTriggerCounts[trigger] || 0) + 1);
  if (count <= rule.skipFirst) return;
  if ((count - rule.skipFirst - 1) % rule.every !== 0) return;

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

// 계측. 2.x에서는 web-analytics가 web-bridge를 peerDependency로 갖는 탓에 esm.sh에서
// 브릿지 SDK가 두 번째 사본으로 로드돼 네이티브 채널이 충돌했고 광고가 전부 죽었다.
// 3.x에서는 web-framework 하나로 합쳐져 같은 인스턴스를 쓰므로 그 문제가 없다.
// 그래도 계측 실패가 앱을 막지는 않도록 호출은 전부 삼킨다.
window.tossLog = function tossLog(type, params) {
  try {
    const result = Analytics?.[type]?.(params);
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
  // 3.x는 토스 밖에서 isSupported()가 false가 아니라 TypeError를 던진다
  // (window.__appsInTossConstants가 undefined). 예외가 새면 아래 배너·전면광고
  // 등록이 통째로 건너뛰어지므로 여기서 잡는다. 토스 앱 안 동작은 그대로다.
  let supported = false;
  try {
    supported = !!(TossAds.initialize.isSupported && TossAds.initialize.isSupported());
  } catch (e) {
    return;
  }
  if (!supported) return;

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
