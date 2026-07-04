const axios = require('axios');

// eventState:'Y' = 진행중 이벤트만 서버에서 걸러서 내려줌
const URL = 'https://www.subway.co.kr/ajaxEventList';
const SITE = 'https://www.subway.co.kr';

async function crawlSubway() {
  const { data } = await axios.post(
    URL,
    { page: 1, eventState: 'Y' },
    { headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }
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
