/**
 * js/demo.js
 * 대한민국 인프라 소외지역 실시간 분석 지도 - 자동 시연(Auto Demo) 모듈
 * + TTS 음성 해설(Web Speech API) / 하단 자막 지원
 *   - 각 단계의 '화면 동작'과 '음성 해설'이 모두 끝나야 다음 단계로 넘어갑니다.
 *   - 음성 켜기/끄기, 속도 조절 가능 (음성 미지원 브라우저는 자막만 표시)
 * 
 * 시연 시나리오:
 *  1. 전국 베이스맵 & 인프라 격차 진단 패널
 *  2. 사용방법 안내 팝업 (11장 전체 낭독 후 자동 닫힘)
 *  3. 실시간 행정구역 검색 (강원 속초시 26km 버퍼 원 & 팝업)
 *  4. 초고위험 소외지역 심층 분석 (경북 의성군)
 *  5. 전문 인프라 레이어 다중 투사 (분만공백, 교통단절, 에너지소외)
 *  6. 13대 인프라 카테고리 필터링
 *  7. 지도 핀 숨기기 / 표시하기 토글
 *  8. 마커 클러스터링
 *  9. 좌측 패널 접기 / 펼치기
 * 10. 실시간 동기화 상태 바 & 타이머
 * 11. 시연 완료 및 초기화 (원위치 복원)
 *
 * 단계(step) 구조:
 *   title      : 위젯에 표시되는 단계명
 *   narration  : 낭독할 문장 (한 덩어리일 때)
 *   segments   : 문장 묶음 배열 [{ text, before, delay, caption }]
 *                - 각 문장이 시작될 때 before() 가 실행되어 '말하는 내용'과 '화면 동작'이 맞물립니다.
 *   action     : 단계 시작 시 실행할 화면 동작 (끝나면 next() 호출)
 *   after      : 단계가 끝날 때(다음 단계로 넘어가기 직전) 실행 — 팝업 닫기 등
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════
  // 지도/UI 제어 헬퍼 — 상태를 '설정'하는 방식이라 여러 번 호출해도 안전합니다
  // ═══════════════════════════════════════════
  function getMap() { return (typeof map !== 'undefined') ? map : null; }

  function flyToView(latlng, zoom, duration) {
    const m = getMap();
    if (m) m.flyTo(latlng, zoom, { duration: duration || 1.2 });
  }

  function closeMapPopup() {
    const m = getMap();
    if (m) m.closePopup();
  }

  function setOverlay(key, on) {
    const m = getMap();
    if (!m || typeof overlayLayerMap === 'undefined' || typeof toggleOverlayLayer !== 'function') return;
    const layer = overlayLayerMap[key];
    if (layer && m.hasLayer(layer) !== on) toggleOverlayLayer(key);
  }

  function setInfra(key, on) {
    if (typeof activeInfraFilterKeys === 'undefined' || typeof toggleInfraOnMap !== 'function') return;
    if (activeInfraFilterKeys.has(key) !== on) toggleInfraOnMap(key);
  }

  function setPins(visible) {
    if (typeof areCategoryPinsVisible === 'undefined' || typeof toggleCategoryPins !== 'function') return;
    if (areCategoryPinsVisible !== visible) toggleCategoryPins();
  }

  function setPanelCollapsed(collapsed) {
    const panel = document.getElementById('categoryItemSidebar');
    if (!panel || typeof toggleSidebarPanel !== 'function') return;
    if (panel.classList.contains('collapsed') !== collapsed) toggleSidebarPanel();
  }

  function closeAllPopups() {
    if (typeof closeSearchAlert === 'function') closeSearchAlert();
    if (typeof closeTutorial === 'function') closeTutorial();
  }

  // 설명 중인 UI 요소 강조 (주황 테두리)
  let hlEl = null;
  function clearHl() {
    if (hlEl) {
      hlEl.style.outline = '';
      hlEl.style.outlineOffset = '';
      hlEl.style.boxShadow = '';
      hlEl = null;
    }
  }
  function hl(selector) {
    clearHl();
    const el = selector ? document.querySelector(selector) : null;
    if (!el) return;
    hlEl = el;
    el.style.outline = '3px solid #ff9500';
    el.style.outlineOffset = '2px';
    el.style.boxShadow = '0 0 0 6px rgba(255, 149, 0, 0.25)';
    if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function stripHtml(html) {
    return String(html || '')
      .replace(/<br\s*\/?>/gi, '. ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/[•◀▶]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function inspectUiseong() {
    if (typeof allRegionsComprehensiveData !== 'undefined') {
      const idx = allRegionsComprehensiveData.findIndex(r => r.name.includes('의성'));
      if (idx !== -1 && typeof selectAndInspectRegion === 'function') {
        selectAndInspectRegion(idx, true);
        return;
      }
    }
    const input = document.getElementById('searchInput');
    if (input) input.value = '경북 의성군';
    if (typeof executeSearchButton === 'function') executeSearchButton();
  }
  // ═══════════════════════════════════════════
  // 시연 시나리오 단계 정의
  // ═══════════════════════════════════════════
  const demoSteps = [
    {
      title: "1. 전국 베이스맵 & 진단 패널",
      narration: "지금부터 대한민국 인프라 소외지역 분석 지도의 자동 시연을 시작하겠습니다. 이 지도는 위성 지도 위에 전국 열여덟 개 인프라 분야의 소외지역을 한눈에 보여 줍니다. 좌측 하단의 인프라 격차 진단 패널에는 대표 지표가 표시됩니다. 응급실 도달시간은 54분으로 수도권의 8분과 크게 차이 나고, 버스 평균 배차는 110분, 도시가스 보급률은 14.2퍼센트입니다. 먼저 사용방법 안내부터 살펴보겠습니다.",
      action: (next) => {
        closeAllPopups();
        closeMapPopup();
        flyToView([36.2, 127.8], 7.1, 1.2);
        setTimeout(next, 1500);
      }
    },
    {
      title: "2. 사용방법 안내 팝업",
      segments: buildTutorialSegments,
      narration: "사용방법 안내 팝업입니다.",
      action: (next) => {
        if (typeof openTutorial === 'function') openTutorial();
        setTimeout(next, 600);
      },
      after: () => { if (typeof closeTutorial === 'function') closeTutorial(); }
    },
    {
      title: "3. 행정구역 검색 & 26km 버퍼 (속초시)",
      segments: [
        {
          text: "첫 번째 기능은 행정구역 검색입니다. 검색창에 속초시를 입력하면 자동완성 목록이 나타납니다.",
          before: () => {
            const input = document.getElementById('searchInput');
            if (input) {
              input.value = "속초시";
              input.focus();
              if (typeof handleSearchInput === 'function') handleSearchInput({ target: input });
            }
          }
        },
        {
          text: "검색을 실행하면 지도가 해당 지역으로 이동하고, 반경 26킬로미터 집중 분석 구역이 파란 원으로 표시됩니다. 핀을 누르면 인프라 분석 정보가 팝업으로 나옵니다.",
          before: () => { if (typeof executeSearchButton === 'function') executeSearchButton(); }
        }
      ],
      action: (next) => next()
    },
    {
      title: "4. 초고위험 소외지역 분석 (경북 의성군)",
      segments: [
        {
          text: "다음은 경상북도 의성군입니다. 의성군은 지방소멸위험도가 0.12로 전국 1위인, 최고 위험군 지역입니다.",
          before: inspectUiseong
        },
        {
          text: "지역을 선택하면 좌측 패널에 실시간 진단 카드가 열리고, 지도에는 진단 구역 원과 상세 팝업이 표시됩니다."
        },
        {
          text: "진단 항목을 보면 야간 운영 약국은 0곳이고, 초중고 폐교는 누적 35개교에 이르며, 시중은행 지점은 폐쇄되고 있습니다. 한편 이웃사촌 시범마을 사업으로 청년 유입을 시도하고 있습니다."
        }
      ],
      action: (next) => next()
    },
    {
      title: "5. 전문 인프라 분석 레이어 투사",
      segments: [
        {
          text: "이번에는 전문 분석 레이어를 겹쳐 보겠습니다. 먼저 분만공백 레이어를 켭니다. 분만이 가능한 병원이 없는 지역을 보여 줍니다.",
          before: () => setOverlay('maternal', true)
        },
        {
          text: "이어서 교통단절 레이어를 켭니다. 대중교통으로 접근하기 어려운 지역이 겹쳐 표시됩니다.",
          before: () => setOverlay('transit', true)
        },
        {
          text: "에너지소외 레이어도 켭니다. 도시가스처럼 난방 에너지 보급이 부족한 지역입니다.",
          before: () => setOverlay('energy', true)
        },
        {
          text: "이렇게 여러 레이어를 겹쳐 보면, 의료와 교통, 에너지 문제가 한 지역에 함께 나타나는 복합 소외 지역을 찾을 수 있습니다. 응급사각, 소멸위험, 금융소외 버튼으로도 레이어를 더할 수 있습니다."
        }
      ],
      action: (next) => {
        closeMapPopup();
        flyToView([36.0, 128.2], 8.2, 1.0);
        setTimeout(next, 1000);
      }
    },
    {
      title: "6. 13대 인프라 카테고리 필터링",
      segments: [
        {
          text: "열세 개 인프라 카테고리 필터입니다. 먼저 응급의료를 켜 보겠습니다. 해당 분야의 소외지역이 이모지 마커로 지도에 표시됩니다.",
          before: () => setInfra('🚨 응급의료', true)
        },
        {
          text: "이번에는 응급의료를 끄고 교통과 철도를 선택합니다. 이렇게 분야를 바꿔 가며 비교할 수 있습니다.",
          before: () => { setInfra('🚨 응급의료', false); setInfra('🚆 교통/철도', true); }
        },
        {
          text: "버튼을 다시 눌러 필터를 모두 해제하면, 숨겨졌던 핀이 원래대로 다시 표시됩니다.",
          before: () => setInfra('🚆 교통/철도', false)
        }
      ],
      action: (next) => next()
    },
    {
      title: "7. 지도 핀 숨김 / 표시 토글",
      segments: [
        {
          text: "이번에는 핀 숨김 기능입니다. 핀이 많아 지도가 복잡할 때, 핀 숨기기 버튼으로 깔끔하게 정리할 수 있습니다.",
          before: () => setPins(false)
        },
        {
          text: "다시 핀 표시하기를 누르면 핀이 원래대로 복원됩니다.",
          before: () => setPins(true)
        }
      ],
      action: (next) => next()
    },
    {
      title: "8. 마커 클러스터링 (핀 겹침 방지)",
      narration: "마커 클러스터링입니다. 지도를 멀리서 보면 가까운 핀들이 숫자 배지로 묶여 겹치지 않습니다. 파란색은 1개에서 4개, 주황색은 5개에서 9개, 빨간색은 10개 이상이고, 클러스터를 클릭하거나 확대하면 개별 핀으로 펼쳐집니다.",
      action: (next) => {
        closeMapPopup();
        flyToView([36.3, 127.8], 7.0, 1.2);
        setTimeout(next, 1500);
      }
    },
    {
      title: "9. 좌측 패널 접기 / 펼치기",
      segments: [
        {
          text: "좌측 패널은 화살표 버튼으로 접을 수 있습니다. 패널을 접으면 지도가 더 넓게 보입니다.",
          before: () => setPanelCollapsed(true)
        },
        {
          text: "다시 누르면 패널이 펼쳐져서, 진단 카드와 소외지역 항목 목록을 볼 수 있습니다.",
          before: () => setPanelCollapsed(false)
        }
      ],
      action: (next) => next()
    },
    {
      title: "10. 실시간 동기화 상태 바 & 타이머",
      segments: [
        {
          text: "상단 상태 바입니다. 라이브 배지는 인프라 데이터가 실시간으로 반영되고 있다는 표시이고, 오른쪽 타이머는 다음 동기화까지 남은 시간으로, 10분 주기로 갱신됩니다.",
          before: () => hl('.sync-status-bar')
        }
      ],
      action: (next) => next(),
      after: clearHl
    },
    {
      title: "11. 시연 완료 및 초기화",
      narration: "이상으로 자동 시연을 마칩니다. 화면은 처음 상태로 복원됩니다. 언제든 상단의 자동 시연 버튼으로 다시 보실 수 있습니다. 감사합니다.",
      action: (next) => {
        cleanupDemoState();
        setTimeout(next, 1500);
      }
    }
  ];

  // 시연 상태 정리 및 원위치 복원 함수
  function cleanupDemoState() {
    clearHl();

    // 1. 열린 팝업 모두 닫기
    closeAllPopups();
    closeMapPopup();

    // 2. 인프라 버튼 필터 해제
    if (typeof activeInfraFilterKeys !== 'undefined' && activeInfraFilterKeys.size > 0) {
      Array.from(activeInfraFilterKeys).forEach(k => setInfra(k, false));
    }

    // 3. 지도 핀 표시 복원
    setPins(true);

    // 4. 시연 중 켠 오버레이 레이어 끄기
    ['maternal', 'transit', 'energy', 'banking'].forEach(k => setOverlay(k, false));

    // 5. 좌측 패널 펼침 상태로 복원
    setPanelCollapsed(false);

    // 6. 검색 마커 및 버퍼 원 제거
    if (typeof liveRegionBufferGroup !== 'undefined') liveRegionBufferGroup.clearLayers();
    const m = getMap();
    if (typeof currentMarker !== 'undefined' && currentMarker && m) {
      m.removeLayer(currentMarker);
      currentMarker = null;
    }

    // 7. 검색창 초기화
    const input = document.getElementById('searchInput');
    if (input) input.value = '';

    // 8. 카메라 원위치
    flyToView([36.1, 127.8], 7.2, 1.5);
  }

  // ═══════════════════════════════════════════
  // 🔊 TTS 음성 해설 (Web Speech API)
  // ═══════════════════════════════════════════
  const tts = {
    supported: ('speechSynthesis' in window) && ('SpeechSynthesisUtterance' in window),
    enabled: true,
    rate: 1.0,
    voice: null
  };
  const RATE_STEPS = [0.9, 1.0, 1.15, 1.3];

  let speakId = 0;
  let speakTimer = null;
  let watchdogTimer = null;
  let keepAliveUtter = null;

  function pickKoreanVoice() {
    if (!tts.supported) return;
    const voices = window.speechSynthesis.getVoices() || [];
    const ko = voices.filter(v => /^ko([-_]|$)/i.test(v.lang));
    if (!ko.length) { tts.voice = null; return; }
    const score = (v) => {
      let sc = 0;
      if (/natural|online/i.test(v.name)) sc += 4;
      if (/google/i.test(v.name)) sc += 3;
      if (/sunhi|yuna|heami|seoyeon|유나|선희/i.test(v.name)) sc += 2;
      if (/^ko[-_]KR$/i.test(v.lang)) sc += 1;
      return sc;
    };
    ko.sort((a, b) => score(b) - score(a));
    tts.voice = ko[0];
  }

  if (tts.supported) {
    pickKoreanVoice();
    if (window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', pickKoreanVoice);
    } else {
      window.speechSynthesis.onvoiceschanged = pickKoreanVoice;
    }
    window.addEventListener('beforeunload', () => {
      try { window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
    });
  }

  function estimateMs(text) {
    return Math.max(1200, Math.round(text.length * 120 / tts.rate));
  }

  function cancelSpeech() {
    speakId++;
    clearTimeout(speakTimer);
    clearTimeout(watchdogTimer);
    keepAliveUtter = null;
    if (tts.supported) {
      try { window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
    }
  }

  function speakNarration(text, onDone, delayMs) {
    cancelSpeech();
    const id = speakId;
    const finish = () => { if (id === speakId) onDone(); };
    const lead = delayMs || 0;

    if (!text) { finish(); return; }

    if (!tts.supported || !tts.enabled) {
      speakTimer = setTimeout(finish, estimateMs(text) + lead);
      return;
    }

    pickKoreanVoice();
    const chunks = (text.match(/[^.!?]+[.!?]*/g) || [text]).map(t => t.trim()).filter(Boolean);
    let i = 0;

    const speakNext = () => {
      if (id !== speakId) return;
      if (i >= chunks.length) {
        speakTimer = setTimeout(finish, 400);
        return;
      }
      const chunk = chunks[i++];
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = 'ko-KR';
      if (tts.voice) u.voice = tts.voice;
      u.rate = tts.rate;

      let handled = false;
      const advance = () => {
        if (handled || id !== speakId) return;
        handled = true;
        clearTimeout(watchdogTimer);
        speakNext();
      };
      u.onend = advance;
      u.onerror = (e) => {
        if (e && (e.error === 'canceled' || e.error === 'interrupted')) return;
        clearTimeout(watchdogTimer);
        speakTimer = setTimeout(advance, estimateMs(chunk));
      };

      keepAliveUtter = u;
      clearTimeout(watchdogTimer);
      watchdogTimer = setTimeout(() => {
        if (handled || id !== speakId) return;
        try { window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
        advance();
      }, estimateMs(chunk) * 3 + 4000);

      window.speechSynthesis.speak(u);
    };

    speakTimer = setTimeout(speakNext, 120 + lead);
  }

  function showCaption(text) {
    const el = document.getElementById('demoCaption');
    if (!el) return;
    el.textContent = text || '';
    el.style.opacity = text ? '1' : '0';
  }
  function hideCaption() { showCaption(''); }

  // ═══════════════════════════════════════════
  // 시연 진행 상태
  // ═══════════════════════════════════════════
  let currentStepIndex = 0;
  let isRunning = false;
  let isPaused = false;
  let isMinimized = false;

  let runToken = 0;
  let actionDone = false;
  let speechDone = false;
  let pendingResume = false;
  let resumeSeg = 0;
  let currentSegIndex = 0;
  let activeStep = null;
  let gapSeq = 0;

  function getSegments(step) {
    const seg = (typeof step.segments === 'function') ? step.segments() : step.segments;
    if (Array.isArray(seg) && seg.length) return seg;
    return [{ text: step.narration }];
  }

  function startNarration(step, token, fromSeg) {
    speechDone = false;
    const segs = getSegments(step);
    let i = Math.min(fromSeg || 0, segs.length);

    const playNext = () => {
      if (token !== runToken) return;
      if (i >= segs.length) {
        currentSegIndex = 0;
        speechDone = true;
        tryAdvance(token);
        return;
      }
      currentSegIndex = i;
      const seg = segs[i++];
      try { if (seg.before) seg.before(); } catch (e) { console.warn('[demo] before hook error', e); }

      let text = '';
      try { text = (typeof seg.text === 'function') ? seg.text() : seg.text; } catch (e) { text = ''; }

      if (seg.caption === false || !text) hideCaption(); else showCaption(text);
      if (!text) { playNext(); return; }
      speakNarration(text, playNext, seg.delay);
    };
    playNext();
  }

  function finishActiveStep() {
    clearHl();
    const st = activeStep;
    activeStep = null;
    if (st && st.after) {
      try { st.after(); } catch (e) { console.warn('[demo] after hook error', e); }
    }
  }

  function tryAdvance(token) {
    if (!isRunning || token !== runToken) return;
    if (!actionDone || !speechDone) return;
    if (isPaused) return;

    const hadAfter = !!(activeStep && activeStep.after);
    finishActiveStep();

    const seq = ++gapSeq;
    const go = () => {
      if (!isRunning || token !== runToken || seq !== gapSeq) return;
      if (isPaused) return;
      currentStepIndex++;
      runStep();
    };
    if (hadAfter) setTimeout(go, 450);
    else go();
  }

  function updateVoiceUI() {
    const vBtn = document.getElementById('demoVoiceBtn');
    const rBtn = document.getElementById('demoRateBtn');
    if (vBtn) {
      if (!tts.supported) {
        vBtn.innerText = '🔇 음성 미지원';
        vBtn.disabled = true;
        vBtn.style.opacity = '0.5';
      } else {
        vBtn.innerText = tts.enabled ? '🔊 음성 켜짐' : '🔇 음성 꺼짐';
        vBtn.style.background = tts.enabled ? 'rgba(0,122,255,0.12)' : '#f2f2f7';
        vBtn.style.color = tts.enabled ? '#007aff' : '#8e8e93';
      }
    }
    if (rBtn) {
      rBtn.innerText = `속도 ${tts.rate.toFixed(2).replace(/0$/, '')}x`;
      rBtn.disabled = !tts.supported;
      rBtn.style.opacity = tts.supported ? '1' : '0.5';
    }
  }

  function restartNarrationIfNeeded() {
    if (!isRunning || isPaused || speechDone) return;
    startNarration(demoSteps[currentStepIndex], runToken, currentSegIndex);
  }

  function toggleVoice() {
    if (!tts.supported) return;
    tts.enabled = !tts.enabled;
    updateVoiceUI();
    restartNarrationIfNeeded();
  }

  function cycleRate() {
    if (!tts.supported) return;
    const idx = RATE_STEPS.indexOf(tts.rate);
    tts.rate = RATE_STEPS[(idx + 1) % RATE_STEPS.length];
    updateVoiceUI();
    restartNarrationIfNeeded();
  }

  function createDemoControllerUI() {
    if (document.getElementById('demoControlWidget')) return;

    const widget = document.createElement('div');
    widget.id = 'demoControlWidget';
    widget.className = 'demo-control-widget';
    widget.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 10000;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.7);
      border-radius: 18px;
      padding: 12px 16px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      width: 290px;
      box-sizing: border-box;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    widget.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:15px;">🎬</span>
          <span style="font-weight:800; font-size:13px; color:#1d1d1f; letter-spacing:-0.2px;">자동 시연</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <span id="demoStepBadge" style="font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:10px; background:#e5e5ea; color:#3a3a3c;">
            READY
          </span>
          <button id="demoMinimizeBtn" title="최소화" style="background:none; border:none; cursor:pointer; font-size:12px; color:#8e8e93; padding:2px; line-height:1;">
            ✕
          </button>
        </div>
      </div>

      <div style="width:100%; height:3.5px; background:rgba(0,0,0,0.06); border-radius:2px; margin-bottom:9px; overflow:hidden;">
        <div id="demoProgressBar" style="width:0%; height:100%; background:linear-gradient(90deg, #007aff, #5856d6); transition:width 0.35s ease; border-radius:2px;"></div>
      </div>

      <div id="demoTitle" style="font-size:12.5px; font-weight:700; color:#007aff; margin-bottom:10px; line-height:1.3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        원터치 자동 시연 모드
      </div>

      <div style="display:flex; gap:6px; margin-bottom:10px;">
        <button id="demoVoiceBtn" style="flex:1.3; padding:5px 6px; border:none; border-radius:7px; background:rgba(0,122,255,0.12); color:#007aff; font-size:11px; font-weight:700; cursor:pointer;">🔊 음성 켜짐</button>
        <button id="demoRateBtn" style="flex:1; padding:5px 6px; border:1px solid #d1d1d6; border-radius:7px; background:#fff; color:#3a3a3c; font-size:11px; font-weight:600; cursor:pointer;">속도 1x</button>
      </div>

      <div id="demoBtnGroupReady" style="display:flex; gap:6px;">
        <button id="demoStartBtn" style="flex:1; padding:8px 12px; border:none; border-radius:10px; background:linear-gradient(135deg, #007aff, #0056b3); color:#fff; font-size:12px; font-weight:800; cursor:pointer; box-shadow:0 3px 10px rgba(0,122,255,0.3); transition:all 0.2s;">
          ▶ 자동 시연 시작
        </button>
      </div>

      <div id="demoBtnGroupRunning" style="display:none; gap:5px; flex-wrap:wrap;">
        <button id="demoPrevBtn" style="flex:1; padding:6px 6px; border:1px solid #d1d1d6; border-radius:7px; background:#fff; color:#1d1d1f; font-size:11px; font-weight:600; cursor:pointer;">
          ◀ 이전
        </button>
        <button id="demoPauseBtn" style="flex:1.2; padding:6px 6px; border:none; border-radius:7px; background:#ff9500; color:#fff; font-size:11px; font-weight:700; cursor:pointer;">
          ⏸ 일시정지
        </button>
        <button id="demoNextBtn" style="flex:1; padding:6px 6px; border:1px solid #d1d1d6; border-radius:7px; background:#fff; color:#1d1d1f; font-size:11px; font-weight:600; cursor:pointer;">
          다음 ▶
        </button>
        <button id="demoStopBtn" style="width:100%; margin-top:3px; padding:5px; border:none; border-radius:7px; background:rgba(255,59,48,0.12); color:#ff3b30; font-size:11px; font-weight:700; cursor:pointer;">
          ⏹ 시연 즉시 종료
        </button>
      </div>
    `;

    document.body.appendChild(widget);

    if (!document.getElementById('demoCaptionStyle')) {
      const st = document.createElement('style');
      st.id = 'demoCaptionStyle';
      st.textContent = `
        #demoCaption {
          position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
          z-index: 9999; max-width: min(720px, calc(100vw - 360px));
          padding: 12px 20px; border-radius: 14px;
          background: rgba(20, 20, 24, 0.82); color: #fff;
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          font-size: 15px; font-weight: 600; line-height: 1.5; text-align: center;
          letter-spacing: -0.2px; pointer-events: none; opacity: 0;
          transition: opacity 0.25s ease; box-shadow: 0 8px 28px rgba(0,0,0,0.3);
          word-break: keep-all;
        }
        @media (max-width: 760px) {
          #demoCaption { max-width: calc(100vw - 32px); bottom: 210px; font-size: 13.5px; }
        }
      `;
      document.head.appendChild(st);
    }
    if (!document.getElementById('demoCaption')) {
      const cap = document.createElement('div');
      cap.id = 'demoCaption';
      cap.setAttribute('aria-live', 'polite');
      document.body.appendChild(cap);
    }

    document.getElementById('demoStartBtn').addEventListener('click', startDemo);
    document.getElementById('demoPauseBtn').addEventListener('click', togglePauseDemo);
    document.getElementById('demoStopBtn').addEventListener('click', stopDemo);
    document.getElementById('demoPrevBtn').addEventListener('click', prevStep);
    document.getElementById('demoNextBtn').addEventListener('click', nextStep);
    document.getElementById('demoMinimizeBtn').addEventListener('click', toggleMinimizeWidget);
    document.getElementById('demoVoiceBtn').addEventListener('click', toggleVoice);
    document.getElementById('demoRateBtn').addEventListener('click', cycleRate);
    updateVoiceUI();
  }

  function toggleMinimizeWidget() {
    const widget = document.getElementById('demoControlWidget');
    if (!widget) return;

    isMinimized = !isMinimized;
    if (isMinimized) {
      widget.style.display = 'none';
      createMinimizedFloatingButton();
    } else {
      widget.style.display = 'block';
      removeMinimizedFloatingButton();
    }
  }

  function createMinimizedFloatingButton() {
    if (document.getElementById('demoFloatingMiniPill')) return;
    const miniPill = document.createElement('button');
    miniPill.id = 'demoFloatingMiniPill';
    miniPill.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 10000;
      background: rgba(0, 122, 255, 0.92);
      color: #fff;
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.4);
      border-radius: 20px;
      padding: 7px 14px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 6px 20px rgba(0, 122, 255, 0.35);
      display: flex;
      align-items: center;
      gap: 5px;
      transition: all 0.2s ease;
    `;
    miniPill.innerHTML = `🎬 자동 시연 ${isRunning ? `(${currentStepIndex + 1}/${demoSteps.length})` : ''}`;
    miniPill.addEventListener('click', () => {
      toggleMinimizeWidget();
    });
    document.body.appendChild(miniPill);
  }

  function removeMinimizedFloatingButton() {
    const miniPill = document.getElementById('demoFloatingMiniPill');
    if (miniPill) miniPill.remove();
  }

  function startDemo() {
    if (isMinimized) toggleMinimizeWidget();
    isRunning = true;
    isPaused = false;
    currentStepIndex = 0;

    document.getElementById('demoBtnGroupReady').style.display = 'none';
    document.getElementById('demoBtnGroupRunning').style.display = 'flex';

    pickKoreanVoice();
    runStep();
  }

  function runStep() {
    if (!isRunning) return;
    finishActiveStep();

    if (currentStepIndex >= demoSteps.length) {
      completeDemo();
      return;
    }

    if (currentStepIndex < 0) {
      currentStepIndex = 0;
    }

    const step = demoSteps[currentStepIndex];
    const total = demoSteps.length;
    const pct = Math.round(((currentStepIndex + 1) / total) * 100);

    const badge = document.getElementById('demoStepBadge');
    if (badge) {
      badge.innerText = `${currentStepIndex + 1} / ${total}`;
      badge.style.background = '#007aff';
      badge.style.color = '#fff';
    }

    const pBar = document.getElementById('demoProgressBar');
    if (pBar) pBar.style.width = `${pct}%`;

    const titleEl = document.getElementById('demoTitle');
    if (titleEl) titleEl.innerText = step.title;

    const token = ++runToken;
    actionDone = false;
    speechDone = false;
    pendingResume = false;

    activeStep = step;
    currentSegIndex = 0;
    resumeSeg = 0;
    startNarration(step, token, 0);

    step.action(() => {
      if (token !== runToken) return;
      actionDone = true;
      tryAdvance(token);
    });
  }

  function togglePauseDemo() {
    const pauseBtn = document.getElementById('demoPauseBtn');
    if (!isPaused) {
      isPaused = true;
      if (!speechDone) {
        pendingResume = true;
        resumeSeg = currentSegIndex;
        cancelSpeech();
      }
      pauseBtn.innerText = "▶ 재개";
      pauseBtn.style.background = "#34c759";
      const titleEl = document.getElementById('demoTitle');
      if (titleEl) titleEl.innerText = "[일시정지됨] 클릭 시 계속 진행";
    } else {
      isPaused = false;
      pauseBtn.innerText = "⏸ 일시정지";
      pauseBtn.style.background = "#ff9500";
      const titleEl = document.getElementById('demoTitle');
      if (titleEl) titleEl.innerText = demoSteps[currentStepIndex].title;
      if (pendingResume) {
        pendingResume = false;
        startNarration(demoSteps[currentStepIndex], runToken, resumeSeg);
      }
      tryAdvance(runToken);
    }
  }

  function prevStep() {
    if (!isRunning) return;
    isPaused = false;
    const pauseBtn = document.getElementById('demoPauseBtn');
    if (pauseBtn) {
      pauseBtn.innerText = "⏸ 일시정지";
      pauseBtn.style.background = "#ff9500";
    }
    currentStepIndex = Math.max(0, currentStepIndex - 1);
    runStep();
  }

  function nextStep() {
    if (!isRunning) return;
    isPaused = false;
    const pauseBtn = document.getElementById('demoPauseBtn');
    if (pauseBtn) {
      pauseBtn.innerText = "⏸ 일시정지";
      pauseBtn.style.background = "#ff9500";
    }
    currentStepIndex = Math.min(demoSteps.length - 1, currentStepIndex + 1);
    runStep();
  }

  function completeDemo() {
    runToken++;
    cancelSpeech();
    hideCaption();
    finishActiveStep();
    isRunning = false;
    isPaused = false;
    currentStepIndex = 0;

    document.getElementById('demoBtnGroupReady').style.display = 'flex';
    document.getElementById('demoBtnGroupRunning').style.display = 'none';

    const startBtn = document.getElementById('demoStartBtn');
    if (startBtn) {
      startBtn.innerText = '↺ 자동 시연 다시 시작';
    }

    const badge = document.getElementById('demoStepBadge');
    if (badge) {
      badge.innerText = '완료 🎉';
      badge.style.background = '#34c759';
      badge.style.color = '#fff';
    }

    const pBar = document.getElementById('demoProgressBar');
    if (pBar) pBar.style.width = '100%';

    const titleEl = document.getElementById('demoTitle');
    if (titleEl) titleEl.innerText = '모든 시연이 완료되었습니다 ✨';
  }

  function stopDemo() {
    runToken++;
    cancelSpeech();
    hideCaption();
    finishActiveStep();
    isRunning = false;
    isPaused = false;
    currentStepIndex = 0;

    cleanupDemoState();

    document.getElementById('demoBtnGroupReady').style.display = 'flex';
    document.getElementById('demoBtnGroupRunning').style.display = 'none';

    const startBtn = document.getElementById('demoStartBtn');
    if (startBtn) {
      startBtn.innerText = '▶ 자동 시연 시작';
    }

    const badge = document.getElementById('demoStepBadge');
    if (badge) {
      badge.innerText = 'READY';
      badge.style.background = '#e5e5ea';
      badge.style.color = '#3a3a3c';
    }

    const pBar = document.getElementById('demoProgressBar');
    if (pBar) pBar.style.width = '0%';

    const titleEl = document.getElementById('demoTitle');
    if (titleEl) titleEl.innerText = '시연이 종료되었습니다';
  }

  window.startInfrastructureAutoDemo = function () {
    const widget = document.getElementById('demoControlWidget');
    if (widget && widget.style.display === 'none') {
      toggleMinimizeWidget();
    }
    startDemo();
  };
  window.stopInfrastructureAutoDemo = stopDemo;
  window.toggleDemoWidget = function () {
    const widget = document.getElementById('demoControlWidget');
    if (!widget) {
      createDemoControllerUI();
      return;
    }
    toggleMinimizeWidget();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createDemoControllerUI);
  } else {
    createDemoControllerUI();
  }
})();