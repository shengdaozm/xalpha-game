// ==================== 全局状态 ====================
const state = {
  mode: 'daily',         // 'daily' | 'strategy'
  fundData: [],          // 当前基金的历史数据
  fundList: [],          // 基金列表
  currentFund: null,     // 当前选中基金
  initialCash: 10000,
  cash: 10000,
  shares: 0,
  totalCost: 0,          // 持仓总成本
  avgCost: 0,            // 持仓均价
  currentIndex: 0,       // 当前推进到的数据索引
  startDateIndex: 0,
  endDateIndex: 0,
  trades: [],            // 交易记录
  assetHistory: [],      // 每日总资产
  benchmarkHistory: [],  // 基准（持有不动）资产
  dates: [],             // 日期标签
  pendingAction: null,   // 'buy' | 'sell' | null
  chart: null,
  resultChart: null,
  maxAsset: 10000,       // 用于计算最大回撤
  gameEnded: false,
};

// ==================== 工具函数 ====================
function fmtMoney(v) {
  return '¥' + Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v) {
  const sign = v >= 0 ? '+' : '';
  return sign + v.toFixed(2) + '%';
}

function pctColor(v) {
  if (v > 0) return 'text-rise';
  if (v < 0) return 'text-fall';
  return 'text-gray-500';
}

function pctHtmlColor(v) {
  if (v > 0) return '#16a34a';
  if (v < 0) return '#dc2626';
  return '#6b7280';
}

// ==================== 初始化 ====================
async function init() {
  try {
    const res = await fetch('config/fund_list.json');
    state.fundList = await res.json();
  } catch (e) {
    console.error('加载基金列表失败', e);
    return;
  }

  const fundSelect = document.getElementById('fundSelect');
  state.fundList.forEach(fund => {
    const opt = document.createElement('option');
    opt.value = fund.code;
    opt.textContent = `${fund.code} ${fund.name}`;
    fundSelect.appendChild(opt);
  });

  fundSelect.addEventListener('change', () => loadFundDateRange(fundSelect.value));

  // 默认加载第一只基金
  if (state.fundList.length > 0) {
    fundSelect.value = state.fundList[0].code;
    loadFundDateRange(state.fundList[0].code);
  }

  bindEvents();
}

async function loadFundDateRange(code) {
  try {
    const res = await fetch(`data/${code}.json`);
    if (!res.ok) throw new Error('数据文件不存在');
    state.fundData = await res.json();
  } catch (e) {
    console.error('加载基金数据失败', e);
    state.fundData = [];
  }

  if (state.fundData.length === 0) return;

  const firstDate = state.fundData[0].date;
  const lastDate = state.fundData[state.fundData.length - 1].date;

  // 默认取最近一年
  const lastIdx = state.fundData.length - 1;
  const startIdx = Math.max(0, lastIdx - 243);

  document.getElementById('startDate').value = state.fundData[startIdx].date;
  document.getElementById('startDate').min = firstDate;
  document.getElementById('startDate').max = lastDate;
  document.getElementById('endDate').value = lastDate;
  document.getElementById('endDate').min = firstDate;
  document.getElementById('endDate').max = lastDate;
}

