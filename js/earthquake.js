/**
 * 실시간 지진 정보를 '긴급재난문자' 형식으로 변환하여 지도 및 UI에 반영하는 모듈 (`js/earthquake.js`)
 */

const EARTHQUAKE_CONFIG = {
    apiKey: "SYJNTA07475N346W",
// 새로운 API 엔드포인트 주소로 변경
    endpoint: "https://apis.data.go.kr/V2/api/DSSP-IF-00247",
    dataType: "JSON"
};

let earthquakeMarkers = []; 
let isFetchingEarthquake = false; 

/**
 * 실시간 지진 데이터를 가져와 긴급재난문자 형태로 가공 및 시각화하는 함수
 */
async function fetchAndRenderRealtimeEarthquakes() {
    if (isFetchingEarthquake) return;
    isFetchingEarthquake = true;

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}${month}${day}`;

    const params = new URLSearchParams({
        serviceKey: EARTHQUAKE_CONFIG.apiKey,
        dataType: EARTHQUAKE_CONFIG.dataType,
        pageNo: "1",
        numOfRows: "5", // 긴급 상황 직전 최신 데이터 위주
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
        const responseBody = data?.response?.body;
        const items = responseBody?.items?.item;

        if (items) {
            const earthquakeList = Array.isArray(items) ? items : [items];
            
            // 1. 지도에 마커 표시
            renderEarthquakeMarkersOnMap(earthquakeList);

            // 2. 가장 최근 발생한 지진을 긴급재난문자 창에 띄우기
            triggerEmergencyBroadcastMessage(earthquakeList[0]);

            updateConnectionStatusUI("connected", `긴급재난문자 연동 완료 (총 ${earthquakeList.length}건 수신)`);
        } else {
            console.log("오늘 감지된 지진 정보가 없습니다.");
            updateConnectionStatusUI("connected_no_data", "실시간 지진 감지 없음 (안전)");
        }
    } catch (error) {
        console.error("긴급재난문자 연동 실패:", error);
        updateConnectionStatusUI("failed", "지진 연결 실패 · 재시도 중...");
    } finally {
        isFetchingEarthquake = false;
    }
}

/**
 * 지도에 지진 마커 생성
 */
function renderEarthquakeMarkersOnMap(earthquakeList) {
    if (typeof map === 'undefined' || !map) {
        console.warn("지도(map) 객체가 아직 초기화되지 않았습니다.");
        return;
    }

    earthquakeMarkers.forEach(marker => {
        if (typeof marker.setMap === 'function') marker.setMap(null);
        else if (typeof marker.remove === 'function') marker.remove();
    });
    earthquakeMarkers = [];

    earthquakeList.forEach(eq => {
        const lat = parseFloat(eq.lat);
        const lon = parseFloat(eq.lon);
        const location = eq.loc;
        const magnitude = eq.mt;
        const time = eq.tmEqk;

        if (isNaN(lat) || isNaN(lon)) return;

        /* 
        // [Leaflet 등 지도 마커 연동 예시]
        const marker = L.marker([lat, lon]).addTo(map);
        marker.bindPopup(`[긴급재난문자] ${location} 지진 발생 (규모: ${magnitude})`);
        earthquakeMarkers.push(marker);
        */
    });
}

/**
 * 🚨 [핵심] 지진 정보를 스마트폰 '긴급재난문자' 레이아웃으로 화면에 팝업/표시하는 함수
 */
function triggerEmergencyBroadcastMessage(eqData) {
    const location = eqData.loc || "알 수 없는 지역";
    const magnitude = eqData.mt || "0.0";
    const time = eqData.tmEqk || "방금 전";
    const depth = eqData.dep ? `깊이: 약 ${eqData.dep}km` : "";

    // DOM에 긴급재난문자 알림 박스가 없다면 동적 생성
    let alertBox = document.getElementById("emergency-broadcast-banner");
    if (!alertBox) {
        alertBox = document.createElement("div");
        alertBox.id = "emergency-broadcast-banner";
        // 긴급재난문자 고유의 디자인 (노란색 배경/검은 테두리 및 경고 스타일)
        alertBox.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 99999;
            background-color: #fff3cd;
            border: 3px solid #ff0000;
            padding: 15px 20px;
            width: 90%;
            max-width: 500px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            font-family: 'Malgun Gothic', sans-serif;
            border-radius: 8px;
            animation: shake 0.5s ease-in-out;
        `;
        document.body.appendChild(alertBox);
    }

    alertBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ff0000; padding-bottom: 8px; margin-bottom: 8px;">
            <strong style="color: #ff0000; font-size: 16px;">🚨 [긴급재난문자] 지진 발생 경보</strong>
            <button onclick="this.parentElement.parentElement.style.display='none'" style="background:none; border:none; font-size:16px; font-weight:bold; cursor:pointer;">✕</button>
        </div>
        <div style="font-size: 14px; color: #333; line-height: 1.5;">
            <p style="margin: 4px 0;"><strong>발생시각:</strong> ${time}</p>
            <p style="margin: 4px 0;"><strong>진앙위치:</strong> ${location}</p>
            <p style="margin: 4px 0;"><strong>규모:</strong> M ${magnitude} ${depth}</p>
            <p style="margin: 8px 0 0 0; font-size: 13px; color: #d9534f;">⚠️ 낙하물로부터 몸을 보호하고, 안전한 곳으로 대피하세요.</p>
        </div>
    `;
    alertBox.style.display = "block";
}

/**
 * 연결 상태바 업데이트
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
        statusElement.innerText = `🌋 ${message}`;
        statusElement.style.color = "red";
    }
}

// 자동 실행 및 주기적 확인 설정 (60초 주기)
document.addEventListener("DOMContentLoaded", () => {
    fetchAndRenderRealtimeEarthquakes();
    setInterval(fetchAndRenderRealtimeEarthquakes, 60000);
});