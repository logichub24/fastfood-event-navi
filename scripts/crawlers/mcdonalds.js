const axios = require('axios');

const API = 'https://www.mcdonalds.co.kr/api/v1/kor/promotion/list';
const SITE = 'https://www.mcdonalds.co.kr';

function toIsoDate(day) {
  // day 형식: '2026-06-12'
  return day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

async function crawlMcdonalds({ viewRows = 200 } = {}) {
  const { data } = await axios.get(API, {
    params: { page: 1, view_rows: viewRows },
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000,
  });

  const list = data?.resultObject?.list || [];
  return list
    .filter((item) => item.status === 'Y' && item.title)
    .map((item) => ({
      brand: 'MCDONALDS',
      id: String(item.seq),
      title: item.title.trim(),
      image: item.pcKorImageUrl ? SITE + item.pcKorImageUrl : '',
      link: SITE + '/kor/promotion/list',
      startDate: toIsoDate(item.promotionStartDay),
      endDate: toIsoDate(item.promotionEndDay),
    }));
}

module.exports = { crawlMcdonalds };

if (require.main === module) {
  crawlMcdonalds().then((items) => {
    console.log(JSON.stringify(items, null, 2));
    console.error(`맥도날드: ${items.length}개 수집`);
  }).catch((err) => {
    console.error('맥도날드 크롤링 실패:', err.message);
    process.exit(1);
  });
}
