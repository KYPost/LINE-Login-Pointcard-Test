// --- 全域變數 ---
let collectedStamps = [];
let isRedeemed = false;

// let liffId = "2009048038-fYCeyi8N";

async function initializeLiff() {
  const myLiffId = "2009048038-fYCeyi8N";
  const urlParams = new URLSearchParams(window.location.search);
  const stampFromUrl = urlParams.get("stamp");

  // 檢查是否為本地開發環境 (localhost / 127.0.0.1)
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  // 1. 先讀取進度
  loadProgress();

  // 【關鍵：紀錄掃碼前的狀態】
  const isFirstTimeUser = collectedStamps.length === 0;

  if (stampFromUrl) {
    handleStamp(stampFromUrl); // 默默幫他蓋章
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  if (isLocal) {
    console.warn("🔧 開發者模式：跳過 LINE 驗證");
    renderStamps();
    finalizeNavigation(isFirstTimeUser, stampFromUrl);
    return;
  }

  try {
    await liff.init({ liffId: myLiffId });

    // 檢查外部瀏覽器
    if (!liff.isInClient()) {
      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        window.location.replace(
          `https://liff.line.me/${myLiffId}${window.location.search}`,
        );
        return;
      }
      showExternalNotice(); // 記得要定義這個 function
      return;
    }

    if (liff.isLoggedIn()) {
      renderStamps();
      finalizeNavigation(isFirstTimeUser, stampFromUrl);
    } else {
      liff.login();
    }
  } catch (error) {
    console.error("LIFF 初始化失敗", error);
  }
}

function finalizeNavigation(isFirstTimeUser, stampFromUrl) {
  if (isRedeemed) {
    navigateTo("success-page");
  } else if (isFirstTimeUser && stampFromUrl) {
    // 新朋友掃碼，先看首頁介紹
    navigateTo("menu-page");
    setTimeout(() => alert("✨ 歡迎！第一枚印章已自動蓋上！"), 500);
  } else if (collectedStamps.length === 5) {
    navigateTo("redeem-page");
  } else if (collectedStamps.length > 0) {
    navigateTo("collect-page");
  } else {
    navigateTo("menu-page");
  }
}

function forceOpenInLine() {
  const liffUrl = "https://liff.line.me/2009048038-fYCeyi8N";

  if (!liff.isInClient()) {
    // 如果是行動裝置，嘗試直接導向
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      window.location.href = liffUrl;
    }
  }
}

function startChallenge() {
  // 檢查是否在本地模式
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (isLocal) {
    // 本地模式直接進去
    if (collectedStamps.length === 5) {
      navigateTo("redeem-page");
    } else {
      navigateTo("collect-page");
    }
    return;
  }

  // 正式環境邏輯
  if (!liff.isLoggedIn()) {
    liff.login();
  } else {
    if (collectedStamps.length === 5) {
      navigateTo("redeem-page");
    } else {
      navigateTo("collect-page");
    }
  }
}

function navigateTo(pageId) {
  // 先移除所有頁面的 active 狀態
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
    // 為了確保每次切換都有動畫，可以稍微強制重置動畫（選配）
    page.style.animation = "none";
    page.offsetHeight; /* 觸發重繪 (reflow) */
    page.style.animation = null;
  });

  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add("active");
  }

  // 如果進入集章頁，確保 UI 是最新的
  if (pageId === "collect-page") {
    renderStamps();
  }
}

