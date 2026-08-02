const axios = require('axios');

// eventState:'Y' = 진행중 이벤트만 서버에서 걸러서 내려줌
const URL = 'https://www.subway.co.kr/ajaxEventList';
const SITE = 'https://www.subway.co.kr';

// 최소 UA로는 봇으로 판정돼 막히는 사이트가 있어 실제 브라우저 UA를 쓴다.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function crawlSubway() {
  const { data } = await axios.post(
    URL,
    { page: 1, eventState: 'Y' },
    {
      // 'Mozilla/5.0'만 보내면 GitHub Actions에서 403으로 막힌다(로컬은 통과).
      // 실제 브라우저가 보내는 헤더 묶음을 갖춰야 통과한다.
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': BROWSER_UA,
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `${SITE}/eventList`,
        'Origin': SITE,
      },
      timeout: 30000,
    }
  );

  const list = Array.isArray(data) ? data : [];
  return list
    .filter((item) => item.subject)
    .map((item) => ({
      brand: 'SUBWAY',
      id: String(item.eventIdx),
      title: item.subject.trim(),
      image: item.pcThumbnail ? SITE + item.pcThumbnail : '',
      link: `${SITE}/eventList`,
      startDate: item.eventStartDt || null,
      endDate: item.eventEndDt || null, // 서브웨이는 종료일 없이 "소진 시" 형태가 많아 null이면 상시로 취급됨
    }));
}

module.exports = { crawlSubway };

if (require.main === module) {
  crawlSubway().then((items) => {
    console.log(JSON.stringify(items, null, 2));
    console.error(`서브웨이: ${items.length}개 수집`);
  }).catch((err) => {
    console.error('서브웨이 크롤링 실패:', err.message);
    process.exit(1);
  });
}
