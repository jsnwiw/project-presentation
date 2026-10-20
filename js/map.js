/**
 * Leaflet 지도 초기화 및 국토교통부 V-World 기반 정밀 인프라 분석 시각화 엔진
 * (카테고리 버튼 및 분석 레이어 자유로운 ON/OFF 토글 시스템 탑재)
 */

// 대한민국 지도 경계
const koreaBounds = L.latLngBounds(
  [33.0, 124.5],
  [38.7, 131.9]
);

// 지도 인스턴스 초기화
const map = L.map('map', {
  center: [36.1, 127.8],
  zoom: 7.2,
  minZoom: 6,
  maxZoom: 19,
  maxBounds: koreaBounds,
  maxBoundsViscosity: 0.95
});

// 지도 이동 시 기존 팝업 닫기
map.on('movestart', function() {
  map.closePopup();
});

/* ==========================================================================
   1. 기본 지도 타일 레이어 (도로선, 도로명 등 모든 기타 라벨 100% 제거, 오직 한국어 지역명만 표기)
   ========================================================================== */

// Google 하이브리드 라벨 타일 (lyrs=h) — 한국어(hl=ko) + 모든 비행정 요소 제거
// POI 핀/아이콘(s.t:2), 도로(s.t:3), 교통(s.t:4), 수계라벨(s.t:5), 경관라벨(s.t:6) 전면 OFF
// → 오직 행정구역 지역명(시·도, 시·군·구, 읍·면·동)만 표시
const labelStyle = [
  's.t:2|s.e:g|p.v:off',    // POI 지오메트리 OFF
  's.t:2|s.e:l.i|p.v:off',  // POI 아이콘(핀) OFF
  's.t:2|s.e:l.t|p.v:off',  // POI 텍스트 OFF
  's.t:3|s.e:g|p.v:off',    // 도로선 OFF
  's.t:3|s.e:l|p.v:off',    // 도로 라벨 OFF
  's.t:4|p.v:off',           // 대중교통 전체 OFF
  's.t:5|s.e:l|p.v:off',    // 수계 라벨 OFF
  's.t:6|s.e:l|p.v:off'     // 경관 라벨 OFF
].join('|');
const encodedStyle = 'apistyle=' + encodeURIComponent(labelStyle).replace(/%7C/gi, '%7C');

const koreanLabelTileUrl = `https://mt{s}.google.com/vt/lyrs=h&hl=ko&${encodedStyle}&x={x}&y={y}&z={z}`;
const koreanLabelOptions = {
  subdomains: ['0', '1', '2', '3'],
  maxZoom: 19,
  minZoom: 6,
  attribution: '&copy; Google 한국어 지역명 라벨',
  opacity: 1,
  zIndex: 10
};

// 1. Esri 글로벌 초고화질 위성 영상
const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  minZoom: 6,
  attribution: 'Tiles &copy; Esri &mdash; World Imagery'
});

// 2. 🏷️ 한국어 지역명 라벨 타일 레이어 (항상 켜져 있도록 설정)
const koreanLabels = L.tileLayer(koreanLabelTileUrl, koreanLabelOptions);

// 위성 지도와 한국어 지역명 라벨을 지도에 직접 추가하여 상시 활성화 (항상 켜져 있음)
esriSatellite.addTo(map);
koreanLabels.addTo(map);

/* ==========================================================================
   2. 전문 인프라 취약 분석 시각화 레이어 6종 정의
   ========================================================================== */

// 1) 🚨 응급의료 골든타임 사각지대 (반경 30km 버퍼)
const emergencyDeficitGroup = L.layerGroup();
const emergencyLocations = [
  { name: "영양군 일원", lat: 36.6668, lng: 129.1128, radius: 30000, desc: "응급실 부재 / 30km 내 종합병원 전무" },
  { name: "신안 흑산도서군", lat: 34.6854, lng: 125.4412, radius: 35000, desc: "야간 해상 응급헬기 이송 제한" },
  { name: "태백 탄광지역", lat: 37.1641, lng: 128.9856, radius: 26000, desc: "외상 응급의학 전문의 부족" },
  { name: "고흥 도양·도화", lat: 34.6111, lng: 127.2847, radius: 32000, desc: "순천 종합병원 1시간 이상 이송" },
  { name: "평창 산간벽지", lat: 37.5714, lng: 128.3912, radius: 25000, desc: "원주·강릉 3차병원 50분 소요" },
  { name: "백령·대청 접경도서", lat: 37.9692, lng: 124.6753, radius: 32000, desc: "중증외상 헬기 이송 60분 초과" },
  { name: "청산·완도 도서군", lat: 34.1788, lng: 126.9066, radius: 28000, desc: "의료선 연 4회 한정 의존" },
  { name: "울릉도·독도 고립군", lat: 37.4844, lng: 130.9056, radius: 35000, desc: "수술 불가, 포항 이송 3시간" },
  { name: "합천 산간 오지", lat: 35.5666, lng: 128.1658, radius: 24000, desc: "분만 산부인과 관내 0곳" },
  { name: "단양 산간지역", lat: 36.9845, lng: 128.3654, radius: 22000, desc: "제천 종합병원 45분 이송" }
];
emergencyLocations.forEach(loc => {
  const circle = L.circle([loc.lat, loc.lng], {
    radius: loc.radius,
    color: '#ff3b30',
    weight: 2,
    opacity: 0.85,
    fillColor: '#ff453a',
    fillOpacity: 0.18,
    dashArray: '6, 6'
  });
  circle.bindTooltip(`🚨 <b>${loc.name}</b><br><span style="color:#ff3b30; font-weight:700;">골든타임 취약권역</span><br>${loc.desc}`, { sticky: true });
  emergencyDeficitGroup.addLayer(circle);
});

// 2) 📉 지방소멸 고위험 경고구역 (소멸지수 < 0.2)
const extinctionRiskGroup = L.layerGroup();
const extinctionLocations = [
  { name: "경북 의성군 (0.12)", lat: 36.3524, lng: 128.6974, radius: 26000 },
  { name: "경북 영양군 (0.13)", lat: 36.6668, lng: 129.1128, radius: 24000 },
  { name: "경남 합천군 (0.13)", lat: 35.5666, lng: 128.1658, radius: 25000 },
  { name: "경북 봉화군 (0.14)", lat: 36.8931, lng: 128.7325, radius: 26000 },
  { name: "경북 청송군 (0.14)", lat: 36.4351, lng: 129.0577, radius: 24000 },
  { name: "충남 청양군 (0.18)", lat: 36.4468, lng: 126.8021, radius: 22000 },
  { name: "전북 무진장 고원 (0.16)", lat: 36.0068, lng: 127.6606, radius: 30000 },
  { name: "강원 정선·태백 (0.15)", lat: 37.27, lng: 128.82, radius: 28000 },
  { name: "전남 고흥군 (0.13)", lat: 34.6111, lng: 127.2847, radius: 28000 }
];
extinctionLocations.forEach(loc => {
  const circle = L.circle([loc.lat, loc.lng], {
    radius: loc.radius,
    color: '#af52de',
    weight: 2,
    opacity: 0.8,
    fillColor: '#bf5af2',
    fillOpacity: 0.18
  });
  circle.bindTooltip(`📉 <b>${loc.name}</b><br><span style="color:#af52de; font-weight:700;">소멸위험 초고위험군</span><br>유소년 대비 고령인구 급증 권역`, { sticky: true });
  extinctionRiskGroup.addLayer(circle);
});