async function openScanner(from) {
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  // --- 模式 A：兌換邏輯 (來自領獎頁) ---
  if (from === "redeem") {
    // 檢查點數是否真的滿了 (雙重保險)
    if (collectedStamps.length < 5) {
      alert("❌ 點數還沒集滿喔！");
      return;
    }

    if (isLocal) {
      const mockCode = prompt(
        "🛠️ LOCAL 模擬：請輸入櫃檯兌換碼",
        "REDEEM_COUPON_2026",
      );
      if (mockCode === "REDEEM_COUPON_2026") {
        isRedeemed = true;
        saveProgress();
        navigateTo("success-page");
      } else {
        alert("無效的代碼");
      }
      return;
    }

    // --- LINE 環境兌換 (掃描核銷) ---
    if (liff.isInClient()) {
      try {
        const result = await liff.scanCodeV2();
        const scannedCode = result.value;

        if (!scannedCode) return; // 使用者自己關掉掃描器

        // 判斷掃到的內容是否正確
        if (scannedCode.includes("REDEEM_COUPON_2026")) {
          isRedeemed = true;
          saveProgress();

          // 讓使用者看見成功，不要直接關視窗
          alert("✅ 核銷成功！請向工作人員領取贈品");
          navigateTo("success-page");

          // 如果你還是想傳訊息給官方帳號做紀錄，可以保留這段：
          /*
          await liff.sendMessages([{
            type: "text",
            text: "🎉 我已完成現場核銷，兌換獎品囉！"
          }]);
          */
        } else {
          alert("❌ 錯誤的兌換碼！請掃描櫃檯專用的核銷 QR Code");
        }
      } catch (error) {
        console.error("掃描或兌換失敗", error);
        if (!error.message.includes("closed")) {
          alert("啟動掃描失敗，請確認相機權限。");
        }
      }
    }
    return;
  }
  // --- 模式 B：集章邏輯 (來自掃描按鈕) ---
  if (isLocal) {
    console.log("🛠️ LOCAL 模擬：掃描中...");
    const randomStamp = "stamp" + Math.floor(Math.random() * 5 + 1);
    handleStamp(randomStamp);
    return;
  }

  // 正式 LINE 掃描環境
  if (!liff.isLoggedIn()) {
    liff.login();
    return;
  }
  try {
    const result = await liff.scanCodeV2();
    handleStamp(result.value);
  } catch (error) {
    console.warn("掃描取消", error);
  }
}
// --- 5. UI 更新 (讓圖片變亮) ---
function handleStamp(code) {
  if (!code) return;

  if (code.includes("REDEEM_COUPON_2026")) {
    executeRedemption();
    return; // 跳出，不執行下方的蓋章邏輯
  }

  let stampId = "";

  // --- 核心解析邏輯 ---
  if (code.includes("?")) {
    // 情境：掃到網址 (例如 https://liff.line.me/.../?stamp=1)
    try {
      // 取得問號後面的參數部分
      const queryString = code.split("?")[1];
      const urlParams = new URLSearchParams(queryString);
      stampId = urlParams.get("stamp");
    } catch (e) {
      console.error("解析網址失敗", e);
    }
  } else {
    // 情境：掃到純字串 (例如 stamp1 或 1)
    stampId = code.replace("stamp", "").trim();
  }

  // --- 驗證與執行 ---
  const validIds = ["1", "2", "3", "4", "5"];

  if (validIds.includes(stampId)) {
    if (!collectedStamps.includes(stampId)) {
      collectedStamps.push(stampId);
      saveProgress();

      // 觸發動畫
      const stampImg = document.getElementById(`s${stampId}`);
      if (stampImg) {
        // 確保圖片先換成彩色
        stampImg.src = `img/icon_${stampId}_on.png`;
        stampImg.style.opacity = "1";

        // 加上動畫 Class
        stampImg.classList.add("stamp-active");

        // 動畫結束後移除 class，避免下次掃描同一顆章(雖然不會發生)或切換頁面時殘留
        stampImg.addEventListener(
          "animationend",
          () => {
            stampImg.classList.remove("stamp-active");
          },
          { once: true },
        );
      }

      setTimeout(() => {
        renderStamps(); // 同步所有狀態（包含其他 4 顆章）

        // 4. 檢查是否集滿，集滿才跳頁
        if (collectedStamps.length === 5) {
          navigateTo("redeem-page");
        }
      }, 800); // 這裡的毫秒數建議略長於你的 CSS 動畫時間 (例如 0.6s -> 800ms)
    } else {
      alert("這個章已經蓋過了喔！");
    }
  }
}

function renderStamps(skipId = null) {
  console.log("正在渲染章印...");
  for (let i = 1; i <= 5; i++) {
    // 如果這顆章正在跑動畫，跳過它，不准重寫它的 src
    if (String(i) === String(skipId)) continue;

    const stampImg = document.getElementById(`s${i}`);
    if (stampImg) {
      const isCollected = collectedStamps.includes(String(i));
      const targetSrc = isCollected
        ? `img/icon_${i}_on.png`
        : `img/icon_${i}_off.png`;

      // 優化：只有當 src 真的不同時才更換，減少瀏覽器負擔
      if (stampImg.getAttribute("src") !== targetSrc) {
        stampImg.src = targetSrc;
      }

      stampImg.style.opacity = isCollected ? "1" : "0.8";
    }
  }
}

