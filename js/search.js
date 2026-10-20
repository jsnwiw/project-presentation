/**
 * 전국 행정구역 검색 및 실시간 자동완성 로직
 * (전국 229개 시·군·구 전수 검색 & 13대 핵심 인프라 실시간 진단 연동)
 */

/**
 * 검색창 입력 시 실시간 자동완성 필터링 (초성/부분/지명/키워드 지원)
 */
function handleSearchInput(e) {
  const rawKeyword = e.target.value.trim();
  const keyword = rawKeyword.toLowerCase();
  const listContainer = document.getElementById('autocompleteList');
  
  if (!keyword) {
    listContainer.style.display = 'none';
    listContainer.innerHTML = '';
    return;
  }

  if (typeof regions === 'undefined' || !Array.isArray(regions)) {
    return;
  }

  // 다중 필드 매칭 (정식명칭, 짧은명칭, 광역도명, 검색 키워드)
  const filtered = regions.filter(r => {
    const matchName = r.name && r.name.toLowerCase().includes(keyword);
    const matchShort = r.shortName && r.shortName.toLowerCase().includes(keyword);
    const matchProvince = r.province && r.province.toLowerCase().includes(keyword);
    const matchKeywords = r.keywords && r.keywords.toLowerCase().includes(keyword);
    return matchName || matchShort || matchProvince || matchKeywords;
  }).slice(0, 10); // 최대 10개 표시

  if (filtered.length > 0) {
    listContainer.innerHTML = filtered.map(r => {
      const typeBadge = r.type === 'metro' ? '광역' : (r.type === 'county' ? '군' : (r.type === 'island' ? '도서' : '시/구'));
      const badgeColor = r.type === 'county' || r.type === 'island' ? '#ff3b30' : '#007aff';
      return `
        <div class="autocomplete-item" onclick="selectRegion('${r.name}', ${r.lat}, ${r.lng}, ${r.zoom})">
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <span>📍 <b>${r.name}</b></span>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:10.5px; color:${badgeColor}; font-weight:700;">${r.infraScore ? r.infraScore.split(' ')[0] : typeBadge}</span>
              <span style="font-size:11px; color:#86868b;">${r.pop}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
    listContainer.style.display = 'block';
  } else {
    listContainer.innerHTML = `
      <div style="padding: 10px; font-size: 13px; color: #86868b; text-align: center;">
        🔍 '${rawKeyword}' 일치 지역 없음<br>
        <span style="font-size:11px; color:#007aff;">Enter 키 입력 시 13대 인프라 정밀 분석이 실행됩니다.</span>
      </div>
    `;
    listContainer.style.display = 'block';
  }
}

/**
 * 검색 버튼 클릭 또는 Enter 키 입력 시 실행 (전국 229개 시군구 전수 매핑)
 */
function executeSearchButton() {
  const searchInput = document.getElementById('searchInput');
  const keyword = searchInput.value.trim();

  // 1. 검색어가 비어있는 경우
  if (!keyword) {
    showSearchAlert(
      'empty',
      '검색어를 입력해주세요',
      '확인하고 싶으신 전국 행정구역(시·군·구)이나 인프라 관심 지역의 명칭을 입력해주세요.<br>(예: 해남, 포항, 영양, 신안, 강릉, 강남, 제주, 세종 등)',
      ['전남 해남군', '경북 포항시', '경북 영양군', '경북 의성군', '전남 신안군', '강원 강릉시', '서울 강남구', '제주 서귀포시', '충북 단양군']
    );
    return;
  }
  
  const kw = keyword.toLowerCase();
  
  // 2. 1차: 완벽 일치 (이름 또는 shortName)
  let found = regions.find(r => 
    r.name.toLowerCase() === kw || 
    (r.shortName && r.shortName.toLowerCase() === kw)
  );

  // 3. 2차: 부분 일치 (이름, shortName, keywords, 광역도명)
  if (!found) {
    found = regions.find(r => 
      r.name.toLowerCase().includes(kw) || 
      (r.shortName && r.shortName.toLowerCase().includes(kw)) ||
      (r.keywords && r.keywords.toLowerCase().includes(kw)) ||
      kw.includes(r.name.toLowerCase()) ||
      (r.shortName && kw.includes(r.shortName.toLowerCase()))
    );
  }

  // 4. 3차: 전국 18대 대표 소외지역 데이터베이스에서 탐색
  if (!found && typeof allRegionsComprehensiveData !== 'undefined') {
    const compFound = allRegionsComprehensiveData.find(r => 
      r.name.toLowerCase().includes(kw) || kw.includes(r.name.toLowerCase())
    );
    if (compFound) {
      found = {
        name: compFound.name,
        lat: compFound.lat,
        lng: compFound.lng,
        zoom: 12
      };
    }
  }

  if (found) {
    selectRegion(found.name, found.lat, found.lng, found.zoom || 12);
  } else {
    // 5. 일치하는 결과가 없는 경우 커스텀 알림 모달 출력
    showSearchAlert(
      'not_found',
      '검색 결과를 찾을 수 없습니다',
      `<b>'${keyword}'</b>에 일치하는 전국 229개 행정구역명을 찾지 못했습니다.<br>시·군·구 단위의 정식 지명을 입력하시거나 아래 추천 지역을 선택해보세요.`,
      ['전남 해남군', '경북 영양군', '경북 포항시', '강원 평창군', '전남 신안군', '서울 강남구', '제주 서귀포시', '울릉군']
    );
  }
}

/**
 * 검색 오류 / 안내 커스텀 모달 UI 표시 함수
 */
function showSearchAlert(type, title, message, suggestions = []) {
  const modal = document.getElementById('searchAlertModal');
  const iconEl = document.getElementById('searchAlertIcon');
  const titleEl = document.getElementById('searchAlertTitle');
  const messageEl = document.getElementById('searchAlertMessage');
  const suggestionsEl = document.getElementById('searchAlertSuggestions');
  const searchDock = document.querySelector('.search-dock');

  // 검색 도크 흔들림 효과
  if (searchDock) {
    searchDock.classList.remove('input-shake');
    void searchDock.offsetWidth; // 리플로우 강제
    searchDock.classList.add('input-shake');
    setTimeout(() => searchDock.classList.remove('input-shake'), 450);
  }

  // 아이콘 및 제목 지정
  if (type === 'empty') {
    iconEl.innerText = '⚠️';
  } else {
    iconEl.innerText = '🔍';
  }

  titleEl.innerHTML = title;
  messageEl.innerHTML = message;

  // 추천 검색어 칩 생성
  if (suggestions && suggestions.length > 0) {
    suggestionsEl.innerHTML = `
      <div style="font-size: 11px; font-weight: 700; color: #86868b; width: 100%; margin-bottom: 2px;">
        💡 빠른 추천 검색 지역:
      </div>
      ` + suggestions.map(name => `
        <span class="alert-chip" onclick="quickSelectFromAlert('${name}')">📍 ${name}</span>
      `).join('');
    suggestionsEl.style.display = 'flex';
  } else {
    suggestionsEl.style.display = 'none';
  }

  modal.classList.add('active');
}

/**
 * 추천 칩 클릭 시 해당 지역 즉시 선택 및 모달 닫기
 */
function quickSelectFromAlert(regionName) {
  closeSearchAlert();
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = regionName;

  const found = regions.find(r => r.name.includes(regionName) || regionName.includes(r.name) || (r.shortName && regionName.includes(r.shortName)));
  if (found) {
    selectRegion(found.name, found.lat, found.lng, found.zoom || 12);
  } else {
    executeSearchButton();
  }
}

/**
 * 검색 알림 모달 닫기
 */
function closeSearchAlert() {
  const modal = document.getElementById('searchAlertModal');
  if (modal) {
    modal.classList.remove('active');
  }
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.focus();
  }
}

/**
 * 모달 배경(Backdrop) 클릭 시 닫기
 */
function closeSearchAlertOnBackdrop(e) {
  if (e.target.id === 'searchAlertModal') {
    closeSearchAlert();
  }
}

/**
 * 검색된 지역의 13대 인프라 정밀 팝업 HTML 빌더
 */
function buildSearchInfraPopupHTML(profile) {
  let infraRowsHTML = '';
  if (profile.allInfra) {
    for (let key in profile.allInfra) {
      const isFiltered = (typeof activeInfraFilterKeys !== 'undefined') && activeInfraFilterKeys.has(key);
      const rowStyle = isFiltered 
        ? 'background: rgba(0,122,255,0.08); border-radius: 4px; padding: 3px 5px;' 
        : 'padding: 3px 0; border-bottom: 1px solid rgba(0,0,0,0.04);';

      infraRowsHTML += `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px; font-size:11px; ${rowStyle}">
          <b style="color:#007aff; white-space:nowrap;">${key}</b>
          <span style="color:#3a3a3c; text-align:right; word-break:keep-all;">${profile.allInfra[key]}</span>
        </div>
      `;
    }
  }

  return `
    <div style="font-size: 12.5px; line-height: 1.45; min-width: 270px; max-width: 320px; max-height: 390px; overflow-y: auto; padding: 4px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <b style="color: #007aff; font-size: 15px;">${profile.emoji || '📍'} ${profile.name}</b>
        <span style="font-size: 10.5px; background: rgba(0,122,255,0.12); color: #007aff; font-weight: 800; padding: 2px 7px; border-radius: 6px;">${profile.deficitScore || '인프라 분석 완료'}</span>
      </div>
      <div style="color: #515156; font-size: 11.5px; margin-top: 3px;">
        👥 실시간 인구수: <b>${profile.pop}</b>
      </div>
      <div style="font-size: 11px; background: rgba(52,199,89,0.1); color: #34c759; padding: 3px 6px; border-radius: 6px; margin: 4px 0; font-weight: 700;">
        ⚡ <b>실시간 상태:</b> ${profile.liveStatus || '정상 스트림 가동 중'}
      </div>
      <hr style="margin: 6px 0; border:0; border-top:1px solid rgba(0,0,0,0.08);">
      <div style="font-weight: 800; color: #ff3b30; font-size: 12px; margin-bottom: 5px; display:flex; justify-content:space-between; align-items:center;">
        <span>🔍 13대 핵심 인프라 정밀 분석 현황</span>
        <span class="live-pulse-badge">LIVE</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:2px; max-height:190px; overflow-y:auto; padding-right:2px;">
        ${infraRowsHTML}
      </div>
    </div>
  `;
}

/**
 * 특정 행정구역 선택 및 지도 이동 & 13대 인프라 실시간 종합 조회
 */
function selectRegion(name, lat, lng, zoom) {
  // 1. 해당 검색 지역의 13대 인프라 프로필 취득
  const profile = (typeof getRegionInfraProfile === 'function')
    ? getRegionInfraProfile(name)
    : { name: name, pop: '집계 중', deficitScore: '분석 완료', liveStatus: '정상 스트림', allInfra: {}, emoji: '📍' };

  // 전역 현재 활성 진단 프로필 등록 (인프라 버튼 클릭 시에도 유지)
  window.currentActiveInspectedRegion = profile;

  // 2. 지도 이동 (부드러운 애니메이션)
  if (typeof map !== 'undefined' && map) {
    map.flyTo([lat, lng], zoom || 12, { duration: 1.2 });
  }

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = profile.name;
  }

  const listContainer = document.getElementById('autocompleteList');
  if (listContainer) {
    listContainer.style.display = 'none';
  }

  // 기존 검색 마커 제거 후 신규 마커 생성
  if (currentMarker) {
    map.removeLayer(currentMarker);
  }

  currentMarker = L.marker([lat, lng], { icon: createCategoryIcon(profile.emoji || '📍') }).addTo(map);
  currentMarker.bindPopup(buildSearchInfraPopupHTML(profile)).openPopup();

  // 3. 지도 위에 실시간 인프라 분석 버퍼 원 표시 (26km 집중 분석 구역)
  if (typeof liveRegionBufferGroup !== 'undefined') {
    liveRegionBufferGroup.clearLayers();
    const focusCircle = L.circle([lat, lng], {
      radius: 26000,
      color: '#007aff',
      weight: 3,
      opacity: 0.9,
      fillColor: '#007aff',
      fillOpacity: 0.16,
      dashArray: '6, 6'
    });
    focusCircle.bindTooltip(`
      <div style="font-size:12px; font-weight:700;">
        ${profile.emoji || '📍'} <b>${profile.name}</b> 13대 인프라 집중 분석 권역<br>
        <span style="color:#007aff; font-size:11px;">실시간 결핍 지표 모니터링 가동 중</span>
      </div>
    `, { sticky: true });
    liveRegionBufferGroup.addLayer(focusCircle);
  }

  // 4. 좌측 패널의 실시간 진단 카드도 해당 검색 지역의 13대 인프라로 즉시 갱신
  const liveContainer = document.getElementById('liveInspectionContainer');
  if (liveContainer && typeof buildRegionLiveInspectionHTML === 'function') {
    liveContainer.innerHTML = buildRegionLiveInspectionHTML(profile);
  }

  // 5. 실시간 지도 반영 알림 토스트 출력
  if (typeof showLiveMapToast === 'function') {
    showLiveMapToast(`🔍 <b>${profile.name}</b> 13대 인프라 실시간 조회가 완료되었습니다!`);
  }
}

// 검색창 영역 외 클릭 시 자동완성 닫기
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-glass-pill')) {
    const listContainer = document.getElementById('autocompleteList');
    if (listContainer) {
      listContainer.style.display = 'none';
    }
  }
});

// Esc 키 입력 시 활성화된 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSearchAlert();
    if (typeof closeDisasterModal === 'function') {
      closeDisasterModal();
    }
  }
});
