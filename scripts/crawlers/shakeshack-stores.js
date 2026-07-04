const axios = require('axios');
const cheerio = require('cheerio');

// shakeshack.kr은 https(443) 미지원 레거시 사이트라 http로만 접근 가능함.
// 전국 매장이 지점별 개별 정적 페이지(location_슬러그.jsp)로 되어있어, 목록 페이지에서
// 슬러그를 모두 모은 뒤 각 페이지를 순회하며 이름/주소/좌표를 뽑는다.
const SITE = 'http://www.shakeshack.kr';
const LIST_URL = `${SITE}/sub/location/location.jsp`;

async function fetchSlugs() {
  const { data } = await axios.get(LIST_URL, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 });
  const matches = [...data.matchAll(/location_([a-z0-9]+)\.jsp/g)].map((m) => m[1]);
  return [...new Set(matches)];
}

async function fetchStore(slug) {
  const url = `${SITE}/sub/location/location_${slug}.jsp`;
  const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 });
  const $ = cheerio.load(data);

  const name = $('.tit-wrap-list h2.h2-kr').first().text().trim();
  const addrRaw = $('.loc-info p.body-normal').first().text();
  const address = addrRaw.split(/TEL/i)[0].replace(/\s+/g, ' ').trim();

  const latMatch = data.match(/lat\s*:\s*([\d.]+)/);
  const lngMatch = data.match(/lng\s*:\s*([\d.]+)/);
  if (!latMatch || !lngMatch) return null;

  return {
    id: `SHAKESHACK_${slug}`,
    brand: 'SHAKESHACK',
    name: name ? `쉐이크쉑 ${name}` : `쉐이크쉑 ${slug}`,
    lat: parseFloat(latMatch[1]),
    lng: parseFloat(lngMatch[1]),
    address,
  };
}

async function crawlShakeshackStores() {
  const slugs = await fetchSlugs();
  const stores = [];
  for (const slug of slugs) {
    try {
      const store = await fetchStore(slug);
      if (store) stores.push(store);
    } catch (err) {
      console.error(`쉐이크쉑 ${slug} 매장 정보 수집 실패: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return stores;
}

module.exports = { crawlShakeshackStores };

if (require.main === module) {
  crawlShakeshackStores().then((items) => {
    console.log(JSON.stringify(items.slice(0, 3), null, 2));
    console.error(`쉐이크쉑 매장: ${items.length}개 수집`);
  }).catch((err) => {
    console.error('쉐이크쉑 매장 수집 실패:', err.message);
    process.exit(1);
  });
}
