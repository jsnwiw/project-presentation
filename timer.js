/**
 * 실시간 인프라 동기화 카운트다운 타이머 및 스트림 메시지 순환 로직
 */

let totalSeconds = 600; // 10분 주기
let streamIndex = 0;

/**
 * 자동 동기화 타이머 및 스트림 순환 시작
 */
function startAutoSyncTimer() {
  const syncTimerEl = document.getElementById('syncTimerText');
  const streamStatusEl = document.getElementById('realtimeStreamStatus');

  // 1초 단위 카운트다운
  setInterval(() => {
    totalSeconds--;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (syncTimerEl) {
      syncTimerEl.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    if (totalSeconds <= 0) {
      totalSeconds = 600;
    }
  }, 1000);

  // 15초 단위 실시간 스트림 문구 순환
  if (typeof realTimeStreams !== 'undefined' && realTimeStreams.length > 0) {
    setInterval(() => {
      streamIndex = (streamIndex + 1) % realTimeStreams.length;
      if (streamStatusEl) {
        streamStatusEl.innerText = realTimeStreams[streamIndex];
      }
    }, 15000);
  }
}

