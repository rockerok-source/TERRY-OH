const STORAGE_KEY = "soxl_loop_app_v2";

const defaultState = {
  tide: "썰물",
  prevClose: 0,
  seed: 10000,
  targetPct: 2.5,
  milBudget: 450,
  seolBudget: 900,
  nextLotNum: 1,
  realizedProfit: 0,
  lots: [0]
};

let state = loadState();

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return Object.assign({}, defaultState, JSON.parse(saved));
    }
  } catch (e) {
    console.error("Failed to load state:", e);
  }
  return JSON.parse(JSON.stringify(defaultState));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function init() {
  const today = new Date();
  document.getElementById("todayDateLabel").textContent = today.toISOString().slice(0, 10);
  document.getElementById("prevCloseInput").value = state.prevClose;
  document.getElementById("setSeed").value = state.seed;
  document.getElementById("setTargetPct").value = state.targetPct;
  document.getElementById("setMilBudget").value = state.milBudget;
  document.getElementById("setSeolBudget").value = state.seolBudget;

  updateDashboard();
  updateTideUI();
  recalcOrders();
  renderLots();
}

function updateDashboard() {
  const activeLots = state.lots.filter(l => l.status === "active");
  const totalInvested = activeLots.reduce((sum, l) => sum + (l.price * l.qty), 0);

  // 배(SOXL 루프) 할당 시드 = 총 시드의 90% ($9,000 기준) + 누적 실현수익
  const loopBaseCash = (state.seed * 0.9) + state.realizedProfit;
  const remainCash = Math.max(0, loopBaseCash - totalInvested);
  const returnPct = state.seed > 0 ? (state.realizedProfit / state.seed) * 100 : 0;

  document.getElementById("headerSeedBadge").textContent = "시드 $" + Number(state.seed).toLocaleString();
  document.getElementById("dashTotalInvested").textContent = "$" + totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById("dashCashRemain").textContent = "루프 잔여현금: $" + remainCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const profitSign = state.realizedProfit >= 0 ? "+" : "-";
  document.getElementById("dashTotalProfit").textContent = profitSign + "$" + Math.abs(state.realizedProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById("dashReturnPct").textContent = `시드 대비 수익률: ${profitSign}${Math.abs(returnPct).toFixed(2)}%`;
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-view").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
  document.getElementById("tab-" + tabName).classList.add("active");
  document.getElementById("nav-" + tabName).classList.add("active");
}

function setTide(tideVal) {
  state.tide = tideVal;
  saveState();
  updateTideUI();
  recalcOrders();
}

function updateTideUI() {
  const btnMil = document.getElementById("btnMilmul");
  const btnSeol = document.getElementById("btnSeolmul");
  if (state.tide === "밀물") {
    btnMil.className = "tide-btn active-mil";
    btnSeol.className = "tide-btn";
    document.getElementById("activeBudgetLabel").textContent = "밀물 1회 기본 매수금 (배 자산 5%)";
    document.getElementById("activeBudgetValue").textContent = "$" + Number(state.milBudget).toFixed(2);
  } else {
    btnMil.className = "tide-btn";
    btnSeol.className = "tide-btn active-seol";
    document.getElementById("activeBudgetLabel").textContent = "썰물 1회 확대 매수금 (배 자산 10%)";
    document.getElementById("activeBudgetValue").textContent = "$" + Number(state.seolBudget).toFixed(2);
  }
}

function recalcOrders() {
  const inputVal = parseFloat(document.getElementById("prevCloseInput").value);
  if (!isNaN(inputVal) && inputVal > 0) {
    state.prevClose = inputVal;
    saveState();
  }
  const p = state.prevClose;
  const tRate = state.targetPct / 100;
  const unitBudget = state.tide === "밀물" ? state.milBudget : state.seolBudget;

  let rows = [];
  if (state.tide === "밀물") {
    const p1 = +(p * (1 + tRate)).toFixed(2);
    const p2 = +(p - 0.01).toFixed(2);
    const p3 = +(p * 0.97).toFixed(2);
    rows = [
      { label: "1단계 (상승추종)", price: p1, qty: Math.floor(unitBudget / p1) },
      { label: "2단계 (기본하락)", price: p2, qty: Math.floor(unitBudget / p2) },
      { label: "3단계 (-3% 하락)", price: p3, qty: Math.floor(unitBudget / p3) }
    ];
  } else {
    const p1 = +(p - 0.01).toFixed(2);
    const p2 = +(p * 0.97).toFixed(2);
    const p3 = +(p * 0.94).toFixed(2);
    rows = [
      { label: "1단계 (기본하락)", price: p1, qty: Math.floor(unitBudget / p1) },
      { label: "2단계 (-3% 하락)", price: p2, qty: Math.floor(unitBudget / p2) },
      { label: "3단계 (-6% 1.5배)", price: p3, qty: Math.floor((unitBudget * 1.5) / p3) }
    ];
  }

  const tbody = document.getElementById("buyOrderBody");
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.label}<br/><span class="sub-small">예상 $${(r.price * r.qty).toFixed(2)}</span></td>
      <td class="price-cell">$${r.price.toFixed(2)}</td>
      <td><span class="qty-badge">${r.qty}주</span></td>
      <td><button type="button" class="btn-exec" onclick="recordBuy(${r.price}, ${r.qty})">체결등록</button></td>
    </tr>
  `).join("");
}

function recordBuy(defaultPrice, defaultQty) {
  const actualPriceStr = prompt("실제 체결된 단가($)를 입력하세요:", defaultPrice.toFixed(2));
  if (actualPriceStr === null) return;
  const actualPrice = parseFloat(actualPriceStr);
  if (isNaN(actualPrice) || actualPrice <= 0) {
    alert("올바른 단가를 입력해 주세요.");
    return;
  }

  const actualQtyStr = prompt("실제 체결된 수량(주)을 입력하세요:", defaultQty);
  if (actualQtyStr === null) return;
  const actualQty = parseInt(actualQtyStr, 10);
  if (isNaN(actualQty) || actualQty <= 0) {
    alert("올바른 수량을 입력해 주세요.");
    return;
  }

  const lotId = "LP-" + String(state.nextLotNum).padStart(2, "0");
  state.nextLotNum += 1;
  const todayStr = new Date().toISOString().slice(0, 10);

  state.lots.push({
    id: lotId,
    date: todayStr,
    price: actualPrice,
    qty: actualQty,
    status: "active"
  });

  saveState();
  updateDashboard();
  renderLots();
  alert(`${lotId} (${actualQty}주 @ $${actualPrice.toFixed(2)}, 총 $${(actualPrice * actualQty).toFixed(2)}) 장부에 등록되었습니다!`);
}

function completeSell(lotId) {
  const lot = state.lots.find(l => l.id === lotId);
  if (!lot) return;
  const targetSell = +(lot.price * (1 + state.targetPct / 100)).toFixed(2);
  const sellPriceStr = prompt(`${lot.id} 실제 익절 체결가($)를 확인해 주세요:`, targetSell.toFixed(2));
  if (sellPriceStr === null) return;
  const sellPrice = parseFloat(sellPriceStr);
  if (isNaN(sellPrice) || sellPrice <= 0) return;

  const profit = (sellPrice - lot.price) * lot.qty;
  lot.status = "sold";
  lot.sellPrice = sellPrice;
  lot.sellDate = new Date().toISOString().slice(0, 10);
  lot.profit = +profit.toFixed(2);
  state.realizedProfit = +(state.realizedProfit + profit).toFixed(2);

  saveState();
  updateDashboard();
  renderLots();
  alert(`${lot.id} 익절 완료! 실현 수익: +$${profit.toFixed(2)}`);
}

function renderLots() {
  const activeLots = state.lots.filter(l => l.status === "active");
  const soldLots = state.lots.filter(l => l.status === "sold");
  const tRate = state.targetPct / 100;

  // 1. Update Sell Table in Tab 1
  const sellBody = document.getElementById("sellOrderBody");
  if (activeLots.length === 0) {
    sellBody.innerHTML = `<tr><td colspan="4" class="empty-msg">현재 보유 중인 루프 묶음이 없습니다.</td></tr>`;
  } else {
    sellBody.innerHTML = activeLots.map(l => {
      const sellTarget = +(l.price * (1 + tRate)).toFixed(2);
      return `
        <tr>
          <td><strong>${l.id}</strong><br/><span class="sub-small">매수 $${l.price.toFixed(2)}</span></td>
          <td class="sell-price-cell">$${sellTarget.toFixed(2)}</td>
          <td><span class="qty-badge">${l.qty}주</span></td>
          <td><button type="button" class="btn-sell-done" onclick="completeSell('${l.id}')">익절완료</button></td>
        </tr>
      `;
    }).join("");
  }

  // 2. Update Lot Cards in Tab 2
  const totalShares = activeLots.reduce((acc, l) => acc + l.qty, 0);
  const totalCost = activeLots.reduce((acc, l) => acc + (l.price * l.qty), 0);
  document.getElementById("statActiveLots").textContent = `총 ${totalShares}주 · ${activeLots.length}개 묶음 ($${totalCost.toFixed(2)})`;

  const listEl = document.getElementById("activeLotsList");
  if (activeLots.length === 0) {
    listEl.innerHTML = `<p class="empty-msg">보유 중인 활성 묶음이 없습니다.</p>`;
  } else {
    listEl.innerHTML = activeLots.map(l => {
      const sellTarget = +(l.price * (1 + tRate)).toFixed(2);
      const lotPrincipal = +(l.price * l.qty).toFixed(2);
      const expProfit = +((sellTarget - l.price) * l.qty).toFixed(2);
      return `
        <div class="lot-card">
          <div class="lot-top">
            <span class="lot-id">${l.id}</span>
            <span class="lot-date">${l.date} 체결 · 투자원금 $${lotPrincipal.toFixed(2)}</span>
          </div>
          <div class="lot-grid">
            <div class="lot-metric">
              <span>매수단가</span>
              <strong>$${l.price.toFixed(2)}</strong>
            </div>
            <div class="lot-metric">
              <span>보유수량</span>
              <strong>${l.qty}주</strong>
            </div>
            <div class="lot-metric">
              <span>목표 LOC매도</span>
              <strong style="color:#dc2626;">$${sellTarget.toFixed(2)}</strong>
            </div>
          </div>
          <div class="lot-actions">
            <span class="profit-tag">목표 익절금: +$${expProfit.toFixed(2)} (+${state.targetPct}%)</span>
            <button type="button" class="btn-sell-done" onclick="completeSell('${l.id}')">매도(익절) 처리</button>
          </div>
        </div>
      `;
    }).join("");
  }

  // 3. Update Sold History in Tab 2
  document.getElementById("soldCountLabel").textContent = `${soldLots.length}건 완료`;
  const soldEl = document.getElementById("soldLotsList");
  if (soldLots.length === 0) {
    soldEl.innerHTML = `<p class="empty-msg">아직 익절 완료된 묶음이 없습니다.</p>`;
  } else {
    soldEl.innerHTML = soldLots.slice().reverse().map(l => `
      <div class="sold-row">
        <div>
          <strong>${l.id}</strong> (${l.qty}주)<br/>
          <span class="sub-small">$${l.price.toFixed(2)} → $${(l.sellPrice || 0).toFixed(2)} (${l.sellDate || ""})</span>
        </div>
        <strong style="color:#0f766e;">+$${(l.profit || 0).toFixed(2)}</strong>
      </div>
    `).join("");
  }
}

function toggleAddForm() {
  const f = document.getElementById("addLotForm");
  f.style.display = f.style.display === "none" || f.style.display === "" ? "block" : "none";
}

function addManualLot() {
  const p = parseFloat(document.getElementById("manualPrice").value);
  const q = parseInt(document.getElementById("manualQty").value, 10);
  if (isNaN(p) || p <= 0 || isNaN(q) || q <= 0) {
    alert("단가와 수량을 정확히 입력해 주세요.");
    return;
  }
  const lotId = "LP-" + String(state.nextLotNum).padStart(2, "0");
  state.nextLotNum += 1;
  state.lots.push({
    id: lotId,
    date: new Date().toISOString().slice(0, 10),
    price: p,
    qty: q,
    status: "active"
  });
  saveState();
  updateDashboard();
  renderLots();
  document.getElementById("manualPrice").value = "";
  document.getElementById("manualQty").value = "";
  toggleAddForm();
}

function saveSettings() {
  state.seed = parseFloat(document.getElementById("setSeed").value) || 10000;
  state.targetPct = parseFloat(document.getElementById("setTargetPct").value) || 2.5;
  state.milBudget = parseFloat(document.getElementById("setMilBudget").value) || 450;
  state.seolBudget = parseFloat(document.getElementById("setSeolBudget").value) || 900;
  saveState();
  updateDashboard();
  updateTideUI();
  recalcOrders();
  renderLots();
  alert("설정이 저장되었습니다.");
}

function exportBackup() {
  const dataStr = JSON.stringify(state);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(dataStr).then(() => {
      alert("현재 장부 데이터가 클립보드에 복사되었습니다. 메모장에 붙여넣어 보관하세요.");
    });
  } else {
    prompt("아래 데이터를 복사해 보관하세요:", dataStr);
  }
}

function importBackup() {
  const raw = prompt("백업해 둔 JSON 데이터를 붙여넣으세요:");
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.lots)) {
      state = Object.assign({}, defaultState, parsed);
      saveState();
      init();
      alert("데이터 복원이 완료되었습니다!");
    } else {
      alert("유효하지 않은 백업 데이터 형식입니다.");
    }
  } catch (e) {
    alert("데이터 형식이 올바르지 않습니다.");
  }
}

function resetAllData() {
  if (confirm("모든 체결 기록을 초기화하고 초기 상태(LP-01 18주 @ $48.87)로 되돌릴까요?")) {
    localStorage.removeItem(STORAGE_KEY);
    state = JSON.parse(JSON.stringify(defaultState));
    init();
    alert("초기화되었습니다.");
  }
}

init();
