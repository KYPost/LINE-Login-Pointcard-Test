// --- 全域變數 ---
let collectedStamps = [];
let isRedeemed = false;

// let liffId = "2009048038-fYCeyi8N";

async function initializeLiff() {
  const myLiffId = "2009048038-fYCeyi8N";

  // 檢查是否為本地開發環境 (localhost / 127.0.0.1)
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (isLocal) {
    console.warn(
      "🔧 目前為開發者模式：偵測到未填寫 LIFF ID，已自動跳過 LINE 驗證。",
    );

    // 1. 先讀取進度
    loadProgress();

    // 2. 支援開發者在網址列輸入 ?stamp=1 來模擬掃碼
    const urlParams = new URLSearchParams(window.location.search);
    const stampIdFromUrl = urlParams.get("stamp");
    if (stampIdFromUrl) {
      handleStamp("stamp" + stampIdFromUrl);
      // 蓋完章後清理網址，避免重刷頁面又多蓋一次
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 4. 渲染印章狀態
    renderStamps();

    if (isRedeemed) {
      navigateTo("success-page");
    } else if (collectedStamps.length === 5 && !isRedeemed) {
      navigateTo("redeem-page");
    } else if (collectedStamps.length > 0) {
      navigateTo("collect-page");
    } else {
      navigateTo("menu-page");
    }

    return; // 結束初始化，不執行下方的 liff.init
  }

  try {
    await liff.init({ liffId: myLiffId });

    if (liff.isLoggedIn()) {
      loadProgress();

      const urlParams = new URLSearchParams(window.location.search);
      const stampIdFromUrl = urlParams.get("stamp");

      if (stampIdFromUrl) {
        handleStamp("stamp" + stampIdFromUrl);

        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      }

      // 3. 最後渲染畫面
      renderStamps();

      if (isRedeemed) {
        navigateTo("success-page");
      } else if (collectedStamps.length === 5) {
        navigateTo("redeem-page");
      } else if (collectedStamps.length > 0) {
        navigateTo("collect-page");
      } else {
        navigateTo("menu-page");
      }
    } else {
      // 未登入的處理...
      // liff.login();
    }
  } catch (error) {
    console.error("LIFF 初始化失敗", error);
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
    if (isLocal) {
      console.log("🛠️ LOCAL 模擬：執行兌換流程");
      const userConfirmed = confirm(
        "確定要兌換獎品嗎？\n(兌換後將標記為已兌換)",
      );
      if (userConfirmed) {
        isRedeemed = true; // 這裡要設定狀態
        saveProgress();
        navigateTo("success-page");
        // ... 動畫代碼 ...
      }
      return; // 執行完 LOCAL 兌換就結束
    }

    // LINE 環境兌換
    if (liff.isInClient()) {
      try {
        await liff.sendMessages([
          {
            type: "text",
            text: "🎉 我已集滿 5 點，完成兌換任務！",
          },
        ]);

        isRedeemed = true; // 先設為 true
        saveProgress(); // 先存檔

        alert("✅ 兌換券已傳送！");
        liff.closeWindow(); // 最後再關窗
      } catch (error) {
        // 如果使用者沒授權「傳送訊息」權限，會跑這裡
        console.error("傳送失敗", error);
        alert("請先授權傳送訊息權限，或直接出示此畫面給工作人員。");
        navigateTo("success-page"); // 失敗也要讓他進成功頁，不然會卡死
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

  const stampId = String(code).replace("stamp", "").trim();
  console.log("🔍 處理後的 ID:", stampId);

  if (["1", "2", "3", "4", "5"].includes(stampId)) {
    if (!collectedStamps.includes(stampId)) {
      collectedStamps.push(stampId);
      saveProgress();

      // 觸發動畫
      const stampImg = document.getElementById(`s${stampId}`);
      if (stampImg) {
        stampImg.src = `img/icon_${stampId}_on.png`; // 換成彩色圖
        stampImg.classList.add("stamp-active"); // 加上 CSS 動畫
      }

      renderStamps();

      // 延遲一下再跳 alert，才不會擋住動畫
      setTimeout(() => {
        if (collectedStamps.length === 5) {
          // alert("🎉 太強了！全部集齊！");
          navigateTo("redeem-page");
        } else {
          // 這裡可以換成更漂亮的彈窗
        }
      }, 600);
    } else {
      alert("這個章已經蓋過了喔！");
    }
  }
}

function renderStamps() {
  console.log("正在渲染章印...");
  for (let i = 1; i <= 5; i++) {
    const stampImg = document.getElementById(`s${i}`);
    if (stampImg) {
      const isCollected = collectedStamps.includes(String(i));
      if (isCollected) {
        stampImg.src = `img/icon_${i}_on.png`;
        stampImg.style.opacity = "1";
      } else {
        stampImg.src = `img/icon_${i}_off.png`;
        stampImg.style.opacity = "0.8";
      }
    }
  }
}

function saveProgress() {
  console.log("💾 正在儲存進度...", collectedStamps);
  localStorage.setItem("tcb_stamps_progress", JSON.stringify(collectedStamps));
  localStorage.setItem("tcb_is_redeemed", JSON.stringify(isRedeemed));
}

function loadProgress() {
  const savedStamps = localStorage.getItem("tcb_stamps_progress");
  const savedRedeem = localStorage.getItem("tcb_is_redeemed");

  if (savedStamps) collectedStamps = JSON.parse(savedStamps);
  if (savedRedeem) isRedeemed = JSON.parse(savedRedeem); // 讀取兌換狀態
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

function resetProgress() {
  // 在開發階段，我們可以先拿掉 confirm 讓測試更流暢
  console.log("正在重置進度...");
  localStorage.removeItem("tcb_stamps_progress");
  localStorage.removeItem("tcb_is_redeemed");
  location.reload();
}

function resetRedeemProgress() {
  // 在開發階段，我們可以先拿掉 confirm 讓測試更流暢
  console.log("正在重置兌換進度...");
  localStorage.setItem("tcb_is_redeemed", "false");
  location.reload();
}

// 確保有呼叫初始化
initializeLiff();