// ==================== 事件绑定 ====================
function bindEvents() {
  // 模式切换
  document.getElementById('modeDailyBtn').addEventListener('click', () => switchMode('daily'));
  document.getElementById('modeStrategyBtn').addEventListener('click', () => switchMode('strategy'));

  // 规则弹窗
  document.getElementById('rulesBtn').addEventListener('click', () => {
    document.getElementById('rulesModal').classList.remove('hidden');
  });
  document.getElementById('closeRulesBtn').addEventListener('click', () => {
    document.getElementById('rulesModal').classList.add('hidden');
  });

  // 策略滑块
  ['risePct', 'sellRatio', 'dropPct', 'buyRatio'].forEach(id => {
    const slider = document.getElementById(id);
    const valSpan = document.getElementById(id + 'Val');
    slider.addEventListener('input', () => {
      valSpan.textContent = slider.value;
    });
  });

  // 开始游戏
  document.getElementById('startBtn').addEventListener('click', startGame);

  // 每日操作
  document.getElementById('buyBtn').addEventListener('click', () => showTradePanel('buy'));
  document.getElementById('sellBtn').addEventListener('click', () => showTradePanel('sell'));
  document.getElementById('holdBtn').addEventListener('click', () => {
    hideTradePanel();
    proceedNextDay();
  });
  document.getElementById('confirmTradeBtn').addEventListener('click', confirmTrade);
  document.getElementById('cancelTradeBtn').addEventListener('click', hideTradePanel);
  document.getElementById('nextDayBtn').addEventListener('click', proceedNextDay);

  // 策略回测
  document.getElementById('runBacktestBtn').addEventListener('click', runStrategyBacktest);

  // 重置/再玩
  document.getElementById('resetBtn').addEventListener('click', resetGame);
  document.getElementById('playAgainBtn').addEventListener('click', resetGame);
  document.getElementById('shareBtn').addEventListener('click', shareResult);
}

function switchMode(mode) {
  state.mode = mode;
  const dailyBtn = document.getElementById('modeDailyBtn');
  const strategyBtn = document.getElementById('modeStrategyBtn');
  const strategyConfig = document.getElementById('strategyConfig');

  if (mode === 'daily') {
    dailyBtn.classList.add('bg-white', 'text-primary');
    dailyBtn.classList.remove('text-blue-100');
    strategyBtn.classList.remove('bg-white', 'text-primary');
    strategyBtn.classList.add('text-blue-100');
    strategyConfig.classList.add('hidden');
  } else {
    strategyBtn.classList.add('bg-white', 'text-primary');
    strategyBtn.classList.remove('text-blue-100');
    dailyBtn.classList.remove('bg-white', 'text-primary');
    dailyBtn.classList.add('text-blue-100');
    strategyConfig.classList.remove('hidden');
  }
}

// ==================== 开始游戏 ====================
function startGame() {
  const code = document.getElementById('fundSelect').value;
  const fund = state.fundList.find(f => f.code === code);
  if (!fund) return;

  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const initialCash = parseFloat(document.getElementById('initialCash').value);

  if (!startDate || !endDate) {
    alert('请选择时间区间');
    return;
  }
  if (initialCash < 100) {
    alert('初始本金至少 100 元');
    return;
  }

  // 找到日期范围对应的索引
  const startIdx = state.fundData.findIndex(d => d.date >= startDate);
  const endIdx = state.fundData.findIndex(d => d.date > endDate);
  if (startIdx === -1 || (endIdx === -1 && state.fundData[state.fundData.length - 1].date < endDate)) {
    alert('选择的日期范围无效');
    return;
  }

  state.currentFund = fund;
  state.initialCash = initialCash;
  state.cash = initialCash;
  state.shares = 0;
  state.totalCost = 0;
  state.avgCost = 0;
  state.currentIndex = startIdx;
  state.startDateIndex = startIdx;
  state.endDateIndex = endIdx === -1 ? state.fundData.length - 1 : endIdx - 1;
  state.trades = [];
  state.assetHistory = [];
  state.benchmarkHistory = [];
  state.dates = [];
  state.maxAsset = initialCash;
  state.gameEnded = false;
  state.pendingAction = null;

  document.getElementById('gameFundName').textContent = `${fund.code} ${fund.name}`;

  // 显示游戏面板
  document.getElementById('setupPanel').classList.add('hidden');
  document.getElementById('gamePanel').classList.remove('hidden');
  document.getElementById('resultPanel').classList.add('hidden');

  if (state.mode === 'daily') {
    document.getElementById('dailyActions').classList.remove('hidden');
    document.getElementById('strategyActions').classList.add('hidden');
    initChart();
    updateDailyView();
  } else {
    document.getElementById('dailyActions').classList.add('hidden');
    document.getElementById('strategyActions').classList.remove('hidden');
    initChart();
    updateHoldingsDisplay();
    document.getElementById('currentDate').textContent = '待回测';
    document.getElementById('gameProgress').textContent = '--';
    document.getElementById('yesterdayChange').textContent = '--';
    document.getElementById('yesterdayNet').textContent = '--';
    document.getElementById('currentNet').textContent = '--';
  }
}

