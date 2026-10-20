/**
 * 애플리케이션 진입점 및 초기화 스크립트
 */

document.addEventListener('DOMContentLoaded', () => {
  // 실시간 타이머 및 스트림 상태 시작
  startAutoSyncTimer();

  // 초기 상태: 전국 18대 인프라 소외지역 전체 보기 활성화
  selectAllCategories();

  // 검색 인풋에서 Enter 키 입력 시 검색 실행
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        executeSearchButton();
      }
    });
  }
});

