// 소상공인시장진흥공단 상가(상권)정보 API의 storeListInUpjong(업종 기반 전국 조회) 엔드포인트로
// 전국 버거(I21004)·치킨(I21006) 소분류 매장을 가져온 뒤, 상호명 패턴으로
// 롯데리아/맘스터치/버거킹/노브랜드버거/프랭크버거를 걸러서
// 맥도날드/쉐이크쉑 자체 사이트 크롤링 결과와 합쳐 public/stores.json에 저장한다.
//
// 업종코드는 largeUpjongList(I2 음식) -> middleUpjongList(I210 기타 간이) -> smallUpjongList로
// 직접 조회해서 확인한 값: I21004=버거, I21006=치킨.
//
// * 맥도날드는 이 데이터셋에 8건밖에 안 잡힘(직영 위주 운영이라 "소상공인" 등록 자체가 적음) ->
//   자체 공식 매장찾기 API(mcdonalds-stores.js, 전국 401건)를 대신 사용.
// * 쉐이크쉑은 이 데이터셋에 0건 -> 자체 사이트의 지점별 개별 페이지를 순회해서 수집(shakeshack-stores.js).
// * KFC/노브랜드버거(주문 사이트 SPA)/프랭크버거(별도 API 없음)는 이 데이터셋 매칭으로 대체하고,
//   자체 매장찾기는 세션/CSRF나 SPA라 이번 단계에서는 제외.
//   (편의점 앱과 달리 대상 브랜드가 소수라 시/도별로 나누지 않고 단일 파일로 저장한다.)
//
// 사용법: node scripts/storeLocations.js  (.env의 SBIZ_API_KEY 사용)
// API 신청: https://www.data.go.kr/data/15012005/openapi.do (무료, 자동승인)

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { crawlMcdonaldsStores } = require('./crawlers/mcdonalds-stores');
const { crawlShakeshackStores } = require('./crawlers/shakeshack-stores');
const { crawlKakaoStores } = require('./crawlers/kakao-stores');

const BASE = 'https://apis.data.go.kr/B553077/api/open/sdsc2';
const OUT_PATH = path.join(__dirname, '..', 'public', 'stores.json');
const PAGE_SIZE = 1000;

const UPJONG_CODES = ['I21004', 'I21006']; // 버거, 치킨

const BRAND_PATTERNS = [
  { brand: 'LOTTERIA', pattern: /롯데리아/i },
  { brand: 'MOMSTOUCH', pattern: /맘스터치/i },
  { brand: 'BURGERKING', pattern: /버거킹/i },
  { brand: 'NOBRANDBURGER', pattern: /노브랜드\s?버거/i },
  { brand: 'FRANKBURGER', pattern: /프랭크\s?버거/i },
];

function loadServiceKey() {
  // GitHub Actions에서는 .env 파일이 없고(gitignore 대상) 워크플로우가 환경변수로 주입하므로
  // process.env를 우선 확인하고, 로컬 개발 편의를 위해 .env 파일을 폴백으로 읽는다.
  if (process.env.SBIZ_API_KEY) return process.env.SBIZ_API_KEY.trim();

  const envPath = path.join(__dirname, '..', '.env');
  const envText = fs.readFileSync(envPath, 'utf-8');
  const match = envText.match(/SBIZ_API_KEY\s*=\s*(.+)/);
  if (!match) throw new Error('SBIZ_API_KEY를 찾을 수 없습니다 (환경변수 또는 .env 파일 필요).');
  return match[1].trim();
}

function loadKakaoKey() {
  if (process.env.KAKAO_REST_API_KEY) return process.env.KAKAO_REST_API_KEY.trim();
  const envPath = path.join(__dirname, '..', '.env');
  try {
    const envText = fs.readFileSync(envPath, 'utf-8');
    const match = envText.match(/KAKAO_REST_API_KEY\s*=\s*(.+)/);
    if (match) return match[1].trim();
  } catch (_) {}
  return null;
}

