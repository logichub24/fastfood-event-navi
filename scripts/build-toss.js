// 토스인앱(Apps in Toss) 빌드용 스크립트.
// granite.config.ts의 web.commands.build/dev에서 호출됨.
// 정적 HTML 앱이라 별도 번들러 없이, public/ 안의 파일만 dist/로 복사한다.
// deals.json/stores.json은 복사하지 않음 - 런타임에 DATA_BASE_URL(GitHub Pages)에서 직접
// fetch하므로 번들에 포함시키면 용량만 커지고, 매일 새벽 크론으로 갱신되는 데이터라 의미 없음.
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'public');
const DIST_DIR = path.join(__dirname, '..', 'dist');

fs.rmSync(DIST_DIR, { recursive: true, force: true });
fs.mkdirSync(DIST_DIR, { recursive: true });

for (const file of ['index.html', 'app.css', 'app.js', 'ads.js', 'sw.js', 'manifest.json']) {
  fs.copyFileSync(path.join(SRC_DIR, file), path.join(DIST_DIR, file));
}

for (const file of fs.readdirSync(SRC_DIR)) {
  if (/^icon.*\.(png|svg)$/.test(file)) {
    fs.copyFileSync(path.join(SRC_DIR, file), path.join(DIST_DIR, file));
  }
}

console.log('토스 빌드 완료:', DIST_DIR);
