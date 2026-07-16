// 카카오 로컬 API 키워드 검색으로 패스트푸드 브랜드 전국 매장을 수집한다.
// 카카오 로컬 API는 쿼리당 최대 2,025건(45페이지 × 45건) 제한이 있으므로
// 시도(17개) × 브랜드 단위로 쪼개어 요청한다.

const axios = require('axios');

const SIDOS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

const BRANDS = [
  { brand: 'MCDONALDS',      query: '맥도날드' },
  { brand: 'LOTTERIA',       query: '롯데리아' },
  { brand: 'MOMSTOUCH',      query: '맘스터치' },
  { brand: 'BURGERKING',     query: '버거킹' },
  { brand: 'NOBRANDBURGER',  query: '노브랜드버거' },
  { brand: 'FRANKBURGER',    query: '프랭크버거' },
  { brand: 'SHAKESHACK',     query: '쉐이크쉑' },
  { brand: 'KFC',            query: 'KFC' },
  { brand: 'SUBWAY',         query: '서브웨이' },
];

const PAGE_SIZE = 15;

async function fetchKeyword(apiKey, keyword, page) {
  const { data } = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
    headers: { Authorization: `KakaoAK ${apiKey}` },
    params: { query: keyword, category_group_code: 'FD6', size: PAGE_SIZE, page },
    timeout: 10000,
  });
  return data;
}

async function fetchBrandInSido(apiKey, brand, sido) {
  const keyword = `${sido} ${brand.query}`;
  const stores = [];
  let page = 1;

  while (page <= 45) {
    let data;
    try {
      data = await fetchKeyword(apiKey, keyword, page);
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.error(`[카카오 400] keyword="${keyword}" page=${page} → ${detail}`);
      break;
    }
    const docs = data.documents || [];
    for (const doc of docs) {
      const lat = parseFloat(doc.y);
      const lng = parseFloat(doc.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      stores.push({
        id: `${brand.brand}_KAKAO_${doc.id}`,
        brand: brand.brand,
        name: doc.place_name,
        lat,
        lng,
        address: doc.road_address_name || doc.address_name || '',
        phone: doc.phone || '',
        kakaoId: doc.id,
      });
    }
    const meta = data.meta || {};
    if (meta.is_end) break;
    // pageable_count는 최대 45 — 이 범위를 넘는 page 요청은 400을 반환하므로 미리 차단
    if (page * PAGE_SIZE >= (meta.pageable_count || 0)) break;
    page++;
    await new Promise((r) => setTimeout(r, 80));
  }

  return stores;
}

async function crawlKakaoStores(apiKey) {
  const all = [];

  for (const brand of BRANDS) {
    const brandStores = [];
    const seenKakaoIds = new Set();

    for (const sido of SIDOS) {
      const stores = await fetchBrandInSido(apiKey, brand, sido);
      for (const s of stores) {
        if (seenKakaoIds.has(s.kakaoId)) continue;
        seenKakaoIds.add(s.kakaoId);
        brandStores.push(s);
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    console.error(`카카오 ${brand.brand}: ${brandStores.length}건`);
    all.push(...brandStores);
  }

  return all;
}

module.exports = { crawlKakaoStores };
