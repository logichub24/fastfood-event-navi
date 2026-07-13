// 노브랜드버거 이벤트를 수집한다.
// 신세계푸드 코퍼레이트 사이트(shinsegaefood.com) 이벤트 페이지는 2024년 이후 갱신이 없어,
// 실제 진행중 행사가 올라오는 주문 사이트(order.nobrandburger.com)의 API를 쓴다.
// POST /nbb.app/NB70201.json, form `message=<JSON>` 형식. eventTypeCode:"60"이 이벤트 목록.

const axios = require('axios');

const ENDPOINT = 'https://order.nobrandburger.com/nbb.app/NB70201.json';
const LINK = 'https://order.nobrandburger.com/event/';

function toIsoDate(yyyymmdd) {
  const m = String(yyyymmdd || '').match(/^(\d{4})(\d{2})(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

async function crawlNobrandburger() {
  const message = JSON.stringify({
    header: { trcode: 'NB70201', app_key: 'NOBBANP0', is_crypt: false, member_number: '', device_os_type: 'Web' },
    body: { eventTypeCode: '60', eventUseYesNo: 'Y', pagingRowCount: '100', pagingStartRow: '1' },
  });

  const { data } = await axios.post(ENDPOINT, `message=${encodeURIComponent(message)}`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000,
  });

  const list = data?.body?.eventList || [];

  return list
    .filter((e) => e.eventTitle && e.eventUseYesNo === 'Y')
    .map((e) => ({
      brand: 'NOBRANDBURGER',
      id: String(e.eventCode),
      title: e.eventTitle.trim(),
      image: e.eventListImageUrl || e.eventMainImageUrl || '',
      link: LINK,
      startDate: toIsoDate(e.eventStartDate),
      endDate: toIsoDate(e.eventEndDate),
      isOngoingText: '진행중',
    }));
}

module.exports = { crawlNobrandburger };

if (require.main === module) {
  crawlNobrandburger().then((items) => {
    console.log(JSON.stringify(items, null, 2));
    console.error(`노브랜드버거: ${items.length}개 수집`);
  }).catch((err) => {
    console.error('노브랜드버거 크롤링 실패:', err.message);
    process.exit(1);
  });
}
