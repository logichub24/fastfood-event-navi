const axios = require('axios');
const cheerio = require('cheerio');

// shakeshack.kr은 https(443)를 지원하지 않는 순수 HTTP 전용 레거시 사이트라 http로만 접근 가능함
const URL = 'http://www.shakeshack.kr/sub/newsnevent.jsp';
const SITE = 'http://www.shakeshack.kr';

function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00+09:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function crawlShakeshack() {
  const { data } = await axios.get(URL, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000,
  });
  const $ = cheerio.load(data);
  const items = [];

  $('li.element-item').each((_, el) => {
    const $el = $(el);
    const title = $el.find('.tit').first().text().trim();
    if (!title) return;

    const dateText = $el.find('.date p').first().text().trim();
    const dateMatch = dateText.match(/(\d{4})\.(\d{2})\.(\d{2})/);
    const postDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null;

    const style = $el.find('.image-wrap').attr('style') || '';
    const imgMatch = style.match(/url\((['"]?)(.*?)\1\)/);
    const rawImg = imgMatch ? imgMatch[2] : '';
    const image = rawImg ? (rawImg.startsWith('http') ? rawImg : SITE + rawImg) : '';

    const rawLink = $el.find('.btn-wrap a').attr('href') || '';
    const link = rawLink ? (rawLink.startsWith('http') ? rawLink : SITE + rawLink) : SITE + '/sub/newsnevent.jsp';
    const idMatch = rawLink.match(/newsnevent_(\d+)\.jsp/);

    // 명시적 종료일이 없는 뉴스/이벤트 게시물이라, 종료일을 null로 두면 2023년 글까지
    // 전부 "상시 진행"으로 잘못 표시됨. 게시일 기준 60일짜리 유효기간을 합성해서 부여.
    const endDate = postDate ? addDays(postDate, 60) : null;

    items.push({
      brand: 'SHAKESHACK',
      id: idMatch ? idMatch[1] : title,
      title,
      image,
      link,
      startDate: postDate,
      endDate,
    });
  });

  return items;
}

module.exports = { crawlShakeshack };

if (require.main === module) {
  crawlShakeshack().then((items) => {
    console.log(JSON.stringify(items.slice(0, 3), null, 2));
    console.error(`쉐이크쉑: ${items.length}개 수집`);
  }).catch((err) => {
    console.error('쉐이크쉑 크롤링 실패:', err.message);
    process.exit(1);
  });
}