// ==================== 每日操作模式 ====================
function updateDailyView() {
  const idx = state.currentIndex;
  const data = state.fundData;

  if (idx > state.startDateIndex) {
    const prev = data[idx - 1];
    document.getElementById('yesterdayChange').textContent = fmtPct(prev.change_pct);
    document.getElementById('yesterdayChange').className = 'font-bold ' + pctColor(prev.change_pct);
    document.getElementById('yesterdayNet').textContent = prev.net.toFixed(4);
  } else {
    document.getElementById('yesterdayChange').textContent = '--';
    document.getElementById('yesterdayChange').className = 'font-bold text-gray-400';
    document.getElementById('yesterdayNet').textContent = '--';
  }

  // 当前净值（未揭示）
  document.getElementById('currentNet').textContent = '?';

  const progress = `${idx - state.startDateIndex + 1} / ${state.endDateIndex - state.startDateIndex + 1}`;
  document.getElementById('currentDate').textContent = data[idx].date;
  document.getElementById('gameProgress').textContent = progress;

  updateHoldingsDisplay();
}

function showTradePanel(action) {
  state.pendingAction = action;
  const panel = document.getElementById('tradePanel');
  const label = document.getElementById('tradeLabel');
  const amountInput = document.getElementById('tradeAmount');

  panel.classList.remove('hidden');
  document.getElementById('nextDayBtn').classList.add('hidden');
  document.getElementById('buyBtn').classList.add('opacity-50');
  document.getElementById('sellBtn').classList.add('opacity-50');

  if (action === 'buy') {
    label.textContent = '买入金额';
    amountInput.placeholder = `最多 ${state.cash.toFixed(2)}`;
    amountInput.value = '';
  } else {
    label.textContent = '卖出份额';
    amountInput.placeholder = `最多 ${state.shares.toFixed(2)}`;
    amountInput.value = '';
  }
  amountInput.focus();
}

function hideTradePanel() {
  state.pendingAction = null;
  document.getElementById('tradePanel').classList.add('hidden');
  document.getElementById('buyBtn').classList.remove('opacity-50');
  document.getElementById('sellBtn').classList.remove('opacity-50');
}

function confirmTrade() {
  const amountStr = document.getElementById('tradeAmount').value;
  const unit = document.getElementById('tradeUnit').value;
  const amount = parseFloat(amountStr);

  if (isNaN(amount) || amount <= 0) {
    alert('请输入有效数值');
    return;
  }

  const idx = state.currentIndex;
  const today = state.fundData[idx];
  const net = today.net;

  if (state.pendingAction === 'buy') {
    let buyAmount;
    if (unit === 'percent') {
      buyAmount = state.cash * amount / 100;
    } else {
      buyAmount = amount;
    }
    if (buyAmount > state.cash) {
      alert('现金不足');
      return;
    }
    const buyShares = buyAmount / net;
    state.cash -= buyAmount;
    state.totalCost += buyAmount;
    state.shares += buyShares;
    state.avgCost = state.shares > 0 ? state.totalCost / state.shares : 0;
    state.trades.push({
      date: today.date,
      type: 'buy',
      amount: buyAmount,
      shares: buyShares,
      net: net,
      avgCost: state.avgCost,
    });
  } else if (state.pendingAction === 'sell') {
    let sellShares;
    if (unit === 'percent') {
      sellShares = state.shares * amount / 100;
    } else {
      sellShares = amount;
    }
    if (sellShares > state.shares) {
      alert('份额不足');
      return;
    }
    const sellAmount = sellShares * net;
    state.cash += sellAmount;
    state.totalCost -= sellShares * state.avgCost;
    state.shares -= sellShares;
    state.avgCost = state.shares > 0 ? state.totalCost / state.shares : 0;
    state.trades.push({
      date: today.date,
      type: 'sell',
      amount: sellAmount,
      shares: sellShares,
      net: net,
      avgCost: state.avgCost,
    });
  }

  hideTradePanel();
  updateHoldingsDisplay();
  updateTradeLog();
  document.getElementById('nextDayBtn').classList.remove('hidden');
}

