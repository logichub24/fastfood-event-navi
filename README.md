# 패스트푸드 행사

국내 패스트푸드 9개 브랜드의 진행 중인 행사와 주변 매장을 한 화면에서 보여주는 **토스 미니앱**입니다.

- 앱 ID: `fastfood-event-navi`
- 운영 상태: **출시 후 운영 중** (일 방문자 약 45~50명)
- 데이터: 매일 자동 수집 후 GitHub Pages로 배포

## 빠른 시작

```bash
npm install
npm run dev          # public/ 을 dist/ 로 복사
npm run build        # dist 복사 + .ait 아티팩트 생성
```

로컬에서 화면을 보려면 정적 서버로 `public/` 을 열면 됩니다.

```bash
node scripts/dev-server.js   # http://localhost:5173
```

## 주요 명령

| 명령 | 설명 |
| --- | --- |
| `npm run build` | `dist/` 생성 후 `ait build` 로 `.ait` 아티팩트 생성 |
| `npm run crawl` | 9개 브랜드 행사 수집 → `public/deals.json` |
| `npm run sync:stores` | 매장 좌표 수집 → `public/stores.json` |
| `node scripts/daily-crawl.js` | 로컬 PC 예약 작업용 일일 크롤 |

## 구조

```
public/            앱 본체 (번들러 없는 정적 웹앱)
  index.html       마크업
  app.js           화면 로직 전체
  app.css          전역 스타일
  ads.js           토스 SDK 연동 (광고·공유·위치·계측)
  sw.js            서비스워커
  deals.json       행사 데이터 (자동 갱신, 번들 제외)
  stores.json      매장 데이터 (자동 갱신, 번들 제외)
scripts/
  build-toss.js    public/ → dist/ 복사
  runAll.js        크롤러 통합 + 카테고리 분류 + 폴백
  crawlers/        브랜드별 크롤러 12개
  storeLocations.js 매장 좌표 수집
  daily-crawl.js   로컬 예약 작업용 크롤
```

## 문서

- [PROJECT_SPEC.md](PROJECT_SPEC.md) — 아키텍처, 데이터 파이프라인, 운영 구조
- [AGENTS.md](AGENTS.md) — 개발 공통 지침
- [checklist.md](checklist.md) — 작업 체크리스트
- [context-notes.md](context-notes.md) — 결정 배경과 함정 기록

## 환경변수

`.env.example` 참고. 실제 키는 커밋하지 않고 GitHub Secrets 로 관리합니다.
