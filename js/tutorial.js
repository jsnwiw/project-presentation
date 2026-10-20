/**
 * 📖 튜토리얼 시스템 – 인앱 사용 가이드 워크스루
 * 글래스모피즘 디자인 통일, 스텝 기반 슬라이드
 */

const TUTORIAL_STEPS = [
  {
    icon: '👋',
    title: '대한민국 인프라 소외지역 분석 지도에 오신 것을 환영합니다!',
    desc: '이 앱은 전국 18대 인프라 소외지역을 <b>실시간으로 분석</b>하고 지도에 시각화합니다.<br>주요 기능들을 빠르게 안내해 드릴게요.',
    highlight: null
  },
  {
    icon: '🗺️',
    title: '지도 기본 조작',
    desc: '• <b>드래그</b>하여 지도를 이동할 수 있습니다.<br>• <b>스크롤(핀치)</b>로 확대/축소할 수 있습니다.<br>• 좌측 상단 <b>+/- 버튼</b>으로도 줌 조절이 가능합니다.<br>• 지역 <b>핀(마커)</b>을 클릭하면 상세 정보를 볼 수 있습니다.',
    highlight: '#map'
  },
  {
    icon: '🔍',
    title: '검색 기능',
    desc: '상단 검색창에 <b>행정구역명</b>을 입력하면 해당 지역으로 이동합니다.<br>예: <span style="color:#007aff;font-weight:700;">서울, 이천, 수원, 부산, 제주</span><br><br>입력하면 <b>자동완성 목록</b>이 표시되어 빠르게 선택할 수 있습니다.',
    highlight: '.search-dock'
  },
  {
    icon: '📋',
    title: '좌측 소외지역 패널',
    desc: '좌측 패널에는 선택한 카테고리의 <b>소외지역 항목</b>들이 표시됩니다.<br><br>• 카테고리를 클릭하면 해당 인프라 소외지역만 필터링됩니다.<br>• 항목 카드를 클릭하면 지도에서 해당 지역이 하이라이트됩니다.',
    highlight: '#categoryItemSidebar'
  },
  {
    icon: '◀️',
    title: '패널 접기 / 펼치기',
    desc: '패널 오른쪽 끝에 붙은 <b>화살표(◀/▶) 버튼</b>을 클릭하면<br>패널을 접거나 펼 수 있습니다.<br><br>패널을 접으면 지도가 더 넓어져 한눈에 볼 수 있습니다.',
    highlight: '#panelToggleBtn'
  },
  {
    icon: '🎛️',
    title: '지도 상단 레이어 토글',
    desc: '지도 위쪽에 있는 <b>레이어 버튼</b>들을 켜고 끌 수 있습니다.<br><br>• 🚨 <b>응급사각</b> – 30km 이내 응급실 없는 지역<br>• 📉 <b>소멸위험</b> – 인구 소멸 위험 지역<br>• 👶 <b>분만공백</b>, 🚆 <b>교통단절</b>, ⚡ <b>에너지소외</b>, 🏦 <b>금융소외</b><br>• 🌋 <b>지진 경보</b> – 실시간 지진 진앙 위치',
    highlight: '.map-quick-toggles'
  },
  {
    icon: '📊',
    title: '13대 인프라 버튼 & 이모지 마커',
    desc: '패널 안에 있는 <b>13대 인프라 분석 버튼</b>을 클릭하면:<br><br>• 해당 인프라 카테고리의 소외지역이 지도에 표시됩니다.<br>• 선택한 지역의 핀에 <b>카테고리 이모지 마커</b>가 자동으로 추가됩니다.<br>• 버튼을 다시 누르면 해제됩니다.',
    highlight: null
  },
  {
    icon: '🚨',
    title: '재해 알림 모달',
    desc: '상단의 <b style="color:#ff3b30;">🚨 재해</b> 버튼을 클릭하면<br>실시간 지진 감지 상황판이 열립니다.<br><br>최근 지진 항목을 클릭하면 지도에서 진앙 위치를 바로 확인할 수 있고, 새 지진이 감지되면 자동으로 알림이 표시됩니다.',
    highlight: null
  },
  {
    icon: '📱',
    title: '모바일 사용',
    desc: '모바일에서는 상단에 <b>🗺️ 지도 화면 / 📋 패널</b> 탭이 표시됩니다.<br><br>탭을 전환하여 지도와 패널을 번갈아 볼 수 있습니다.<br>가로/세로 모드 모두 최적화되어 있습니다.',
    highlight: null
  },
  {
    icon: '📍',
    title: '핀 자동 묶기 (클러스터)',
    desc: '지도에 핀이 많아도 <b>겹치지 않습니다!</b><br><br>• 가까운 핀들은 <b style="color:#007aff;">숫자 배지</b>로 자동 묶입니다.<br>• 🔵 <b>파란색</b> = 1~4개 &nbsp; 🟠 <b>주황색</b> = 5~9개 &nbsp; 🔴 <b>빨간색</b> = 10개+<br>• <b>클러스터를 클릭</b>하면 줌인하여 개별 핀이 펼쳐집니다.<br>• <b>줌인</b>할수록 핀들이 하나씩 나뉘어 표시됩니다.',
    highlight: '#map'
  },
  {
    icon: '🎉',
    title: '이제 시작해보세요!',
    desc: '모든 준비가 끝났습니다!<br><br>궁금한 지역을 <b>검색</b>하거나, <b>레이어 토글</b>을 활용하여<br>대한민국 인프라 소외지역을 분석해 보세요.<br><br><span style="color:#86868b;font-size:12px;">언제든 상단의 <b>ℹ️ 사용방법</b> 버튼으로 다시 볼 수 있습니다.</span>',
    highlight: null
  }
];