// 3) 👶 분만·산부인과 공백지구 (분만실 0곳)
const maternalDeficitGroup = L.layerGroup();
const maternalLocations = [
  { name: "경북 영양·청송 (분만실 0)", lat: 36.55, lng: 129.08, radius: 28000, desc: "안동 1시간 이상 원정 출산 필수" },
  { name: "경남 합천·산청 (분만실 0)", lat: 35.49, lng: 128.02, radius: 30000, desc: "대구·진주 원정 진료, 응급 구급차 의존" },
  { name: "강원 정선·태백 (분만실 0)", lat: 37.27, lng: 128.82, radius: 27000, desc: "관내 분만실 폐쇄, 원주 원정 진료" },
  { name: "전남 신안·완도·고흥 (분만실 0)", lat: 34.50, lng: 126.80, radius: 38000, desc: "도서벽지 산모 1개월 전 육지 체류 필수" }
];
maternalLocations.forEach(loc => {
  const circle = L.circle([loc.lat, loc.lng], {
    radius: loc.radius,
    color: '#ff2d55',
    weight: 2,
    opacity: 0.85,
    fillColor: '#ff375f',
    fillOpacity: 0.18,
    dashArray: '5, 5'
  });
  circle.bindTooltip(`👶 <b>${loc.name}</b><br><span style="color:#ff2d55; font-weight:700;">분만·보육 인프라 사각</span><br>${loc.desc}`, { sticky: true });
  maternalDeficitGroup.addLayer(circle);
});

// 4) 🚆 광역교통·철도 단절 취약축
const transitDeficitGroup = L.layerGroup();
const mountainAxis = [
  [36.3524, 128.6974], [36.6668, 129.1128], [36.8931, 128.7325],
  [37.1641, 128.9856], [37.3806, 128.6608], [37.5714, 128.3912]
];
const transitLine1 = L.polyline(mountainAxis, {
  color: '#ff9500', weight: 4, opacity: 0.8, dashArray: '10, 8'
}).bindTooltip("🚆 <b>태백·소백 산간 교통 단절축</b><br>철도 미연결 및 버스 배차 2시간 초과", { sticky: true });
transitDeficitGroup.addLayer(transitLine1);

const islandAxis1 = [[34.8118, 126.3922], [34.6854, 125.4412]];
const islandAxis2 = [[34.3111, 126.7550], [34.1788, 126.9066]];
transitDeficitGroup.addLayer(L.polyline(islandAxis1, { color: '#007aff', weight: 3, opacity: 0.8, dashArray: '8, 6' }).bindTooltip("🚢 <b>신안 흑산 해상 항로 의존축</b>", { sticky: true }));
transitDeficitGroup.addLayer(L.polyline(islandAxis2, { color: '#007aff', weight: 3, opacity: 0.8, dashArray: '8, 6' }).bindTooltip("🚢 <b>완도 청산 해상 항로 의존축</b>", { sticky: true }));

// 5) ⚡ 상수도·도시가스 미보급 권역
const energyWaterDeficitGroup = L.layerGroup();
const energyLocations = [
  { name: "경북 영양·봉화·청송", lat: 36.68, lng: 128.95, radius: 34000, desc: "도시가스 배관 0%, 지하수 의존 가구 다수" },
  { name: "전남 신안·완도·고흥 도서", lat: 34.50, lng: 126.60, radius: 42000, desc: "가뭄 시 해수담수화 제한급수, 유류 난방 의존" },
  { name: "강원 평창·정선·태백 산간", lat: 37.37, lng: 128.72, radius: 32000, desc: "혹한기 등유 난방비 과중, 간이 상수도 결빙" },
  { name: "울릉도 전역", lat: 37.4844, lng: 130.9056, radius: 20000, desc: "가스 배관망 전무, 디젤 발전 의존" }
];
energyLocations.forEach(loc => {
  const circle = L.circle([loc.lat, loc.lng], {
    radius: loc.radius, color: '#34c759', weight: 2, opacity: 0.8, fillColor: '#30d158', fillOpacity: 0.16, dashArray: '4, 4'
  });
  circle.bindTooltip(`⚡ <b>${loc.name}</b><br><span style="color:#34c759; font-weight:700;">에너지·상수도 취약지대</span><br>${loc.desc}`, { sticky: true });
  energyWaterDeficitGroup.addLayer(circle);
});

// 6) 🏦 금융창구·우체국 소외지구
const bankingDeficitGroup = L.layerGroup();
const bankingLocations = [
  { name: "경북 영양·봉화 (1금융권 0)", lat: 36.78, lng: 128.92, radius: 30000, desc: "시중은행 지점 전무, 농협·우체국 의존" },
  { name: "충남 청양 (1금융권 0)", lat: 36.4468, lng: 126.8021, radius: 22000, desc: "시중은행 지점 폐쇄, 고령층 금융 접근 취약" },
  { name: "전북 무진장 (1금융권 0)", lat: 36.0068, lng: 127.6606, radius: 28000, desc: "면단위 ATM 철수 가속화" },
  { name: "인천 옹진 도서군", lat: 37.9692, lng: 124.6753, radius: 32000, desc: "도서 내 단일 금융창구 운영" }
];
bankingLocations.forEach(loc => {
  const circle = L.circle([loc.lat, loc.lng], {
    radius: loc.radius, color: '#5856d6', weight: 2, opacity: 0.8, fillColor: '#5e5ce6', fillOpacity: 0.16, dashArray: '6, 4'
  });
  circle.bindTooltip(`🏦 <b>${loc.name}</b><br><span style="color:#5856d6; font-weight:700;">금융 인프라 소외지구</span><br>${loc.desc}`, { sticky: true });
  bankingDeficitGroup.addLayer(circle);
});

// ==========================================================================
// 🌋 [실시간 지진 감지 · 재난알림 레이어]
//  - 레이어 그룹만 여기서 생성하고, 실제 데이터 수신/렌더링은 js/earthquake.js 가 담당
// ==========================================================================
const disasterEarthquakeGroup = L.layerGroup();

// 레이어 맵 딕셔너리
const overlayLayerMap = {
  emergency: emergencyDeficitGroup,
  extinction: extinctionRiskGroup,
  maternal: maternalDeficitGroup,
  transit: transitDeficitGroup,
  energy: energyWaterDeficitGroup,
  banking: bankingDeficitGroup,
  disasterEarthquake: disasterEarthquakeGroup
};

/* ==========================================================================
   3. 지도 우측 상단 레이어 컨트롤 복구
   ========================================================================== */

const baseMaps = {
  "🌍 글로벌 위성 (한국어 지역명 라벨)": esriSatellite
};

