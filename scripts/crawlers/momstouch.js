const axios = require('axios');
const cheerio = require('cheerio');

// s_level=Y 파라미터로 진행중인 프로모션만 서버에서 걸러서 내려줌.
const URL = 'https://momstouch.co.kr/promotion/list.php?s_level=Y';
const SITE = 'https://momstouch.co.kr';

async function crawlMomstouch() {
  const { data } = await axios.get(URL, {
    // GitHub Actions에서 15초로는 매번 타임아웃이 나 전날 데이터로 대체되고 있었다.
    // 응답이 느린 사이트라 여유를 주고, 브라우저 헤더를 갖춰 차단 가능성도 줄인다.
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
    },
    timeout: 30000,
  });
  const $ = cheerio.load(data);
  const items = [];

  $('.card-news li').each((_, el) => {
    const $el = $(el);
    const title = $el.find('.title').first().text().trim();
    if (!title) return;

    const period = $el.find('.date').first().text().trim();
    const dateMatch = period.match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
    const startDate = dateMatch ? dateMatch[1] : null;
    const endDate = dateMatch ? dateMatch[2] : null;

    const style = $el.find('figure').attr('style') || '';
    const imgMatch = style.match(/url\((['"]?)(.*?)\1\)/);
    const rawImg = imgMatch ? imgMatch[2] : '';
    const image = rawImg ? (rawImg.startsWith('http') ? rawImg : SITE + rawImg) : '';

    const onclick = $el.find('a').attr('onclick') || $el.find('a').attr('href') || '';
    const idMatch = onclick.match(/go_view\('(\d+)'\)/);
    const id = idMatch ? idMatch[1] : title;
    const link = idMatch ? `${SITE}/promotion/view.php?idx=${idMatch[1]}` : `${SITE}/promotion/list.php`;

    items.push({ brand: 'MOMSTOUCH', id, title, image, link, startDate, endDate });
  });

  return items;
}

module.exports = { crawlMomstouch };

if (require.main === module) {
  crawlMomstouch().then((items) => {
    console.log(JSON.stringify(items, null, 2));
    console.error(`맘스터치: ${items.length}개 수집`);
  }).catch((err) => {
    console.error('맘스터치 크롤링 실패:', err.message);
    process.exit(1);
  });
}