function proceedNextDay() {
  hideTradePanel();
  document.getElementById('nextDayBtn').classList.add('hidden');

  const idx = state.currentIndex;
  const today = state.fundData[idx];

  // 揭示今日净值
  const asset = state.cash + state.shares * today.net;
  state.assetHistory.push(asset);
  state.benchmarkHistory.push(state.initialCash);
  state.dates.push(today.date);

  if (asset > state.maxAsset) {
    state.maxAsset = asset;
  }

  // 显示今日结果
  const reveal = document.getElementById('todayReveal');
  reveal.classList.remove('hidden');
  const changeEl = document.getElementById('todayChangeDisplay');
  const netEl = document.getElementById('todayNetDisplay');
  changeEl.textContent = fmtPct(today.change_pct);
  changeEl.style.color = pctHtmlColor(today.change_pct);
  netEl.textContent = `净值: ${today.net.toFixed(4)}`;

  updateChart();
  updateHoldingsDisplay();
  updateTradeLog();

  // 前进到下一天
  state.currentIndex++;

  if (state.currentIndex > state.endDateIndex) {
    endGame();
    return;
  }

  // 短暂延迟后更新视图
  setTimeout(() => {
    updateDailyView();
  }, 100);
}

// ==================== 策略回测模式 ====================
function runStrategyBacktest() {
  const risePct = parseFloat(document.getElementById('risePct').value);
  const sellRatio = parseFloat(document.getElementById('sellRatio').value) / 100;
  const dropPct = parseFloat(document.getElementById('dropPct').value);
  const buyRatio = parseFloat(document.getElementById('buyRatio').value) / 100;

  const strategy = { risePct, sellRatio, dropPct, buyRatio };

  let cash = state.initialCash;
  let shares = 0;
  let totalCost = 0;
  let avgCost = 0;
  const history = [];
  const dates = [];
  const trades = [];

  const data = state.fundData;

  for (let i = state.startDateIndex; i <= state.endDateIndex; i++) {
    const today = data[i];

    if (i > state.startDateIndex) {
      const prev = data[i - 1];

      // 昨日跌幅 >= 阈值 → 买入
      if (prev.change_pct <= -strategy.dropPct && cash > 0) {
        const buyCash = cash * strategy.buyRatio;
        const buyShares = buyCash / today.net;
        totalCost += buyCash;
        shares += buyShares;
        avgCost = shares > 0 ? totalCost / shares : 0;
        cash -= buyCash;
        trades.push({
          date: today.date,
          type: 'buy',
          amount: buyCash,
          shares: buyShares,
          net: today.net,
          avgCost: avgCost,
        });
      }

      // 昨日涨幅 >= 阈值 → 卖出
      if (prev.change_pct >= strategy.risePct && shares > 0) {
        const sellShares = shares * strategy.sellRatio;
        const sellAmount = sellShares * today.net;
        totalCost -= sellShares * avgCost;
        shares -= sellShares;
        avgCost = shares > 0 ? totalCost / shares : 0;
        cash += sellAmount;
        trades.push({
          date: today.date,
          type: 'sell',
          amount: sellAmount,
          shares: sellShares,
          net: today.net,
          avgCost: avgCost,
        });
      }
    }

    const asset = cash + shares * today.net;
    history.push(asset);
    dates.push(today.date);
  }

  state.cash = cash;
  state.shares = shares;
  state.totalCost = totalCost;
  state.avgCost = avgCost;
  state.trades = trades;
  state.assetHistory = history;
  state.benchmarkHistory = new Array(history.length).fill(state.initialCash);
  state.dates = dates;
  state.maxAsset = Math.max(...history);

  // 更新显示
  document.getElementById('currentDate').textContent = `${dates[0]} ~ ${dates[dates.length - 1]}`;
  document.getElementById('gameProgress').textContent = `${dates.length} 天`;
  document.getElementById('yesterdayChange').textContent = '--';
  document.getElementById('yesterdayNet').textContent = '--';
  document.getElementById('currentNet').textContent = data[state.endDateIndex].net.toFixed(4);

  updateChart();
  updateHoldingsDisplay();
  updateTradeLog();

  // 延迟后显示结果
  setTimeout(() => endGame(), 500);
}

