// ==========================================
// 1. 설정 및 실시간 API 연동 추가 코드
// ==========================================
const REALTIME_EQ_CONFIG = {
    apiKey: "403fbc593fbab293ae2421789374bfc240df24c62b1811b886f0f22a8f90ad28",
    endpoint: "https://apis.data.go.kr/1360000/EqkInfoService/getEqkMsg",
    dataType: "JSON"
};

// 실시간 지진 데이터를 주기적으로 가져와 지도에 반영하는 함수
async function fetchAndRenderRealtimeEarthquakes() {
    // 오늘 날짜 및 최근 조회 범위 설정 (YYYYMMDD 형식)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}${month}${day}`;

    const params = new URLSearchParams({
        serviceKey: REALTIME_EQ_CONFIG.apiKey,
        dataType: REALTIME_EQ_CONFIG.dataType,
        pageNo: "1",
        numOfRows: "20",
        fromTmFc: todayStr, // 오늘 날짜 기준
        toTmFc: todayStr
    });

    try {
        const response = await fetch(`${REALTIME_EQ_CONFIG.endpoint}?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`서버 응답 오류: ${response.status}`);
        }

        const data = await response.json();
        const items = data?.response?.body?.items?.item;

        if (items) {
            const earthquakeList = Array.isArray(items) ? items : [items];
            renderEarthquakeMarkersOnMap(earthquakeList);
        } else {
            console.log("금일 감지된 실시간 지진 정보가 없습니다.");
        }
    } catch (error) {
        console.error("지진 데이터 실시간 반영 중 오류 발생:", error);
    }
}

// ==========================================
// 2. 지도 위에 지진 마커 표시 및 갱신 코드
// ==========================================
let earthquakeMarkers = []; // 기존 마커 관리 배열

function renderEarthquakeMarkersOnMap(earthquakeList) {
    // 정의된 지도 객체(예: map)가 있는지 확인
    if (typeof map === 'undefined' || !map) {
        console.warn("지도(map) 객체가 초기화되지 않았습니다.");
        return;
    }

    // 기존 마커 제거 (초기화)
    earthquakeMarkers.forEach(marker => {
        if (typeof marker.setMap === 'function') {
            marker.setMap(null); // Google Maps 등
        } else if (typeof marker.remove === 'function') {
            marker.remove();     // Leaflet 등
        }
    });
    earthquakeMarkers = [];

    earthquakeList.forEach(eq => {
        const lat = parseFloat(eq.lat); // 위도
        const lon = parseFloat(eq.lon); // 경도
        const location = eq.loc;        // 진앙 위치
        const magnitude = eq.mt;        // 규모
        const time = eq.tmEqk;          // 발생 시각

        // 마커 생성 (Leaflet 기준 예시, Google/Kakao/Naver인 경우 문법에 맞게 수정)
        /* 
        // 예시: Leaflet 사용 시
        const marker = L.marker([lat, lon]).addTo(map);
        marker.bindPopup(`
            <div style="min-width: 150px;">
                <strong>🚨 실시간 지진 경보</strong><br>
                - 위치: ${location}<br>
                - 규모: M ${magnitude}<br>
                - 시간: ${time}
            </div>
        `);
        earthquakeMarkers.push(marker);
        */

        // 예시: Google Maps API 사용 시
        /*
        const marker = new google.maps.Marker({
            position: { lat: lat, lng: lon },
            map: map,
            title: `[지진] ${location} (규모 ${magnitude})`
        });
        
        const infowindow = new google.maps.InfoWindow({
            content: `<div><strong>지진 발생</strong><br>위치: ${location}<br>규모: ${magnitude}<br>시간: ${time}</div>`
        });

        marker.addListener("click", () => {
            infowindow.open(map, marker);
        });
        earthquakeMarkers.push(marker);
        */
    });

console.log(`[실시간 반영 완료] 총 ${earthquakeList.length}개의 지진 정보가 지도에 업데이트되었습니다.`);
}

// 타이머 파일(`js/timer.js`) 등과 연계하여 일정 주기(예: 60초)마다 자동 실행
setInterval(fetchAndRenderRealtimeEarthquakes, 60000);