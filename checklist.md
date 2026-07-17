# 3단계 Lottie 히어로 애니메이션 체크리스트

범위: 상세 시트 헤더(openDetail) "히어로" 위치에만 Lottie 적용. 카드 리스트는 2단계 SVG 씬 유지.

- [ ] lottie-web 경량 SVG 빌드(lottie_light) 자체 호스팅 (`public/lottie-light.min.js`)
- [ ] build-toss.js 복사 목록에 lottie JS + JSON 폴더 추가
- [ ] 카테고리별 Lottie JSON 자체 생성 (우선 할인=동전, 이후 확장)
- [ ] openDetail 헤더에 Lottie 마운트, 매칭 없으면 기존 그라데이션 폴백
- [ ] 상세 시트 닫을 때 lottie 인스턴스 destroy (메모리 누수 방지)
- [ ] 프리뷰에서 상세 시트 열어 재생 확인 + 콘솔 에러 0 + 스크린샷
- [ ] 커밋