// 두 좌표 사이의 거리(미터)를 Haversine 공식으로 계산한다.
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 기존 매장 목록(existing)에서 100m 이내 같은 브랜드 매장이 있으면 중복으로 판단한다.
function isDuplicate(store, existingByBrand) {
  const nearby = existingByBrand[store.brand];
  if (!nearby) return false;
  return nearby.some((s) => distanceMeters(s.lat, s.lng, store.lat, store.lng) < 100);
}

function classifyBrand(name) {
  for (const { brand, pattern } of BRAND_PATTERNS) {
    if (pattern.test(name)) return brand;
  }
  return null;
}

async function fetchUpjong(serviceKey, code) {
  const stores = [];
  let pageNo = 1;
  let totalCount = Infinity;

  while ((pageNo - 1) * PAGE_SIZE < totalCount) {
    const { data } = await axios.get(`${BASE}/storeListInUpjong`, {
      params: { serviceKey, type: 'json', divId: 'indsSclsCd', key: code, numOfRows: PAGE_SIZE, pageNo },
      timeout: 20000,
    });

    const body = data && data.body;
    const items = (body && body.items) || [];
    totalCount = (body && body.totalCount) || items.length;

    items.forEach((item) => {
      const brand = classifyBrand(item.bizesNm || '');
      if (!brand) return; // 4개 브랜드 외 매장(치킨집/타 버거 브랜드 등)은 제외
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      stores.push({
        id: `${brand}_${item.bizesId}`,
        brand,
        name: item.bizesNm,
        lat,
        lng,
        address: item.lnoAdr || item.rdnmAdr || '',
      });
    });

    console.error(`[${code}] page ${pageNo} (${items.length}건 / 전체 ${totalCount}건, 브랜드매칭 누적 ${stores.length}건)`);
    pageNo++;
    await new Promise((r) => setTimeout(r, 150));
  }

  return stores;
}

async function run() {
  const serviceKey = loadServiceKey();

  let all = [];
  for (const code of UPJONG_CODES) {
    const stores = await fetchUpjong(serviceKey, code);
    all = all.concat(stores);
  }

  try {
    const mcdStores = await crawlMcdonaldsStores();
    console.error(`맥도날드 자체 API: ${mcdStores.length}건 수집`);
    all = all.concat(mcdStores);
  } catch (err) {
    console.error('맥도날드 매장 수집 실패(계속 진행):', err.message);
  }

  try {
    const shakeStores = await crawlShakeshackStores();
    console.error(`쉐이크쉑 자체 페이지: ${shakeStores.length}건 수집`);
    all = all.concat(shakeStores);
  } catch (err) {
    console.error('쉐이크쉑 매장 수집 실패(계속 진행):', err.message);
  }

  // 동일 매장이 두 업종코드에 중복 집계될 수 있으니 id 기준으로 중복 제거
  const dedup = new Map();
  all.forEach((s) => dedup.set(s.id, s));
  let final = [...dedup.values()];

  // 카카오 로컬 API로 누락 매장 보완
  const kakaoKey = loadKakaoKey();
  if (kakaoKey) {
    try {
      const kakaoStores = await crawlKakaoStores(kakaoKey);

      // 브랜드별 인덱스 구성 (근접 중복 판단용)
      const byBrand = {};
      for (const s of final) {
        (byBrand[s.brand] = byBrand[s.brand] || []).push(s);
      }

      let added = 0;
      for (const s of kakaoStores) {
        if (!isDuplicate(s, byBrand)) {
          final.push(s);
          (byBrand[s.brand] = byBrand[s.brand] || []).push(s);
          added++;
        }
      }
      console.error(`카카오 보완: ${kakaoStores.length}건 수집 → ${added}건 신규 추가`);
    } catch (err) {
      console.error('카카오 매장 수집 실패(계속 진행):', err.message);
    }
  } else {
    console.error('KAKAO_REST_API_KEY 없음 — 카카오 보완 건너뜀');
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(final), 'utf-8');

  const byBrand = final.reduce((acc, s) => { acc[s.brand] = (acc[s.brand] || 0) + 1; return acc; }, {});
  console.error('브랜드별 매장 수:', byBrand);
  console.error(`stores.json 작성 완료: 총 ${final.length}건 (${OUT_PATH})`);
}

run().catch((err) => {
  console.error('매장 위치 수집 실패:', err.message);
  process.exit(1);
});
