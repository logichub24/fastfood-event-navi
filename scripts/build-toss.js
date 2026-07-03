// 토스인앱(Apps in Toss) 빌드용 스크립트.
// granite.config.ts의 web.commands.build/dev에서 호출됨.
// 정적 HTML 앱이라 별도 번들러 없이, public/ 안의 파일만 dist/로 복사한다.
// deals.json은 (편의점 앱과 달리) GitHub Pages 등 외부 호스팅을 아직 구성하지 않았으므로
// 빌드 시점 스냅샷을 그대로 번들에 포함시킨다. 매일 최신화하려면
// `npm run crawl && npm run build:toss`를 배포 전에 실행해야 한다.
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'public');
const DIST_DIR = path.join(__dirname, '..', 'dist');

fs.rmSync(DIST_DIR, { recursive: true, force: true });
fs.mkdirSync(DIST_DIR, { recursive: true });

fs.copyFileSync(path.join(SRC_DIR, 'index.html'), path.join(DIST_DIR, 'index.html'));
fs.copyFileSync(path.join(SRC_DIR, 'ads.js'), path.join(DIST_DIR, 'ads.js'));

if (fs.existsSync(path.join(SRC_DIR, 'deals.json'))) {
  fs.copyFileSync(path.join(SRC_DIR, 'deals.json'), path.join(DIST_DIR, 'deals.json'));
} else {
  console.warn('deals.json이 없습니다. `npm run crawl`을 먼저 실행하세요.');
}

if (fs.existsSync(path.join(SRC_DIR, 'stores.json'))) {
  fs.copyFileSync(path.join(SRC_DIR, 'stores.json'), path.join(DIST_DIR, 'stores.json'));
} else {
  console.warn('stores.json이 없습니다. `npm run sync:stores`를 먼저 실행하세요.');
}

for (const file of fs.readdirSync(SRC_DIR)) {
  if (/^icon.*\.(png|svg)$/.test(file)) {
    fs.copyFileSync(path.join(SRC_DIR, file), path.join(DIST_DIR, file));
  }
}

console.log('토스 빌드 완료:', DIST_DIR);