// ==================== 更新显示 ====================
function updateHoldingsDisplay() {
  const idx = Math.min(state.currentIndex, state.endDateIndex);
  const net = state.fundData[idx] ? state.fundData[idx].net : 0;
  const marketValue = state.shares * net;
  const totalAsset = state.cash + marketValue;
  const profit = state.shares > 0 ? marketValue - state.totalCost : 0;
  const profitPct = state.totalCost > 0 ? (profit / state.totalCost * 100) : 0;

  document.getElementById('cashDisplay').textContent = fmtMoney(state.cash);
  document.getElementById('sharesDisplay').textContent = state.shares.toFixed(2);
  document.getElementById('avgCostDisplay').textContent = state.shares > 0 ? state.avgCost.toFixed(4) : '--';

  const profitEl = document.getElementById('profitDisplay');
  if (state.shares > 0) {
    const sign = profit >= 0 ? '+' : '';
    profitEl.textContent = `${sign}${fmtMoney(profit)} (${sign}${profitPct.toFixed(2)}%)`;
    profitEl.className = 'font-bold ' + pctColor(profit);
  } else {
    profitEl.textContent = '--';
    profitEl.className = 'font-bold text-gray-400';
  }

  document.getElementById('marketValueDisplay').textContent = fmtMoney(marketValue);
  document.getElementById('totalAssetDisplay').textContent = fmtMoney(totalAsset);
}

function updateTradeLog() {
  const log = document.getElementById('tradeLog');
  if (state.trades.length === 0) {
    log.innerHTML = '<div class="text-gray-400 text-center py-4">暂无交易记录</div>';
    return;
  }

  const recent = state.trades.slice(-20).reverse();
  log.innerHTML = recent.map(t => {
    const isBuy = t.type === 'buy';
    const color = isBuy ? 'text-rise' : 'text-fall';
    const action = isBuy ? '买入' : '卖出';
    const avgCostStr = t.avgCost > 0 ? `均价${t.avgCost.toFixed(4)}` : '';
    return `<div class="flex justify-between items-center py-1 px-2 hover:bg-gray-50 rounded">
      <span class="text-gray-400 text-xs">${t.date}</span>
      <span class="${color} font-medium text-xs">${action}</span>
      <span class="text-gray-500 text-xs">${isBuy ? fmtMoney(t.amount) : t.shares.toFixed(2) + '份'}</span>
      <span class="text-gray-400 text-xs">@${t.net.toFixed(4)}</span>
      <span class="text-gray-400 text-xs">${avgCostStr}</span>
    </div>`;
  }).join('');
}

// ==================== 图表 ====================
function initChart() {
  const ctx = document.getElementById('assetChart').getContext('2d');
  if (state.chart) {
    state.chart.destroy();
  }
  state.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: '总资产',
          data: [],
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 5,
        },
        {
          label: '基准',
          data: [],
          borderColor: '#9ca3af',
          borderWidth: 1.5,
          borderDash: [5, 5],
          fill: false,
          tension: 0,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 8, font: { size: 10 } },
        },
        y: {
          grid: { color: '#f3f4f6' },
          ticks: {
            font: { size: 10 },
            callback: v => '¥' + v.toLocaleString(),
          },
        },
      },
    },
  });
}

function updateChart() {
  if (!state.chart) return;
  state.chart.data.labels = state.dates;
  state.chart.data.datasets[0].data = state.assetHistory;
  state.chart.data.datasets[1].data = state.benchmarkHistory;
  state.chart.update('none');
}