const overlayMaps = {
  "🏷️ 한국어 지역명 라벨": koreanLabels,
  "🚨 응급의료 골든타임 사각지대 (30km)": emergencyDeficitGroup,
  "📉 지방소멸 고위험 권역 (소멸지수 < 0.2)": extinctionRiskGroup,
  "👶 분만·산부인과 공백지구 (분만실 0)": maternalDeficitGroup,
  "🚆 대중교통·철도 단절 취약축": transitDeficitGroup,
  "⚡ 상수도·도시가스 미보급 권역": energyWaterDeficitGroup,
  "🏦 금융창구·ATM 소외지구": bankingDeficitGroup
};

// 지도 우측 상단 레이어 컨트롤 사이드바는 사용자 요청에 따라 숨김 처리
// (글로벌 위성 및 한국어 라벨은 상시 활성화 유지되며, 레이어는 상단 퀵 버튼으로 제어)
// const layerControl = L.control.layers(baseMaps, overlayMaps, { position: 'topright', collapsed: false }).addTo(map);

// 기본값으로 [응급의료]와 [지방소멸] 활성화 (한국어 라벨은 상시 활성화)
emergencyDeficitGroup.addTo(map);
extinctionRiskGroup.addTo(map);

/**
 * 지도 상단 퀵 버튼으로 분석 레이어 ON/OFF 토글
 */
function toggleOverlayLayer(layerKey) {
  const layer = overlayLayerMap[layerKey];
  const btn = document.querySelector(`.layer-toggle-btn[data-layer="${layerKey}"]`);

  if (!layer) return;

  if (map.hasLayer(layer)) {
    // 끄기 (OFF)
    map.removeLayer(layer);
    if (btn) btn.classList.remove('active');
  } else {
    // 켜기 (ON)
    map.addLayer(layer);
    if (btn) btn.classList.add('active');
  }
}

// 지도 레이어 변경 시 상단 버튼 상태 동기화
map.on('overlayadd', function(e) {
  for (let key in overlayLayerMap) {
    if (overlayLayerMap[key] === e.layer) {
      const btn = document.querySelector(`.layer-toggle-btn[data-layer="${key}"]`);
      if (btn) btn.classList.add('active');
    }
  }
});

map.on('overlayremove', function(e) {
  for (let key in overlayLayerMap) {
    if (overlayLayerMap[key] === e.layer) {
      const btn = document.querySelector(`.layer-toggle-btn[data-layer="${key}"]`);
      if (btn) btn.classList.remove('active');
    }
  }
});

/* ==========================================================================
   4. 지도 좌측 하단 인프라 격차 종합 진단 인포패널
   ========================================================================== */

const dashboardControl = L.control({ position: 'bottomleft' });
dashboardControl.onAdd = function() {
  const div = L.DomUtil.create('div', 'infra-mini-dashboard');
  div.innerHTML = `
    <div class="dash-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>📊 전국 18대 인프라 격차 진단</span>
    </div>
    <div class="dash-grid" id="dashboardStatsGrid">
      <div class="dash-stat">
        <span class="dash-stat-label">🚑 응급실 도달시간</span>
        <span class="dash-stat-val text-red">54분 <small>(수도권 8분)</small></span>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-label">🔥 도시가스 보급률</span>
        <span class="dash-stat-val text-amber">14.2% <small>(수도권 91%)</small></span>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-label">📉 평균 소멸위험지수</span>
        <span class="dash-stat-val text-purple">0.14 <small>(초고위험군)</small></span>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-label">👶 분만 산부인과</span>
        <span class="dash-stat-val text-red">0개소 <small>(원정 1시간+)</small></span>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-label">🚌 버스 평균 배차</span>
        <span class="dash-stat-val text-blue">110분 <small>(수도권 9분)</small></span>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-label">🏦 시중은행 지점</span>
        <span class="dash-stat-val text-purple">0개소 <small>(단위농협 의존)</small></span>
      </div>
    </div>
  `;
  return div;
};
dashboardControl.addTo(map);

map.fitBounds(koreaBounds);

// 마커 관리 변수
let currentMarker = null;
let categoryMarkers = [];

// 마커 클러스터 그룹 (핀 겹침 방지)
const markerClusterGroup = L.markerClusterGroup({
  maxClusterRadius: 45,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true,
  disableClusteringAtZoom: 13,
  iconCreateFunction: function(cluster) {
    const count = cluster.getChildCount();
    let size = 'small';
    let dim = 36;
    if (count >= 10) { size = 'large'; dim = 48; }
    else if (count >= 5) { size = 'medium'; dim = 42; }
    return L.divIcon({
      html: `<div class="cluster-pin-icon"><span>${count}</span></div>`,
      className: 'custom-cluster-icon ' + size,
      iconSize: L.point(dim, dim)
    });
  }
});
map.addLayer(markerClusterGroup);

// 다중 토글 관리 Set (활성화된 카테고리 저장)
let activeCategoryKeys = new Set(['all']);

/**
 * 커스텀 이모지 핀 아이콘 생성
 */
