/**
 * 🌋 실시간 지진 감지 · 재난알림 모듈
 *
 * - 데이터 (우선): 기상청 지진정보 조회서비스 (공공데이터포털 EqkInfoService)
 * - 데이터 (보조): USGS Earthquake Hazards Program (공개 GeoJSON API, CORS 허용)
 * - 감시 구역: 한반도 및 인접 해역/일본 서부/중국 동부
 * - 동작: 5분마다 폴링 → 신규 지진 발견 시 배너 + 소리 + 진동 + (허용 시) 브라우저 알림
 * - 지도: disasterEarthquakeGroup 레이어에 진앙 마커를 실시간 갱신
 *
 * ※ 참고용 정보입니다. 공식 지진속보·재난문자는 기상청/국민재난안전포털을 따르세요.
 */

(function () {
  'use strict';

  /* ------------------------------------------------------------------
     설정
  ------------------------------------------------------------------ */
  const KMA_SERVICE_KEY = '403fbc593fbab293ae2421789374bfc240df24c62b1811b886f0f22a8f90ad28';
  const KMA_BASE_URL = 'https://apis.data.go.kr/1360000/EqkInfoService';
  // CORS 프록시 목록 (브라우저에서 공공데이터 API 직접 호출 시 CORS 차단 우회)
  const CORS_PROXIES = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url='
  ];

  const QUAKE_CONFIG = {
    pollIntervalMs: 5 * 60 * 1000,    // 폴링 주기 (5분)
    fetchTimeoutMs: 12 * 1000,        // 요청 타임아웃
    lookbackDays: 7,                  // 목록에 보여줄 과거 기간
    minMagnitude: 2.5,                // 수집 최소 규모
    // 전체 감시 박스 (한반도 + 주변)
    watchBox: { minLat: 28, maxLat: 44, minLng: 119, maxLng: 137 },
    // '한반도 인근' 판정 박스 (국내 체감 가능 구역)
    koreaBox: { minLat: 32.5, maxLat: 39.5, minLng: 124, maxLng: 131.5 },
    // 알림 발동 최소 규모
    alertMinMagKorea: 2.5,            // 한반도 인근
    alertMinMagOther: 4.5,            // 그 외 지역
    recentWindowMin: 60,              // 첫 로딩 시, 이 시간(분) 이내 발생분은 즉시 알림
    maxListItems: 15
  };

  const MAJOR_CITIES = [
    ['서울', 37.5665, 126.9780], ['인천', 37.4563, 126.7052], ['수원', 37.2636, 127.0286],
    ['춘천', 37.8813, 127.7298], ['강릉', 37.7519, 128.8761], ['대전', 36.3504, 127.3845],
    ['세종', 36.4800, 127.2890], ['청주', 36.6424, 127.4890], ['전주', 35.8242, 127.1480],
    ['광주', 35.1595, 126.8526], ['대구', 35.8714, 128.6014], ['안동', 36.5684, 128.7294],
    ['포항', 36.0190, 129.3435], ['울산', 35.5384, 129.3114], ['부산', 35.1796, 129.0756],
    ['창원', 35.2285, 128.6811], ['목포', 34.8118, 126.3922], ['여수', 34.7604, 127.6622],
    ['제주', 33.4996, 126.5312], ['울릉', 37.4844, 130.9057]
  ];

  const PLACE_KO = [
    [/South Korea/gi, '대한민국'], [/North Korea/gi, '북한'], [/Korea/gi, '한국'],
    [/Japan/gi, '일본'], [/China/gi, '중국'], [/Russia/gi, '러시아'],
    [/Sea of Japan \(East Sea\)/gi, '동해'], [/Yellow Sea/gi, '황해'],
    [/East China Sea/gi, '동중국해'], [/Korea Strait/gi, '대한해협']
  ];

  /* ------------------------------------------------------------------
     상태
  ------------------------------------------------------------------ */
  let liveEvents = [];              // USGS에서 받은 실제 이벤트 (최신순)
  let simEvent = null;              // 모의 훈련용 가상 이벤트
  let simTimer = null;
  const seenIds = new Set();
  let initialized = false;
  let pollTimer = null;
  let lastOkAt = null;
  let lastError = null;
  let audioCtx = null;
  let alertHideTimer = null;
  let soundOn = true;
  const markerById = {};

  try { soundOn = localStorage.getItem('quakeSoundOn') !== '0'; } catch (e) { /* 저장소 불가 시 기본값 */ }

  /* ------------------------------------------------------------------
     유틸
  ------------------------------------------------------------------ */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function inBox(lat, lng, b) {
    return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
  }

  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function nearestCity(lat, lng) {
    let best = null;
    MAJOR_CITIES.forEach(([name, clat, clng]) => {
      const d = haversineKm(lat, lng, clat, clng);
      if (!best || d < best.km) best = { name, km: d };
    });
    return best;
  }

  function translatePlace(place) {
    let out = place || '위치 정보 없음';
    PLACE_KO.forEach(([re, ko]) => { out = out.replace(re, ko); });
    return out;
  }

  function severityOf(mag) {
    if (mag >= 5.0) return 'danger';
    if (mag >= 4.0) return 'warning';
    return 'info';
  }

  function severityLabel(sev) {
    return { danger: '강진 경보', warning: '지진 주의', info: '지진 감지' }[sev];
  }

  function severityColor(sev) {
    return { danger: '#ff3b30', warning: '#ff9500', info: '#007aff' }[sev];
  }

  function fmtClock(ms) {
    try {
      return new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date(ms));
    } catch (e) { return new Date(ms).toLocaleString('ko-KR'); }
  }

  function fmtAgo(ms) {
    const min = Math.max(0, Math.round((Date.now() - ms) / 60000));
    if (min < 1) return '방금 전';
    if (min < 60) return `${min}분 전`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  }

  /** USGS feature → 앱 내부 이벤트 */
  function normalize(f) {
    const [lng, lat, depth] = f.geometry.coordinates;
    const p = f.properties || {};
    const mag = typeof p.mag === 'number' ? p.mag : 0;
    const near = nearestCity(lat, lng);
    const korea = inBox(lat, lng, QUAKE_CONFIG.koreaBox);
    return {
      id: f.id,
      mag, lat, lng,
      depth: depth,
      time: p.time,
      placeRaw: p.place || '',
      place: translatePlace(p.place),
      url: p.url || '',
      korea,
      near,
      sev: severityOf(mag),
      simulated: false
    };
  }

  function shouldAlert(ev) {
    const min = ev.korea ? QUAKE_CONFIG.alertMinMagKorea : QUAKE_CONFIG.alertMinMagOther;
    return ev.mag >= min;
  }

  function allEvents() {
    return simEvent ? [simEvent].concat(liveEvents) : liveEvents.slice();
  }

  /* ------------------------------------------------------------------
     데이터 수신 — ① 기상청 API (우선) → ② USGS (보조/fallback)
  ------------------------------------------------------------------ */

  /** 날짜를 YYYYMMDD 형식 문자열로 변환 */
  function fmtDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${dd}`;
  }

  /** 기상청 tmEqk(발생시각) 문자열 → Unix ms */
  function parseTmEqk(s) {
    if (!s) return 0;
    // "2026/10/15 14:23:45" 또는 "20261015142345" 형태 모두 처리
    const clean = s.replace(/[\/\-]/g, '').replace(/[: ]/g, '');
    const y = +clean.slice(0, 4), mo = +clean.slice(4, 6) - 1, d = +clean.slice(6, 8);
    const h = +clean.slice(8, 10) || 0, mi = +clean.slice(10, 12) || 0, sec = +clean.slice(12, 14) || 0;
    return new Date(y, mo, d, h, mi, sec).getTime();
  }

  /** 기상청 응답 item → 앱 내부 이벤트 */
  function normalizeKma(item) {
    const lat = parseFloat(item.lat) || 0;
    const lng = parseFloat(item.lon) || 0;
    const mag = parseFloat(item.mt) || 0;
    const depth = parseFloat(item.dep) || 0;
    const time = parseTmEqk(item.tmEqk);
    const place = item.loc || '위치 정보 없음';
    const near = nearestCity(lat, lng);
    const korea = inBox(lat, lng, QUAKE_CONFIG.koreaBox);
    return {
      id: 'KMA_' + (item.tmFc || '') + '_' + lat + '_' + lng,
      mag, lat, lng, depth, time,
      placeRaw: place,
      place: place,
      url: '',
      korea,
      near,
      sev: severityOf(mag),
      simulated: false
    };
  }

  /** 기상청 API URL 구성 */
  function buildKmaUrl() {
    const now = new Date();
    const from = new Date(Date.now() - QUAKE_CONFIG.lookbackDays * 86400000);
    const params = new URLSearchParams({
      serviceKey: KMA_SERVICE_KEY,
      pageNo: '1',
      numOfRows: '200',
      dataType: 'JSON',
      fromTmFc: fmtDate(from),
      toTmFc: fmtDate(now)
    });
    return `${KMA_BASE_URL}/getEqkMsgList?${params.toString()}`;
  }

  /** CORS 프록시를 통해 기상청 API 호출 시도 */
  async function fetchKma(signal) {
    const rawUrl = buildKmaUrl();
    const errors = [];

    // 먼저 직접 호출 시도 (같은 도메인이거나 CORS 허용 시)
    const attempts = [rawUrl, ...CORS_PROXIES.map(p => p + encodeURIComponent(rawUrl))];

    for (const url of attempts) {
      try {
        const res = await fetch(url, { signal, cache: 'no-store' });
        if (!res.ok) { errors.push('HTTP ' + res.status); continue; }
        const json = await res.json();

        // 공공데이터 API 에러 응답 체크
        const header = json?.response?.header;
        if (header && header.resultCode !== '00') {
          errors.push('KMA API 오류: ' + (header.resultMsg || header.resultCode));
          continue;
        }

        const items = json?.response?.body?.items?.item;
        if (!items) { errors.push('KMA: 데이터 없음'); continue; }

        const arr = Array.isArray(items) ? items : [items];
        return arr
          .map(normalizeKma)
          .filter(ev => ev.lat !== 0 && ev.lng !== 0 && ev.mag >= QUAKE_CONFIG.minMagnitude)
          .sort((a, b) => b.time - a.time);
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        errors.push(e.message);
      }
    }
    throw new Error('기상청 API 실패: ' + errors.join(' | '));
  }

  /** USGS API URL 구성 (fallback) */
  function buildUsgsUrl() {
    const start = new Date(Date.now() - QUAKE_CONFIG.lookbackDays * 86400000).toISOString();
    const b = QUAKE_CONFIG.watchBox;
    const q = new URLSearchParams({
      format: 'geojson',
      starttime: start,
      minmagnitude: String(QUAKE_CONFIG.minMagnitude),
      minlatitude: b.minLat, maxlatitude: b.maxLat,
      minlongitude: b.minLng, maxlongitude: b.maxLng,
      orderby: 'time',
      limit: '200'
    });
    return 'https://earthquake.usgs.gov/fdsnws/event/1/query?' + q.toString();
  }

  /** USGS API 호출 (fallback) */
  async function fetchUsgs(signal) {
    const res = await fetch(buildUsgsUrl(), { signal, cache: 'no-store' });
    if (!res.ok) throw new Error('USGS HTTP ' + res.status);
    const json = await res.json();
    return (json.features || [])
      .filter(f => f && f.geometry && f.geometry.coordinates)
      .map(normalize);
  }

  /** 기상청 우선, USGS fallback */
  async function fetchQuakes() {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), QUAKE_CONFIG.fetchTimeoutMs);
    try {
      // 기상청 API 우선 시도
      try {
        const events = await fetchKma(ctrl.signal);
        console.log('[earthquake] 기상청 API 성공:', events.length, '건');
        return events;
      } catch (kmaErr) {
        console.warn('[earthquake] 기상청 API 실패, USGS로 전환:', kmaErr.message);
      }
      // USGS fallback
      const events = await fetchUsgs(ctrl.signal);
      console.log('[earthquake] USGS fallback 성공:', events.length, '건');
      return events;
    } finally {
      clearTimeout(to);
    }
  }

  async function refreshEarthquakes(manual) {
    setStatus('loading');
    try {
      const events = await fetchQuakes();
      lastOkAt = Date.now();
      lastError = null;

      const fresh = events.filter(e => !seenIds.has(e.id));
      events.forEach(e => seenIds.add(e.id));
      liveEvents = events;

      renderAll();
      setStatus('ok');

      if (!initialized) {
        initialized = true;
        // 첫 로딩: 최근 발생분(기본 60분 이내)만 즉시 알림
        const recent = fresh.filter(e =>
          shouldAlert(e) && (Date.now() - e.time) <= QUAKE_CONFIG.recentWindowMin * 60000);
        if (recent.length) fireAlert(recent[0], { initial: true });
      } else {
        // 신규 발생분 알림 (가장 강한 것 우선)
        const alerts = fresh.filter(shouldAlert).sort((a, b) => b.mag - a.mag);
        if (alerts.length) fireAlert(alerts[0], { extra: alerts.length - 1 });
      }

      if (manual && typeof showLiveMapToast === 'function') {
        showLiveMapToast('🌋 지진 정보를 갱신했습니다 (최근 ' + QUAKE_CONFIG.lookbackDays + '일 ' + events.length + '건)');
      }
    } catch (err) {
      lastError = err;
      console.warn('[earthquake] 데이터 수신 실패:', err);
      setStatus('error');
      if (manual && typeof showLiveMapToast === 'function') {
        showLiveMapToast('⚠️ 지진 정보를 불러오지 못했습니다 (기상청·USGS 모두 실패). 잠시 후 자동 재시도합니다.');
      }
    }
  }

  function startPolling() {
    refreshEarthquakes(false);
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => refreshEarthquakes(false), QUAKE_CONFIG.pollIntervalMs);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && lastOkAt && Date.now() - lastOkAt > QUAKE_CONFIG.pollIntervalMs) {
        refreshEarthquakes(false);
      }
    });
  }

  /* ------------------------------------------------------------------
     상태 표시
  ------------------------------------------------------------------ */
  function setStatus(state) {
    const badge = document.getElementById('quakeMonitorBadge');
    const status = document.getElementById('quakeStatus');
    let text, cls;
    if (state === 'loading' && !lastOkAt) {
      text = '연결 중…'; cls = 'loading';
    } else if (state === 'error') {
      text = lastOkAt ? '연결 지연 · 재시도 중' : '연결 실패 · 재시도 중'; cls = 'error';
    } else {
      const clock = lastOkAt ? new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date(lastOkAt)) : '';
      text = '정상 감시 중' + (clock ? ' · ' + clock : ''); cls = 'ok';
    }
    if (badge) {
      badge.className = 'quake-monitor-badge ' + cls;
      badge.textContent = '🌋 지진 ' + text;
    }
    if (status) {
      status.className = 'quake-status ' + cls;
      status.textContent = text;
    }
  }

  /* ------------------------------------------------------------------
     렌더링: 지도 + 목록
  ------------------------------------------------------------------ */
  function popupHTML(ev) {
    const c = severityColor(ev.sev);
    const near = ev.near
      ? `${esc(ev.near.name)}에서 약 ${Math.round(ev.near.km)}km`
      : '-';
    const link = ev.url
      ? `<a href="${esc(ev.url)}" target="_blank" rel="noopener" style="color:#007aff; font-weight:700;">USGS 상세 ➔</a>`
      : ev.id.startsWith('KMA_')
        ? `<span style="color:#007aff; font-weight:700;">📡 기상청 제공</span>`
        : '';
    return `
      <div style="font-family:-apple-system, BlinkMacSystemFont, sans-serif; min-width:230px; padding:3px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; border-bottom:1.5px solid ${c}; padding-bottom:5px;">
          <b style="font-size:13.5px; color:${c};">🌋 ${severityLabel(ev.sev)}${ev.simulated ? ' (모의)' : ''}</b>
          <span style="font-size:10.5px; font-weight:800; background:${c}22; color:${c}; padding:2px 7px; border-radius:6px;">규모 ${ev.mag.toFixed(1)}</span>
        </div>
        <div style="font-size:12.5px; font-weight:800; color:#1d1d1f; margin-bottom:4px;">📍 ${esc(ev.place)}</div>
        <div style="font-size:11.5px; color:#515156; line-height:1.55;">
          🕒 ${fmtClock(ev.time)} (${fmtAgo(ev.time)})<br>
          ⬇️ 진원 깊이 약 ${ev.depth != null ? Math.round(ev.depth) : '-'}km<br>
          🏙️ 가장 가까운 주요 도시: ${near}
        </div>
        <div style="margin-top:6px; font-size:11px;">${link}</div>
      </div>`;
  }

  function renderMap() {
    if (typeof disasterEarthquakeGroup === 'undefined') return;
    disasterEarthquakeGroup.clearLayers();
    Object.keys(markerById).forEach(k => delete markerById[k]);

    allEvents().forEach(ev => {
      const c = severityColor(ev.sev);
      const ageMin = (Date.now() - ev.time) / 60000;
      const isRecent = ev.simulated || ageMin <= 180;
      let marker;

      if (isRecent || ev.mag >= 4.0) {
        // 최근/강진: 규모 라벨 말풍선 + 펄스
        const icon = L.divIcon({
          className: 'disaster-marker-container',
          html: `<div class="disaster-bubble quake-bubble" style="border-color:${c}; color:${c}; box-shadow:0 4px 14px ${c}55;">
                   <span class="bubble-pulse" style="background:${c};"></span>
                   <span>🌋 M${ev.mag.toFixed(1)}</span>
                 </div>`,
          iconSize: [92, 28],
          iconAnchor: [46, 14]
        });
        marker = L.marker([ev.lat, ev.lng], { icon, zIndexOffset: Math.round(ev.mag * 100) });
      } else {
        marker = L.circleMarker([ev.lat, ev.lng], {
          radius: 4 + ev.mag * 1.6,
          color: c, weight: 1.5, opacity: 0.9,
          fillColor: c, fillOpacity: 0.35
        });
        marker.bindTooltip(`M${ev.mag.toFixed(1)} · ${esc(ev.place)}`, { sticky: true });
      }
      marker.bindPopup(popupHTML(ev), { maxWidth: 300 });
      disasterEarthquakeGroup.addLayer(marker);
      markerById[ev.id] = marker;
    });
  }

  function renderList() {
    const el = document.getElementById('quakeList');
    if (!el) return;
    const items = allEvents();

    if (!items.length) {
      el.innerHTML = lastOkAt
        ? `<div class="quake-empty">✅ 최근 ${QUAKE_CONFIG.lookbackDays}일간 감시 구역에서 규모 ${QUAKE_CONFIG.minMagnitude} 이상 지진이 없습니다.</div>`
        : `<div class="quake-empty">지진 정보를 불러오는 중입니다…</div>`;
      return;
    }

    el.innerHTML = items.slice(0, QUAKE_CONFIG.maxListItems).map(ev => {
      const c = severityColor(ev.sev);
      const near = ev.near ? `${esc(ev.near.name)} 약 ${Math.round(ev.near.km)}km` : '';
      return `
        <div class="quake-item ${ev.sev}" onclick="focusQuake('${esc(ev.id)}')">
          <div class="quake-mag" style="background:${c};">${ev.mag.toFixed(1)}</div>
          <div class="quake-info">
            <div class="quake-place">${ev.simulated ? '🧪 [모의 훈련] ' : ''}${esc(ev.place)}</div>
            <div class="quake-meta">
              ${fmtClock(ev.time)} · ${fmtAgo(ev.time)} · 깊이 ${ev.depth != null ? Math.round(ev.depth) : '-'}km${near ? ' · ' + near : ''}
              ${ev.korea ? ' · <b style="color:#d70015;">한반도 인근</b>' : ''}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function renderAll() {
    renderMap();
    renderList();
  }

  /* ------------------------------------------------------------------
     알림 (배너 · 소리 · 진동 · 브라우저 알림)
  ------------------------------------------------------------------ */
  function ensureAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch (e) { return null; }
  }

  function playAlarm(sev) {
    if (!soundOn) return;
    const ctx = ensureAudio();
    if (!ctx) return;

    const schedule = () => {
      if (ctx.state !== 'running') return;   // 사용자 상호작용 전이면 브라우저가 차단 → 조용히 건너뜀
      const beeps = sev === 'danger' ? 6 : sev === 'warning' ? 3 : 2;
      const freqA = sev === 'danger' ? 960 : 740;
      const freqB = sev === 'danger' ? 720 : 560;
      const t0 = ctx.currentTime;
      for (let i = 0; i < beeps; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = i % 2 === 0 ? freqA : freqB;
        const s = t0 + i * 0.32;
        gain.gain.setValueAtTime(0.0001, s);
        gain.gain.exponentialRampToValueAtTime(0.25, s + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, s + 0.28);
        osc.connect(gain).connect(ctx.destination);
        osc.start(s);
        osc.stop(s + 0.3);
      }
    };

    if (ctx.state === 'running') schedule();
    else ctx.resume().then(schedule).catch(() => { /* 자동재생 차단 */ });
  }

  function safetyTip(sev) {
    if (sev === 'info') return '';
    return '🛡️ 흔들리면 머리를 보호하고 튼튼한 탁자 아래로 → 멈추면 가스·전기를 끄고 계단으로 대피 (엘리베이터 사용 금지)';
  }

  function fireAlert(ev, opts) {
    opts = opts || {};
    const banner = document.getElementById('quakeAlertBanner');
    const c = severityColor(ev.sev);

    if (banner) {
      const near = ev.near ? `${esc(ev.near.name)}에서 약 ${Math.round(ev.near.km)}km` : '';
      const extra = opts.extra > 0 ? ` <span class="qa-extra">외 ${opts.extra}건</span>` : '';
      const tip = safetyTip(ev.sev);
      banner.className = 'quake-alert-banner show ' + ev.sev;
      banner.style.setProperty('--qa-color', c);
      banner.innerHTML = `
        <div class="qa-icon">🌋</div>
        <div class="qa-body">
          <div class="qa-title">
            ${ev.simulated ? '🧪 [모의 훈련] ' : ''}${severityLabel(ev.sev)} · 규모 ${ev.mag.toFixed(1)}${extra}
          </div>
          <div class="qa-sub">📍 ${esc(ev.place)}</div>
          <div class="qa-sub">🕒 ${fmtAgo(ev.time)} (${fmtClock(ev.time)})${near ? ' · ' + near : ''}</div>
          ${tip ? `<div class="qa-tip">${tip}</div>` : ''}
          <div class="qa-foot">참고용 정보 (기상청/USGS) · 공식 지진속보/재난문자는 기상청을 확인하세요</div>
        </div>
        <div class="qa-actions">
          <button class="qa-btn" onclick="focusQuake('${esc(ev.id)}')">지도 보기</button>
          <button class="qa-close" onclick="closeQuakeAlert()" aria-label="닫기">&times;</button>
        </div>`;
      if (alertHideTimer) clearTimeout(alertHideTimer);
      // 강진(5.0+)은 사용자가 닫을 때까지 유지, 그 외는 자동 숨김
      if (ev.sev !== 'danger') {
        alertHideTimer = setTimeout(closeQuakeAlert, 15000);
      }
    }

    // 지도 레이어 자동 활성화
    if (typeof map !== 'undefined' && typeof disasterEarthquakeGroup !== 'undefined' && !map.hasLayer(disasterEarthquakeGroup)) {
      map.addLayer(disasterEarthquakeGroup);
    }

    playAlarm(ev.sev);
    if (navigator.vibrate && ev.sev !== 'info') {
      try { navigator.vibrate(ev.sev === 'danger' ? [300, 120, 300, 120, 500] : [250, 100, 250]); } catch (e) { /* 미지원 */ }
    }
    notifyBrowser(ev);
  }

  function closeQuakeAlert() {
    const banner = document.getElementById('quakeAlertBanner');
    if (banner) banner.classList.remove('show');
    if (alertHideTimer) { clearTimeout(alertHideTimer); alertHideTimer = null; }
  }

  function notifyBrowser(ev) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const near = ev.near ? ` (${ev.near.name} 약 ${Math.round(ev.near.km)}km)` : '';
      new Notification(`🌋 ${severityLabel(ev.sev)} · 규모 ${ev.mag.toFixed(1)}`, {
        body: `${ev.place}${near}\n${fmtAgo(ev.time)} · 참고용 정보`,
        tag: 'quake-' + ev.id,
        requireInteraction: ev.sev === 'danger'
      });
    } catch (e) { /* 일부 모바일 브라우저는 생성자 알림 미지원 */ }
  }

  function updateControlLabels() {
    const soundBtn = document.getElementById('quakeSoundBtn');
    if (soundBtn) soundBtn.textContent = soundOn ? '🔊 소리 켜짐' : '🔇 소리 꺼짐';
    const nBtn = document.getElementById('quakeNotifyBtn');
    if (nBtn) {
      if (!('Notification' in window)) {
        nBtn.textContent = '🔕 알림 미지원'; nBtn.disabled = true;
      } else if (Notification.permission === 'granted') {
        nBtn.textContent = '🔔 브라우저 알림 켜짐';
      } else if (Notification.permission === 'denied') {
        nBtn.textContent = '🔕 알림 차단됨 (브라우저 설정)';
      } else {
        nBtn.textContent = '🔔 브라우저 알림 켜기';
      }
    }
  }

  /* ------------------------------------------------------------------
     공개 함수 (HTML onclick 에서 호출)
  ------------------------------------------------------------------ */
  function requestQuakeNotification() {
    if (!('Notification' in window)) return;
    Notification.requestPermission().then(() => {
      updateControlLabels();
      if (Notification.permission === 'granted' && typeof showLiveMapToast === 'function') {
        showLiveMapToast('🔔 지진 발생 시 브라우저 알림을 보내드립니다 (이 탭을 열어 둔 경우)');
      }
    });
  }

  function toggleQuakeSound() {
    soundOn = !soundOn;
    try { localStorage.setItem('quakeSoundOn', soundOn ? '1' : '0'); } catch (e) { /* 무시 */ }
    if (soundOn) ensureAudio();
    updateControlLabels();
  }

  function focusQuake(id) {
    if (typeof closeDisasterModal === 'function') closeDisasterModal();
    if (typeof switchMobileView === 'function' && window.innerWidth <= 768) switchMobileView('map');
    if (typeof map === 'undefined') return;
    if (!map.hasLayer(disasterEarthquakeGroup)) map.addLayer(disasterEarthquakeGroup);

    const ev = allEvents().find(e => e.id === id);
    if (!ev) return;
    map.flyTo([ev.lat, ev.lng], Math.max(map.getZoom(), 8.5), { animate: true, duration: 1.2 });
    setTimeout(() => { if (markerById[id]) markerById[id].openPopup(); }, 1300);
  }

  /** 재해 모달/상단 버튼에서 호출: 한반도 인근 최신 지진 중심으로 이동 */
  function triggerEarthquakeDisaster() {
    if (typeof closeDisasterModal === 'function') closeDisasterModal();
    if (typeof switchMobileView === 'function' && window.innerWidth <= 768) switchMobileView('map');
    if (typeof map === 'undefined') return;
    if (!map.hasLayer(disasterEarthquakeGroup)) map.addLayer(disasterEarthquakeGroup);

    const korea = allEvents().filter(e => e.korea);
    if (korea.length) {
      const strongest = korea.slice().sort((a, b) => b.mag - a.mag)[0];
      focusQuake(strongest.id);
    } else {
      map.flyTo([36.3, 127.8], 7, { animate: true, duration: 1.2 });
    }
    if (typeof showLiveMapToast === 'function') {
      showLiveMapToast(`🌋 <b>[실시간 지진]</b> 최근 ${QUAKE_CONFIG.lookbackDays}일 ${allEvents().length}건을 지도에 표시했습니다.`);
    }
  }

  /** 상단 퀵 버튼: 지진 레이어 ON/OFF */
  function toggleEarthquakeDisaster() {
    if (typeof toggleOverlayLayer === 'function') toggleOverlayLayer('disasterEarthquake');
    if (typeof showLiveMapToast !== 'function' || typeof map === 'undefined') return;
    if (map.hasLayer(disasterEarthquakeGroup)) {
      showLiveMapToast(`🌋 <b>실시간 지진 레이어</b> 표시 (최근 ${QUAKE_CONFIG.lookbackDays}일 ${allEvents().length}건)`);
    } else {
      showLiveMapToast('지진 레이어가 해제되었습니다.');
    }
  }

  /** 알림이 실제로 어떻게 보이는지 확인하는 모의 훈련 */
  function testQuakeAlert() {
    ensureAudio();   // 버튼 클릭(사용자 제스처) 중이므로 오디오 잠금 해제
    if (simTimer) clearTimeout(simTimer);
    simEvent = {
      id: 'SIMULATED',
      mag: 4.8, lat: 36.0820, lng: 129.3560, depth: 10,
      time: Date.now(),
      placeRaw: 'SIMULATION',
      place: '경북 포항시 북구 인근 (모의 훈련)',
      url: '',
      korea: true,
      near: nearestCity(36.0820, 129.3560),
      sev: severityOf(4.8),
      simulated: true
    };
    renderAll();
    if (typeof closeDisasterModal === 'function') closeDisasterModal();
    fireAlert(simEvent, {});
    simTimer = setTimeout(() => { simEvent = null; renderAll(); }, 5 * 60 * 1000);
  }

  /* ------------------------------------------------------------------
     초기화
  ------------------------------------------------------------------ */
  window.refreshEarthquakes = refreshEarthquakes;
  window.requestQuakeNotification = requestQuakeNotification;
  window.toggleQuakeSound = toggleQuakeSound;
  window.focusQuake = focusQuake;
  window.closeQuakeAlert = closeQuakeAlert;
  window.triggerEarthquakeDisaster = triggerEarthquakeDisaster;
  window.toggleEarthquakeDisaster = toggleEarthquakeDisaster;
  window.testQuakeAlert = testQuakeAlert;

  // 브라우저 자동재생 정책: 첫 사용자 입력 시 오디오 잠금 해제
  ['click', 'touchstart', 'keydown'].forEach(evt =>
    document.addEventListener(evt, function unlock() {
      ensureAudio();
      document.removeEventListener(evt, unlock);
    }, { once: true, passive: true })
  );

  document.addEventListener('DOMContentLoaded', () => {
    updateControlLabels();
    setStatus('loading');
    renderList();
    startPolling();
  });

  // 순수 함수 테스트용 노출 (브라우저 동작에는 영향 없음)
  window.__quakeInternals = { haversineKm, nearestCity, severityOf, inBox, normalize, shouldAlert, translatePlace, QUAKE_CONFIG };
})();