// ==================== 游戏结束 ====================
function endGame() {
  state.gameEnded = true;

  const finalIdx = state.mode === 'strategy' ? state.endDateIndex : Math.min(state.currentIndex, state.endDateIndex);
  const finalNet = state.fundData[finalIdx].net;
  const finalAsset = state.cash + state.shares * finalNet;

  // 计算统计指标
  const totalReturn = (finalAsset - state.initialCash) / state.initialCash * 100;
  let maxDrawdown = 0;
  let peak = state.initialCash;
  for (const asset of state.assetHistory) {
    if (asset > peak) peak = asset;
    const dd = (peak - asset) / peak * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // 胜率：赚钱的交易占比
  let winCount = 0;
  for (let i = 1; i < state.assetHistory.length; i++) {
    if (state.assetHistory[i] > state.assetHistory[i - 1]) winCount++;
  }
  const winRate = state.assetHistory.length > 1 ? (winCount / (state.assetHistory.length - 1) * 100) : 0;

  // 填充结果面板
  document.getElementById('resultFundName').textContent = `${state.currentFund.code} ${state.currentFund.name}`;
  document.getElementById('resultInitialCash').textContent = fmtMoney(state.initialCash);
  document.getElementById('resultFinalAsset').textContent = fmtMoney(finalAsset);

  const returnEl = document.getElementById('resultReturnRate');
  returnEl.textContent = fmtPct(totalReturn);
  returnEl.style.color = pctHtmlColor(totalReturn);

  document.getElementById('resultMaxDrawdown').textContent = '-' + maxDrawdown.toFixed(2) + '%';
  document.getElementById('resultTradeCount').textContent = state.trades.length;
  document.getElementById('resultWinRate').textContent = winRate.toFixed(1) + '%';

  // 表情
  const emoji = totalReturn > 20 ? '🚀' : totalReturn > 0 ? '🎉' : totalReturn > -10 ? '😐' : '😭';
  document.getElementById('resultEmoji').textContent = emoji;

  // 结果图表
  if (state.resultChart) {
    state.resultChart.destroy();
  }
  const rctx = document.getElementById('resultChart').getContext('2d');
  state.resultChart = new Chart(rctx, {
    type: 'line',
    data: {
      labels: state.dates,
      datasets: [
        {
          label: '总资产',
          data: state.assetHistory,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
        },
        {
          label: '基准',
          data: state.benchmarkHistory,
          borderColor: '#9ca3af',
          borderWidth: 1.5,
          borderDash: [5, 5],
          fill: false,
          tension: 0,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
        y: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 10 }, callback: v => '¥' + v.toLocaleString() } },
      },
    },
  });

  // 切换面板
  document.getElementById('gamePanel').classList.add('hidden');
  document.getElementById('resultPanel').classList.remove('hidden');
}

// ==================== 重置 ====================
function resetGame() {
  state.cash = state.initialCash;
  state.shares = 0;
  state.totalCost = 0;
  state.avgCost = 0;
  state.trades = [];
  state.assetHistory = [];
  state.benchmarkHistory = [];
  state.dates = [];
  state.gameEnded = false;
  state.pendingAction = null;

  document.getElementById('setupPanel').classList.remove('hidden');
  document.getElementById('gamePanel').classList.add('hidden');
  document.getElementById('resultPanel').classList.add('hidden');
  document.getElementById('todayReveal').classList.add('hidden');
  document.getElementById('tradePanel').classList.add('hidden');
  document.getElementById('nextDayBtn').classList.add('hidden');
}

// ==================== 分享 ====================
function shareResult() {
  const finalAsset = state.cash + state.shares * state.fundData[state.endDateIndex].net;
  const totalReturn = ((finalAsset - state.initialCash) / state.initialCash * 100).toFixed(2);
  const text = `我在 FundSim Game 模拟投资了 ${state.currentFund.name}，最终收益 ${totalReturn > 0 ? '+' : ''}${totalReturn}%！来试试你能赚多少？`;

  if (navigator.share) {
    navigator.share({ title: 'FundSim Game 战绩', text });
  } else {
    navigator.clipboard.writeText(text).then(() => {
      alert('战绩已复制到剪贴板！');
    }).catch(() => {
      alert(text);
    });
  }
}

// ==================== 启动 ====================
init();
