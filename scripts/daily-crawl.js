// 이 PC에서 매일 저녁 행사 데이터를 수집해 저장소에 푸시하는 스케줄러용 스크립트.
//
// 왜 필요한가: GitHub Actions는 해외 데이터센터 IP라 서브웨이(403)·맘스터치(타임아웃)가
// 차단된다. 국내 IP인 이 PC에서는 정상 수집된다. 반대로 롯데리아는 Actions에서만 되므로
// 양쪽이 서로를 보완한다 - runAll.js의 폴백이 상대 환경이 넣어둔 값을 그대로 보존한다.
//
// 매장 위치(stores.json)는 Actions가 매일 처리하므로 여기서는 건드리지 않는다.
// 실행: node scripts/daily-crawl.js  (Windows 작업 스케줄러에 등록)

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOG_PATH = path.join(ROOT, 'daily-crawl.log');
// 20시에 성공했으면 21시 재시도분은 그냥 끝낸다. 실패했거나 PC가 꺼져 있었으면 21시에 이어받는다.
const STATE_PATH = path.join(ROOT, 'daily-crawl.state');

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function alreadySucceededToday() {
  try {
    return fs.readFileSync(STATE_PATH, 'utf-8').trim() === todayKey();
  } catch (e) {
    return false; // 파일이 없으면 아직 안 돌린 것
  }
}

function markSucceeded() {
  try {
    fs.writeFileSync(STATE_PATH, todayKey(), 'utf-8');
  } catch (e) {
    // 기록 실패는 무시 - 최악의 경우 21시에 한 번 더 도는 정도라 해가 없다.
  }
}

function log(message) {
  const line = `[${new Date().toLocaleString('ko-KR')}] ${message}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_PATH, line + '\n', 'utf-8');
  } catch (e) {
    // 로그 기록 실패가 크롤을 막지 않도록 무시한다.
  }
}

// 실패해도 스크립트가 계속 판단할 수 있도록 예외 대신 결과 객체를 돌려준다.
// 크롤러는 진행 상황을 stderr로 찍으므로 두 스트림을 모두 모아야 로그가 쓸모 있다.
function run(command) {
  const res = spawnSync(command, { cwd: ROOT, encoding: 'utf-8', shell: true });
  const out = (res.stdout || '') + (res.stderr || '');
  return { ok: res.status === 0, out };
}

function hasStagedChanges() {
  // git diff --cached --quiet 는 변경이 있으면 exit 1 - 그걸 그대로 이용한다.
  return !run('git diff --cached --quiet').ok;
}

function main() {
  if (alreadySucceededToday()) {
    log('오늘 이미 성공 - 건너뜀');
    return;
  }

  log('===== 로컬 크롤 시작 =====');

  // Actions가 먼저 올린 커밋이 있을 수 있으니 먼저 받아온다.
  const pulled = run('git pull --rebase origin main');
  if (!pulled.ok) {
    log('중단: git pull 실패 - 수동 확인 필요\n' + pulled.out.trim());
    process.exit(1);
  }

  const crawled = run('npm run crawl');
  // 크롤러 일부가 실패해도 runAll.js가 폴백으로 채우고 0이 아니면 성공으로 끝난다.
  // 전부 실패하면 exit 1이므로 deals.json은 건드려지지 않는다.
  if (!crawled.ok) {
    log('중단: 크롤 실패 - deals.json 유지');
    log(crawled.out.split('\n').slice(-15).join('\n'));
    process.exit(1);
  }
  const summary = crawled.out.split('\n').filter((l) => /수집 완료|대체합니다|작성 완료/.test(l));
  log('수집 결과\n' + summary.join('\n'));

  run('git add public/deals.json');
  if (!hasStagedChanges()) {
    log('변경 없음 - 커밋 생략');
    markSucceeded();
    return;
  }

  const today = new Date().toLocaleDateString('ko-KR');
  const committed = run(`git commit -m "chore: 행사 데이터 자동 갱신(로컬) ${today}"`);
  if (!committed.ok) {
    log('중단: 커밋 실패\n' + committed.out.trim());
    process.exit(1);
  }

  // 푸시가 거부되면(Actions와 경합) 원격 변경을 받아 최대 3회 재시도한다.
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (run('git push').ok) {
      log('푸시 완료');
      markSucceeded();
      return;
    }
    log(`푸시 거부됨 - 원격 변경을 받아 재시도 (${attempt}/3)`);
    run('git pull --rebase origin main');
  }

  log('실패: 3회 재시도 후에도 푸시하지 못했습니다.');
  process.exit(1);
}

main();
