const axios = require('axios');
const cheerio = require('cheerio');

// 롯데리아는 자체 도메인(lotteria.com) 대신 롯데GRS 통합 플랫폼 LOTTE EATZ에서 운영됨.
// divcd=10 파라미터로 롯데리아 브랜드만 필터링해서 가져올 수 있음(엔제리너스=20, 크리스피크림도넛=40).
const ENDPOINT = 'https://www.lotteeatz.com/event/main/eventListAjax';
const SITE = 'https://www.lotteeatz.com';
const DIVCD_LOTTERIA = '10';

async function fetchPage(page) {
  const { data } = await axios.post(
    ENDPOINT,
    { divcd: DIVCD_LOTTERIA, page, eventSttusCode: '' },
    {
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000,
    }
  );
  const $ = cheerio.load(data);
  const items = [];
  $('li.grid-item').each((_, el) => {
    const $el = $(el);
    const title = $el.find('.grid-title').first().text().replace(/\s+/g, ' ').trim();
    if (!title) return;

    const period = $el.find('.grid-period').first().text().replace(/\s+/g, ' ').trim();
    // '2026.06.25 ~ 2026.06.26' -> ['2026-06-25', '2026-06-26']
    const dateMatch = period.match(/(\d{4})\.(\d{2})\.(\d{2})\s*~\s*(\d{4})\.(\d{2})\.(\d{2})/);
    const startDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null;
    const endDate = dateMatch ? `${dateMatch[4]}-${dateMatch[5]}-${dateMatch[6]}` : null;

    const rawImg = $el.find('.thumb-box img').attr('src') || '';
    const image = rawImg.startsWith('http') ? rawImg : SITE + rawImg;

    const rawLink = $el.find('a.btn-link').attr('href') || $el.find('a').first().attr('href') || '';
    const link = rawLink.startsWith('http') ? rawLink : SITE + rawLink;
    const idMatch = rawLink.match(/selectEvent\/(\d+)/);

    items.push({
      brand: 'LOTTERIA',
      id: idMatch ? idMatch[1] : title,
      title,
      image,
      link,
      startDate,
      endDate,
    });
  });
  return items;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function crawlLotteria({ maxPages = 20, delayMs = 300 } = {}) {
  const all = [];
  const seenIds = new Set();
  const today = todayIso();

  for (let page = 1; page <= maxPages; page++) {
    const items = await fetchPage(page);
    if (items.length === 0) break;

    let newCount = 0;
    for (const item of items) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      all.push(item);
      newCount++;
    }
    if (newCount === 0) break; // 다음 페이지가 같은 목록을 반복하면 중단

    // 목록은 최신순이므로, 이 페이지의 모든 항목이 이미 종료된 이벤트라면
    // 다음 페이지도 전부 과거 이벤트일 뿐이라 더 가져올 필요가 없음.
    const allExpired = items.every((item) => item.endDate && item.endDate < today);
    if (allExpired) break;

    await new Promise((r) => setTimeout(r, delayMs));
  }
  return all;
}

module.exports = { crawlLotteria };

if (require.main === module) {
  crawlLotteria().then((items) => {
    console.log(JSON.stringify(items, null, 2));
    console.error(`롯데리아: ${items.length}개 수집`);
  }).catch((err) => {
    console.error('롯데리아 크롤링 실패:', err.message);
    process.exit(1);
  });
}
