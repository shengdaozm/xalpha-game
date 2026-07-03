基金历史行情模拟投资游戏・完整开发计划书
一、项目定位
项目名称
FundSim Game —— 基于历史净值的基金模拟投资小游戏
核心目标
利用基金成立以来真实每日涨跌幅 / 净值数据做回测型模拟投资
无需后端服务器，全程静态部署在 GitHub Pages
通过 GitHub Action 自动更新基金数据，用户提交 PR 可触发数据拉取
提供两种游玩模式：每日操作模式 + 策略投递模式
界面美观、操作简单，可直接分享链接供他人游玩
技术栈
前端：HTML + TailwindCSS + JavaScript + Chart.js（净值走势图）
数据脚本：Python（xalpha/akshare 拉取基金历史日涨跌幅）
自动化：GitHub Actions（定时 / PR 触发更新基金 JSON）
部署：GitHub Pages（纯静态，无数据库、无服务器）
数据格式：JSON（基金列表、每日净值、日涨跌幅）
二、需求与功能完整规划
1. 基金数据来源
基金列表从 config/fund_list.json 读取
数据包含：基金代码、名称、类型、成立时间、全量历史日线数据
单条日线结构：
json
{
  "date": "2023-01-01",
  "net": 1.2345,
  "change_pct": 1.23
}
2. 两种核心游戏模式
模式 A：每日操作模式（手动择时）
用户选择一只基金 + 游戏时间窗口（起始日期～结束日期）
输入初始本金（默认 10000）
游戏按日期逐天推进
每天只展示前一天的净值与涨跌幅
用户决策：
买入（投入多少金额）
卖出（卖出多少份额）
持有不动
当天结束后展示今日真实涨跌幅与账户变化
最终展示总收益率、最大回撤、交易次数
模式 B：策略投递模式（条件自动交易）
同样选择基金、时间窗口、初始金额
用户预设自动化策略规则：
单日涨幅 ≥ X% → 卖出 Y% 仓位
单日跌幅 ≤ -X% → 买入 Z% 现金
最大持仓上限 / 最低保留现金
系统按历史日期全自动回测执行
直接输出回测报告：收益曲线、交易记录、最终收益
3. 用户体验流程
进入页面 → 选择模式
选择基金 → 选择时间区间
设置本金 → 开始游戏
每日操作 / 策略执行
游戏结束 → 生成战绩卡片 + 收益图
可截图分享、重新开始
4. GitHub Action 自动化（关键）
触发条件：
每周自动执行一次
提交 PR 修改 fund_list.json 时触发
执行内容：
运行 Python 脚本拉取所有基金最新日涨跌幅
生成 / 更新 data/基金代码.json
提交回仓库
优点：数据永远最新，无需人工维护
三、界面设计（精美可直接实现）
主界面结构
顶部导航栏
项目名称 + 模式切换（每日操作 / 策略投递）
说明按钮（规则弹窗）
左侧控制面板（30%）
基金选择下拉框
日期范围选择器
初始金额输入框
开始 / 重置按钮
模式 B 专用策略配置面板：
涨幅触发卖出
跌幅触发买入
仓位比例滑块
右侧主展示区（70%）
净值 / 收益走势图（Chart.js）
当前日期、昨日涨跌幅、当前资产
操作按钮区（买 / 卖 / 持有）
持仓信息：现金、持仓份额、总资产
底部战绩面板
初始金额 / 当前资产
总收益率
最大回撤
交易次数
胜率
风格
简约金融风：深蓝 + 白色 + 绿色（涨）红色（跌）
卡片式布局，圆角、阴影
移动端适配
数据实时刷新，无刷新跳转
四、后台脚本（Python 完整可直接运行）
1. 拉取基金历史日涨跌幅脚本
scripts/fetch_fund_data.py
python
运行
import json
import os
import akshare as ak

# 读取配置
with open("config/fund_list.json", "r", encoding="utf-8") as f:
    fund_list = json.load(f)

# 保存目录
os.makedirs("data", exist_ok=True)

