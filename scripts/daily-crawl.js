// 이 PC에서 매일 저녁 행사 데이터를 수집해 저장소(main)에 푸시하는 스케줄러용 스크립트.
//
// 왜 필요한가: GitHub Actions는 해외 데이터센터 IP라 서브웨이(403)·맘스터치(타임아웃)가
// 차단된다. 국내 IP인 이 PC에서는 정상 수집된다. 반대로 롯데리아는 Actions에서만 되므로
// 양쪽이 서로를 보완한다 - runAll.js의 폴백이 상대 환경이 넣어둔 값을 그대로 보존한다.
//
// ⚠️ 왜 전용 worktree를 쓰는가 (2026-08-25 사고 후 변경):
// 예전에는 이 저장소에서 그대로 `git pull --rebase origin main`을 실행했다.
// 그런데 개발용 브랜치(migrate/ait-sdk-v3)가 체크아웃돼 있으면 그 브랜치를 main 위로
// rebase하려다 deals.json에서 충돌이 나고, 저장소가 detached HEAD로 멈춰버렸다.
// 그 뒤로 이틀간 크롤이 전부 실패했다.
// 이제는 main만 체크아웃된 별도 worktree에서만 작업하므로,
// 개발 중 어느 브랜치를 쓰든 크롤에 영향이 없고 작업 트리도 건드리지 않는다.
// 게다가 매번 origin/main으로 hard reset하므로 충돌이 발생할 수 없다.
//
// 매장 위치(stores.json)는 Actions가 매일 처리하므로 여기서는 건드리지 않는다.
// 실행: node scripts/daily-crawl.js  (Windows 작업 스케줄러에 등록)

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WORKTREE = path.join(ROOT, '..', 'fastfood-crawl-main');
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
// 타임아웃이 없으면 git이 자격증명 입력을 기다리며 멈출 때 프로세스가 영원히 살아남고,
// 예약 작업이 IgnoreNew라 다음 실행까지 통째로 건너뛴다.
// GIT_TERMINAL_PROMPT=0으로 입력 대기 자체를 막고, 타임아웃으로 이중 방어한다.
function run(command, opts = {}) {
  const { cwd = WORKTREE, timeoutMs = 120000, env = {} } = opts;
  const res = spawnSync(command, {
    cwd,
    encoding: 'utf-8',
    shell: true,
    timeout: timeoutMs,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', ...env },
  });
  const out = (res.stdout || '') + (res.stderr || '');
  if (res.error && res.error.code === 'ETIMEDOUT') {
    return { ok: false, out: `${timeoutMs / 1000}초 초과로 중단: ${command}\n${out}` };
  }
  return { ok: res.status === 0, out };
}

// 크롤 전용 worktree를 준비한다. 없으면 만들고, 있으면 origin/main과 똑같이 되돌린다.
function prepareWorktree() {
  if (!fs.existsSync(WORKTREE)) {
    log('크롤 전용 worktree가 없어 새로 만든다: ' + WORKTREE);
    const fetched = run('git fetch origin main', { cwd: ROOT });
    if (!fetched.ok) return { ok: false, out: fetched.out };
    const added = run(`git worktree add "${WORKTREE}" main`, { cwd: ROOT });
    if (!added.ok) return { ok: false, out: added.out };
  }

  const fetched = run('git fetch origin main');
  if (!fetched.ok) return { ok: false, out: fetched.out };

  // 여기서 hard reset을 하기 때문에 충돌이 발생할 수 없다.
  // 이 worktree에는 사람이 만든 변경이 없으므로 잃을 것도 없다.
  const reset = run('git reset --hard origin/main');
  if (!reset.ok) return { ok: false, out: reset.out };

  const branch = run('git rev-parse --abbrev-ref HEAD');
  if (!branch.ok || branch.out.trim() !== 'main') {
    return { ok: false, out: 'worktree가 main이 아니다: ' + branch.out.trim() };
  }
  return { ok: true, out: '' };
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

  const prepared = prepareWorktree();
  if (!prepared.ok) {
    log('중단: worktree 준비 실패 - 수동 확인 필요\n' + prepared.out.trim());
    process.exit(1);
  }

  // worktree에는 node_modules가 없으므로 이 저장소의 것을 NODE_PATH로 빌려 쓴다.
  // (worktree에 중복 설치하지 않기 위함)
  const crawled = run('node scripts/runAll.js', {
    timeoutMs: 600000,
    env: { NODE_PATH: path.join(ROOT, 'node_modules') },
  });
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

  // 푸시가 거부되면(Actions와 경합) origin/main을 다시 받아 그 위에 얹어 재시도한다.
  // rebase 대신 fetch + reset 후 재커밋이 아니라, 데이터 파일 하나뿐이라 rebase가 안전하다.
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (run('git push origin main').ok) {
      log('푸시 완료');
      markSucceeded();
      return;
    }
    log(`푸시 거부됨 - 원격 변경을 받아 재시도 (${attempt}/3)`);
    const rebased = run('git pull --rebase origin main');
    if (!rebased.ok) {
      // 충돌 등으로 rebase가 걸리면 worktree를 깨끗한 상태로 되돌리고 포기한다.
      // 다음 실행에서 hard reset으로 정상 복구되므로 저장소가 망가진 채 남지 않는다.
      log('리베이스 실패 - worktree를 되돌리고 중단한다\n' + rebased.out.trim());
      run('git rebase --abort');
      run('git reset --hard origin/main');
      process.exit(1);
    }
  }

  log('실패: 3회 재시도 후에도 푸시하지 못했습니다.');
  process.exit(1);
}

main();
