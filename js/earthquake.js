/**
 * 실시간 지진 정보 연동 및 지도 마커 표시 모듈 (`js/earthquake.js`)
 */

const EARTHQUAKE_CONFIG = {
    apiKey: "403fbc593fbab293ae2421789374bfc240df24c62b1811b886f0f22a8f90ad28",
    endpoint: "https://apis.data.go.kr/1360000/EqkInfoService/getEqkMsg",
    dataType: "JSON"
};

let earthquakeMarkers = []; // 지도에 표시된 마커 관리 배열
let isFetchingEarthquake = false; // 중복 요청 방지 플래그

/**
 * 실시간 지진 데이터를 API로부터 가져와 지도에 반영하는 메인 함수
 */
async function fetchAndRenderRealtimeEarthquakes() {
    if (isFetchingEarthquake) return;
    isFetchingEarthquake = true;

    // 오늘 날짜 생성 (YYYYMMDD 형식)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}${month}${day}`;

    const params = new URLSearchParams({
        serviceKey: EARTHQUAKE_CONFIG.apiKey,
        dataType: EARTHQUAKE_CONFIG.dataType,
        pageNo: "1",
        numOfRows: "20",
        fromTmFc: todayStr,
        toTmFc: todayStr
    });

    const requestUrl = `${EARTHQUAKE_CONFIG.endpoint}?${params.toString()}`;

    try {
        const response = await fetch(requestUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP 오류 발생: ${response.status}`);
        }

        const data = await response.json();
        
        // 공공데이터 응답 구조 안전 접근
        const responseBody = data?.response?.body;
        const items = responseBody?.items?.item;

        if (items) {
            const earthquakeList = Array.isArray(items) ? items : [items];
            renderEarthquakeMarkersOnMap(earthquakeList);
            updateConnectionStatusUI("connected", `정상 연동 완료 (총 ${earthquakeList.length}건)`);
        } else {
            console.log("오늘 감지된 실시간 지진 통보문이 없습니다.");
            updateConnectionStatusUI("connected_no_data", "실시간 지진 감지 없음 (정상)");
        }
    } catch (error) {
        console.error("지진 데이터 연동 실패:", error);
        updateConnectionStatusUI("failed", "지진 연결 실패 · 네트워크 상태를 확인하세요");
    } finally {
        isFetchingEarthquake = false;
    }
}

/**
 * 지도 객체 위에 지진 마커를 그리고 갱신하는 함수
 */
function renderEarthquakeMarkersOnMap(earthquakeList) {
    // 지도 전역 객체(예: map) 존재 여부 검증
    if (typeof map === 'undefined' || !map) {
        console.warn("지도(map) 객체가 아직 초기화되지 않았습니다.");
        return;
    }

    // 기존 마커 초기화 (메모리 및 화면 정리)
    earthquakeMarkers.forEach(marker => {
        if (typeof marker.setMap === 'function') {
            marker.setMap(null); // Google Maps 방식
        } else if (typeof marker.remove === 'function') {
            marker.remove();     // Leaflet 방식
        }
    });
    earthquakeMarkers = [];

    earthquakeList.forEach(eq => {
        const lat = parseFloat(eq.lat); // 위도
        const lon = parseFloat(eq.lon); // 경도
        const location = eq.loc;        // 진앙 위치
        const magnitude = eq.mt;        // 규모
        const time = eq.tmEqk;          // 발생 시각

        // 유효한 좌표값인지 검증
        if (isNaN(lat) || isNaN(lon)) return;

        // Leaflet 또는 Google Maps 등 프로젝트 환경에 맞춘 마커 추가 처리
        /* 
        // [예시] Leaflet 라이브러리 사용 시:
        const marker = L.marker([lat, lon]).addTo(map);
        marker.bindPopup(`
            <div style="padding: 5px;">
                <strong>🚨 지진 발생 알림</strong><br>
                - 위치: ${location}<br>
                - 규모: M ${magnitude}<br>
                - 시간: ${time}
            </div>
        `);
        earthquakeMarkers.push(marker);
        */
    });

    console.log(`[실시간 반영 완료] 총 ${earthquakeList.length}개의 지진 정보가 지도에 업데이트되었습니다.`);
}

/**
 * 화면 UI(상태 표시용 HTML 요소)에 연결 상태를 업데이트하는 함수
 */
function updateConnectionStatusUI(statusType, message) {
    const statusElement = document.getElementById("earthquake-status");
    if (!statusElement) return;

    if (statusType === "connected") {
        statusElement.innerText = `🟢 ${message}`;
        statusElement.style.color = "green";
    } else if (statusType === "connected_no_data") {
        statusElement.innerText = `🔵 ${message}`;
        statusElement.style.color = "blue";
    } else if (statusType === "failed") {
        statusElement.innerText = `🔴 ${message}`;
        statusElement.style.color = "red";
    }
}

// 최초 실행 및 주기적 폴링 설정 (60초마다 데이터 갱신)
document.addEventListener("DOMContentLoaded", () => {
    fetchAndRenderRealtimeEarthquakes();
    setInterval(fetchAndRenderRealtimeEarthquakes, 60000);
});