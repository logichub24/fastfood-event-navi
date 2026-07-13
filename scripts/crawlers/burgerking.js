// 버거킹 코리아 이벤트를 수집한다.
// 사이트가 SPA라 HTML엔 목록이 없고, POST /burgerking/BKR0608.json 엔드포인트가 이벤트 목록을 준다.
// 요청은 form-urlencoded `message=<JSON>` 형태이며, body.tpStatusEvent="C"가 진행중 이벤트다.

const axios = require('axios');

const ENDPOINT = 'https://www.burgerking.co.kr/burgerking/BKR0608.json';
const LINK = 'https://www.burgerking.co.kr/event/ongoing';

function toIsoDate(yyyymmdd) {
  // '20260701' -> '2026-07-01'
  const m = String(yyyymmdd || '').match(/^(\d{4})(\d{2})(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

async function crawlBurgerking() {
  const message = JSON.stringify({
    header: { result: true, error_code: '', error_text: '', info_text: '', message_version: '', login_session_id: '', trcode: 'BKR0608', cd_call_chnn: '01' },
    body: { cdTypeEvent: '00', page: '1', pageCount: '100', tpStatusEvent: 'C' }, // C=진행중
  });

  const { data } = await axios.post(ENDPOINT, `message=${encodeURIComponent(message)}`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000,
  });

  const list = data?.body?.eventList || [];

  return list
    .filter((e) => e.eventTitle)
    .map((e) => ({
      brand: 'BURGERKING',
      id: String(e.eventId),
      title: e.eventTitle.trim(),
      image: e.imageUrlWeb || e.imageUrlApp || '',
      link: LINK,
      startDate: toIsoDate(e.dtStart),
      endDate: toIsoDate(e.dtEnd),
      isOngoingText: '진행중',
    }));
}

module.exports = { crawlBurgerking };

if (require.main === module) {
  crawlBurgerking().then((items) => {
    console.log(JSON.stringify(items, null, 2));
    console.error(`버거킹: ${items.length}개 수집`);
  }).catch((err) => {
    console.error('버거킹 크롤링 실패:', err.message);
    process.exit(1);
  });
}
