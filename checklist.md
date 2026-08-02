# 작업 체크리스트 — 4개 항목 (KFC 문서정정 / 광고 튜닝 / 재방문 동기 / 파일 분리)

이전 Lottie 체크리스트는 폐기됨(context-notes.md 참고). 새 범위로 교체.

## 1. KFC 매장 위치 "미지원" 표기 정정
실제로는 카카오 로컬 API로 186건 수집 중. 코드가 아니라 주석·문서만 낡음.

- [x] `scripts/storeLocations.js` 헤더 주석에서 KFC 미지원 서술 수정
- [x] `.github/workflows/crawl.yml` 스텝 이름에서 "KFC는 아직 미지원" 제거
- [x] `public/index.html` EVENT_BRANDS 주석 수정 (버거킹/노브랜드버거 크롤러는 실재함)

## 2. 광고 트리거 튜닝 (수익화 ↔ 경험 균형)
- [x] 앱 시작 후 유예 45초
- [x] 전역 쿨다운 90초
- [x] 세션당 노출 상한 5회
- [x] navigation 빈도 매번 → 2회당 1회
- [x] 일반 브라우저에서 조용히 no-op 유지 확인 (콘솔 에러 0)

## 3. 재방문 동기 — "지난 방문 이후 새 행사"
- [x] 마지막 방문 시점의 행사 키 집합을 localStorage에 저장
- [x] 저장본과 비교해 개인화 신규 산출
- [x] 배너 추가 + 탭하면 해당 행사만 필터
- [x] 첫 방문자는 배너 미노출
- [x] 저장 실패·로드 실패에도 앱이 깨지지 않도록 방어

## 4. index.html 분리 (1547줄 → 299줄)
- [x] `<style>` → `public/app.css` (144줄)
- [x] 인라인 `<script>` → `public/app.js` (1168줄)
- [x] `scripts/build-toss.js` 복사 목록 갱신
- [x] `public/sw.js` PRECACHE 갱신 + 캐시 버전 v1→v2
- [x] onclick 인라인 핸들러 유지 위해 `type="module"` 미사용

## 검증
- [x] 행사 목록 74건 렌더 / 상세 시트 / 검색 39건 / 찜 토글
- [x] 지도 타일·마커 (매장 5,243건, 반경 내 마커 7개) — rAF 우회 직접 호출로 확인
- [x] 콘솔 에러 0
- [x] `node scripts/build-toss.js` 성공, dist에 app.css·app.js 포함 확인
- [x] 항목별 커밋 분리
- [ ] 실기기(토스 인앱)에서 광고 가드 실제 동작 확인 — 프리뷰에서는 SDK가 no-op이라 미검증
