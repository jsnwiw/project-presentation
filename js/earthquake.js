<<<<<<<<< Temporary merge branch 1
// js/earthquake.js 에 적용할 수 있는 에러 처리 및 재시도 제어 로직

let retryCount = 0;
const MAX_RETRY = 3;

async function fetchAndRenderRealtimeEarthquakes() {
=========
/**
 * 실시간 지진 정보 연동 및 지도 마커 표시 모듈 (`js/earthquake.js`)
 */

const EARTHQUAKE_CONFIG = {
    apiKey: "403fbc593fbab293ae2421789374bfc240df24c62b1811b886f0f22a8f90ad28",
    endpoint: "https://apis.data.go.kr/1360000/EqkInfoService/getEqkMsg",
    dataType: "JSON"
};

// 실시간 지진 데이터를 주기적으로 가져와 지도에 반영하는 함수
async function fetchAndRenderRealtimeEarthquakes() {
    if (isFetchingEarthquake) return;
    isFetchingEarthquake = true;

    // 오늘 날짜 생성 (YYYYMMDD 형식)
>>>>>>>>> Temporary merge branch 2
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}${month}${day}`;

    const params = new URLSearchParams({
<<<<<<<<< Temporary merge branch 1
        serviceKey: "403fbc593fbab293ae2421789374bfc240df24c62b1811b886f0f22a8f90ad28",
        dataType: "JSON",
=========
        serviceKey: EARTHQUAKE_CONFIG.apiKey,
        dataType: EARTHQUAKE_CONFIG.dataType,
>>>>>>>>> Temporary merge branch 2
        pageNo: "1",
        numOfRows: "20",
        fromTmFc: todayStr,
        toTmFc: todayStr
    });

<<<<<<<<< Temporary merge branch 1
    const requestUrl = `https://apis.data.go.kr/1360000/EqkInfoService/getEqkMsg?${params.toString()}`;
=========
    const requestUrl = `${EARTHQUAKE_CONFIG.endpoint}?${params.toString()}`;
>>>>>>>>> Temporary merge branch 2

    try {
        const response = await fetch(requestUrl);
        
        if (!response.ok) {
<<<<<<<<< Temporary merge branch 1
            throw new Error(`HTTP 상태 코드 오류: ${response.status}`);
=========
            throw new Error(`HTTP 오류 발생: ${response.status}`);
>>>>>>>>> Temporary merge branch 2
        }

        const data = await response.json();
        
        // 공공데이터 응답 구조 안전 접근
        const responseBody = data?.response?.body;
        const items = responseBody?.items?.item;

        // 성공 시 재시도 카운트 초기화
        retryCount = 0;

        if (items) {
            const earthquakeList = Array.isArray(items) ? items : [items];
            renderEarthquakeMarkersOnMap(earthquakeList);
<<<<<<<<< Temporary merge branch 1
            // UI에 연결 성공 표시
            updateConnectionStatus("connected");
        } else {
            console.log("금일 감지된 실시간 지진 정보가 없습니다.");
            updateConnectionStatus("connected_no_data");
        }
    } catch (error) {
        console.error("지진 데이터 연동 실패:", error);
        retryCount++;

        if (retryCount <= MAX_RETRY) {
            console.log(`재시도 중... (${retryCount}/${MAX_RETRY})`);
            updateConnectionStatus("retrying");
            // 5초 뒤 재시도
            setTimeout(fetchAndRenderRealtimeEarthquakes, 5000);
        } else {
            console.warn("최대 재시도 횟수를 초과했습니다. 네트워크 상태나 API 키를 확인해주세요.");
            updateConnectionStatus("failed");
        }
    }
}

// 화면 UI 상태 업데이트 함수 (예시)
function updateConnectionStatus(status) {
    const statusElement = document.getElementById("earthquake-status"); // HTML 상의 상태 표시 요소
    if (!statusElement) return;

    if (status === "retrying") {
        statusElement.innerText = "🌋 지진 연결 실패 · 재시도 중...";
    } else if (status === "connected") {
        statusElement.innerText = "🟢 지진 실시간 연동 완료";
    } else if (status === "failed") {
        statusElement.innerText = "🔴 지진 연결 실패 (네트워크 확인 필요)";
    }
}
=========
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

        // 유효한 좌표값인지 검증
        if (isNaN(lat) || isNaN(lon)) return;

        // 사용 중인 지도 라이브러리(Leaflet 또는 Google Maps 등)에 맞게 마커 추가
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

        // [예시] Google Maps API 사용 시:
        /*
        const marker = new google.maps.Marker({
            position: { lat: lat, lng: lon },
            map: map,
            title: `[지진] ${location} (규모 ${magnitude})`
        });
        
        const infowindow = new google.maps.InfoWindow({
            content: `<div><strong>🚨 지진 발생</strong><br>위치: ${location}<br>규모: ${magnitude}<br>시간: ${time}</div>`
        });

        marker.addListener("click", () => {
            infowindow.open(map, marker);
        });
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

// 최초 실행 및 주기적 폴링 설정 (예: 60초마다 데이터 갱신)
document.addEventListener("DOMContentLoaded", () => {
    fetchAndRenderRealtimeEarthquakes();
    setInterval(fetchAndRenderRealtimeEarthquakes, 60000);
});
>>>>>>>>> Temporary merge branch 2
