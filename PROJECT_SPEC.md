# PROJECT_SPEC — 패스트푸드 행사

운영 중인 앱입니다. 구조를 바꾸기 전에 이 문서를 먼저 읽어주세요.

## 1. 개요

| 항목 | 값 |
| --- | --- |
| 앱 이름 | 패스트푸드 행사 |
| 앱 ID | `fastfood-event-navi` |
| 플랫폼 | 토스 미니앱 (Apps in Toss) |
| SDK | `@apps-in-toss/web-framework` — master 2.x / `migrate/ait-sdk-v3` 브랜치 3.0.4 |
| 프레임워크 | 없음. 번들러 없는 정적 웹앱 (HTML + JS + Tailwind CDN) |
| 언어 | JavaScript (TypeScript 미사용) |
| 저장소 | https://github.com/logichub24/fastfood-event-navi |

## 2. 핵심 목적

패스트푸드 브랜드의 **진행 중인 행사**를 한눈에 보여주고, **내 주변 매장**으로 연결한다.
유입의 약 90%가 토스 검색이고 대부분 브랜드 의도를 갖고 들어온다.

## 3. 화면 구성

탭은 2개이고 설정은 시트로 연다.

- **행사 탭** — 목록, 브랜드/카테고리 필터, 검색(초성 지원), 찜, 상세 시트
- **매장찾기 탭** — Leaflet 지도, 반경 300m~5km, 브랜드 필터, 드라이브스루 필터, 위성뷰, 지역 검색, 길찾기
- **설정** — 안내, 찜 초기화, 알림 동의

오버레이는 바텀시트 5개(상세·검색·찜·지역검색·매장)와 모달 4개(설정·시작안내·브랜드·카테고리)입니다.
전부 닫기 버튼과 배경 탭으로 닫힙니다.

## 4. 데이터 파이프라인 ⚠️ 중요

앱은 데이터를 **번들에 넣지 않고 런타임에 받아옵니다.**

```
크롤 → git push → GitHub Pages 배포 → 앱이 실행 시 fetch
```

`DATA_BASE_URL = https://logichub24.github.io/fastfood-event-navi/public/`

**따라서 데이터만 바뀔 때는 앱 재배포(`ait deploy`)가 필요 없습니다.**
푸시 후 Pages 배포(~1분) + CDN 캐시(max-age=600)로 **최대 10분 내 전 사용자 반영**됩니다.
앱 코드(`public/*`)를 고칠 때만 재빌드·재배포가 필요합니다.

### 수집 경로가 두 개인 이유

| 경로 | 시각 | 특징 |
| --- | --- | --- |
| GitHub Actions (`crawl.yml`) | 매일 03시 KST | 7개 브랜드 + 매장 좌표 |
| 로컬 PC 예약 작업 (`daily-crawl.js`) | 매일 20시 / 실패 시 21시 | 서브웨이·맘스터치 포함 전 브랜드 |

로컬 크롤은 **`E:APPastfood-crawl-main` 전용 git worktree**(main 전용)에서 실행됩니다.
개발용 브랜치를 체크아웃해 두어도 크롤에 영향이 없고, 매 실행마다 `origin/main`으로
hard reset하므로 **충돌이 발생할 수 없습니다.** worktree에는 `node_modules`를 두지 않고
주 저장소의 것을 `NODE_PATH`로 빌려 씁니다.

**서브웨이·맘스터치**는 GitHub Actions(해외 IP)에서 403·타임아웃으로 차단됩니다.
**롯데리아는 정반대로** 로컬에서 0건, Actions에서 정상 수집됩니다.

`runAll.js`의 폴백이 **상대 환경이 넣어둔 값을 보존**하므로 두 경로가 서로를 보완합니다.
**이 구조를 깨지 마세요.** 한쪽만 남기면 일부 브랜드 데이터가 멈춥니다.

> ⚠️ 알려진 위험: 로컬 PC 의존은 개발 지침 §45(특정 PC 의존 금지)에 어긋납니다.
> PC 고장·교체 시 두 브랜드가 멈춥니다. 국내 VPS 전환이 대안이나 차단 기준(지역 vs 데이터센터)이
> 확인되지 않아 보류 중입니다.

## 5. 외부 의존

| 대상 | 용도 | 방식 | CORS |
| --- | --- | --- | --- |
| GitHub Pages | deals/stores.json | fetch | 대상 |
| Open-Meteo | 날씨 추천 칩 | fetch | 대상 |
| esm.sh | 토스 SDK | ESM import | 대상 |
| Tailwind / Font Awesome / Leaflet | CDN 자산 | script·link | 비대상 |
| OpenStreetMap / VWorld / CartoDB | 지도 타일 | img | 비대상 |
| VWorld 검색 | 지역 검색 | JSONP | 비대상 |
| 카카오맵 | 길찾기 | 링크 이동 | 비대상 |

SDK 3.x부터 origin이 `https://fastfood-event-navi.web.tossmini.com` / `...private-web...`으로 바뀝니다.
CORS 대상 4곳은 모두 `ACAO: *`로 확인했습니다.

> ⚠️ `VWORLD_KEY`가 `public/app.js`에 하드코딩돼 있습니다(지침 §12 위반).
> 서버가 없어 `Mini App → 서버 → 외부 API` 구조를 못 만든 상태입니다.

## 6. 광고

- 배너: 진입 시 상시 (하단 탭바 위)
- 전면광고: 길찾기 매번 / 지도 진입 2번째부터 / 행사 상세 2·4·6번째
- 시작 유예·쿨다운·세션 상한 없음. 광고 재로딩 시간이 자연 간격 역할

평균 체류가 34초라 유예를 걸면 광고가 사실상 꺼집니다(45초로 뒀다가 겪음).

## 7. 계측

`window.tossLog(type, params)` — SDK 3.x의 `Analytics` 사용.
2.x에서는 `web-analytics`가 `web-bridge`를 peer로 가져 esm.sh에서 브릿지가 **두 번 로드돼
광고가 전부 죽는** 문제가 있어 제거했었고, 3.x에서 한 패키지로 합쳐지며 복원했습니다.

## 8. 빌드·배포

```bash
npm run build                  # dist/ + fastfood-event-navi.ait
node_modules/.bin/ait deploy   # 토스 콘솔 업로드 (API 키 필요)
```

`dist/`와 `*.ait`는 `.gitignore` 대상이며, **git push는 앱 배포가 아닙니다.**

## 9. 알려진 미해결 항목

- 로컬 PC 의존 (§4 참고)
- `VWORLD_KEY` 클라이언트 노출 (§5 참고)
- CI 없음 — `.github/workflows`에 `crawl.yml`(데이터)만 있고 빌드 검증 워크플로우가 없음
- `NOTIFICATION_TEMPLATE_CODE`가 `PLACEHOLDER` — 토스 콘솔 스마트발송 등록 대기
- 찜 누를 때 알림 동의창이 뜨는 동작 (CTA 예측 가능성 이슈, 위 코드 등록 시 활성화됨)