let tutorialCurrentStep = 0;
let tutAutoTimer = null;
let isTutAutoPlaying = false;
const TUT_AUTO_INTERVAL = 3500; // 자동 넘김 간격 (3.5초)

/* ── 열기 / 닫기 ─────────────────────────────── */
function openTutorial() {
  tutorialCurrentStep = 0;
  const overlay = document.getElementById('tutorialModalOverlay');
  if (!overlay) return;
  overlay.classList.add('active');
  renderTutorialStep();
}

function closeTutorial() {
  stopTutorialAutoPlay();
  const overlay = document.getElementById('tutorialModalOverlay');
  if (overlay) overlay.classList.remove('active');
  clearTutorialHighlight();
  // 튜토리얼 완료/닫기 시 localStorage에 기록 → 다음 방문 시 자동 표시 안 함
  try { localStorage.setItem('tutorialSeen', '1'); } catch(e) {}
}

/* ── 자동 넘김 토글 & 제어 ───────────────────────── */
function toggleTutorialAutoPlay() {
  if (isTutAutoPlaying) {
    stopTutorialAutoPlay();
  } else {
    startTutorialAutoPlay();
  }
}

function startTutorialAutoPlay() {
  isTutAutoPlaying = true;
  updateTutAutoPlayButtonUI();
  scheduleNextTutorialStep();
}

function stopTutorialAutoPlay() {
  isTutAutoPlaying = false;
  if (tutAutoTimer) {
    clearTimeout(tutAutoTimer);
    tutAutoTimer = null;
  }
  updateTutAutoPlayButtonUI();
}

function updateTutAutoPlayButtonUI() {
  const btn = document.getElementById('tutAutoPlayBtn');
  if (!btn) return;
  if (isTutAutoPlaying) {
    btn.innerHTML = '⏸ 자동 멈춤';
    btn.style.background = '#ff9500';
    btn.style.color = '#ffffff';
  } else {
    btn.innerHTML = '▶ 자동 넘김';
    btn.style.background = 'rgba(0, 122, 255, 0.12)';
    btn.style.color = '#007aff';
  }
}

function scheduleNextTutorialStep() {
  if (tutAutoTimer) clearTimeout(tutAutoTimer);
  if (!isTutAutoPlaying) return;

  tutAutoTimer = setTimeout(() => {
    if (!isTutAutoPlaying) return;
    if (tutorialCurrentStep < TUTORIAL_STEPS.length - 1) {
      tutorialCurrentStep++;
      renderTutorialStep();
      scheduleNextTutorialStep();
    } else {
      stopTutorialAutoPlay();
      closeTutorial();
    }
  }, TUT_AUTO_INTERVAL);
}

