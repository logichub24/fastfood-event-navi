const fs = require('fs');
const path = require('path');

const { crawlMcdonalds } = require('./crawlers/mcdonalds');
const { crawlKFC } = require('./crawlers/kfc');
const { crawlLotteria } = require('./crawlers/lotteria');
const { crawlMomstouch } = require('./crawlers/momstouch');
const { crawlFrankburger } = require('./crawlers/frankburger');
const { crawlShakeshack } = require('./crawlers/shakeshack');
const { crawlSubway } = require('./crawlers/subway');
const { crawlBurgerking } = require('./crawlers/burgerking');
const { crawlNobrandburger } = require('./crawlers/nobrandburger');

const OUT_PATH = path.join(__dirname, '..', 'public', 'deals.json');

// 이벤트 제목 키워드로 카테고리를 추정한다. 앱의 CATEGORIES 목록과 맞춰야 함.
// 순서가 우선순위 - 위에서부터 먼저 매칭되는 카테고리로 분류한다.
const CATEGORY_RULES = [
  ['신메뉴', /신메뉴|신제품|NEW\b|출시/i],
  ['시간대 특가', /타임|런치|브레이크|나이트|올데이|데이!|시부터.*시까지|시~.*시/],
  ['세트･콤보', /세트|콤보|박스|팩\b/],
  ['배달', /배달|배민|쿠팡이츠|요기요|땡겨요|딜리버리/],
  ['멤버십･앱', /멤버십|회원|APP|앱\b/i],
  ['쿠폰･할인', /쿠폰|할인|무료|세일|이벤트/],
];

function guessCategory(title) {
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(title)) return category;
  }
  return '메뉴소식';
}

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function daysBetween(fromIso, toIso) {
  const from = new Date(fromIso + 'T00:00:00+09:00');
  const to = new Date(toIso + 'T00:00:00+09:00');
  return Math.round((to - from) / 86400000);
}

// 재시도 로직: 실패 시 delayMs 간격으로 최대 maxRetries회 재시도
async function withRetry(fn, label, maxRetries = 3, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) console.error(`${label}: ${attempt}번째 시도에서 성공`);
      return result;
    } catch (err) {
      console.error(`${label}: 시도 ${attempt}/${maxRetries} 실패 - ${err.message}`);
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error(`${label}: ${maxRetries}회 시도 모두 실패`);
}

function extractBrandItemsFromOldDB(oldDB, brand) {
  return oldDB.filter((p) => p.brand === brand);
}

async function run() {
  let oldDB = [];
  try {
    oldDB = JSON.parse(fs.readFileSync(OUT_PATH, 'utf-8'));
    console.error(`기존 deals.json 로드: ${oldDB.length}건`);
  } catch (e) {
    // 첫 실행 등으로 기존 파일이 없으면 폴백 없이 진행
  }
  const oldIds = new Set(oldDB.map((p) => `${p.brand}:${p.id}`));

  const crawlers = [
    ['MCDONALDS', crawlMcdonalds],
    ['KFC', crawlKFC],
    ['LOTTERIA', crawlLotteria],
    ['MOMSTOUCH', crawlMomstouch],
    ['FRANKBURGER', crawlFrankburger],
    ['SHAKESHACK', crawlShakeshack],
    ['SUBWAY', crawlSubway],
    ['BURGERKING', crawlBurgerking],
    ['NOBRANDBURGER', crawlNobrandburger],
  ];

  let all = [];
  for (const [brand, crawlFn] of crawlers) {
    let items = [];
    try {
      items = await withRetry(() => crawlFn(), brand);
      console.error(`${brand}: ${items.length}개 수집 완료`);
    } catch (err) {
      console.error(`${brand} 크롤링 최종 실패:`, err.message);
    }

    if (items.length === 0) {
      const fallback = extractBrandItemsFromOldDB(oldDB, brand);
      if (fallback.length > 0) {
        console.error(`${brand}: 0건 수집되어 전날 데이터 ${fallback.length}건으로 대체합니다. (크롤러 점검 필요)`);
        items = fallback.map(({ category, ongoing, daysLeft, isNew, ...rest }) => rest);
      }
    }

    const oldCount = oldDB.filter((p) => p.brand === brand).length;
    if (oldCount > 0 && items.length < oldCount * 0.3) {
      console.error(`⚠️  ${brand}: 수집량 급감 감지 (전날 ${oldCount}건 → 오늘 ${items.length}건). 크롤러 점검 권장.`);
    }

    all = all.concat(items);
  }

  if (all.length === 0) {
    console.error('모든 브랜드 수집에 실패하여 deals.json을 갱신하지 않습니다.');
    process.exit(1);
  }

  const today = todayStr();
  const final = all
    .map((item) => {
      const ongoing = !item.endDate || item.endDate >= today;
      const daysLeft = item.endDate ? daysBetween(today, item.endDate) : null;
      return {
        ...item,
        category: guessCategory(item.title),
        ongoing,
        daysLeft,
        isNew: !oldIds.has(`${item.brand}:${item.id}`),
      };
    })
    .filter((item) => item.ongoing) // 종료된 이벤트는 목록에서 제외
    .sort((a, b) => {
      // 마감 임박순 정렬, 상시(daysLeft null)는 맨 뒤로
      if (a.daysLeft === null && b.daysLeft === null) return 0;
      if (a.daysLeft === null) return 1;
      if (b.daysLeft === null) return -1;
      return a.daysLeft - b.daysLeft;
    });

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(final, null, 2), 'utf-8');
  console.error(`deals.json 작성 완료: 이벤트 ${final.length}건 (${OUT_PATH})`);
}

run();
