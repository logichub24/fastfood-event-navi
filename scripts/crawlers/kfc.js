const axios = require('axios');

const URL = 'https://www.kfckorea.com/promotion/promotionlist/a801';
const SITE = 'https://www.kfckorea.com';

// window.__INITIAL_COMPONENTS_STATE__ = [null, {...}]; 형태로 페이지에 인라인 삽입되어 있음.
// 뒤이어 같은 <script> 태그 안에 다른 window.__X__ 대입문이 더 있어서 </script>까지 통째로 잘라내면
// 안 되고, 첫 '[' 부터 문자열/이스케이프를 고려해 괄호 깊이가 0이 되는 지점까지만 잘라야 함.
function extractBalanced(str, start) {
  let depth = 0;
  let inStr = false;
  let strCh = '';
  let esc = false;
  for (let i = start; i < str.length; i++) {
    const c = str[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === strCh) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; strCh = c; continue; }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) return str.slice(start, i + 1);
    }
  }
  return null;
}

function toIsoDate(dateTime) {
  // '2026-06-16 00:00:00' -> '2026-06-16'
  if (!dateTime) return null;
  const m = String(dateTime).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

async function crawlKFC() {
  const { data: html } = await axios.get(URL, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000,
  });

  const marker = '__INITIAL_COMPONENTS_STATE__';
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) throw new Error('__INITIAL_COMPONENTS_STATE__ 를 찾을 수 없음 (사이트 구조 변경 의심)');

  const startBracket = html.indexOf('[', markerIdx);
  const jsText = extractBalanced(html, startBracket);
  if (!jsText) throw new Error('상태 JSON 추출 실패');

  const state = JSON.parse(jsText);
  const rows = state?.[1]?.listData?.rows || [];

  return rows
    .filter((row) => row.event_title)
    .map((row) => ({
      brand: 'KFC',
      id: String(row.event_index),
      title: row.event_title.trim(),
      // 이미지 경로는 /nas 하위에 실제로 존재함 (event_web_list_img 값 자체에는 /nas가 빠져있음)
      image: row.event_web_list_img ? SITE + '/nas' + row.event_web_list_img : '',
      link: SITE + '/promotion/promotionlist/a801',
      startDate: toIsoDate(row.event_show_str_date),
      endDate: toIsoDate(row.event_show_end_date),
      isOngoingText: row.event_progress_nm, // '진행중' / '진행종료'
    }));
}

module.exports = { crawlKFC };

if (require.main === module) {
  crawlKFC().then((items) => {
    console.log(JSON.stringify(items, null, 2));
    console.error(`KFC: ${items.length}개 수집`);
  }).catch((err) => {
    console.error('KFC 크롤링 실패:', err.message);
    process.exit(1);
  });
}
