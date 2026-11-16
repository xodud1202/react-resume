# 뉴스 요약 모바일 읽기 개선 검증

- 대상: /news/summary. API·DB·데이터 및 기존 읽음 저장 로직 변경 없음.
- node harness/news-summary.test.cjs: 5개 통과. npm run lint 및 npm run build 통과.
- Playwright + 설치된 Chrome headless, localhost:3014, 모든 /api 요청은 모의 JSON 응답으로 차단·대체. 운영 DB 또는 Spring 실행 없음.
- 375/390/768/1440px 폭에서 가로 넘침 없음, 스크롤 축소·상단 복원·날짜 변경·하단 전체 읽음 확인.
- 모바일 헤더 높이 226.55px → 139.5px, 축소 버튼 48px. 본문17px/행간28.05px, break-all/justify/text-align-last:start 계산 스타일 확인.
- 모바일 확대/축소 스크린샷 직접 시각 검토. 실제 휴대폰이나 실데이터 서버 검증은 아니며 UI 모의 응답 검증입니다.

## 후속 요청: 최초부터 작은 헤더 고정

- 스크롤 크기 전환 state/listener/utility를 제거하고 최초 렌더부터 기존 작은 헤더를 고정 적용. 읽음 처리용 스크롤은 유지.
- 회귀5개, lint, build 재통과. 모의 API 브라우저375/390/768/1440px에서 초기·스크롤 후 모두139.5px, 날짜버튼48px 확인.
- 날짜전환·상단복귀·하단전체읽음·가로넘침 없음 재검증 및 모바일 초기 화면 직접 시각 검토.
