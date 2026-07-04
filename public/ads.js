// 토스인앱(Apps in Toss) 광고 SDK 연동.
// 일반 브라우저에서는 isSupported()가 false라 전부 조용히 no-op되고,
// 토스 앱 WebView 안에서 열렸을 때만 실제 광고가 붙는다.
//
// TODO: 앱인토스 콘솔에서 이 앱(fastfood-event-navi)으로 광고 그룹을 발급받은 뒤 아래 ID를 교체할 것.
import { TossAds, loadFullScreenAd, showFullScreenAd, share, getCurrentLocation, Accuracy } from 'https://esm.sh/@apps-in-toss/web-bridge@2.9.2';

const AD_CONFIG = {
  banner: 'ait.v2.live.PLACEHOLDER_BANNER',
  interstitial: 'ait.v2.live.PLACEHOLDER_INTERSTITIAL',
};

let interstitialReady = false;
let detailOpenCount = 0;
const INTERSTITIAL_EVERY_N_DETAIL_OPENS = 3;

function loadInterstitial() {
  if (!loadFullScreenAd.isSupported || !loadFullScreenAd.isSupported()) return;
  loadFullScreenAd({
    options: { adGroupId: AD_CONFIG.interstitial },
    onEvent: (event) => { if (event.type === 'loaded') interstitialReady = true; },
    onError: () => { interstitialReady = false; },
  });
}

// 행사 상세보기(이벤트 카드) 또는 매장 정보 시트(지도 마커)를 열 때마다 호출됨.
// 1번째, 그 다음부터는 N번째마다(1, 4, 7...) 전면 광고 노출 - 매번 끼우면 이탈률이 올라가서 빈도 제한.
window.onDetailOpened = function onDetailOpened() {
  detailOpenCount++;
  if ((detailOpenCount - 1) % INTERSTITIAL_EVERY_N_DETAIL_OPENS !== 0) return;
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
