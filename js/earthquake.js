// js/earthquake.js 에 적용할 수 있는 에러 처리 및 재시도 제어 로직

let retryCount = 0;
const MAX_RETRY = 3;

async function fetchAndRenderRealtimeEarthquakes() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}${month}${day}`;

    const params = new URLSearchParams({
        serviceKey: "403fbc593fbab293ae2421789374bfc240df24c62b1811b886f0f22a8f90ad28",
        dataType: "JSON",
        pageNo: "1",
        numOfRows: "20",
        fromTmFc: todayStr,
        toTmFc: todayStr
    });

    const requestUrl = `https://apis.data.go.kr/1360000/EqkInfoService/getEqkMsg?${params.toString()}`;

    try {
        const response = await fetch(requestUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP 상태 코드 오류: ${response.status}`);
        }

        const data = await response.json();
        const items = data?.response?.body?.items?.item;

        // 성공 시 재시도 카운트 초기화
        retryCount = 0;

        if (items) {
            const earthquakeList = Array.isArray(items) ? items : [items];
            renderEarthquakeMarkersOnMap(earthquakeList);
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