const STORAGE_KEY = "soxl_infinite_buy_v1";

const els = {
  seed: document.getElementById("seedInput"),
  rounds: document.getElementById("roundsInput"),
  targetPct: document.getElementById("targetPctInput"),
  price: document.getElementById("priceInput"),
  perBuyAmt: document.getElementById("perBuyAmt"),
  estShares: document.getElementById("estShares"),
  avgPrice: document.getElementById("avgPrice"),
  targetPrice: document.getElementById("targetPrice"),
  totalShares: document.getElementById("totalShares"),
  totalInvested: document.getElementById("totalInvested"),
  pnlText: document.getElementById("pnlText"),
  tradeForm: document.getElementById("tradeForm"),
  tradeType: document.getElementById("tradeType"),
  tradePrice: document.getElementById("tradePrice"),
  tradeQty: document.getElementById("tradeQty"),
  tradeList: document.getElementById("tradeList"),
  resetTradesBtn: document.getElementById("resetTradesBtn"),
  saveBadge: document.getElementById("saveBadge"),
};

let state = loadState();
syncInputsFromState();
recalculateAndRender();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        seed: 10000,
        rounds: 40,
        targetPct: 10,
        currentPrice: 0,
        trades: [],
      };
    }
    return JSON.parse(raw);
  } catch {
    return { seed: 10000, rounds: 40, targetPct: 10, currentPrice: 0, trades: [] };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    els.saveBadge.textContent = "저장됨";
  } catch {
    els.saveBadge.textContent = "저장 오류";
  }
}

function syncInputsFromState() {
  els.seed.value = state.seed || 10000;
  els.rounds.value = state.rounds || 40;
  els.targetPct.value = state.targetPct ?? 10;
  els.price.value = state.currentPrice > 0 ? state.currentPrice : "";
}

function computePortfolio(trades) {
  let shares = 0;
  let costBasis = 0;

  const chronological = [...trades].reverse();
  for (const t of chronological) {
    if (t.type === "BUY") {
      shares += t.qty;
      costBasis += t.price * t.qty;
    } else if (t.type === "SELL" && shares > 0) {
      const avg = costBasis / shares;
      const sellQty = Math.min(t.qty, shares);
      shares -= sellQty;
      costBasis = Math.max(0, costBasis - avg * sellQty);
    }
  }

  const avgPrice = shares > 0 ? costBasis / shares : 0;
  return { shares, costBasis, avgPrice };
}

function recalculateAndRender() {
  const seed = Math.max(0, Number(els.seed.value) || 0);
  const rounds = Math.max(1, Number(els.rounds.value) || 40);
  const targetPct = Number(els.targetPct.value) || 0;
  const curPrice = Math.max(0, Number(els.price.value) || 0);

  state.seed = seed;
  state.rounds = rounds;
  state.targetPct = targetPct;
  state.currentPrice = curPrice;
  saveState();

  const perBuy = seed / rounds;
  const estQty = curPrice > 0 ? perBuy / curPrice : 0;

  const { shares, costBasis, avgPrice } = computePortfolio(state.trades);
  const targetSellPrice = avgPrice > 0 ? avgPrice * (1 + targetPct / 100) : 0;

  const refPrice = curPrice > 0 ? curPrice : avgPrice;
  const marketVal = shares * refPrice;
  const pnl = marketVal - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

  els.perBuyAmt.textContent = `$${perBuy.toFixed(2)}`;
  els.estShares.textContent = curPrice > 0 ? `${estQty.toFixed(2)}주` : "0.00주";
  els.avgPrice.textContent = avgPrice > 0 ? `$${avgPrice.toFixed(2)}` : "$0.00";
  els.targetPrice.textContent = targetSellPrice > 0 ? `$${targetSellPrice.toFixed(2)}` : "$0.00";

  els.totalShares.textContent = shares.toFixed(2);
  els.totalInvested.textContent = `$${costBasis.toFixed(2)}`;

  const sign = pnl > 0 ? "+" : "";
  els.pnlText.textContent = `${sign}$${pnl.toFixed(2)} (${sign}${pnlPct.toFixed(1)}%)`;
  els.pnlText.className = pnl > 0 ? "pos" : pnl < 0 ? "neg" : "";

  renderTrades();
}

function renderTrades() {
  els.tradeList.innerHTML = "";
  if (!state.trades.length) {
    const p = document.createElement("p");
    p.className = "empty-msg";
    p.textContent = "아직 체결 기록이 없습니다.";
    els.tradeList.appendChild(p);
    return;
  }

  state.trades.forEach((t, index) => {
    const li = document.createElement("li");
    li.className = "trade-item";

    const left = document.createElement("div");
    const tag = document.createElement("span");
    tag.className = `trade-tag ${t.type === "BUY" ? "tag-buy" : "tag-sell"}`;
    tag.textContent = t.type === "BUY" ? "매수" : "매도";

    const info = document.createElement("span");
    const amt = (t.price * t.qty).toFixed(2);
    info.textContent = `$${t.price.toFixed(2)} × ${t.qty}주 ($${amt})`;

    left.appendChild(tag);
    left.appendChild(info);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "del-btn";
    delBtn.textContent = "삭제";
    delBtn.addEventListener("click", () => {
      state.trades.splice(index, 1);
      recalculateAndRender();
    });

    li.appendChild(left);
    li.appendChild(delBtn);
    els.tradeList.appendChild(li);
  });
}

[els.seed, els.rounds, els.targetPct, els.price].forEach((input) => {
  input.addEventListener("input", recalculateAndRender);
});

els.tradeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const type = els.tradeType.value;
  const price = Number(els.tradePrice.value);
  const qty = Number(els.tradeQty.value);
  if (!(price > 0) || !(qty > 0)) return;

  state.trades.unshift({ type, price, qty, ts: Date.now() });
  els.tradePrice.value = "";
  els.tradeQty.value = "";
  recalculateAndRender();
});

els.resetTradesBtn.addEventListener("click", () => {
  if (!state.trades.length) return;
  state.trades = [];
  recalculateAndRender();
});