async function executeRedemption() {
  // 1. 基本門檻檢查
  if (collectedStamps.length < 5) {
    alert("❌ 您的點數不足，無法兌換禮品！");
    return;
  }

  if (isRedeemed) {
    alert("⚠️ 此禮品已經兌換過了喔！");
    navigateTo("success-page");
    return;
  }

  // 2. 啟動 LINE 掃描器
  try {
    const result = await liff.scanCodeV2();
    const code = result.value;

    if (!code) return; // 使用者取消掃描

    // 3. 檢查掃到的內容是否為正確的「核銷密語」
    // 這裡的字串要跟櫃檯 QR Code 內容一模一樣
    if (code.includes("REDEEM_COUPON_2026")) {
      // 成功核銷邏輯
      isRedeemed = true;
      saveProgress();

      alert("✅ 核銷成功！請向店員領取獎品");
      navigateTo("success-page");
      triggerConfetti();
    } else {
      alert("❌ 錯誤的兌換碼，請掃描櫃檯專用的兌換 QR Code");
    }
  } catch (error) {
    console.error("掃描失敗:", error);
    alert("掃描功能啟動失敗，請確認是否授權相機權限。");
  }
}

// 修改後的快捷鍵邏輯
window.addEventListener("keydown", function (e) {
  // 使用 e.code 可以忽略大小寫，'KeyR' 代表鍵盤上的 R 位置
  if (e.key === "r" || e.key === "R" || e.code === "KeyR") {
    // 阻止瀏覽器的預設行為（例如 Alt+R 有些瀏覽器會開選單）
    e.preventDefault();
    resetProgress();
  }

  if (e.key === "t" || e.key === "T" || e.code === "KeyT") {
    // 阻止瀏覽器的預設行為（例如 Alt+R 有些瀏覽器會開選單）
    e.preventDefault();
    resetRedeemProgress();
  }
});

// 修改後的儲存邏輯
function saveProgress() {
  const now = new Date().getTime(); // 取得目前的毫秒數
  const progressData = {
    stamps: collectedStamps,
    isRedeemed: isRedeemed,
    timestamp: now, // 紀錄存檔時間
  };

  console.log("💾 正在儲存進度 (24HR 有效)...", progressData);
  localStorage.setItem("tcb_stamps_data_package", JSON.stringify(progressData));
}

// 修改後的讀取邏輯
function loadProgress() {
  const dataString = localStorage.getItem("tcb_stamps_data_package");

  if (dataString) {
    const data = JSON.parse(dataString);
    const now = new Date().getTime();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // 24小時的毫秒數

    // 檢查是否超過 24 小時
    if (now - data.timestamp > TWENTY_FOUR_HOURS) {
      console.log("⏰ 進度已超過 24 小時，自動清空");
      localStorage.removeItem("tcb_stamps_data_package");
      collectedStamps = [];
      isRedeemed = false;
    } else {
      // 沒過期，正常讀取
      collectedStamps = data.stamps || [];
      isRedeemed = data.isRedeemed || false;
      console.log("✅ 成功載入未過期進度");
    }
  }
}

function resetProgress() {
  console.log("正在重置進度...");
  // 刪除合併後的資料包
  localStorage.removeItem("tcb_stamps_data_package");

  // 為了保險，舊的 Key 也順便清一下（如果你之前測試有殘留）
  localStorage.removeItem("tcb_stamps_progress");
  localStorage.removeItem("tcb_is_redeemed");

  location.reload();
}

function resetRedeemProgress() {
  console.log("正在重置兌換進度...");
  // 讀取目前的資料，修改兌換狀態後再存回去
  const dataString = localStorage.getItem("tcb_stamps_data_package");
  if (dataString) {
    let data = JSON.parse(dataString);
    data.isRedeemed = false;
    localStorage.setItem("tcb_stamps_data_package", JSON.stringify(data));
  }
  location.reload();
}

// 確保有呼叫初始化
initializeLiff();
