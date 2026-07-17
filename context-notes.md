# 3단계 히어로 애니메이션 컨텍스트 노트

## 결정 배경
- 사용자 요청: 3단계 Lottie 마이크로 애니메이션. NVIDIA 무료 AI는 Lottie 미생성 → 폐기.
- 사용자 선택: "히어로만 + 직접 생성" → 이후 "꼭 코인이어야 하나, 다른 대안?"

## Lottie 시도와 폐기 (중요)
- lottie-web(경량/전체 빌드 모두) 자체 호스팅 + 지연 로드 + 상세 헤더 마운트까지 구현했으나,
  **개발 프리뷰 브라우저가 requestAnimationFrame을 심하게 스로틀**하여 애니메이션이 진행되지 않음(currentFrame 정지).
- 그 결과 애니메이션 위치/스케일/투명도 Lottie가 레이어 transform을 `-999999`(초기값)로 두고 화면 밖으로 렌더 → **이 환경에서 어떤 Lottie 모션도 시각 검증 불가**.
- 정적 Lottie 도형은 정상 렌더됨. 즉 코드/JSON 버그가 아니라 프리뷰 환경 한계.
- **결론: 검증 불가한 Lottie 대신, 이 프리뷰에서 정상 렌더·검증되는 CSS/SVG로 히어로를 강화하기로 전환.** Lottie 관련 파일(lottie-light.min.js, public/lottie/) 및 코드 전량 제거.

## 최종 구현 (검증됨)
- 상세 시트 헤더(openDetail)에 카드 리스트의 카테고리별 SVG 씬(dealSceneHtml)을 재사용해 크게 표시.
  - 할인=금화 낙하, 배달=스쿠터, 1+1/경품=색종이, 신메뉴=별, 그 외=플로팅 브랜드 이모지.
- band-flow(흐르는 그라데이션) + band-shimmer(광택) 추가.
- 헤더는 .deal-card가 아니므로 뷰포트 일시정지 CSS(stage2)의 영향 없이 항상 재생.
- 프리뷰에서 금화 낙하 헤더 시각 확인 완료, 콘솔 에러 0.

## 참고
- 무료 Lottie: LottieFiles (Lottie Simple License, 상업용 허용, 출처표시 불요). AI 생성 오픈소스: diffusionstudio/lottie(MIT).
- 실제 기기에서 Lottie가 필요해지면, 프리뷰가 아닌 실기기에서 검증하는 조건으로 재도입 가능.