function createCategoryIcon(emoji) {
  return L.divIcon({
    className: 'custom-emoji-pin',
    html: `<div style="background: rgba(255,255,255,0.95); backdrop-filter: blur(12px); border: 2px solid #007aff; border-radius: 50%; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 8px 20px rgba(0,0,0,0.25);">${emoji}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19]
  });
}

/**
 * 소외지역 종합 정보 팝업 HTML 생성
 */
function buildComprehensivePopupContent(regionObj) {
  let html = `
    <div style="font-size: 12.5px; line-height: 1.45; min-width: 275px; max-height: 340px; overflow-y: auto; padding: 4px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <b style="color: #007aff; font-size: 14.5px;">${regionObj.emoji} ${regionObj.name}</b>
        <span style="font-size: 10.5px; background: rgba(255,59,48,0.12); color: #ff3b30; font-weight: 700; padding: 2px 6px; border-radius: 6px;">${regionObj.deficitScore || '취약지구'}</span>
      </div>
      <span style="color: #515156; font-size: 11.5px;">👥 인구수: <b>${regionObj.pop}</b></span>
      <hr style="margin: 6px 0; border:0; border-top:1px solid rgba(0,0,0,0.1);">
      <div style="font-weight: 700; color: #ff3b30; margin-bottom: 4px;">🔍 18대 인프라 소외 정보 종합</div>
  `;

  for (let infraKey in regionObj.allInfra) {
    html += `<div style="margin-bottom: 3px;">• <b>${infraKey}:</b> ${regionObj.allInfra[infraKey]}</div>`;
  }

  html += `
      <hr style="margin: 6px 0; border:0; border-top:1px solid rgba(0,0,0,0.1);">
      ⚡ <b style="color: #34c759;">실시간 상태:</b> ${regionObj.liveStatus}
    </div>
  `;
  return html;
}

/**
 * 카테고리 버튼 ON/OFF 자유 토글 함수
 */
function toggleCategory(catKey, catName, emoji, event) {
  const btn = event ? event.currentTarget : document.querySelector(`.filter-tab[data-cat="${catKey}"]`);
  
  if (catKey === 'all') {
    // '전체 보기' 클릭 시:
    if (activeCategoryKeys.has('all')) {
      // 이미 전체 보기가 켜져 있을 때 다시 누르면: 전체 끄기 (OFF)
      activeCategoryKeys.clear();
      updateAllTabsUI();
      renderFilteredRegions();
      return;
    } else {
      // 켜기 (ON): 모든 개별 필터를 초기화하고 전체 켜기
      activeCategoryKeys.clear();
      activeCategoryKeys.add('all');
      updateAllTabsUI();
      renderFilteredRegions();
      return;
    }
  }

  // 개별 카테고리 클릭 시:
  activeCategoryKeys.delete('all');

  if (activeCategoryKeys.has(catKey)) {
    // 1) 이미 켜져 있던 버튼 -> 끄기 (OFF)
    activeCategoryKeys.delete(catKey);
  } else {
    // 2) 꺼져 있던 버튼 -> 켜기 (ON)
    activeCategoryKeys.add(catKey);
  }

  // 3) 만약 모든 개별 버튼을 다 껐다면 -> 완전히 빈 상태(모두 OFF) 유지
  updateAllTabsUI();
  renderFilteredRegions();
}

/**
 * 탭 버튼들의 ON / OFF UI 스타일 및 뱃지 업데이트
 */
function updateAllTabsUI() {
  document.querySelectorAll('.filter-tab').forEach(tab => {
    const key = tab.getAttribute('data-cat');
    const pill = tab.querySelector('.tab-toggle-pill');

    if (activeCategoryKeys.has(key)) {
      tab.classList.add('active');
      if (pill) pill.innerText = 'ON';
    } else {
      tab.classList.remove('active');
      if (pill) pill.innerText = 'OFF';
    }
  });
}

/**
 * 현재 활성화(ON)된 카테고리들에 맞게 소외지역 목록 및 마커 렌더링
 */
// 동적 실시간 지도 반영 레이어 그룹
const dynamicInfraLayerGroup = L.layerGroup().addTo(map);
const liveRegionBufferGroup = L.layerGroup().addTo(map);

// 현재 지도에 실시간 반영(ON)된 인프라 키 Set
let activeInfraFilterKeys = new Set();

// 현재 선택된 소외지역 인덱스 (기본: 0 경북 영양군)
let selectedRegionIndex = 0;

// 13대 인프라별 시각화 색상 및 분석 데이터 매핑
const infraVisualizationConfig = {
  "🚨 응급의료": { color: "#ff3b30", radius: 30000, layerKey: "emergency", title: "응급의료 골든타임 사각지대 (30km)" },
  "🚆 교통/철도": { color: "#ff9500", radius: 25000, layerKey: "transit", title: "광역교통·철도 단절 취약축" },
  "📚 교육": { color: "#007aff", radius: 20000, title: "학령인구 급감 교육 인프라 취약지대" },
  "🎭 문화/체육": { color: "#af52de", radius: 22000, title: "문화·예술·체육 시설 전무 권역" },
  "🚒 소방/안전": { color: "#ff6900", radius: 20000, title: "소방 7분 골든타임 취약 권역" },
  "🏠 복지/돌봄": { color: "#ff2d55", radius: 22000, title: "취약계층 및 독거노인 돌봄 공백지구" },
  "📡 통신/디지털": { color: "#5ac8fa", radius: 24000, title: "5G 및 디지털 통신 음영 지대" },
  "💧 상수도/물": { color: "#32ade6", radius: 26000, layerKey: "energy", title: "광역상수도 미보급·지하수 의존구역" },
  "⚡ 에너지/난방": { color: "#34c759", radius: 28000, layerKey: "energy", title: "도시가스 배관 미보급 권역" },
  "🛒 생활/상권": { color: "#ffcc00", radius: 20000, title: "대형 쇼핑 및 생활필수 상권 부재" },
  "🌲 환경/생태": { color: "#30d158", radius: 22000, title: "농어촌 생태 친환경 정비 취약지구" },
  "💼 일자리/산업": { color: "#5856d6", radius: 25000, title: "청년 일자리 및 산업단지 부재축" },
  "📉 소멸위험": { color: "#bf5af2", radius: 26000, layerKey: "extinction", title: "지방소멸 고위험 권역 (소멸지수 < 0.2)" }
};

/**
 * 실시간 지도 반영 토스트 알림 표시
 */
function showLiveMapToast(msg) {
  const toast = document.getElementById('liveMapToast');
  if (!toast) return;
  toast.innerHTML = msg;
  toast.classList.add('show');
  if (window._toastTimeout) clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

/**
 * 패널 내 13대 핵심 인프라 버튼 목록 HTML 생성
 */
function buildStandard13ListHTML() {
  if (typeof standardInfra13 === 'undefined') return '';
  return Object.entries(standardInfra13).map(([name, desc]) => {
    const isActive = activeInfraFilterKeys.has(name) ? 'active' : '';
    const badgeText = activeInfraFilterKeys.has(name) ? '반영 ON 🟢' : '지도 반영 📍';
    return `
      <button class="infra-action-btn ${isActive}" data-infra="${name}" onclick="toggleInfraOnMap('${name}')">
        <div class="infra-btn-left">
          <span class="infra-13-name">${name}</span>
          <span class="infra-13-desc">${desc}</span>
        </div>
        <span class="infra-btn-badge">${badgeText}</span>
      </button>
    `;
  }).join('');
}

/**
 * 특정 지역의 13대 인프라 실시간 정밀 결핍 진단 카드 HTML 생성
 */
function buildRegionLiveInspectionHTML(region) {
  if (!region) return '';

  let infraItemsHTML = '';
  if (typeof standardInfra13 !== 'undefined') {
    for (let key in standardInfra13) {
      const specificDesc = (region.allInfra && region.allInfra[key]) 
        ? region.allInfra[key] 
        : standardInfra13[key];
      const isFiltered = activeInfraFilterKeys.has(key);
      const activeBorder = isFiltered ? 'border: 1.5px solid var(--apple-blue); background: rgba(0,122,255,0.06);' : '';

      infraItemsHTML += `
        <div class="infra-13-item" style="${activeBorder}">
          <span class="infra-13-name">${key}</span>
          <span class="infra-13-desc">${specificDesc}</span>
        </div>
      `;
    }
  }

  return `
    <div class="region-detail-card">
      <div class="panel-card-header" style="border-bottom-color: rgba(0, 122, 255, 0.2);">
        <div class="panel-card-title" style="color: #007aff; font-size: 13.5px;">
          <span style="font-size: 15px;">${region.emoji}</span>
          <b>${region.name}</b>
        </div>
        <span class="live-pulse-badge">실시간 진단</span>
      </div>
      <div style="font-size:11px; color:#515156; display:flex; justify-content:space-between; margin-top:2px;">
        <span>👥 ${region.pop}</span>
        <b style="color:#ff3b30;">${region.deficitScore || '고위험 소외'}</b>
      </div>
      <div style="font-size:10.5px; background:rgba(0,122,255,0.08); padding:5px 8px; border-radius:8px; color:#007aff; font-weight:700;">
        ⚡ <b>실시간 상태:</b> ${region.liveStatus || '정상 스트림 수신 중'}
      </div>
      <div class="panel-section-title" style="margin-top:6px;">
        <span>📊 13대 인프라 실시간 결핍 현황</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:4px; max-height:200px; overflow-y:auto; padding-right:2px;">
        ${infraItemsHTML}
      </div>
    </div>
  `;
}

let areCategoryPinsVisible = true;

/**
 * 지도에 표시된 핀(마커) 숨기기
 */
function hideCategoryMarkersOnMap() {
  areCategoryPinsVisible = false;
  markerClusterGroup.clearLayers();
  updatePinToggleBtnUI();
}

/**
 * 지도에 표시된 핀(마커) 다시 보이기
 */
function showCategoryMarkersOnMap() {
  areCategoryPinsVisible = true;
  markerClusterGroup.addLayers(categoryMarkers);
  updatePinToggleBtnUI();
}

/**
 * 지도 핀 숨김 / 표시 토글
 */
function toggleCategoryPins() {
  if (areCategoryPinsVisible) {
    hideCategoryMarkersOnMap();
    showLiveMapToast('📍 지도에 표시된 핀을 숨겼습니다.');
  } else {
    showCategoryMarkersOnMap();
    showLiveMapToast('📌 지도에 핀을 다시 표시했습니다.');
  }
}

/**
 * 핀 토글 버튼 UI 텍스트 갱신
 */
function updatePinToggleBtnUI() {
  const btn = document.getElementById('pinToggleBtn');
  if (btn) {
    btn.innerHTML = areCategoryPinsVisible 
      ? '<span>📌 핀 숨기기</span>' 
      : '<span style="color:#ff3b30;">📍 핀 표시하기</span>';
    btn.classList.toggle('active', !areCategoryPinsVisible);
  }
}

/**
 * 13대 인프라 버튼 클릭 시 지도에 실시간 시각화 반영 (ON/OFF 토글)
 * (패널에서 해당 버튼을 누르면 지도에 표시된 핀 숨김 처리)
 */
function toggleInfraOnMap(infraKey) {
  const btn = document.querySelector(`.infra-action-btn[data-infra="${infraKey}"]`);
  
  if (activeInfraFilterKeys.has(infraKey)) {
    // 끄기 (OFF)
    activeInfraFilterKeys.delete(infraKey);
    if (btn) {
      btn.classList.remove('active');
      const badge = btn.querySelector('.infra-btn-badge');
      if (badge) badge.innerText = '지도 반영 📍';
    }
    showLiveMapToast(`🔌 <b>${infraKey}</b> 지표 지도 표시를 해제했습니다.`);
    // 모든 인프라 버튼이 해제되면 지도 핀 복원
    if (activeInfraFilterKeys.size === 0) {
      showCategoryMarkersOnMap();
    }
  } else {
    // 켜기 (ON)
    activeInfraFilterKeys.add(infraKey);
    if (btn) {
      btn.classList.add('active');
      const badge = btn.querySelector('.infra-btn-badge');
      if (badge) badge.innerText = '반영 ON 🟢';
    }
    // 사용자의 요청: 패널에서 해당 버튼 누르면 지도에 표시된 핀 숨김
    hideCategoryMarkersOnMap();
    // Add emoji marker for the selected infra button
    const region = allRegionsComprehensiveData[selectedRegionIndex] || allRegionsComprehensiveData[0];
    const emoji = extractInfraEmoji(infraKey);
    if (region && emoji) {
        addEmojiMarker(region.lat, region.lng, emoji);
    }
    showLiveMapToast(`⚡ <b>${infraKey}</b> 현황 반영 (지도 핀 숨김)`);
  }

  // 실시간 지도 동적 시각화 갱신
  refreshDynamicInfraLayers();

  // 패널의 선택 지역 진단 카드도 상태 갱신
  const currentRegion = (typeof window !== 'undefined' && window.currentActiveInspectedRegion) 
    ? window.currentActiveInspectedRegion 
    : (allRegionsComprehensiveData[selectedRegionIndex] || allRegionsComprehensiveData[0]);
  const liveContainer = document.getElementById('liveInspectionContainer');
  if (liveContainer) {
    liveContainer.innerHTML = buildRegionLiveInspectionHTML(currentRegion);
  }
}

/**
 * 활성화된 인프라 지표들을 지도에 실시간 레이어로 시각화
 */
function refreshDynamicInfraLayers() {
  dynamicInfraLayerGroup.clearLayers();

  if (activeInfraFilterKeys.size === 0) {
    return;
  }

  let bounds = [];

  activeInfraFilterKeys.forEach(infraKey => {
    const config = infraVisualizationConfig[infraKey] || { color: '#007aff', radius: 24000, title: infraKey };

    // 1) allRegionsComprehensiveData에서 해당 인프라가 취약한 지역들에 반경 버퍼 원 시각화
    allRegionsComprehensiveData.forEach(region => {
      if (region.allInfra && region.allInfra[infraKey]) {
        bounds.push([region.lat, region.lng]);

        const circle = L.circle([region.lat, region.lng], {
          radius: config.radius,
          color: config.color,
          weight: 2.5,
          opacity: 0.9,
          fillColor: config.color,
          fillOpacity: 0.22,
          dashArray: '6, 6'
        });

        circle.bindTooltip(`
          <div style="font-size:12px; font-weight:700; line-height:1.4;">
            <span style="color:${config.color}; font-size:12.5px;">${infraKey}</span> 취약 권역<br>
            📍 <b>${region.name}</b><br>
            <span style="font-size:11px; font-weight:500; color:#515156;">${region.allInfra[infraKey]}</span>
          </div>
        `, { sticky: true });

        dynamicInfraLayerGroup.addLayer(circle);
      }
    });

    // 2) 매핑된 기존 전문 분석 레이어가 있으면 함께 활성화
    if (config.layerKey && overlayLayerMap[config.layerKey]) {
      if (!map.hasLayer(overlayLayerMap[config.layerKey])) {
        map.addLayer(overlayLayerMap[config.layerKey]);
        const toggleBtn = document.querySelector(`.layer-toggle-btn[data-layer="${config.layerKey}"]`);
        if (toggleBtn) toggleBtn.classList.add('active');
      }
    }
  });

  if (bounds.length > 0) {
    map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 9 });
  }
}

/**
 * 좌측 패널 렌더링 및 실시간 조회 연동
 */
function renderFilteredRegions() {
  // 기존 마커 초기화
  markerClusterGroup.clearLayers();
  categoryMarkers = [];

  const itemSidebar = document.getElementById('categoryItemSidebar');

  // 마커 생성 (areCategoryPinsVisible 상태 반영)
  allRegionsComprehensiveData.forEach((region, index) => {
    const marker = L.marker([region.lat, region.lng], { icon: createCategoryIcon(region.emoji) });
    marker.bindPopup(buildComprehensivePopupContent(region));
    marker.on('click', () => {
      selectAndInspectRegion(index, false);
    });
    categoryMarkers.push(marker);
  });
  if (areCategoryPinsVisible) {
    markerClusterGroup.addLayers(categoryMarkers);
  }

  if (!itemSidebar) return;

  const currentRegion = (typeof window !== 'undefined' && window.currentActiveInspectedRegion)
    ? window.currentActiveInspectedRegion
    : (allRegionsComprehensiveData[selectedRegionIndex] || allRegionsComprehensiveData[0]);

  let panelHTML = `
    <!-- 패널 상단 타이틀 및 지도 핀 숨김/표시 원터치 버튼 -->
    <div class="sidebar-title" style="justify-content:space-between; align-items:center;">
      <span style="font-size:12px; font-weight:800;">📋 13대 인프라 실시간 진단</span>
      <div style="display:flex; align-items:center; gap:5px;">
        <button class="pin-toggle-btn ${!areCategoryPinsVisible ? 'active' : ''}" id="pinToggleBtn" onclick="toggleCategoryPins()" title="지도 핀 숨김 / 표시 토글">
          ${areCategoryPinsVisible ? '<span>📌 핀 숨기기</span>' : '<span style="color:#ff3b30;">📍 핀 표시</span>'}
        </button>
        <button class="pin-toggle-btn" onclick="toggleSidebarPanel()" title="패널 숨기기 / 펼치기" style="border-color: rgba(0,122,255,0.3); color: #007aff; background: rgba(0,122,255,0.08); font-weight:700; padding: 4px 8px;">
          <span>◀ 패널 숨김</span>
        </button>
        <span class="live-pulse-badge">LIVE</span>
      </div>
    </div>

    <!-- 📊 전국 18대 인프라 격차 진단 종합 요약 카드 (통일된 카드 창 UI) -->
    <div class="national-gap-summary-card">
      <div class="gap-card-header panel-card-header" style="border-bottom-color: rgba(220, 38, 38, 0.18);">
        <div class="panel-card-title">
          <span style="font-size:13px;">📊</span>
          <b>전국 18대 인프라 격차 진단</b>
        </div>
        <span class="gap-alert-tag">격차 심각</span>
      </div>
      <div class="gap-stat-grid">
        <div class="gap-stat-cell">
          <span class="gap-label">🚨 응급실 도달시간</span>
          <div class="gap-value-row">
            <b class="gap-main-val">54분</b>
            <span class="gap-sub-val">(수도권 3분)</span>
          </div>
        </div>
        <div class="gap-stat-cell">
          <span class="gap-label">📉 평균 소멸위험지수</span>
          <div class="gap-value-row">
            <b class="gap-main-val danger">0.14</b>
            <span class="gap-sub-val danger">(초고위험)</span>
          </div>
        </div>
        <div class="gap-stat-cell">
          <span class="gap-label">🚆 버스 평균 배차</span>
          <div class="gap-value-row">
            <b class="gap-main-val">110분</b>
            <span class="gap-sub-val">(수도권 9분)</span>
          </div>
        </div>
        <div class="gap-stat-cell">
          <span class="gap-label">⚡ 도시가스 보급률</span>
          <div class="gap-value-row">
            <b class="gap-main-val">14.2%</b>
            <span class="gap-sub-val">(수도권 91%)</span>
          </div>
        </div>
        <div class="gap-stat-cell">
          <span class="gap-label">👶 분만 산부인과</span>
          <div class="gap-value-row">
            <b class="gap-main-val danger">0개소</b>
            <span class="gap-sub-val danger">(원정 1시간)</span>
          </div>
        </div>
        <div class="gap-stat-cell">
          <span class="gap-label">🏦 시중은행 지점</span>
          <div class="gap-value-row">
            <b class="gap-main-val danger">0개소</b>
            <span class="gap-sub-val danger">(단위농협 의존)</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ⚡ 13대 인프라 지도 실시간 반영 카드 (통일된 카드 창 UI) -->
    <div class="panel-card-window">
      <div class="panel-card-header">
        <div class="panel-card-title">
          <span style="font-size:13px;">⚡</span>
          <b>13대 인프라 지도 실시간 반영</b>
        </div>
        <span class="panel-card-tag blue">클릭 시 지도 연동</span>
      </div>
      <div style="font-size:10.5px; color:#6e6e73; padding: 0 1px;">
        항목 클릭 시 해당 인프라의 사각지대 권역을 지도에 즉시 표시합니다.
      </div>
      <div class="panel-card-scroll-body" style="max-height: 185px;">
        ${buildStandard13ListHTML()}
      </div>
    </div>

    <!-- 🚨 실시간 선택 지역 정밀 진단 영역 (통일된 카드 창 UI) -->
    <div id="liveInspectionContainer">
      ${buildRegionLiveInspectionHTML(currentRegion)}
    </div>

    <!-- 🗺️ 전국 18대 취약지역 선택 카드 (통일된 카드 창 UI) -->
    <div class="panel-card-window">
      <div class="panel-card-header">
        <div class="panel-card-title">
          <span style="font-size:13px;">🗺️</span>
          <b>전국 취약지역 선택</b>
        </div>
        <span class="panel-card-tag purple">${allRegionsComprehensiveData.length}개 시·군</span>
      </div>
      <div style="font-size:10.5px; color:#6e6e73; padding: 0 1px;">
        지역 클릭 시 지도 중심 이동 및 해당 지역 인프라가 실시간 진단됩니다.
      </div>
      <div class="panel-card-scroll-body" style="max-height: 180px;" id="regionCardsList">
  `;

  allRegionsComprehensiveData.forEach((region, index) => {
    const isActive = index === selectedRegionIndex ? 'active-region-card' : '';
    panelHTML += `
      <div class="cat-item-card ${isActive}" onclick="selectAndInspectRegion(${index}, true)">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span>${region.emoji} <b>${region.name}</b></span>
          <span style="font-size:10px; color:#ff3b30; font-weight:700;">${region.deficitScore ? region.deficitScore.split(' ')[1] || '취약' : '취약'}</span>
        </div>
      </div>
    `;
  });

  panelHTML += `
      </div>
    </div>
  `;
  itemSidebar.innerHTML = panelHTML;
  map.setView([35.9, 127.8], 7);
}

/**
 * 지역 선택 시 실시간 13대 인프라 조회 및 지도 포커스 & 버퍼 표시
 */
function selectAndInspectRegion(index, shouldMoveMap = true) {
  selectedRegionIndex = index;
  const region = allRegionsComprehensiveData[index];
  if (!region) return;

  // 전역 활성 지역 저장 및 검색 인풋 동기화
  window.currentActiveInspectedRegion = region;
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = region.name;

  // 1) 좌측 패널 실시간 진단 카드 업데이트
  const liveContainer = document.getElementById('liveInspectionContainer');
  if (liveContainer) {
    liveContainer.innerHTML = buildRegionLiveInspectionHTML(region);
  }

  // 2) 리스트 카드 활성 상태 업데이트
  document.querySelectorAll('#regionCardsList .cat-item-card').forEach((card, idx) => {
    if (idx === index) {
      card.classList.add('active-region-card');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      card.classList.remove('active-region-card');
    }
  });

  // 3) 지도 위에 해당 지역 전용 실시간 취약 반경 버퍼 원 표시
  liveRegionBufferGroup.clearLayers();
  const focusCircle = L.circle([region.lat, region.lng], {
    radius: 28000,
    color: '#007aff',
    weight: 3,
    opacity: 0.95,
    fillColor: '#007aff',
    fillOpacity: 0.16,
    dashArray: '8, 6'
  });
  focusCircle.bindTooltip(`📍 <b>${region.name}</b><br><span style="color:#007aff; font-weight:700;">13대 인프라 실시간 진단 구역</span><br>${region.deficitScore || ''}`, { sticky: true });
  liveRegionBufferGroup.addLayer(focusCircle);

  // 4) 지도 이동 및 팝업 열기 (클러스터 해제 줌에서 핀 직접 표시)
  if (categoryMarkers[index] && !markerClusterGroup.hasLayer(categoryMarkers[index])) {
    markerClusterGroup.addLayer(categoryMarkers[index]);
  }

  if (shouldMoveMap) {
    map.flyTo([region.lat, region.lng], 13, { duration: 1.2 });
  }
  // 클러스터 해제 후 팝업 열기 (약간의 딜레이)
  setTimeout(() => {
    if (categoryMarkers[index]) {
      markerClusterGroup.zoomToShowLayer(categoryMarkers[index], () => {
        categoryMarkers[index].openPopup();
      });
    }
  }, shouldMoveMap ? 1300 : 100);

  // 5) 실시간 지도 반영 알림 토스트 표시
  showLiveMapToast(`📍 <b>${region.name}</b> 13대 인프라가 지도에 실시간 반영되었습니다!`);
}

/**
 * 특정 마커로 지도 포커스 및 팝업 열기 (기존 호환)
 */
function focusAndOpenMarker(lat, lng, markerIndex) {
  selectAndInspectRegion(markerIndex, true);
}

/**
 * 초기 상태 및 하위 호환 함수들
 */
function selectAllCategories(event) {
  renderFilteredRegions();
}

function selectCategory(catKey, catName, emoji, event) {
  renderFilteredRegions();
}

/* ==========================================================================
   5. 모든 기기(모바일/태블릿/데스크톱) 대응 크기 조절 및 뷰 전환 시스템
   ========================================================================== */

let isPanelTransitioning = false;
let panelTransitionTimer = null;

/**
 * 데스크톱/태블릿: 좌측 패널 접기 / 펼치기 토글 (지도 지지직거림 100% 원천 차단 무지연 슬라이드)
 */
function toggleSidebarPanel() {
  // 모바일 화면에서는 지도 화면으로 전환
  if (window.innerWidth <= 768) {
    if (typeof switchMobileView === 'function') {
      switchMobileView('map');
      return;
    }
  }

  const panel = document.getElementById('categoryItemSidebar');
  const wrapper = document.getElementById('sidebarWrapper');
  const layout = document.querySelector('.content-layout');
  const icon = document.getElementById('panelToggleIcon');

  if (!panel || !layout) return;

  // 1) 패널 슬라이딩 중 지도 연쇄 렌더링 충돌(지지직거림) 방지 락 활성화
  isPanelTransitioning = true;
  if (panelTransitionTimer) clearTimeout(panelTransitionTimer);

  const isCollapsed = panel.classList.toggle('collapsed');
  if (wrapper) wrapper.classList.toggle('collapsed', isCollapsed);
  layout.classList.toggle('sidebar-collapsed', isCollapsed);

  if (icon) {
    icon.innerText = isCollapsed ? '▶' : '◀';
  }

  // 2) 패널 슬라이드 애니메이션(0.35s)이 완벽히 끝난 직후 단 한 번만 뷰포트 크기를 매끄럽게 동기화
  panelTransitionTimer = setTimeout(() => {
    isPanelTransitioning = false;
    if (map) {
      map.invalidateSize({ pan: false, debounceMoveend: true });
    }
  }, 360);

  if (isCollapsed) {
    showLiveMapToast('🗺️ 지도가 전체 화면으로 부드럽게 확장되었습니다.');
  } else {
    showLiveMapToast('📋 13대 진단 패널이 표시되었습니다.');
  }
}

/**
 * 모바일/스마트폰: [지도 화면]과 [13대 진단 패널] 간 원터치 뷰 전환
 */
function switchMobileView(viewMode) {
  document.body.classList.remove('mobile-mode-map', 'mobile-mode-panel');
  document.body.classList.add(viewMode === 'map' ? 'mobile-mode-map' : 'mobile-mode-panel');

  const tabMapBtn = document.getElementById('tabMapBtn');
  const tabPanelBtn = document.getElementById('tabPanelBtn');

  if (tabMapBtn && tabPanelBtn) {
    if (viewMode === 'map') {
      tabMapBtn.classList.add('active');
      tabPanelBtn.classList.remove('active');
    } else {
      tabMapBtn.classList.remove('active');
      tabPanelBtn.classList.add('active');
    }
  }

  // 지도 크기 보정
  if (viewMode === 'map') {
    setTimeout(() => {
      map.invalidateSize();
    }, 150);
  }
}

// ==========================================================================
// [자동 크기 및 위치 조정 엔진] 화면 크기 및 브라우저 확대/축소(Zoom) 실시간 감지 & 자동 위치 보정 시스템
// ==========================================================================

let layoutAdjustmentTimer = null;
let lastRecordedCenter = null;

/**
 * 화면 크기(Resize) 및 브라우저 확대/축소(Zoom) 감지 시 자동으로 지도 및 패널 위치를 완벽하게 재조정
 * @param {string} triggerSource 감지된 트리거 원인 ('resize' | 'zoom' | 'viewport' | 'observer' | 'init')
 */
function triggerAutoLayoutAdjustment(triggerSource = 'resize') {
  // 패널 슬라이딩 애니메이션 도중에는 지도를 흔들지 않도록 안전 보호 (지지직거림 방지)
  if (isPanelTransitioning) return;

  if (layoutAdjustmentTimer) {
    cancelAnimationFrame(layoutAdjustmentTimer);
  }

  layoutAdjustmentTimer = requestAnimationFrame(() => {
    if (isPanelTransitioning) return;
    const windowWidth = window.innerWidth;

    // 1. 지도 인스턴스 뷰포트 크기 자동 보정 (옆으로 튕기는 Snap 현상 100% 원천 차단)
    if (typeof map !== 'undefined' && map) {
      // pan: false로 뷰포트만 자연스럽게 갱신하고, 인위적인 panTo 강제 순간이동(튕김 현상)을 일체 호출하지 않음
      map.invalidateSize({ pan: false, debounceMoveend: true });

      // 열려 있는 팝업 위치 자동 보정
      if (map._popup && map._popup.isOpen()) {
        map._popup.update();
      }
    }

    // 2. 모바일 / 태블릿 / 데스크톱 반응형 뷰 모드 및 패널/화살표 위치 자동 재정렬
    if (windowWidth <= 768) {
      if (!document.body.classList.contains('mobile-mode-map') && !document.body.classList.contains('mobile-mode-panel')) {
        switchMobileView('map');
      }
    } else {
      document.body.classList.remove('mobile-mode-map', 'mobile-mode-panel');
      const mobileTabs = document.getElementById('mobileViewTabs');
      if (mobileTabs) mobileTabs.style.display = 'none';

      const sidebarWrapper = document.getElementById('sidebarWrapper');
      const categoryItemSidebar = document.getElementById('categoryItemSidebar');

      if (sidebarWrapper && categoryItemSidebar) {
        if (!sidebarWrapper.classList.contains('collapsed')) {
          categoryItemSidebar.style.display = 'flex';
          categoryItemSidebar.style.opacity = '1';
          categoryItemSidebar.style.transform = 'translate3d(0, 0, 0)';
        }
      }
    }

    // 3. 검색 자동완성 목록 위치 보정
    const searchInput = document.getElementById('searchInput');
    const autocompleteList = document.getElementById('autocompleteList');
    if (searchInput && autocompleteList && autocompleteList.style.display === 'block') {
      const rect = searchInput.getBoundingClientRect();
      autocompleteList.style.top = `${rect.bottom + 6}px`;
    }

    // 4. 상단 인프라 퀵 토글 바 스크롤 경계 보정
    const quickToggles = document.querySelector('.map-quick-toggles');
    if (quickToggles && quickToggles.scrollLeft > 0) {
      quickToggles.scrollLeft = Math.min(quickToggles.scrollLeft, quickToggles.scrollWidth - quickToggles.clientWidth);
    }
  });
}

/**
 * 브라우저 확대/축소(Zoom), 창 크기 변경(Resize), 뷰포트 스케일 변화 통합 감지기 초기화
 */
function initAutoLayoutAndZoomEngine() {
  // 1. 브라우저 창 크기 변경 감지
  window.addEventListener('resize', () => {
    triggerAutoLayoutAdjustment('resize');
  }, { passive: true });

  // 2. 브라우저 확대/축소(Ctrl +, Ctrl -, 마우스 휠 줌) DPR 변화 감지기 (체인 리스너)
  function registerDprZoomWatcher() {
    const dpr = window.devicePixelRatio || 1;
    const mediaQuery = window.matchMedia(`(resolution: ${dpr}dppx)`);

    const handleDprChange = () => {
      triggerAutoLayoutAdjustment('zoom');
      registerDprZoomWatcher(); // 다음 줌 레벨 변경 감지를 위해 재등록
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDprChange, { once: true });
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleDprChange);
    }
  }
  registerDprZoomWatcher();

  // 3. 모바일/태블릿 핀치 줌 및 비주얼 뷰포트 크기 변화 실시간 감지
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      triggerAutoLayoutAdjustment('viewport');
    }, { passive: true });

    window.visualViewport.addEventListener('scroll', () => {
      triggerAutoLayoutAdjustment('viewport');
    }, { passive: true });
  }

  // 4. DOM 요소 실시간 렌더링 크기 감지 (ResizeObserver) - 최상위 레이아웃 컨테이너만 정밀 관찰
  if (window.ResizeObserver) {
    const layoutObserver = new ResizeObserver(() => {
      // 패널 접힘/펼침 애니메이션 중에는 옵저버 트리거 방지
      if (!isPanelTransitioning) {
        triggerAutoLayoutAdjustment('observer');
      }
    });

    const targetLayout = document.querySelector('.content-layout');
    if (targetLayout) layoutObserver.observe(targetLayout);
  }

  // 5. 사용자가 지도를 직접 조작했을 때 마지막 중심 좌표 갱신
  if (typeof map !== 'undefined' && map) {
    map.on('moveend', () => {
      if (!isPanelTransitioning) {
        lastRecordedCenter = map.getCenter();
      }
    });
  }

  // 6. 초기 실행
  if (window.innerWidth <= 768) {
    switchMobileView('map');
  } else {
    triggerAutoLayoutAdjustment('init');
  }
}

// ==========================================================================
// 13대 인프라 항목별 맞춤 이모지 및 데이터 자동 연동 시스템
// ==========================================================================

// 1. 13대 인프라 데이터 원본 사전 (이모지 및 기본 상세 설명 매핑)
const infraDataDict = {
  "응급의료": { emoji: "🚨", desc: "응급실 부재 (반경 30km 내 종합병원 전무)" },
  "교통/철도": { emoji: "🚆", desc: "철도 노선 무(無), 버스 배차 120분 이상" },
  "교육": { emoji: "📚", desc: "학령인구 급감으로 분교 통합 및 통학버스 의존" },
  "문화/체육": { emoji: "🎭", desc: "영화관·공공수영장 전무" },
  "소방/안전": { emoji: "🚒", desc: "골든타임(7분) 도달률 38% 최하위" },
  "복지/돌봄": { emoji: "🏠", desc: "독거노인 비율 42% 돌봄 인력 부족" },
  "통신/디지털": { emoji: "📡", desc: "산간 오지 5G 음영 및 중계기 부족" },
  "상수도/물": { emoji: "💧", desc: "지방상수도 보급률 62% 지하수 의존" },
  "에너지/난방": { emoji: "⚡", desc: "도시가스 공급률 0%, 등유·LPG 의존" },
  "생활/상권": { emoji: "🛒", desc: "대형마트·프랜차이즈 병원 전무" },
  "환경/생태": { emoji: "🌲", desc: "산간 급경사 폐기물 수거 주기 김" },
  "일자리/산업": { emoji: "💼", desc: "청년 고용 인프라 및 산단 부재" },
  "소멸위험": { emoji: "📉", desc: "인구 소멸 고위험 지역" }
};

// 2. 지역별 및 카테고리별 맞춤 이모지 핀 일괄 생성 및 지도 반영 함수
function addInfraPinToMap(mapInstance, lat, lng, regionName, categoryKey, customDesc) {
  const targetData = infraDataDict[categoryKey] || { emoji: "📍", desc: customDesc || "상세 정보 없음" };
  const description = customDesc || targetData.desc;

  const emojiIcon = L.divIcon({
    className: 'custom-infra-emoji-marker',
    html: `
      <div style="
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1.5px solid #007aff;
        border-radius: 20px;
        padding: 5px 12px;
        box-shadow: 0 6px 20px rgba(0, 122, 255, 0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif;
        white-space: nowrap;
        cursor: pointer;
      ">
        <span style="font-size: 15px;">${targetData.emoji}</span>
        <div style="display: flex; flex-direction: column; text-align: left;">
          <span style="font-size: 11px; font-weight: 800; color: #1d1d1f;">${regionName} - ${categoryKey}</span>
          <span style="font-size: 9.5px; font-weight: 600; color: #515156;">${description}</span>
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [20, 20]
  });

  return L.marker([lat, lng], { icon: emojiIcon }).addTo(mapInstance);
}

// 화면 크기 및 브라우저 확대/축소 자동 감지 엔진 시작
initAutoLayoutAndZoomEngine();
// ==================== Emoji Marker Helpers ====================
/**
 * Create a Leaflet divIcon displaying the given emoji.
 */
function createEmojiDivIcon(emoji) {
  return L.divIcon({
    className: 'custom-emoji-pin',
    html: `<div style="background: rgba(255,255,255,0.95); backdrop-filter: blur(12px); border: 2px solid #007aff; border-radius: 50%; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 8px 20px rgba(0,0,0,0.25);">${emoji}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19]
  });
}

/**
 * Add an emoji marker to the map at the given coordinates.
 * The marker is stored in the global `categoryMarkers` array so it can be toggled.
 */
function addEmojiMarker(lat, lng, emoji) {
  const icon = createEmojiDivIcon(emoji);
  const marker = L.marker([lat, lng], { icon });
  marker.addTo(map);
  categoryMarkers.push(marker);
}

/**
 * Extract the leading emoji character from an infra key string.
 * Example: "⚡ 에너지/난방" → "⚡"
 */
function extractInfraEmoji(infraKey) {
  const match = infraKey.match(/^\p{Emoji_Presentation}|^\p{Emoji}/u);
  return match ? match[0] : '';
}
