const axios = require('axios');

// 맥도날드는 자체 공식 매장찾기 API가 있어 소상공인 상권정보보다 이쪽이 훨씬 정확하고 완전함
// (소상공인 데이터는 직영점 위주라 8건밖에 안 잡힘 - 이 API는 전국 401개 전부 커버).
const API = 'https://www.mcdonalds.co.kr/api/v1/kor/store/list';
const SITE = 'https://www.mcdonalds.co.kr';

async function crawlMcdonaldsStores({ viewRows = 1000 } = {}) {
  const { data } = await axios.get(API, {
    params: { page: 1, view_rows: viewRows },
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 20000,
  });

  const list = data?.resultObject?.list || [];
  return list
    .filter((s) => s.status === 'Y' && s.lat && s.lng)
    .map((s) => ({
      id: `MCDONALDS_${s.seq}`,
      brand: 'MCDONALDS',
      name: s.korName,
      lat: parseFloat(s.lat),
      lng: parseFloat(s.lng),
      address: s.loadKor || s.addressKor || '',
    }));
}

module.exports = { crawlMcdonaldsStores };

if (require.main === module) {
  crawlMcdonaldsStores().then((items) => {
    console.log(JSON.stringify(items.slice(0, 3), null, 2));
    console.error(`맥도날드 매장: ${items.length}개 수집`);
  }).catch((err) => {
    console.error('맥도날드 매장 수집 실패:', err.message);
    process.exit(1);
  });
}
