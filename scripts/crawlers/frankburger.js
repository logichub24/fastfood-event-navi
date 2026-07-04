const axios = require('axios');
const cheerio = require('cheerio');

// board=event_01&tab=1 이 서버사이드에서 이미 "진행중 이벤트"만 걸러줌
const URL = 'https://frankburger.co.kr/board/index.php?board=event_01&tab=1';
const SITE = 'https://frankburger.co.kr';

async function crawlFrankburger() {
  const { data } = await axios.get(URL, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000,
  });
  const $ = cheerio.load(data);
  const items = [];

  $('ul.board_list > li').each((_, el) => {
    const $el = $(el);
    const title = $el.find('.board_list_title').first().text().trim();
    if (!title) return;

    const descText = $el.find('.board_list_desc').first().text().replace(/\s+/g, ' ').trim();
    const dateMatch = descText.match(/(\d{4})\/(\d{2})\/(\d{2})\s*~\s*(\d{4})\/(\d{2})\/(\d{2})/);
    const startDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null;
    const endDate = dateMatch ? `${dateMatch[4]}-${dateMatch[5]}-${dateMatch[6]}` : null;

    const rawImg = $el.find('.board_list_thumb img').attr('src') || '';
    const image = rawImg.startsWith('http') ? rawImg : SITE + rawImg;

    const rawLink = $el.find('a').first().attr('href') || '';
    const link = rawLink.startsWith('http') ? rawLink : SITE + rawLink;
    const idMatch = rawLink.match(/idx=(\d+)/);

    items.push({
      brand: 'FRANKBURGER',
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

module.exports = { crawlFrankburger };

if (require.main === module) {
  crawlFrankburger().then((items) => {
    console.log(JSON.stringify(items, null, 2));
    console.error(`프랭크버거: ${items.length}개 수집`);
  }).catch((err) => {
    console.error('프랭크버거 크롤링 실패:', err.message);
    process.exit(1);
  });
}