/* 첫 방문 시 팝업 알림창으로 안내 (localStorage에 기록이 없으면 표시) */
function autoShowTutorial() {
  try {
    if (localStorage.getItem('tutorialSeen')) return;
  } catch(e) { return; }

  // 팝업 알림 엘리먼트 생성
  const popup = document.createElement('div');
  popup.className = 'tutorial-popup';
  popup.innerHTML = `
    <div class="tutorial-popup-icon">📖</div>
    <div class="tutorial-popup-text">
      <strong>처음 오셨나요?</strong>
      <span>사용방법을 확인해보세요!</span>
    </div>
    <button class="tutorial-popup-btn" id="tutPopupOpenBtn">보기</button>
    <button class="tutorial-popup-close" id="tutPopupCloseBtn">&times;</button>
  `;
  document.body.appendChild(popup);

  // 살짝 딜레이 후 슬라이드-인 애니메이션
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      popup.classList.add('show');
    });
  });

  // "보기" 클릭 → 튜토리얼 열기
  document.getElementById('tutPopupOpenBtn').addEventListener('click', () => {
    popup.classList.remove('show');
    setTimeout(() => { popup.remove(); }, 350);
    openTutorial();
  });

  // "✕" 클릭 → 팝업만 닫기 + 기록 저장
  document.getElementById('tutPopupCloseBtn').addEventListener('click', () => {
    popup.classList.remove('show');
    setTimeout(() => { popup.remove(); }, 350);
    try { localStorage.setItem('tutorialSeen', '1'); } catch(e) {}
  });

  // 10초 후 자동 사라짐
  setTimeout(() => {
    if (document.body.contains(popup)) {
      popup.classList.remove('show');
      setTimeout(() => { popup.remove(); }, 350);
    }
  }, 10000);
}

// 페이지 로드 완료 후 1.5초 뒤 팝업 표시
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(autoShowTutorial, 1500);
});

function closeTutorialOnBackdrop(e) {
  if (e.target === e.currentTarget) closeTutorial();
}

/* ── 스텝 렌더 ───────────────────────────────── */
function renderTutorialStep() {
  const step = TUTORIAL_STEPS[tutorialCurrentStep];
  const total = TUTORIAL_STEPS.length;

  document.getElementById('tutStepIcon').textContent = step.icon;
  document.getElementById('tutStepTitle').textContent = step.title;
  document.getElementById('tutStepDesc').innerHTML = step.desc;

  // 프로그레스
  document.getElementById('tutProgress').textContent =
    `${tutorialCurrentStep + 1} / ${total}`;

  // 프로그레스 바
  const pct = ((tutorialCurrentStep + 1) / total) * 100;
  document.getElementById('tutProgressBar').style.width = pct + '%';

  // 버튼 상태
  document.getElementById('tutPrevBtn').style.visibility =
    tutorialCurrentStep === 0 ? 'hidden' : 'visible';

  const nextBtn = document.getElementById('tutNextBtn');
  if (tutorialCurrentStep === total - 1) {
    nextBtn.textContent = '✅ 완료';
  } else {
    nextBtn.textContent = '다음 ▶';
  }

  // 하이라이트
  applyTutorialHighlight(step.highlight);

  // 카드 애니메이션
  const card = document.getElementById('tutCard');
  card.style.animation = 'none';
  // force reflow
  void card.offsetHeight;
  card.style.animation = 'tutSlideIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
}

/* ── 다음 / 이전 ─────────────────────────────── */
function tutorialNext() {
  if (tutorialCurrentStep < TUTORIAL_STEPS.length - 1) {
    tutorialCurrentStep++;
    renderTutorialStep();
    if (isTutAutoPlaying) scheduleNextTutorialStep();
  } else {
    closeTutorial();
  }
}

function tutorialPrev() {
  if (tutorialCurrentStep > 0) {
    tutorialCurrentStep--;
    renderTutorialStep();
    if (isTutAutoPlaying) scheduleNextTutorialStep();
  }
}

/* ── 하이라이트 ──────────────────────────────── */
function applyTutorialHighlight(selector) {
  clearTutorialHighlight();
  if (!selector) return;
  const el = document.querySelector(selector);
  if (!el) return;
  el.classList.add('tutorial-highlight');
}

function clearTutorialHighlight() {
  document.querySelectorAll('.tutorial-highlight').forEach(el => {
    el.classList.remove('tutorial-highlight');
  });
}