for fund in fund_list:
    code = fund["code"]
    name = fund["name"]
    print(f"正在拉取: {code} {name}")

    # 获取成立以来所有日涨跌幅
    df = ak.fund_open_fund_info_em(fund=code)
    # 只保留需要字段
    df = df.rename(columns={
        "净值日期": "date",
        "单位净值": "net",
        "日增长率": "change_pct"
    })[["date", "net", "change_pct"]]

    # 转为 JSON
    result = df.to_dict(orient="records")
    with open(f"data/{code}.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

print("所有基金数据更新完成！")
2. GitHub Action 配置
.github/workflows/update_fund_data.yml
yaml
name: Update Fund Data

on:
  push:
    paths:
      - config/fund_list.json
  pull_request:
    paths:
      - config/fund_list.json
  schedule:
    - cron: '0 2 * * 1'  # 每周一 2 点

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.10'
      - name: Install dependencies
        run: pip install akshare pandas
      - name: Run fetch script
        run: python scripts/fetch_fund_data.py
      - name: Commit and push
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add data/
          git diff --quiet && git diff --staged --quiet || git commit -m "Auto update fund data"
          git push
3. 配置文件
config/fund_list.json
json
[
  {"code": "005827", "name": "易方达蓝筹精选混合"},
  {"code": "161725", "name": "招商中证白酒指数"},
  {"code": "000001", "name": "华夏成长混合"}
]
五、核心策略逻辑（JS 前端实现）
1. 每日操作模式逻辑
按日期遍历历史数据
只展示前一天涨跌幅
用户操作影响现金与份额
当日净值变化后更新总资产
记录每一笔交易
2. 策略投递模式逻辑（自动回测）
示例策略模板：
js
运行
function runStrategy(data, strategy, initialCash) {
  let cash = initialCash;
  let shares = 0;
  let history = [];

  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const today = data[i];

    // 策略：昨日跌幅 >= 阈值 则买入
    if (prev.change_pct <= -strategy.dropPct) {
      const buyCash = cash * strategy.buyRatio;
      shares += buyCash / prev.net;
      cash -= buyCash;
    }

    // 策略：昨日涨幅 >= 阈值 则卖出
    if (prev.change_pct >= strategy.risePct) {
      const sellShares = shares * strategy.sellRatio;
      cash += sellShares * prev.net;
      shares -= sellShares;
    }

    // 今日净值变动
    const asset = cash + shares * today.net;
    history.push({ date: today.date, asset });
  }

  return { cash, shares, history };
}
六、项目目录结构（标准可直接建仓库）
plaintext
FundSim/
├── index.html              # 主页面
├── assets/
│   ├── app.js              # 游戏逻辑
│   ├── chart.js            # 图表
│   └── style.css           # 样式
├── config/
│   └── fund_list.json      # 基金列表
├── data/
│   ├── 005827.json
│   ├── 161725.json
│   └── 000001.json
├── scripts/
│   └── fetch_fund_data.py  # 数据拉取脚本
└── .github/workflows/update_fund_data.yml
七、开发计划合理性评估
✅ 合理，非常可行，且非常适合 GitHub Pages
纯静态：不需要服务器、数据库、域名
数据自动更新：Action 搞定，不用管
玩法清晰：两种模式覆盖手动与策略
可扩展：后续可加排行榜、多基金对比、定投模拟
分享友好：链接一发就能玩
开发难度低：AI 可直接写完所有代码
⚠️ 唯一限制
无用户账号系统（适合一次性体验，不适合长期存档）
数据是历史回测，不是实时交易（但对你的游戏目标完全足够）
八、你下一步我可以直接帮你生成
你回复我一句，我可以一次性全部输出完整代码：
精美的 HTML 界面（带 TailwindCSS，可直接用）
完整 JS 游戏逻辑（两种模式都实现）
Python 拉取数据脚本
GitHub Action 配置
示例基金数据 JSON
你只要：
新建 GitHub 仓库
上传文件
开启 Pages
就能直接上线游玩。
